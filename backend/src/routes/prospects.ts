import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, desc, asc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const prospects = await db.query.prospects.findMany({
      orderBy: (p, { desc }) => [desc(p.score)],
    });
    res.json(prospects);
  } catch (error) {
    console.error('Get prospects error:', error);
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const prospect = await db.query.prospects.findFirst({
      where: eq(schema.prospects.id, req.params.id),
    });
    if (!prospect) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(prospect);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prospect' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.insert(schema.prospects).values({
      id,
      ...req.body,
      createdAt: now,
      updatedAt: now,
    });
    const prospect = await db.query.prospects.findFirst({
      where: eq(schema.prospects.id, id),
    });
    res.status(201).json(prospect);
  } catch (error) {
    console.error('Create prospect error:', error);
    res.status(500).json({ error: 'Failed to create prospect' });
  }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await db.update(schema.prospects)
      .set({ ...req.body, updatedAt: new Date().toISOString() })
      .where(eq(schema.prospects.id, id));
    const prospect = await db.query.prospects.findFirst({
      where: eq(schema.prospects.id, id),
    });
    if (!prospect) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(prospect);
  } catch (error) {
    console.error('Update prospect error:', error);
    res.status(500).json({ error: 'Failed to update prospect' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await db.delete(schema.prospects).where(eq(schema.prospects.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete prospect' });
  }
});

export default router;
