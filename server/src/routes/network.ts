import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, lt, ne, sql, isNull, or } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// All network routes require auth
router.use(authMiddleware);

// GET /api/network/daily-prompt - Serendipity engine
router.get('/daily-prompt', async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if we already have a prompt for today
    const existingPrompt = await db.query.dailyPrompts.findFirst({
      where: eq(schema.dailyPrompts.date, today)
    });

    if (existingPrompt && !existingPrompt.dismissed) {
      // Return cached prompt with full contact details
      const reconnection = existingPrompt.reconnectionContactId
        ? await db.query.contacts.findFirst({
            where: eq(schema.contacts.id, existingPrompt.reconnectionContactId)
          })
        : null;

      const collision1 = existingPrompt.collisionContactId1
        ? await db.query.contacts.findFirst({
            where: eq(schema.contacts.id, existingPrompt.collisionContactId1)
          })
        : null;

      const collision2 = existingPrompt.collisionContactId2
        ? await db.query.contacts.findFirst({
            where: eq(schema.contacts.id, existingPrompt.collisionContactId2)
          })
        : null;

      return res.json({
        date: today,
        reconnection: reconnection ? {
          contact: reconnection,
          daysSinceLastContact: calculateDaysSince(reconnection.lastInteractionAt)
        } : null,
        collision: (collision1 && collision2) ? {
          contact1: collision1,
          contact2: collision2,
          sharedTags: existingPrompt.sharedTags ? JSON.parse(existingPrompt.sharedTags) : []
        } : null
      });
    }

    // Generate new prompt
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoISO = sixtyDaysAgo.toISOString();

    // Reconnection: contacts not contacted in 60+ days, weighted by warmth
    const reconnectionCandidates = await db
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.userId, req.userId!),
          ne(schema.contacts.warmth, 'dormant'),
          or(
            lt(schema.contacts.lastInteractionAt, sixtyDaysAgoISO),
            isNull(schema.contacts.lastInteractionAt)
          )
        )
      )
      .orderBy(schema.contacts.warmth, schema.contacts.lastInteractionAt);

    // Use date as seed for stable daily selection
    const dateSeed = parseInt(today.replace(/-/g, ''), 10);
    const reconnectionContact = reconnectionCandidates.length > 0
      ? reconnectionCandidates[dateSeed % reconnectionCandidates.length]
      : null;

    // Random collision: two contacts from different categories with shared tags
    const allContacts = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.userId, req.userId!));

    let collision1 = null;
    let collision2 = null;
    let sharedTags: string[] = [];

    if (allContacts.length >= 2) {
      // Group by category
      const byCategory = allContacts.reduce((acc, contact) => {
        if (!acc[contact.category]) acc[contact.category] = [];
        acc[contact.category].push(contact);
        return acc;
      }, {} as Record<string, typeof allContacts>);

      const categories = Object.keys(byCategory);
      
      if (categories.length >= 2) {
        // Pick two different categories using date seed
        const cat1Index = dateSeed % categories.length;
        const cat2Index = (dateSeed + 1) % categories.length;
        const cat1 = categories[cat1Index];
        const cat2 = categories[cat2Index];

        if (cat1 !== cat2) {
          const contacts1 = byCategory[cat1];
          const contacts2 = byCategory[cat2];

          // Pick one contact from each category
          collision1 = contacts1[dateSeed % contacts1.length];
          collision2 = contacts2[(dateSeed + 7) % contacts2.length];

          // Find shared tags
          const tags1 = collision1.tags ? JSON.parse(collision1.tags) : [];
          const tags2 = collision2.tags ? JSON.parse(collision2.tags) : [];
          sharedTags = tags1.filter((t: string) => tags2.includes(t));
        }
      }
    }

    // Cache the prompt
    const promptId = crypto.randomUUID();
    await db.insert(schema.dailyPrompts).values({
      id: promptId,
      date: today,
      reconnectionContactId: reconnectionContact?.id || null,
      collisionContactId1: collision1?.id || null,
      collisionContactId2: collision2?.id || null,
      sharedTags: sharedTags.length > 0 ? JSON.stringify(sharedTags) : null,
      dismissed: false,
      createdAt: new Date().toISOString()
    });

    res.json({
      date: today,
      reconnection: reconnectionContact ? {
        contact: reconnectionContact,
        daysSinceLastContact: calculateDaysSince(reconnectionContact.lastInteractionAt)
      } : null,
      collision: (collision1 && collision2) ? {
        contact1: collision1,
        contact2: collision2,
        sharedTags
      } : null
    });
  } catch (error) {
    console.error('Daily prompt error:', error);
    res.status(500).json({ error: 'Failed to generate daily prompt' });
  }
});

// POST /api/network/daily-prompt/dismiss - Dismiss today's prompt
router.post('/daily-prompt/dismiss', async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    await db
      .update(schema.dailyPrompts)
      .set({ dismissed: true })
      .where(eq(schema.dailyPrompts.date, today));

    res.json({ success: true });
  } catch (error) {
    console.error('Dismiss prompt error:', error);
    res.status(500).json({ error: 'Failed to dismiss prompt' });
  }
});

function calculateDaysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default router;
