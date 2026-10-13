import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { parseDelay, type LockDelay } from './types';

const KEY = 'us.applock.delay.v1';
type LockState = { ready: boolean; delay: LockDelay; error: string; hydrate: () => Promise<void>; save: (delay: LockDelay) => Promise<void> };
export const useLockStore = create<LockState>((set) => ({
  ready: false, delay: 'off', error: '',
  hydrate: async () => {
    try { const delay = parseDelay(await SecureStore.getItemAsync(KEY)); set({ ready: true, delay, error: '' }); }
    catch { set({ ready: false, error: 'Your lock setting could not load. Your space stays covered. Try again.' }); }
  },
  save: async delay => {
    await SecureStore.setItemAsync(KEY, delay);
    set({ delay, ready: true, error: '' });
  },
}));
