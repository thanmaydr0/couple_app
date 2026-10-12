import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { themes, type ThemeId, type AccentOverride } from './tokens';

export type AnimationLevel = 'full' | 'reduced' | 'off';
type Preferences = { themeId: ThemeId; accentOverride: AccentOverride; animationLevel: AnimationLevel };
type ThemeStore = Preferences & {
  hydrated: boolean;
  setThemeId: (id: ThemeId) => void; setAccentOverride: (id: AccentOverride) => void;
  setAnimationLevel: (level: AnimationLevel) => void;
};
const defaults: Preferences = { themeId: 'Midnight', accentOverride: null, animationLevel: 'full' };
export const useAppearanceStatus = create<{ persistenceError: string | null }>(() => ({ persistenceError: null }));
const validTheme = (value: unknown): value is ThemeId => typeof value === 'string' && Object.hasOwn(themes, value);
export const useThemeStore = create<ThemeStore>()(persist((set) => ({
  ...defaults, hydrated: false,
  setThemeId: themeId => set({ themeId }), setAccentOverride: accentOverride => set({ accentOverride }),
  setAnimationLevel: animationLevel => set({ animationLevel }),
}), {
  name: 'us-appearance-v1',
  storage: createJSONStorage(() => ({
    getItem: key => AsyncStorage.getItem(key),
    setItem: async (key, value) => { try { await AsyncStorage.setItem(key, value); useAppearanceStatus.setState({ persistenceError: null }); } catch { useAppearanceStatus.setState({ persistenceError: 'Appearance could not be saved on this phone.' }); } },
    removeItem: key => AsyncStorage.removeItem(key),
  })),
  partialize: ({ themeId, accentOverride, animationLevel }) => ({ themeId, accentOverride, animationLevel }),
  merge: (saved, current) => {
    const value = saved as Partial<Preferences> | undefined;
    return { ...current, themeId: validTheme(value?.themeId) ? value.themeId : defaults.themeId,
      accentOverride: validTheme(value?.accentOverride) ? value.accentOverride : null,
      animationLevel: value?.animationLevel === 'off' || value?.animationLevel === 'reduced' ? value.animationLevel : 'full' };
  },
  onRehydrateStorage: () => (_state, error) => { useThemeStore.setState({ hydrated: true }); if (error) useAppearanceStatus.setState({ persistenceError: 'Saved appearance could not be loaded.' }); },
}));
