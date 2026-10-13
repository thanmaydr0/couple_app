export type Video = { videoId: string; title: string; thumbnail: string };
export type YtSession = { id: string; couple_id: string; host_id: string; status: 'active' | 'ended'; current_video_id: string | null; queue: Video[]; created_at: string };
export type PlayerSnapshot = { pos: number; state: number; duration: number; rates: number[] };
export type Command = { action: 'play' | 'pause' | 'seek' | 'rate'; value?: number };
export const reactions = ['❤️', '😂', '😮', '🥹', '👏'] as const;
export const timing = { sample: 500, heartbeat: 4000, ping: 30000, timeout: 16000, prepare: 25000, reaction: 1200 } as const;
