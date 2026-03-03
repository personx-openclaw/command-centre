import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, lt, ne, sql, isNull, or, gte } from 'drizzle-orm';
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

// GET /api/network/stats - Network statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    // Total contacts
    const totalContactsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.contacts)
      .where(eq(schema.contacts.userId, req.userId!));
    
    const totalContacts = totalContactsResult[0]?.count || 0;

    // Interactions this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    const interactionsThisWeekResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.interactions)
      .innerJoin(schema.contacts, eq(schema.interactions.contactId, schema.contacts.id))
      .where(
        and(
          eq(schema.contacts.userId, req.userId!),
          gte(schema.interactions.date, weekAgoISO)
        )
      );

    const interactionsThisWeek = interactionsThisWeekResult[0]?.count || 0;

    // Overdue follow-ups
    const today = new Date().toISOString();
    
    const overdueFollowUpsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.userId, req.userId!),
          sql`${schema.contacts.nextFollowUpAt} < ${today}`
        )
      );

    const overdueFollowUps = overdueFollowUpsResult[0]?.count || 0;

    // Pipeline values (active deals only)
    const activeDeals = await db
      .select()
      .from(schema.deals)
      .where(
        and(
          eq(schema.deals.userId, req.userId!),
          sql`${schema.deals.stage} NOT IN ('won', 'lost')`
        )
      );

    let pipelineValue = 0;
    let weightedPipelineValue = 0;
    
    activeDeals.forEach(deal => {
      const value = deal.value || 0;
      const probability = deal.probability || 0;
      
      pipelineValue += value;
      weightedPipelineValue += (value * probability) / 100;
    });

    const activeDealsCount = activeDeals.length;

    // Warmth distribution
    const warmthDistribution = await db
      .select({
        warmth: schema.contacts.warmth,
        count: sql<number>`count(*)`
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.userId, req.userId!))
      .groupBy(schema.contacts.warmth);

    const warmthDist = {
      hot: 0,
      warm: 0,
      cold: 0,
      dormant: 0
    };

    warmthDistribution.forEach(row => {
      warmthDist[row.warmth as keyof typeof warmthDist] = row.count;
    });

    res.json({
      totalContacts,
      interactionsThisWeek,
      overdueFollowUps,
      pipelineValue: Math.round(pipelineValue),
      weightedPipelineValue: Math.round(weightedPipelineValue),
      activeDeals: activeDealsCount,
      warmthDistribution: warmthDist
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/network/follow-up-queue - Contacts needing follow-up
router.get('/follow-up-queue', async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekFromNowISO = weekFromNow.toISOString();

    const contacts = await db
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.userId, req.userId!),
          sql`${schema.contacts.nextFollowUpAt} IS NOT NULL`,
          sql`${schema.contacts.nextFollowUpAt} <= ${weekFromNowISO}`
        )
      )
      .orderBy(schema.contacts.nextFollowUpAt);

    const contactsWithInteractions = await Promise.all(
      contacts.map(async (contact) => {
        const lastInteraction = await db
          .select()
          .from(schema.interactions)
          .where(eq(schema.interactions.contactId, contact.id))
          .orderBy(sql`${schema.interactions.date} DESC`)
          .limit(1);

        const isOverdue = contact.nextFollowUpAt && contact.nextFollowUpAt < today;
        const isToday = contact.nextFollowUpAt && 
          contact.nextFollowUpAt.split('T')[0] === today.split('T')[0];

        return {
          contact,
          lastInteraction: lastInteraction[0] || null,
          urgency: isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming'
        };
      })
    );

    const sorted = contactsWithInteractions.sort((a, b) => {
      const urgencyOrder = { overdue: 0, today: 1, upcoming: 2 };
      return urgencyOrder[a.urgency as keyof typeof urgencyOrder] - 
             urgencyOrder[b.urgency as keyof typeof urgencyOrder];
    });

    res.json({ contacts: sorted });
  } catch (error) {
    console.error('Follow-up queue error:', error);
    res.status(500).json({ error: 'Failed to fetch follow-up queue' });
  }
});

// GET /api/network/activity-heatmap - Interaction frequency heatmap
router.get('/activity-heatmap', async (req: AuthRequest, res) => {
  try {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const twelveWeeksAgoISO = twelveWeeksAgo.toISOString();

    const interactions = await db
      .select({
        date: schema.interactions.date
      })
      .from(schema.interactions)
      .innerJoin(schema.contacts, eq(schema.interactions.contactId, schema.contacts.id))
      .where(
        and(
          eq(schema.contacts.userId, req.userId!),
          gte(schema.interactions.date, twelveWeeksAgoISO)
        )
      );

    const dateMap = new Map<string, number>();
    interactions.forEach(interaction => {
      const date = interaction.date.split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    const heatmapData = [];
    for (let i = 83; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = dateMap.get(dateStr) || 0;
      
      heatmapData.push({
        date: dateStr,
        count,
        level: count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3
      });
    }

    res.json({ heatmap: heatmapData });
  } catch (error) {
    console.error('Activity heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch activity heatmap' });
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
