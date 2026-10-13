export type CapsuleKind = 'letter' | 'surprise' | 'future_us';
export type Capsule = {
  encrypted?: boolean; files?: import('@/features/e2ee/files').FileSecret[]; voiceMeta?: import('@/features/voice/types').VoiceMeta;
  id: string; couple_id: string; author_id: string; title: string; body: string;
  media_paths: string[]; voice_path: string | null; kind: CapsuleKind; unlock_at: string;
  open_together: boolean; ceremony_started_at: string | null; opened_at: string | null;
  opened_by: string[]; created_at: string;
};
export type CapsuleStub = Pick<Capsule, 'id' | 'author_id' | 'unlock_at' | 'kind' | 'opened_at' | 'open_together'> & {
  title_hint: string | null; has_media: boolean; ready: boolean; server_now: string;
};
export type CapsuleDraft = Pick<Capsule, 'title' | 'body' | 'kind' | 'unlock_at' | 'open_together'>;
// Voice-session extension: use the private capsules bucket and the same path
// convention; set voice_path before unlock. Recording/playback is intentionally deferred.
export type CapsuleVoiceExtension = Pick<Capsule, 'id' | 'voice_path'>;
