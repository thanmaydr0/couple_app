import { createContext, useContext } from 'react';

// Native call modals must honor the lock even while their providers stay mounted.
export const AppLockVisibility = createContext(false);
export function useAppLockCovered() { return useContext(AppLockVisibility); }
