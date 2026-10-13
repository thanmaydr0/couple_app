import type { MediaStream } from 'react-native-webrtc';
import type { CallKind, CallRow } from '@/types/db';

export const RING_MS = 40_000;
export const EVENTS = ['invite', 'ready', 'share', 'sleep', 'accept', 'decline', 'cancel', 'offer', 'answer', 'ice', 'end', 'busy'] as const;
export type SignalEvent = typeof EVENTS[number];
export type Description = { type: 'offer' | 'answer'; sdp: string };
export type Candidate = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
export type Signal = {
  id: string; from: string; to: string; coupleId: string; kind: CallKind; sentAt: number;
  description?: Description; candidate?: Candidate; restart?: boolean; streamId?: string; screenMid?: string; sharing?: boolean; sleeping?: boolean; asleep?: boolean;
};
export type CallState = {
  sharing: boolean; remoteScreen: MediaStream | null; remoteSharing: boolean; sleeping: boolean; asleep: boolean; partnerAsleep: boolean;
  phase: 'idle' | 'preparing' | 'incoming' | 'outgoing' | 'connecting' | 'connected' | 'reconnecting';
  call: CallRow | null; local: MediaStream | null; remote: MediaStream | null;
  muted: boolean; camera: boolean; front: boolean; connectedAt: number | null;
  route: string; routes: string[]; error: string | null; path: string | null; ready: boolean;
};
export const initialState: CallState = {
  sharing: false, remoteScreen: null, remoteSharing: false, sleeping: false, asleep: false, partnerAsleep: false,
  phase: 'idle', call: null, local: null, remote: null, muted: false, camera: true, front: true,
  connectedAt: null, route: '', routes: [], error: null, path: null, ready: false,
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
export function parseSignal(value: unknown): Signal | null {
  if (!record(value) || typeof value.id !== 'string' || typeof value.from !== 'string' ||
    typeof value.to !== 'string' || typeof value.coupleId !== 'string' ||
    (value.kind !== 'audio' && value.kind !== 'video') || typeof value.sentAt !== 'number' || !Number.isFinite(value.sentAt)) return null;
  if (value.description !== undefined && (!record(value.description) ||
    !['offer', 'answer'].includes(String(value.description.type)) || typeof value.description.sdp !== 'string')) return null;
  if (value.candidate !== undefined && (!record(value.candidate) || typeof value.candidate.candidate !== 'string' ||
    (value.candidate.sdpMid != null && typeof value.candidate.sdpMid !== 'string') ||
    (value.candidate.sdpMLineIndex != null && typeof value.candidate.sdpMLineIndex !== 'number'))) return null;
  if (value.restart !== undefined && typeof value.restart !== 'boolean') return null;
  if (value.screenMid !== undefined && typeof value.screenMid !== 'string') return null;
  if (value.streamId !== undefined && typeof value.streamId !== 'string') return null;
  for (const key of ['sharing', 'sleeping', 'asleep']) if (value[key] !== undefined && typeof value[key] !== 'boolean') return null;
  return value as Signal;
}
export function freshInvite(startedAt: string, now = Date.now()) {
  const age = now - Date.parse(startedAt);
  return Number.isFinite(age) && age >= -5_000 && age < RING_MS;
}
