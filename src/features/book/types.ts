import type { MediaRow } from '@/types/db';
import type { ChatRow } from '@/features/chat/types';
import type { Entry, Summary } from '@/features/story/types';
import type { Capsule } from '@/features/capsule/types';

export type FeatureId = 'book';
export type BookRange = { from: string; to: string; label: string; year?: number };
export type BookPeriod = 'year' | 'since-start' | 'custom';
export type BookChapter = 'photos' | 'messages' | 'milestones' | 'places' | 'wins' | 'stats';
export type BookPlace = { id: string; name: string; country_code: string | null; lat: number; lon: number; kind: string; visited_on: string | null; notes: string | null };
export type BookEvent = { id: string; title: string; starts_at: string; location: string | null; kind: string };
export type BookListItem = { id: string; title: string; done_at: string; notes: string | null };
export type BookSource = {
  photos: MediaRow[];
  messages: ChatRow[];
  reactions: Record<string, number>;
  places: BookPlace[];
  wins: BookListItem[];
  events: BookEvent[];
  capsules: Capsule[];
  milestones: Entry[];
  stats: Summary | null;
  timezone: string;
  userId: string;
  mediaStore: import('../media/service').MediaStore;
  warnings: string[];
};
export type BookOptions = {
  title: string;
  dedication: string;
  chapters: Record<BookChapter, boolean>;
  selectedMessages: string[];
  printFriendly: boolean;
  lightQuality: boolean;
};
