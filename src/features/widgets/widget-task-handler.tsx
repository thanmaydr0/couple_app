import type { PropsWithChildren } from 'react';
import { FlexWidget, ImageWidget, TextWidget, requestWidgetUpdate, type WidgetTaskHandlerProps, type WidgetInfo } from 'react-native-android-widget';
import { radius, spacing, typography, geometry } from '@/theme/tokens';
import { motionTokens } from '@/motion/tokens';
import { initialState, readState, refreshData, imageData, sendWidgetHeartbeat } from './service';
import type { WidgetState } from './types';
import './background';

type Props = { state?: WidgetState; image?: `data:image${string}`; width?: number; height?: number; feedback?: string };
const hex = (value: string) => value as `#${string}`;
function Label({ text, state, big = false }: { text: string; state: WidgetState; big?: boolean }) {
  return <TextWidget text={text} style={{ color: hex(state.colors.textPrimary), fontSize: typography[big ? 'display/L' : 'caption'].fontSize, textAlign: 'center' }} />;
}
function Frame({ state, children, uri, heartbeat = false }: PropsWithChildren<{ state: WidgetState; uri?: string; heartbeat?: boolean }>) {
  return <FlexWidget accessibilityLabel={heartbeat ? 'Send your partner a heartbeat' : 'Open Us widget'} clickAction={heartbeat && state.enabled ? 'HEARTBEAT' : uri ? 'OPEN_URI' : 'OPEN_APP'} clickActionData={uri ? { uri } : undefined} style={{ width: 'match_parent', height: 'match_parent', justifyContent: 'center', alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: hex(state.colors.surface) }}>
    {state.enabled ? children : <Label text="Enable widgets in Us" state={state} />}
  </FlexWidget>;
}
export function UsWidget({ state = initialState }: Props) {
  return <Frame state={state} uri="us://"><Label text={state.days === null ? 'Us' : String(state.days)} state={state} big /><Label text={state.days === null ? 'Our space, together' : 'days together'} state={state} /><Label text={`${state.partner} ${state.status}`} state={state} />{state.countdown ? <Label text={state.countdown} state={state} /> : null}{state.error ? <Label text="Saved · refresh needed" state={state} /> : null}</Frame>;
}
function Picture({ state, image, width = geometry.touch * 2, height = geometry.touch * 2, doodle = false }: Props & { state: WidgetState; doodle?: boolean }) {
  return <Frame state={state} uri={doodle ? 'us://us/widgets?reply=1' : `us://us/widgets?photo=${state.photo?.id ?? ''}`}>
    {image ? <ImageWidget image={image} imageWidth={Math.max(geometry.touch, width - spacing.md)} imageHeight={Math.max(geometry.touch, height - spacing.xl)} resizeMode={doodle ? 'contain' : 'cover'} radius={radius.sm} /> : <Label text={doodle ? 'Waiting for a love doodle' : state.mode === 'favorites' ? 'Choose favorites in Us' : 'Add a photo to Memories'} state={state} />}
    <Label text={doodle ? 'Love Doodle · tap to reply' : 'Photo of the day'} state={state} />
  </Frame>;
}
export function PhotoWidget(props: Props) { return <Picture {...props} state={props.state ?? initialState} />; }
export function DoodleWidget(props: Props) { return <Picture {...props} state={props.state ?? initialState} doodle />; }
export function HeartbeatWidget({ state = initialState, feedback }: Props) {
  return <Frame state={state} heartbeat><Label text="♥" state={state} big />{feedback ? <Label text={feedback} state={state} /> : null}</Frame>;
}
const renderers = { UsWidget, PhotoWidget, DoodleWidget, HeartbeatWidget };
async function representation(info: WidgetInfo, state: WidgetState, feedback?: string) {
  const Widget = renderers[info.widgetName as keyof typeof renderers];
  const file = info.widgetName === 'PhotoWidget' ? state.photoFile : info.widgetName === 'DoodleWidget' ? state.doodleFile : undefined;
  return Widget ? <Widget state={state} image={state.enabled ? await imageData(file) : undefined} width={info.width} height={info.height} feedback={feedback} /> : <UsWidget state={state} />;
}
export async function renderAll(state?: WidgetState) {
  // Fresh preference read prevents an in-flight sync repainting content after turn-off.
  const saved = await readState();
  const value = state?.owner === saved.owner && state?.enabled === saved.enabled ? { ...state, colors: saved.colors } : saved;
  for (const widgetName of Object.keys(renderers)) await requestWidgetUpdate({ widgetName, renderWidget: info => representation(info, value) });
}
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  let state = await readState();
  let feedback: string | undefined;
  if (props.widgetAction === 'WIDGET_CLICK' && props.clickAction === 'HEARTBEAT' && state.enabled) {
    try { feedback = await sendWidgetHeartbeat(); } catch { feedback = 'Try again online'; }
    // RemoteViews are static bitmaps: timestamped feedback instead of an unsupported animation.
    feedback = `${feedback} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else state = await refreshData();
  props.renderWidget(await representation(props.widgetInfo, state, feedback));
  if (feedback) {
    await new Promise<void>(resolve => setTimeout(resolve, motionTokens.heartbeat));
    props.renderWidget(await representation(props.widgetInfo, await readState()));
  }
}
