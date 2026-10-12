import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// This is the SAME authenticated client, with an open schema for independently
// owned feature tables. Validate network rows with each feature's own schema.
type FeatureDatabase = { public: {
  Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }>;
  Views: Record<never, never>; Functions: Record<never, never>;
} };
export const featureSupabase = supabase as unknown as SupabaseClient<FeatureDatabase>;
