import type { CoupleRow, Database } from '@/types/db';

// The base schema predates anniversary editing. Restrict the extension to the
// one column granted by app-shell-permissions.sql; all row types stay shared.
export type AppDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'couples'> & {
      couples: Omit<Database['public']['Tables']['couples'], 'Update'> & { Update: Pick<CoupleRow, 'anniversary'> };
    };
  };
};
