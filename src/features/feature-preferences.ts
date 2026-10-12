import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { featureRegistry } from './registry';
import { useSession } from '@/lib/hooks';
type Preferences = { hidden: Record<string, string[]>; ready: boolean; error: string | null; toggle: (userId: string, id: string) => void };
export const useFeaturePreferences = create<Preferences>()(persist((set) => ({
  hidden: {}, ready: false, error: null,
  toggle: (userId, id) => set(state => { const hidden = state.hidden[userId] ?? []; return { hidden: { ...state.hidden, [userId]: hidden.includes(id) ? hidden.filter(value => value !== id) : [...hidden, id] } }; }),
}), {
  name: 'us-feature-preferences-v1',
  storage: createJSONStorage(() => ({
    getItem: key => AsyncStorage.getItem(key),
    setItem: async (key, value) => {
      try { await AsyncStorage.setItem(key, value); if (useFeaturePreferences.getState().error !== null) useFeaturePreferences.setState({ error: null }); }
      catch { const error = 'Your choices could not be saved on this phone. Try again.'; if (useFeaturePreferences.getState().error !== error) useFeaturePreferences.setState({ error }); }
    },
    removeItem: key => AsyncStorage.removeItem(key),
  })),
  partialize: state => ({ hidden: state.hidden }),
  merge: (saved, current) => { const value = saved as { hidden?: Record<string, unknown> } | undefined; const hidden: Record<string, string[]> = {}; if (value?.hidden && typeof value.hidden === 'object') for (const [key, list] of Object.entries(value.hidden)) if (Array.isArray(list)) hidden[key] = list.filter((id): id is string => typeof id === 'string'); return { ...current, hidden }; },
  onRehydrateStorage: () => (_state, error) => useFeaturePreferences.setState({ ready: true, error: error ? 'Saved feature choices could not be loaded.' : null }),
}));
export function useEnabledFeatures() {
  const { data: session } = useSession();
  const hidden = useFeaturePreferences(state => state.hidden);
  const ready = useFeaturePreferences(state => state.ready);
  return ready ? featureRegistry.filter(feature => feature.enabled && !(hidden[session?.user.id ?? ''] ?? []).includes(feature.id)) : [];
}
