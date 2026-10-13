import type { ThemeColors } from '@/theme/tokens';
import type { MediaRow } from '@/types/db';
export type PhotoMode = 'latest' | 'random' | 'favorites';
export type Doodle = { id: string; couple_id: string; author_id: string; image_path: string; created_at: string };
export type WidgetState = {
  owner: string; couple: string; colors: ThemeColors; enabled: boolean;
  mode: PhotoMode; favorites: string[]; partner: string; status: string;
  days: number | null; countdown: string; photo?: MediaRow; photoFile?: string;
  doodle?: Doodle; doodleFile?: string; updatedAt?: number; error?: string;
};
