export const categories = ['food', 'groceries', 'rent', 'travel', 'fun', 'gifts', 'bills', 'health', 'other'] as const;
export type Category = typeof categories[number];
export type SplitType = 'equal' | 'percent' | 'paid_for_partner' | 'paid_for_me' | 'custom';
export type Expense = {
  id: string; couple_id: string; paid_by: string; amount_minor: number; currency: string;
  category: Category; note: string | null; split_type: SplitType;
  split: { payer_bps?: number; payer_minor?: number }; spent_on: string;
  receipt_path: string | null; recurring_id: string | null; created_at: string; deleted_at: string | null;
};
export type Settlement = { id: string; couple_id: string; from_user: string; to_user: string; amount_minor: number; currency: string; settled_at: string; note: string | null };
export type Goal = { id: string; couple_id: string; title: string; emoji: string; target_minor: number; saved_minor: number; deadline: string | null; created_by: string };
export type Contribution = { id: string; goal_id: string; couple_id: string; user_id: string; amount_minor: number; created_at: string };
export type ExpenseDraft = Pick<Expense, 'paid_by' | 'amount_minor' | 'currency' | 'category' | 'note' | 'split_type' | 'split' | 'spent_on' | 'receipt_path'>;
export type Recurring = { id: string; couple_id: string; template: ExpenseDraft; cadence: 'monthly'; next_run: string };
export type WalletData = { expenses: Expense[]; settlements: Settlement[]; goals: Goal[]; contributions: Contribution[]; recurring: Recurring[] };
