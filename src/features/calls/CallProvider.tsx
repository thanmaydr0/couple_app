import { type PropsWithChildren } from 'react';

export function CallProvider({ children }: PropsWithChildren) {
  // TODO: Own the call lifecycle and signaling subscription here.
  return children;
}
