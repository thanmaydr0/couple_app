import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Header, Text, Card, Button, TextField } from '@/ui';
import { AnimatedNumber, StaggerList } from '@/motion';
import { useTheme } from '@/theme';
import { usePresence } from '@/features/presence/PresenceProvider';
import { useGameNight, useRoundChoices, type GameNightEngine } from './useGameNight';
import { ConnectBoard, Reveal, Wheel } from './presentation';
import { gameIds, titles, type GameId, type Prompt, type Round } from './types';

const descriptions: Record<GameId, string> = {
  know: 'Ten questions, alternating roles. Answer about yourself while your partner guesses. Choices stay private until both lock in.',
  rather: 'Ten little choices. Pick privately, reveal together, and discover where you agree.',
  roulette: 'Eight turns, four moods, two skip tokens each. Everything is optional; end the game any time.',
  connect: 'Drop discs into a column. First to connect four wins. Moves are final, and your board survives app restarts.',
};
export default function GameNightScreen() {
  const params = useLocalSearchParams<{ game?: string }>();
  const initial = gameIds.find(id => id === params.game) ?? null;
  const engine = useGameNight(); const theme = useTheme();
  const online = usePresence(store => store.partnerOnline);
  const [selected, setSelected] = useState<GameId | null>(initial);
  const [playing, setPlaying] = useState(false); const [category, setCategory] = useState('');
  const [custom, setCustom] = useState(false);
  const rounds = engine.games.filter(r => r.game === selected);
  const live = rounds.find(r => r.status !== 'finished'); const round = live ?? rounds[0];
  const stats = engine.stats.data?.find(row => row.game === selected);
  const disabled = engine.busy || engine.rounds.offline || !engine.coupleId || !engine.partner.data;
  const queryError = engine.profile.error || engine.partner.error || engine.rounds.error || engine.active.error || engine.customs.error || engine.stats.error;
  const content = { gap: theme.spacing.md, paddingBottom: theme.spacing.lg };
  function back() { if (playing) setPlaying(false); else if (selected) { setSelected(null); setCustom(false); setCategory(''); } else router.replace('/(tabs)/games'); }
  return <Screen bottomInset><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={content}>
    <Header title={selected ? titles[selected] : 'Game night'} subtitle="A little friendly rivalry. A little closer together." onBack={back} />
    <Text color="textSecondary">{engine.partner.data?.display_name || 'Your partner'} · {online ? 'Online' : 'Away'} · {engine.rounds.realtime === 'SUBSCRIBED' ? 'Live sync' : 'Reconnecting'}</Text>
    {engine.rounds.offline && <Card><Text>Offline. Saved content stays visible; reconnect to make a move.</Text></Card>}
    {(engine.error || queryError) && <Card style={content}><Text color="danger">{engine.error || 'Could not load game night. Check your connection and retry.'}</Text><Button title="Retry" onPress={engine.refresh} /></Card>}
    {engine.notice && <Text accessibilityLiveRegion="polite">{engine.notice}</Text>}
    {engine.profile.isLoading || engine.rounds.isLoading || engine.active.isLoading ? <Text accessibilityRole="progressbar">Restoring your games…</Text>
      : !engine.coupleId ? <Card><Text>Link your couple in Settings to play together.</Text></Card>
      : !selected ? <StaggerList><View style={content}>{gameIds.map(game => <Card key={game} style={content}><Text variant="title/M">{titles[game]}</Text><Text color="textSecondary">{descriptions[game]}</Text><Button title="Open lobby" onPress={() => { setSelected(game); setCategory(''); }} /></Card>)}</View></StaggerList>
      : playing && round ? <Play key={round.id} engine={engine} round={round} disabled={disabled} category={category} />
      : <>
        <Card style={content}><Text variant="title/M">{live ? 'Your game is waiting' : 'Make an evening of it'}</Text><Text>{descriptions[selected]}</Text>
          {!engine.partner.data && <Text>Waiting for your linked partner’s profile.</Text>}
          {(selected === 'know' || selected === 'roulette') && <><Text variant="label">Prompt category</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{['', ...(selected === 'know' ? ['favorites', 'memories', 'habits', 'dreams'] : ['sweet', 'funny', 'adventurous', 'deep'])].map(c => <Button key={c} variant={category === c ? 'primary' : 'secondary'} title={`${category === c ? '✓ ' : ''}${c || 'All moods'}`} onPress={() => setCategory(c)} disabled={engine.busy} />)}</View></>}
          {selected !== 'connect' && (engine.customs.data ?? []).some(p => p.game === selected) && <Button title={`${category === '__custom' ? '✓ ' : ''}Use only your custom prompts`} variant={category === '__custom' ? 'primary' : 'secondary'} onPress={() => setCategory(category === '__custom' ? '' : '__custom')} />}
          {live ? <Button title="Resume game" onPress={() => setPlaying(true)} /> : <Button title={engine.busy ? 'Starting…' : round ? 'Rematch · new game' : 'Start a game'} disabled={disabled} onPress={() => { void engine.start(selected, category || undefined, round).then(success => { if (success) setPlaying(true); }); }} />}
          {live?.status === 'lobby' && live.created_by === engine.uid && <Button title="Cancel invitation" variant="ghost" disabled={disabled} onPress={() => { void engine.action('cancel', live); }} />}
        </Card>
        <Card style={content}><Text variant="title/S">Your story so far</Text><View style={{ flexDirection: 'row', gap: theme.spacing.md }}>{[
          { label: 'Played', value: stats?.played ?? 0 },
          { label: 'Your wins', value: stats && stats.extra.a === engine.uid ? stats.wins_a : stats?.wins_b ?? 0 },
          { label: 'Partner wins', value: stats && stats.extra.a === engine.uid ? stats.wins_b : stats?.wins_a ?? 0 },
        ].map(item => <View key={item.label} style={{ flex: 1 }}><AnimatedNumber value={item.value} /><Text variant="caption" color="textSecondary">{item.label}</Text></View>)}</View>
          {(selected === 'know' || selected === 'rather') && <><AnimatedNumber value={stats?.extra.attempts ? Math.round((stats.extra.matches ?? 0) / stats.extra.attempts * 100) : 0} /><Text>{selected === 'know' ? 'Knowing each other' : 'You agree'} · {stats?.extra.attempts ? 'percent over all revealed rounds' : 'No answers revealed yet'}</Text>{selected === 'know' && <Text>Best streak: {stats?.extra.best_streak ?? 0}</Text>}</>}
        </Card>
        <Text variant="title/S">Last results</Text>{rounds.filter(r => r.status === 'finished').length ? <StaggerList>{rounds.filter(r => r.status === 'finished').slice(0, theme.geometry.firstScreenful).map(r => <Card key={r.id} style={content}><Text>{new Date(r.updated_at).toLocaleDateString()} · {result(r, engine.uid)}</Text><Text variant="caption">{r.game === 'connect' ? `${r.state.step} moves` : `You ${r.state.scores[engine.uid ?? ''] ?? 0} · Partner ${r.state.scores[r.state.a === engine.uid ? r.state.b : r.state.a] ?? 0}`}</Text></Card>)}</StaggerList> : <Text color="textSecondary">Your first result starts here.</Text>}
        {selected !== 'connect' && <><Button title={custom ? 'Close custom prompt maker' : 'Add your own prompt'} variant="secondary" onPress={() => setCustom(!custom)} />{custom && <CustomMaker key={selected} game={selected} engine={engine} disabled={disabled} />}
          {(engine.customs.data ?? []).filter(p => p.game === selected).map(p => <Card key={p.id} style={content}><Text>{p.text}</Text>{p.options.length > 0 && <Text variant="caption">{p.options.join(' / ')}</Text>}<Text variant="caption">{p.category} · {p.kind || (p.options.length ? 'Multiple choice' : 'Typed answer')}</Text>{p.created_by === engine.uid && <Button title="Delete custom prompt" variant="ghost" disabled={disabled} onPress={() => { void engine.deleteCustom(p.id); }} />}</Card>)}</>}
      </>}
  </ScrollView></Screen>;
}
function result(round: Round, uid?: string) {
  if (round.state.winner) return round.state.winner === uid ? 'You won' : 'Partner won';
  return round.game === 'rather' ? 'Choices explored together' : round.state.step === 0 && !round.state.reveal ? 'Invitation closed' : 'Finished together · tie';
}
function Play({ engine, round, disabled, category }: { engine: GameNightEngine; round: Round; disabled: boolean; category: string }) {
  const { spacing } = useTheme(); const [answer, setAnswer] = useState('');
  const s = round.state; const mine = s.turn === engine.uid;
  const choiceQuery = useRoundChoices(engine, round);
  const choices = choiceQuery.data ?? [];
  const locked = choices.some(c => c.author === engine.uid);
  const prompt = s.prompt; const content = { gap: spacing.md };
  const last = s.step >= (round.game === 'roulette' ? 7 : 9);
  return <View style={content}>
    {choiceQuery.error && <Card style={content}><Text color="danger">Could not restore your private choice.</Text><Button title="Retry choices" onPress={() => { void choiceQuery.refetch(); }} /></Card>}
    <Card style={content}><Text variant="title/S">{round.status === 'finished' ? result(round, engine.uid) : round.status === 'lobby' ? 'An invitation for two' : round.game === 'connect' ? mine ? 'Your turn' : 'Partner’s turn' : `Round ${s.step + 1} of ${round.game === 'roulette' ? 8 : 10}`}</Text>
      {round.game !== 'rather' && <Text>You: {s.scores[engine.uid ?? ''] ?? 0} · Partner: {s.scores[s.a === engine.uid ? s.b : s.a] ?? 0}{round.game === 'know' ? ` · Your streak: ${s.streaks[engine.uid ?? ''] ?? 0}` : ''}</Text>}
      {round.game === 'connect' && <Text>You play {s.a === engine.uid ? 'A' : 'B'}. Four in any direction wins.</Text>}
    </Card>
    {round.status === 'lobby' ? <Card style={content}><Text>{round.created_by === engine.uid ? 'Waiting for your partner to accept. This invitation will be here when you return.' : 'Your partner invited you to play.'}</Text>{round.created_by !== engine.uid && <Button title="Join game" disabled={disabled} onPress={() => { void engine.action('join', round); }} />}</Card>
      : <>
        {round.game === 'connect' ? <ConnectBoard round={round} disabled={disabled || !mine || round.status !== 'active'} onMove={column => { void engine.action('move', round, { column }); }} />
          : round.game === 'roulette' ? <>
            <Wheel round={round} /><Text>{mine ? 'Your' : 'Partner’s'} turn · You have {s.skips[engine.uid ?? ''] ?? 0} skip tokens</Text>
            {s.spun ? <Card style={content}><Text variant="label">{prompt?.category} · {prompt?.kind}</Text><Text variant="title/M">{prompt?.text}</Text>{s.reveal ? <Text>✓ {s.completed.at(-1)?.skipped ? 'Skipped' : 'Completed'}</Text> : <><Button title="✓ Mark completed" disabled={disabled || !mine || round.status !== 'active'} onPress={() => { void engine.action('complete', round); }} /><Button title="Use a skip token" variant="secondary" disabled={disabled || !mine || (s.skips[engine.uid ?? ''] ?? 0) <= 0 || round.status !== 'active'} onPress={() => { void engine.action('skip', round); }} /></>}</Card>
              : <Button title={mine ? 'Spin the wheel' : 'Waiting for partner to spin'} disabled={disabled || !mine || round.status !== 'active'} onPress={() => { void engine.spin(round, category || undefined); }} />}
            <Text variant="caption">Consent comes first. You can end this game at any time, even without tokens.</Text>
            {s.completed.length > 0 && <Card style={content}><Text variant="label">Check-offs</Text>{s.completed.map(item => <Text key={item.step}>{item.skipped ? '↷ Skipped' : '✓ Completed'} · {item.text}</Text>)}</Card>}
            {round.status === 'active' && <Button title="End roulette" variant="ghost" disabled={disabled} onPress={() => { void engine.action('end', round); }} />}
          </> : <>
            <Card style={content}><Text variant="caption" color="textSecondary">{prompt?.category}</Text><Text variant="title/M">{prompt?.text}</Text><Text>{round.game === 'know' ? mine ? 'Answer about yourself. Your partner is guessing your answer.' : 'Guess your partner’s answer about themselves.' : 'Pick privately. Both choices appear together.'}</Text></Card>
            {choiceQuery.isLoading ? <Text>Restoring your private choice…</Text> : s.reveal ? <Reveal key={s.step} round={round} choices={choices} uid={engine.uid} /> : locked ? <Card><Text>Choice locked. Waiting for your partner; your answer stays private.</Text></Card>
              : prompt?.options.length ? <View style={content}>{prompt.options.map(option => <Button key={option} title={option} variant="secondary" disabled={disabled || round.status !== 'active'} onPress={() => { void engine.action('answer', round, { answer: option }); }} />)}</View>
                : <View style={content}><TextField key={s.step} label="Your private answer" value={answer} onChangeText={setAnswer} maxLength={120} editable={!disabled && round.status === 'active'} hint="Short text; small spelling differences are accepted. Answers lock on submit." /><Button title="Lock answer" disabled={disabled || !answer.trim() || round.status !== 'active'} onPress={() => { void engine.action('answer', round, { answer }).then(success => { if (success) setAnswer(''); }); }} /></View>}
          </>}
        {s.reveal && round.status === 'active' && <Button title={last ? 'Finish & save results' : 'Next round · swap turns'} disabled={disabled} onPress={() => { void engine.next(round, category || undefined); setAnswer(''); }} />}
        {round.status === 'finished' && <Button title="Rematch" disabled={disabled} onPress={() => { void engine.start(round.game, category || undefined, round); }} />}
      </>}
  </View>;
}
function CustomMaker({ game, engine, disabled }: { game: Exclude<GameId, 'connect'>; engine: GameNightEngine; disabled: boolean }) {
  const { spacing } = useTheme(); const [text, setText] = useState(''); const [typed, setTyped] = useState(true);
  const [options, setOptions] = useState(['', '', '', '']); const [kind, setKind] = useState<'truth' | 'dare'>('truth');
  const [category, setCategory] = useState(game === 'know' ? 'favorites' : game === 'roulette' ? 'sweet' : 'together');
  const wanted = game === 'rather' ? 2 : game === 'know' && !typed ? 4 : 0;
  const picked = options.slice(0, wanted).map(s => s.trim());
  const valid = text.trim().length > 0 && picked.every(Boolean) && new Set(picked).size === picked.length;
  return <Card style={{ gap: spacing.md }}><Text variant="title/S">Make it yours</Text><TextField label="Question or prompt" value={text} onChangeText={setText} maxLength={500} editable={!disabled} />
    {game === 'know' && <Button variant="secondary" title={typed ? 'Switch to four choices' : 'Switch to short text'} onPress={() => setTyped(!typed)} />}
    {game === 'roulette' && <Button variant="secondary" title={`Type: ${kind} · tap to switch`} onPress={() => setKind(kind === 'truth' ? 'dare' : 'truth')} />}
    {game !== 'rather' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{(game === 'know' ? ['favorites', 'memories', 'habits', 'dreams'] : ['sweet', 'funny', 'adventurous', 'deep']).map(c => <Button key={c} title={`${category === c ? '✓ ' : ''}${c}`} variant={category === c ? 'primary' : 'secondary'} onPress={() => setCategory(c)} />)}</View>}
    {Array.from({ length: wanted }, (_, i) => <TextField key={i} label={`Choice ${i + 1}`} value={options[i]} maxLength={120} editable={!disabled} onChangeText={value => setOptions(old => old.map((v, index) => index === i ? value : v))} />)}
    <Text variant="caption">Prompts are shared with your partner. Keep personal answers out of the prompt itself.</Text>
    <Button title="Save custom prompt" disabled={disabled || !valid} onPress={() => { const prompt: Omit<Prompt, 'id'> = { game, text: text.trim(), category, options: picked, ...(game === 'roulette' ? { kind } : {}) }; void engine.addCustom(prompt); }} />
  </Card>;
}
