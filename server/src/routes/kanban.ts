import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';
import { z } from 'zod';

const router = Router();

// All kanban routes require auth
router.use(authMiddleware);

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['backlog', 'today', 'in_progress', 'done']).default('backlog'),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).default('medium'),
  tags: z.string().optional(),
  dueDate: z.string().optional(),
  source: z.enum(['manual', 'telegram', 'morning_report']).default('manual'),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['backlog', 'today', 'in_progress', 'done']).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  position: z.number().optional(),
  tags: z.string().optional(),
  dueDate: z.string().optional(),
  completedAt: z.string().optional(),
});

// Get all tasks
router.get('/tasks', async (req: AuthRequest, res) => {
  try {
    const tasks = await db.query.tasks.findMany({
      where: eq(schema.tasks.userId, req.userId!),
      orderBy: (tasks, { asc }) => [asc(tasks.position)],
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/tasks', async (req: AuthRequest, res) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Get max position for this status
    const maxPositionTask = await db.query.tasks.findFirst({
      where: and(
        eq(schema.tasks.userId, req.userId!),
        eq(schema.tasks.status, data.status)
      ),
      orderBy: (tasks, { desc }) => [desc(tasks.position)],
    });

    const position = (maxPositionTask?.position ?? 0) + 1;

    const [task] = await db
      .insert(schema.tasks)
      .values({
        id: taskId,
        userId: req.userId!,
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        position,
        tags: data.tags || null,
        dueDate: data.dueDate || null,
        completedAt: null,
        source: data.source,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.patch('/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateTaskSchema.parse(req.body);

    const updates: any = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Auto-set completedAt when moving to done
    if (data.status === 'done' && !data.completedAt) {
      updates.completedAt = new Date().toISOString();
    }
    // Clear completedAt when moving out of done
    if (data.status && data.status !== 'done') {
      updates.completedAt = null;
    }

    const [task] = await db
      .update(schema.tasks)
      .set(updates)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, req.userId!)))
      .returning();

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/tasks/:id', async (req: AuthRequest, res) => {
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

// Reorder tasks (batch position update)
router.post('/tasks/reorder', async (req: AuthRequest, res) => {
  try {
    const { tasks: taskUpdates } = req.body;

    if (!Array.isArray(taskUpdates)) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    // Update positions in transaction (better-sqlite3 is synchronous)
    for (const { id, position, status } of taskUpdates) {
      await db
        .update(schema.tasks)
        .set({ 
          position, 
          status,
          updatedAt: new Date().toISOString() 
        })
        .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, req.userId!)));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

export default router;
