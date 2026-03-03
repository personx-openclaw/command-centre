import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, like, or, sql, desc, asc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';
import { z } from 'zod';

const router = Router();

// All contact routes require auth
router.use(authMiddleware);

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'
];

const createContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  category: z.enum(['client', 'prospect', 'investor', 'mentor', 'accelerator', 'finance', 'personal', 'other']).default('other'),
  tags: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  warmth: z.enum(['hot', 'warm', 'cold', 'dormant']).default('warm'),
  nextFollowUpAt: z.string().optional(),
});

const updateContactSchema = createContactSchema.partial();

// GET /api/contacts - List all contacts with filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { search, category, warmth, tag } = req.query;

    let query = db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.userId, req.userId!));

    // Build WHERE conditions
    const conditions = [eq(schema.contacts.userId, req.userId!)];

    if (search && typeof search === 'string') {
      conditions.push(
        or(
          like(schema.contacts.firstName, `%${search}%`),
          like(schema.contacts.lastName, `%${search}%`),
          like(schema.contacts.company, `%${search}%`),
          like(schema.contacts.tags, `%${search}%`),
          like(schema.contacts.notes, `%${search}%`)
        )!
      );
    }

    if (category && typeof category === 'string') {
      const categories = category.split(',');
      conditions.push(sql`${schema.contacts.category} IN (${sql.join(categories.map(c => sql`${c}`), sql`, `)})`);
    }

    if (warmth && typeof warmth === 'string') {
      const warmthLevels = warmth.split(',');
      conditions.push(sql`${schema.contacts.warmth} IN (${sql.join(warmthLevels.map(w => sql`${w}`), sql`, `)})`);
    }

    if (tag && typeof tag === 'string') {
      conditions.push(like(schema.contacts.tags, `%${tag}%`));
    }

    const contacts = await db
      .select()
      .from(schema.contacts)
      .where(and(...conditions))
      .orderBy(desc(schema.contacts.lastInteractionAt));

    // Get unique categories and tags for filters
    const allContacts = await db
      .select({ category: schema.contacts.category, tags: schema.contacts.tags })
      .from(schema.contacts)
      .where(eq(schema.contacts.userId, req.userId!));

    const categories = [...new Set(allContacts.map(c => c.category))];
    const tagsSet = new Set<string>();
    allContacts.forEach(c => {
      if (c.tags) {
        try {
          const parsed = JSON.parse(c.tags);
          if (Array.isArray(parsed)) {
            parsed.forEach(t => tagsSet.add(t));
          }
        } catch {}
      }
    });

    res.json({
      contacts,
      total: contacts.length,
      filters: {
        categories,
        tags: Array.from(tagsSet),
        warmthLevels: ['hot', 'warm', 'cold', 'dormant']
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/contacts/:id - Get single contact with details
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.userId, req.userId!)
      )
    });

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    // Get recent interactions
    const recentInteractions = await db
      .select()
      .from(schema.interactions)
      .where(eq(schema.interactions.contactId, id))
      .orderBy(desc(schema.interactions.date))
      .limit(10);

    // Get deals
    const deals = await db
      .select()
      .from(schema.deals)
      .where(eq(schema.deals.contactId, id))
      .orderBy(desc(schema.deals.createdAt));

    // Count total interactions
    const interactionCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.interactions)
      .where(eq(schema.interactions.contactId, id));

    const interactionCount = interactionCountResult[0]?.count || 0;

    // Calculate days since last interaction
    let daysSinceLastInteraction = null;
    if (contact.lastInteractionAt) {
      const lastDate = new Date(contact.lastInteractionAt);
      const now = new Date();
      daysSinceLastInteraction = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    res.json({
      contact,
      recentInteractions,
      deals,
      interactionCount,
      daysSinceLastInteraction
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST /api/contacts - Create new contact
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createContactSchema.parse(req.body);

    const contactId = crypto.randomUUID();
    const now = new Date().toISOString();
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const [contact] = await db
      .insert(schema.contacts)
      .values({
        id: contactId,
        userId: req.userId!,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        role: data.role || null,
        category: data.category,
        tags: data.tags || null,
        linkedinUrl: data.linkedinUrl || null,
        notes: data.notes || null,
        warmth: data.warmth,
        lastInteractionAt: null,
        nextFollowUpAt: data.nextFollowUpAt || null,
        avatarColor,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PATCH /api/contacts/:id - Update contact
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateContactSchema.parse(req.body);

    const [contact] = await db
      .update(schema.contacts)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.userId, req.userId!)
      ))
      .returning();

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id - Delete contact (cascades to interactions and deals)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await db
      .delete(schema.contacts)
      .where(and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.userId, req.userId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
