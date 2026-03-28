import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['backlog', 'today', 'in_progress', 'done'] })
    .notNull()
    .default('backlog'),
  priority: text('priority', { enum: ['urgent', 'high', 'medium', 'low'] })
    .notNull()
    .default('medium'),
  position: text('position').notNull(), // Fractional index as text
  tags: text('tags'),
  dueDate: text('due_date'),
  completedAt: text('completed_at'),
  source: text('source', { enum: ['manual', 'telegram', 'morning_report'] })
    .notNull()
    .default('manual'),
  agentEnabled: integer('agent_enabled', { mode: 'boolean' }).default(false),
  agentType: text('agent_type'),
  agentDescription: text('agent_description'),
  agentStatus: text('agent_status'),
  agentResult: text('agent_result'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Module 2: Networking CRM

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  role: text('role'),
  category: text('category', {
    enum: ['client', 'prospect', 'investor', 'mentor', 'accelerator', 'finance', 'personal', 'other']
  }).notNull().default('other'),
  tags: text('tags'),
  linkedinUrl: text('linkedin_url'),
  notes: text('notes'),
  warmth: text('warmth', { enum: ['hot', 'warm', 'cold', 'dormant'] })
    .notNull()
    .default('warm'),
  lastInteractionAt: text('last_interaction_at'),
  nextFollowUpAt: text('next_follow_up_at'),
  avatarColor: text('avatar_color'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const interactions = sqliteTable('interactions', {
  id: text('id').primaryKey(),
  contactId: text('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['meeting', 'call', 'email', 'linkedin', 'event', 'intro', 'note']
  }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  date: text('date').notNull(),
  sentiment: text('sentiment', { enum: ['positive', 'neutral', 'negative'] })
    .default('neutral'),
  followUpRequired: integer('follow_up_required', { mode: 'boolean' })
    .default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const deals = sqliteTable('deals', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contactId: text('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  value: real('value'),
  currency: text('currency').notNull().default('GBP'),
  stage: text('stage', {
    enum: ['lead', 'contacted', 'demo', 'poc', 'negotiation', 'won', 'lost']
  }).notNull().default('lead'),
  probability: integer('probability'),
  notes: text('notes'),
  expectedCloseDate: text('expected_close_date'),
  closedAt: text('closed_at'),
  position: text('position').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const dailyPrompts = sqliteTable('daily_prompts', {
  id: text('id').primaryKey(),
  date: text('date').notNull().unique(),
  reconnectionContactId: text('reconnection_contact_id')
    .references(() => contacts.id),
  collisionContactId1: text('collision_contact_id_1')
    .references(() => contacts.id),
  collisionContactId2: text('collision_contact_id_2')
    .references(() => contacts.id),
  sharedTags: text('shared_tags'),
  dismissed: integer('dismissed', { mode: 'boolean' }).default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const prospects = sqliteTable('prospects', {
  id: text('id').primaryKey(),
  firmName: text('firm_name').notNull(),
  firmAum: text('firm_aum'),
  firmCountry: text('firm_country').notNull().default('UK'),
  firmDataStack: text('firm_data_stack'),
  firmExternalDatasets: text('firm_external_datasets'),
  firmPainSignals: text('firm_pain_signals'),
  contactName: text('contact_name'),
  contactTitle: text('contact_title'),
  contactLinkedinUrl: text('contact_linkedin_url'),
  contactEmail: text('contact_email'),
  contactRecentActivity: text('contact_recent_activity'),
  contactBackground: text('contact_background'),
  score: integer('score').default(0),
  scoreBreakdown: text('score_breakdown'),
  status: text('status').notNull().default('identified'),
  linkedinDraft: text('linkedin_draft'),
  emailSubjectDraft: text('email_subject_draft'),
  emailBodyDraft: text('email_body_draft'),
  outreachSentAt: text('outreach_sent_at'),
  replyReceivedAt: text('reply_received_at'),
  replyNotes: text('reply_notes'),
  meetingBookedAt: text('meeting_booked_at'),
  notes: text('notes'),
  researchedAt: text('researched_at'),
  surfacedAt: text('surfaced_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
