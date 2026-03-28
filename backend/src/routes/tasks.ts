import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tasks = await db.query.tasks.findMany({
      orderBy: (tasks, { asc }) => [asc(tasks.position)],
    });
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, description, status, priority } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.tasks).values({
      id: taskId,
      userId: req.userId!,
      title,
      description: description || null,
      status: status || 'backlog',
      priority: priority || 'medium',
      position: String(Date.now()),
      createdAt: now,
      updatedAt: now,
    });
    const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) });
    res.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await db.update(schema.tasks)
      .set({ ...req.body, updatedAt: new Date().toISOString() })
      .where(eq(schema.tasks.id, id));
    const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, id) });
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await db.delete(schema.tasks).where(eq(schema.tasks.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

router.post('/ingest', async (req: AuthRequest, res) => {
  try {
    const { title, description, priority, tags, column, due_date, agentType, agentDescription } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }
    const user = await db.query.users.findFirst();
    if (!user) { res.status(500).json({ error: 'No user found' }); return; }
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.tasks).values({
      id: taskId,
      userId: user.id,
      title,
      description: description || '',
      status: (column || 'backlog') as 'backlog' | 'today' | 'in_progress' | 'done',
      priority: (priority || 'medium') as 'urgent' | 'high' | 'medium' | 'low',
      tags: JSON.stringify(tags || []),
      source: 'telegram' as const,
      position: String(Date.now()),
      agentType: agentType || null,
      agentDescription: agentDescription || description || null,
      dueDate: due_date || null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ id: taskId, title, column: column || 'backlog', priority: priority || 'medium' });
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest task' });
  }
});


// Agent status update endpoint
router.patch('/:id/agent', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { agentStatus, agentResult } = req.body;
    await db.update(schema.tasks)
      .set({ agentStatus, agentResult, updatedAt: new Date().toISOString() })
      .where(eq(schema.tasks.id, id));
    const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, id) });
    res.json(task);
  } catch (error) {
    console.error('Agent update error:', error);
    res.status(500).json({ error: 'Failed to update agent status' });
  }
});

export default router;
