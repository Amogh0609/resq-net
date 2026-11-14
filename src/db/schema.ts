import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Operator'),
  role: text('role').notNull().default('citizen'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const negotiationRuns = pgTable('negotiation_runs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  profile: text('profile').notNull(),
  horizonH: integer('horizon_h').notNull(),
  baseCapacityMW: doublePrecision('base_capacity_mw').notNull(),
  fairnessWeight: doublePrecision('fairness_weight').notNull(),
  negotiatedDamage: doublePrecision('negotiated_damage').notNull(),
  uncoordinatedDamage: doublePrecision('uncoordinated_damage').notNull(),
  jainsFairness: doublePrecision('jains_fairness').notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fieldEscalations = pgTable('field_escalations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  category: text('category').notNull(),
  areaName: text('area_name').notNull(),
  severity: text('severity').notNull(),
  summary: text('summary').notNull(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  negotiationRuns: many(negotiationRuns),
  fieldEscalations: many(fieldEscalations),
  chatMessages: many(chatMessages),
}));

export const negotiationRunsRelations = relations(negotiationRuns, ({ one }) => ({
  author: one(users, {
    fields: [negotiationRuns.userId],
    references: [users.id],
  }),
}));

export const fieldEscalationsRelations = relations(fieldEscalations, ({ one }) => ({
  author: one(users, {
    fields: [fieldEscalations.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  author: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));
