import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';
import { z } from 'zod';

const router = Router();

// All interaction routes require auth
router.use(authMiddleware);

const createInteractionSchema = z.object({
  type: z.enum(['meeting', 'call', 'email', 'linkedin', 'event', 'intro', 'note']),
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string(), // ISO date
  sentiment: z.enum(['positive', 'neutral', 'negative']).default('neutral'),
  followUpRequired: z.boolean().default(false),
});

const updateInteractionSchema = createInteractionSchema.partial();

// GET /api/contacts/:contactId/interactions - List interactions for a contact
router.get('/contacts/:contactId/interactions', async (req: AuthRequest, res) => {
  try {
    const { contactId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify contact belongs to user
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(schema.contacts.id, contactId),
        eq(schema.contacts.userId, req.userId!)
      )
    });

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    const interactions = await db
      .select()
      .from(schema.interactions)
      .where(eq(schema.interactions.contactId, contactId))
      .orderBy(desc(schema.interactions.date))
      .limit(limit)
      .offset(offset);

    res.json({
      interactions,
      total: interactions.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get interactions error:', error);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  }
});

// POST /api/contacts/:contactId/interactions - Log new interaction
router.post('/contacts/:contactId/interactions', async (req: AuthRequest, res) => {
  try {
    const { contactId } = req.params;
    const data = createInteractionSchema.parse(req.body);

    // Verify contact belongs to user
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(schema.contacts.id, contactId),
        eq(schema.contacts.userId, req.userId!)
      )
    });

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    const interactionId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create the interaction
    const [interaction] = await db
      .insert(schema.interactions)
      .values({
        id: interactionId,
        contactId,
        type: data.type,
        title: data.title,
        description: data.description || null,
        date: data.date,
        sentiment: data.sentiment,
        followUpRequired: data.followUpRequired,
        createdAt: now,
      })
      .returning();

    // Update contact's lastInteractionAt
    await db
      .update(schema.contacts)
      .set({
        lastInteractionAt: data.date,
        updatedAt: now,
      })
      .where(eq(schema.contacts.id, contactId));

    res.json(interaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Create interaction error:', error);
    res.status(500).json({ error: 'Failed to create interaction' });
  }
});

// PATCH /api/interactions/:id - Update interaction
router.patch('/interactions/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateInteractionSchema.parse(req.body);

    // Get the interaction to verify ownership through contact
    const interaction = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, id),
      with: {
        contact: true
      }
    });

    if (!interaction) {
      res.status(404).json({ error: 'Interaction not found' });
      return;
    }

    // Verify contact belongs to user (using type assertion since Drizzle's with might not be typed)
    const contactId = interaction.contactId;
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(schema.contacts.id, contactId),
        eq(schema.contacts.userId, req.userId!)
      )
    });

    if (!contact) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const [updated] = await db
      .update(schema.interactions)
      .set(data)
      .where(eq(schema.interactions.id, id))
      .returning();

    // If date changed and this is the most recent interaction, update contact
    if (data.date) {
      const mostRecentInteraction = await db
        .select()
        .from(schema.interactions)
        .where(eq(schema.interactions.contactId, contactId))
        .orderBy(desc(schema.interactions.date))
        .limit(1);

      if (mostRecentInteraction[0]?.id === id) {
        await db
          .update(schema.contacts)
          .set({
            lastInteractionAt: data.date,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.contacts.id, contactId));
      }
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Update interaction error:', error);
    res.status(500).json({ error: 'Failed to update interaction' });
  }
});

// DELETE /api/interactions/:id - Delete interaction
router.delete('/interactions/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Get the interaction to verify ownership
    const interaction = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, id)
    });

    if (!interaction) {
      res.status(404).json({ error: 'Interaction not found' });
      return;
    }

    // Verify contact belongs to user
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(schema.contacts.id, interaction.contactId),
        eq(schema.contacts.userId, req.userId!)
      )
    });

    if (!contact) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const contactId = interaction.contactId;
    const wasLatest = contact.lastInteractionAt === interaction.date;

    // Delete the interaction
    await db
      .delete(schema.interactions)
      .where(eq(schema.interactions.id, id));

    // If we deleted the most recent interaction, update contact with new most recent
    if (wasLatest) {
      const newMostRecent = await db
        .select()
        .from(schema.interactions)
        .where(eq(schema.interactions.contactId, contactId))
        .orderBy(desc(schema.interactions.date))
        .limit(1);

      await db
        .update(schema.contacts)
        .set({
          lastInteractionAt: newMostRecent[0]?.date || null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.contacts.id, contactId));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete interaction error:', error);
    res.status(500).json({ error: 'Failed to delete interaction' });
  }
});

export default router;
