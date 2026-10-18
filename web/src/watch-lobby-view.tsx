import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ArrowRight, Clock3, Film, HardDrive, Heart, LoaderCircle, LockKeyhole, Play, RefreshCw, Sparkles } from 'lucide-react';
import type { WatchSessionRow } from './backend.js';
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './watch-ui';

export type WatchLobbyProps = {
  userId: string;
  sessions: WatchSessionRow[] | null;
  error: string | null;
  picking: boolean;
  joining: ReadonlySet<string>;
  onPick(): void;
  onJoin(session: WatchSessionRow): void;
  onRefresh(): void;
};

function movieSize(bytes: number | null | undefined) {
  if (!Number.isFinite(bytes) || !bytes || bytes < 0) return 'Size unavailable';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: unit > 1 ? 2 : 0 }).format(bytes / 1024 ** unit)} ${units[unit]}`;
}

function movieLength(milliseconds: number | null | undefined) {
  if (!Number.isFinite(milliseconds) || !milliseconds || milliseconds < 0) return 'Running time unavailable';
  const totalMinutes = Math.max(1, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} hr ${minutes} min` : `${totalMinutes} min`;
}

function WatchLobbyView({ userId, sessions, error, picking, joining, onPick, onJoin, onRefresh }: WatchLobbyProps) {
  return <div className="watch-lobby-content">
    <Card className="hero watch-hero">
      <CardHeader className="watch-hero-header">
        <p className="eyebrow watch-hero-kicker">YOUR COUCH. THEIR COUCH. ONE MOVIE.</p>
        <CardTitle className="watch-hero-title">A little date, from wherever you are.</CardTitle>
        <CardDescription className="watch-hero-description">Choose the same local movie on both devices. Your video stays on your device; only playback controls travel between you, so you can laugh, pause and swoon together.</CardDescription>
      </CardHeader>
      <div className="watch-hero-art" aria-hidden="true">
        <span className="watch-hero-orbit" />
        <span className="watch-hero-reel"><span className="watch-hero-play"><Play className="watch-icon" /></span></span>
        <Heart className="watch-hero-heart" />
        <Sparkles className="watch-hero-sparkle" />
      </div>
    </Card>

    <div className="watch-start-panel">
      <div className="watch-start-copy">
        <p className="eyebrow">BEGIN WITH A FAVORITE</p>
        <p className="muted">Choose one movie you both already have.</p>
      </div>
      <Button variant="primary" className="watch-start" onClick={onPick} disabled={picking} aria-busy={picking}>
        {picking ? 'Reading your movie…' : 'Pick a movie for our night'}
        {picking ? <LoaderCircle className="watch-button-icon watch-spin" aria-hidden="true" /> : <Heart className="watch-button-icon" aria-hidden="true" />}
      </Button>
    </div>

    {error && sessions !== null && <p className="notice watch-error" role="alert">{error}</p>}

    <Card className="watch-ritual">
      <CardHeader className="watch-ritual-header">
        <CardTitle className="eyebrow watch-ritual-title">A small ritual, made for two</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="watch-steps">
          {['Pick your favorite', 'Choose the same copy', 'Press play together'].map((label, index) => <li className="watch-step" key={label}>
            <span className="watch-step-number">{String(index + 1).padStart(2, '0')}</span><span className="watch-step-label">{label}</span>
          </li>)}
        </ol>
      </CardContent>
    </Card>

    <section className="watch-invitations" aria-labelledby="watch-invitations-title">
      <div className="watch-section-heading">
        <div className="watch-section-copy">
          <p className="eyebrow">YOUR NEXT SHARED SCENE</p>
          <h2 id="watch-invitations-title">Open movie nights</h2>
          <p className="muted">Pick up an invitation when you’re ready to settle in together.</p>
        </div>
        <Badge variant="secondary" className="watch-count" aria-label={sessions === null ? 'Loading open movie nights' : `${sessions.length} open ${sessions.length === 1 ? 'movie night' : 'movie nights'}`}>
          {sessions?.length ?? '…'}
        </Badge>
      </div>

      <div className="watch-invitation-list">
        {sessions === null && error ? <Card className="watch-load-error">
          <CardContent className="watch-load-error-copy">
            <CardTitle as="h3">We couldn’t reach your movie nights.</CardTitle>
            <CardDescription role="alert">{error}</CardDescription>
          </CardContent>
          <Button variant="outline" className="watch-retry" onClick={onRefresh}>Try again<RefreshCw className="watch-button-icon" aria-hidden="true" /></Button>
        </Card> : sessions === null ? <Card className="watch-loading">
          <LoaderCircle className="watch-loading-icon watch-spin" aria-hidden="true" />
          <CardDescription role="status">Gathering your invitations…</CardDescription>
        </Card> : sessions.length === 0 ? <Card className="watch-empty">
          <span className="watch-empty-mark" aria-hidden="true"><Heart /></span>
          <CardContent className="watch-empty-copy">
            <CardTitle as="h3">Your next movie night starts here.</CardTitle>
            <CardDescription>There are no open invitations yet. Pick a movie you both have to begin your next little date.</CardDescription>
          </CardContent>
        </Card> : sessions.map(room => {
          const isJoining = joining.has(room.id);
          return <Card className="watch-invitation" key={room.id} data-session-id={room.id}>
            <div className="watch-poster" aria-hidden="true">
              <span className="watch-poster-frame"><Film /></span>
              <Heart className="watch-poster-heart" />
            </div>
            <CardContent className="watch-invitation-copy">
              <Badge variant={room.host_id === userId ? 'secondary' : 'outline'} className="watch-invitation-badge">
                {room.host_id === userId ? 'YOUR MOVIE NIGHT' : 'AN INVITATION FOR YOU'}
              </Badge>
              <CardTitle as="h3" className="watch-invitation-title">{room.title || 'Untitled movie'}</CardTitle>
              <div className="watch-metadata">
                <Badge variant="outline" className="watch-meta-chip"><Clock3 className="watch-meta-icon" aria-hidden="true" />{movieLength(room.duration_ms)}</Badge>
                <Badge variant="outline" className="watch-meta-chip"><HardDrive className="watch-meta-icon" aria-hidden="true" />{movieSize(room.file_size)}</Badge>
              </div>
            </CardContent>
            <CardFooter className="watch-join-footer">
              <Button variant="primary" className="watch-join" onClick={() => onJoin(room)} disabled={isJoining} aria-busy={isJoining}>
                {isJoining ? 'Opening your copy…' : 'Join with my local copy'}
                {isJoining ? <LoaderCircle className="watch-button-icon watch-spin" aria-hidden="true" /> : <ArrowRight className="watch-button-icon" aria-hidden="true" />}
              </Button>
            </CardFooter>
          </Card>;
        })}
      </div>
      <Button variant="ghost" className="watch-refresh" onClick={onRefresh}><RefreshCw className="watch-button-icon" aria-hidden="true" />Refresh invitations</Button>
    </section>

    <Card className="watch-privacy">
      <span className="watch-privacy-mark" aria-hidden="true"><LockKeyhole /></span>
      <CardContent className="watch-privacy-copy">
        <CardTitle as="h3">Your files stay yours.</CardTitle>
        <CardDescription>Choose the same unprotected video on both devices. Nothing is uploaded; only playback controls travel between you. Streaming-service DRM downloads cannot be played here. Embedded audio and subtitles can be chosen independently.</CardDescription>
      </CardContent>
    </Card>
  </div>;
}

export function mountWatchLobbyView(container: HTMLElement) {
  const root: Root = createRoot(container);
  return {
    render: (props: WatchLobbyProps) => root.render(<WatchLobbyView {...props} />),
    unmount: () => root.unmount(),
  };
}
