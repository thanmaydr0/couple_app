import { create } from 'zustand';
import type { Lease } from './types';
type State = { lease: Lease | null; error: string | null; pendingStop: boolean; ready: boolean };
export const useLocationState = create<State>(() => ({ lease: null, error: null, pendingStop: false, ready: false }));
