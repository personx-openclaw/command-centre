import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

router.use(authMiddleware);

// Get all tasks
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const whereClause = userId === 'bot'
      ? undefined
      : eq(schema.tasks.userId, userId);

    const tasks = await db.query.tasks.findMany({
      where: whereClause,
      orderBy: (tasks, { asc }) => [asc(tasks.position)],
    });
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, description, status, priority } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }

    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();
    const position = String(Date.now());

    await db.insert(schema.tasks).values({
      id: taskId,
      userId: req.userId!,
      title,
      description: description || null,
      status: status || 'backlog',
      priority: priority || 'medium',
      position,
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

// Update task
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await db.update(schema.tasks)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(schema.tasks.id, id));

    const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, id) });
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Bot ingest endpoint
router.post('/ingest', async (req: AuthRequest, res) => {
  try {
    const { title, description, priority, tags, column, due_date } = req.body;
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

export default router;
