import { z } from 'zod';
import { categories, type WalletData } from './types';
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const id = z.string().uuid();
export const draftSchema = z.object({ paid_by:id, amount_minor:minor.positive().max(1_000_000_000_000), currency:z.string().regex(/^[A-Z]{3}$/), category:z.enum(categories), note:z.string().max(500).nullable(), split_type:z.enum(['equal','percent','paid_for_partner','paid_for_me','custom']), split:z.object({payer_bps:z.number().int().min(0).max(10000).optional(),payer_minor:minor.optional()}), spent_on:z.string(), receipt_path:z.string().nullable() });
const expense = draftSchema.extend({id,couple_id:id,recurring_id:id.nullable(),created_at:z.string(),deleted_at:z.string().nullable()});
const settlement = z.object({id,couple_id:id,from_user:id,to_user:id,amount_minor:minor,currency:z.string(),settled_at:z.string(),note:z.string().nullable()});
const goal = z.object({id,couple_id:id,title:z.string(),emoji:z.string(),target_minor:minor.positive(),saved_minor:minor,deadline:z.string().nullable(),created_by:id});
const contribution = z.object({id,goal_id:id,couple_id:id,user_id:id,amount_minor:minor,created_at:z.string()});
const recurring = z.object({id,couple_id:id,template:draftSchema,cadence:z.literal('monthly'),next_run:z.string()});
export function decodeWallet(rows: unknown[]): WalletData { return {expenses:z.array(expense).parse(rows[0]),settlements:z.array(settlement).parse(rows[1]),goals:z.array(goal).parse(rows[2]),contributions:z.array(contribution).parse(rows[3]),recurring:z.array(recurring).parse(rows[4])}; }
