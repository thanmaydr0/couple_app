import { type PropsWithChildren } from 'react';

export function AuthGate({ children }: PropsWithChildren) {
  // TODO: Restore the session and protect routes when authentication is implemented.
  // This placeholder deliberately allows access to all scaffold screens.
  return children;
}
