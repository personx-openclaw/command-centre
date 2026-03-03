import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All stats routes require auth
router.use(authMiddleware);

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

    // Pipeline values (active deals only: not won or lost)
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

    // Get contacts with follow-up dates (overdue or upcoming in next 7 days)
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

    // Get last interaction for each contact
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

    // Sort by urgency
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

// GET /api/network/activity-heatmap - Interaction frequency heatmap (last 12 weeks)
router.get('/activity-heatmap', async (req: AuthRequest, res) => {
  try {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks
    const twelveWeeksAgoISO = twelveWeeksAgo.toISOString();

    // Get all interactions in the last 12 weeks
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

    // Group by date
    const dateMap = new Map<string, number>();
    interactions.forEach(interaction => {
      const date = interaction.date.split('T')[0]; // YYYY-MM-DD
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    // Generate array of last 84 days with counts
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

export default router;
