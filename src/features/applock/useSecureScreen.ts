import { useEffect, useId, useMemo, useState } from 'react';
import { setCaptureProtection } from './capture';
import { usePrivacy } from './usePrivacy';

/** Call before rendering sensitive content; render it only when ready is true. */
export function useSecureScreen(enabled: boolean) {
  const privacy = usePrivacy(); const id = useId(); const key = `us.private.${id}`;
  // Keep private content protected while the preference is unresolved/offline without a cache.
  const protect = enabled && (privacy.data?.privacy.block_screenshots ?? true);
  const request = useMemo(() => ({ key, protect }), [key, protect]);
  const [completed, setCompleted] = useState<typeof request | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true; setError(null);
    if (protect) {
      void setCaptureProtection(key, true).then(() => { if (alive) setCompleted(request); })
        .catch(() => { if (alive) setError('Screen protection is unavailable. Close this private area and try again.'); });
    } else setCompleted(null);
    return () => { alive = false; void setCaptureProtection(key, false).catch(() => {}); };
  }, [key, protect, request]);
  return { ready: !protect || completed === request, error };
}
