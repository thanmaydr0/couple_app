import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import type { AppDatabase } from './database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(url && anonKey);

// Keep placeholder screens usable before credentials are supplied.
// Real auth must check isSupabaseConfigured before making requests.
export const supabase = createClient<AppDatabase>(
  url || 'https://unconfigured.supabase.co',
  anonKey || 'unconfigured-anon-key',
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock } },
);
