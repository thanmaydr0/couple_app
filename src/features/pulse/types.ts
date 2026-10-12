export type Answer = { id: string; couple_id: string; day: string; user_id: string; answer: string; created_at: string };
export const moods = ['joyful', 'calm', 'loved', 'hopeful', 'tired', 'anxious', 'sad', 'overwhelmed'] as const;
export const moodEmoji = ['😊', '😌', '🥰', '🌱', '😴', '🫨', '🌧️', '🫂'] as const;
export type Mood = typeof moods[number];
export const availabilities = ['free', 'busy', 'sleeping', 'driving', 'studying', 'working'] as const;
export type Availability = typeof availabilities[number];
export type Status = { user_id: string; couple_id: string; mood: Mood; availability: Availability; note: string | null; updated_at: string };
export type PartnerPlace = { city: string | null; timezone: string | null; lat: number | null; lon: number | null };
