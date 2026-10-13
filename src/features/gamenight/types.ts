import { z } from 'zod';
export const gameIds = ['know', 'rather', 'roulette', 'connect'] as const;
export type GameId = typeof gameIds[number];
export const promptSchema = z.object({ id: z.string(), game: z.enum(gameIds), category: z.string().max(40), text: z.string().min(1).max(500), options: z.array(z.string().min(1).max(120)).max(4).default([]), kind: z.enum(['truth', 'dare']).optional() });
export type Prompt = z.infer<typeof promptSchema>;
export const stateSchema = z.object({
  a: z.string().uuid(), b: z.string().uuid(), turn: z.string().uuid(), step: z.number().int().nonnegative(),
  prompt: promptSchema.nullable(), reveal: z.boolean(), scores: z.record(z.string(), z.number()),
  streaks: z.record(z.string(), z.number()), skips: z.record(z.string(), z.number()),
  board: z.array(z.number().int().min(0).max(2)).length(42), line: z.array(z.number().int().min(0).max(41)),
  winner: z.string().uuid().nullable(), matched: z.boolean().nullable(), spun: z.boolean(),
  completed: z.array(z.object({ step: z.number(), text: z.string(), skipped: z.boolean(), author: z.string() })), last: z.number().int().nullable(),
});
export type GameState = z.infer<typeof stateSchema>;
export const roundSchema = z.object({ id: z.string().uuid(), couple_id: z.string().uuid(), game: z.enum(gameIds), state: stateSchema, status: z.enum(['lobby', 'active', 'finished']), created_by: z.string().uuid(), created_at: z.string(), updated_at: z.string() });
export type Round = z.infer<typeof roundSchema>;
export const choiceSchema = z.object({ id: z.string().uuid(), couple_id: z.string().uuid(), round_id: z.string().uuid(), step: z.number().int(), author: z.string().uuid(), answer: z.string(), created_at: z.string() });
export type Choice = z.infer<typeof choiceSchema>;
export const customSchema = promptSchema.extend({ id: z.string().uuid(), couple_id: z.string().uuid(), created_by: z.string().uuid(), created_at: z.string() });
export const statsSchema = z.object({ couple_id: z.string().uuid(), game: z.enum(gameIds), played: z.number(), wins_a: z.number(), wins_b: z.number(), extra: z.object({ a: z.string().optional(), b: z.string().optional(), attempts: z.number().optional(), matches: z.number().optional(), best_streak: z.number().optional() }).passthrough() });
export type Stats = z.infer<typeof statsSchema>;
export const titles: Record<GameId, string> = { know: 'How well do you know me?', rather: 'Would you rather', roulette: 'Truth or dare roulette', connect: 'Connect Four' };
