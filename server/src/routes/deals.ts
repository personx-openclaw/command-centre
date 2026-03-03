import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';
import { z } from 'zod';

const router = Router();

// All deal routes require auth
router.use(authMiddleware);

const createDealSchema = z.object({
  contactId: z.string(),
  title: z.string().min(1),
  value: z.number().optional(),
  currency: z.string().default('GBP'),
  stage: z.enum(['lead', 'contacted', 'demo', 'poc', 'negotiation', 'won', 'lost']).default('lead'),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  position: z.string(),
});

const updateDealSchema = z.object({
  title: z.string().min(1).optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
  stage: z.enum(['lead', 'contacted', 'demo', 'poc', 'negotiation', 'won', 'lost']).optional(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  position: z.string().optional(),
});

const moveDealSchema = z.object({
  stage: z.enum(['lead', 'contacted', 'demo', 'poc', 'negotiation', 'won', 'lost']),
  position: z.string(),
});

// GET /api/deals - List all deals
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { stage } = req.query;

    let query = db
      .select({
        deal: schema.deals,
        contact: schema.contacts
      })
      .from(schema.deals)
      .leftJoin(schema.contacts, eq(schema.deals.contactId, schema.contacts.id))
      .where(eq(schema.deals.userId, req.userId!));

    if (stage && typeof stage === 'string') {
      const stages = stage.split(',');
      query = query.where(
        and(
          eq(schema.deals.userId, req.userId!),
          // @ts-ignore - Drizzle type issue with IN clause
          sql`${schema.deals.stage} IN (${stages.join(',')})`
        )
      ) as any;
    }

    const results = await query.orderBy(asc(schema.deals.position));

    // Transform results to include contact info in deal object
    const deals = results.map(r => ({
      ...r.deal,
      contact: r.contact
    }));

    res.json({ deals });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// POST /api/deals - Create new deal
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createDealSchema.parse(req.body);

    // Verify contact belongs to user
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(schema.contacts.id, data.contactId),
        eq(schema.contacts.userId, req.userId!)
      )
    });

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    const dealId = crypto.randomUUID();
    const now = new Date().toISOString();

    const [deal] = await db
      .insert(schema.deals)
      .values({
        id: dealId,
        userId: req.userId!,
        contactId: data.contactId,
        title: data.title,
        value: data.value || null,
        currency: data.currency,
        stage: data.stage,
        probability: data.probability || null,
        notes: data.notes || null,
        expectedCloseDate: data.expectedCloseDate || null,
        closedAt: null,
        position: data.position,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Create deal error:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// PATCH /api/deals/:id - Update deal
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateDealSchema.parse(req.body);

    const updates: any = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Auto-set closedAt when moving to won/lost
    if (data.stage === 'won' || data.stage === 'lost') {
      updates.closedAt = new Date().toISOString();
    }
    // Clear closedAt when moving back to active stages
    if (data.stage && !['won', 'lost'].includes(data.stage)) {
      updates.closedAt = null;
    }

    const [deal] = await db
      .update(schema.deals)
      .set(updates)
      .where(and(
        eq(schema.deals.id, id),
        eq(schema.deals.userId, req.userId!)
      ))
      .returning();

    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    res.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Update deal error:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// PATCH /api/deals/:id/move - Move deal (drag and drop)
router.patch('/:id/move', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { stage, position } = moveDealSchema.parse(req.body);

    const updates: any = {
      stage,
      position,
      updatedAt: new Date().toISOString(),
    };

    // Auto-set/clear closedAt
    if (stage === 'won' || stage === 'lost') {
      updates.closedAt = new Date().toISOString();
    } else {
      updates.closedAt = null;
    }

    const [deal] = await db
      .update(schema.deals)
      .set(updates)
      .where(and(
        eq(schema.deals.id, id),
        eq(schema.deals.userId, req.userId!)
      ))
      .returning();

    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    res.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Move deal error:', error);
    res.status(500).json({ error: 'Failed to move deal' });
  }
});

// DELETE /api/deals/:id - Delete deal
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await db
      .delete(schema.deals)
      .where(and(
        eq(schema.deals.id, id),
        eq(schema.deals.userId, req.userId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

export default router;
