/** Hand-written schema types. UUID, date and timestamptz values are strings.
 * bigint is represented as number by supabase-js; keep values below 2^53.
 * Insert describes SQL shape; RLS/column grants further restrict app writes.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type MessageKind = 'text' | 'image' | 'system';
export type MediaKind = 'photo' | 'video';
export type ChessTurn = 'w' | 'b';
export type ChessStatus = 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
export type CallKind = 'audio' | 'video';
export type CallStatus = 'ringing' | 'answered' | 'declined' | 'missed' | 'ended';
export type WatchStatus = 'open' | 'active' | 'ended';

export type CoupleRow = { id: string; anniversary: string | null; created_at: string };
export type CoupleInsert = { id?: string; anniversary?: string | null; created_at?: string };
export type ProfileRow = {
  id: string; couple_id: string | null; display_name: string | null;
  avatar_path: string | null; last_seen: string | null; created_at: string;
};
export type ProfileInsert = {
  id: string; couple_id?: string | null; display_name?: string | null;
  avatar_path?: string | null; last_seen?: string | null; created_at?: string;
};
export type PushTokenRow = { user_id: string; token: string; updated_at: string };
export type PushTokenInsert = { user_id: string; token: string; updated_at?: string };
export type MessageRow = {
  id: string; couple_id: string; sender_id: string; kind: MessageKind;
  body: string | null; media_path: string | null; reply_to: string | null;
  client_id: string; created_at: string; read_at: string | null;
};
export type MessageInsert = {
  id?: string; couple_id: string; sender_id: string; kind: MessageKind;
  body?: string | null; media_path?: string | null; reply_to?: string | null;
  client_id: string; created_at?: string; read_at?: string | null;
};
export type MediaRow = {
  id: string; couple_id: string; uploader_id: string; kind: MediaKind;
  storage_path: string; thumb_path: string | null; taken_at: string;
  width: number | null; height: number | null; duration_ms: number | null;
  size_bytes: number | null; caption: string | null; created_at: string;
};
export type MediaInsert = {
  id?: string; couple_id: string; uploader_id: string; kind: MediaKind;
  storage_path: string; thumb_path?: string | null; taken_at: string;
  width?: number | null; height?: number | null; duration_ms?: number | null;
  size_bytes?: number | null; caption?: string | null; created_at?: string;
};
export type ChessGameRow = {
  id: string; couple_id: string; white_id: string; black_id: string;
  fen: string; pgn: string; turn: ChessTurn; status: ChessStatus;
  winner_id: string | null; draw_offered_by: string | null;
  last_move_from: string | null; last_move_to: string | null;
  created_at: string; updated_at: string;
};
export type ChessGameInsert = {
  id?: string; couple_id: string; white_id: string; black_id: string;
  fen?: string; pgn?: string; turn?: ChessTurn; status?: ChessStatus;
  winner_id?: string | null; draw_offered_by?: string | null;
  last_move_from?: string | null; last_move_to?: string | null;
  created_at?: string; updated_at?: string;
};
export type ScribbleMatchRow = {
  id: string; couple_id: string; created_by: string; scores: { [key: string]: Json | undefined };
  rounds_played: number; created_at: string; updated_at: string;
};
export type ScribbleMatchInsert = {
  id?: string; couple_id: string; created_by: string; scores?: { [key: string]: Json | undefined };
  rounds_played?: number; created_at?: string; updated_at?: string;
};
export type CallRow = {
  id: string; couple_id: string; caller_id: string; kind: CallKind;
  status: CallStatus; started_at: string; answered_at: string | null; ended_at: string | null;
};
export type CallInsert = {
  id?: string; couple_id: string; caller_id: string; kind: CallKind;
  status?: CallStatus; started_at?: string; answered_at?: string | null; ended_at?: string | null;
};
export type WatchSessionRow = {
  id: string; couple_id: string; host_id: string; title: string | null;
  file_size: number | null; duration_ms: number | null; status: WatchStatus; created_at: string;
};
export type WatchSessionInsert = {
  id?: string; couple_id: string; host_id: string; title?: string | null;
  file_size?: number | null; duration_ms?: number | null; status?: WatchStatus; created_at?: string;
};

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row; Insert: Insert; Update: Update; Relationships: [];
};
/** Pass Database to createClient<Database>(url, publishableKey). */
export type Database = {
  public: {
    Tables: {
      couples: Table<CoupleRow, CoupleInsert, never>;
      profiles: Table<ProfileRow, ProfileInsert, Partial<Pick<ProfileRow, 'display_name' | 'avatar_path' | 'last_seen'>>>;
      push_tokens: Table<PushTokenRow, PushTokenInsert>;
      messages: Table<MessageRow, MessageInsert, { read_at?: string | null }>;
      media: Table<MediaRow, MediaInsert>;
      chess_games: Table<ChessGameRow, ChessGameInsert>;
      scribble_matches: Table<ScribbleMatchRow, ScribbleMatchInsert>;
      calls: Table<CallRow, CallInsert>;
      watch_sessions: Table<WatchSessionRow, WatchSessionInsert>;
    };
    Views: { [_ in never]: never };
    Functions: { my_couple_id: { Args: Record<PropertyKey, never>; Returns: string | null } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update'];
