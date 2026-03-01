import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// All task routes require auth
router.use(authMiddleware);

// Get all tasks
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tasks = await db.query.tasks.findMany({
      where: eq(schema.tasks.userId, req.userId!),
      orderBy: (tasks, { asc }) => [asc(tasks.order)],
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

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Get max order for this status
    const maxOrderTask = await db.query.tasks.findFirst({
      where: and(
        eq(schema.tasks.userId, req.userId!),
        eq(schema.tasks.status, status || 'backlog')
      ),
      orderBy: (tasks, { desc }) => [desc(tasks.order)],
    });

    const order = (maxOrderTask?.order ?? -1) + 1;

    const [task] = await db
      .insert(schema.tasks)
      .values({
        id: taskId,
        userId: req.userId!,
        title,
        description: description || null,
        status: status || 'backlog',
        priority: priority || 'medium',
        order,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

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

    const [task] = await db
      .update(schema.tasks)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, req.userId!)))
      .returning();

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

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

    await db
      .delete(schema.tasks)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, req.userId!)));

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
