export type Point = { x: number; y: number };
export type Touch = Point & { down: boolean; at: number; seq: number };
export type Intensity = 'off' | 'gentle' | 'strong';
export type Message = { user: string; instance: string; seq: number; at: number } & (
  | { kind: 'touch'; point: Point; down: true }
  | { kind: 'up' }
  | { kind: 'ready' }
  | { kind: 'heart'; point: Point }
  | { kind: 'ping'; sent: number }
  | { kind: 'pong'; sent: number; received: number }
  | { kind: 'pulse'; when: number }
);
