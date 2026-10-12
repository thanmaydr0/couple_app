import type { ComponentType } from 'react';
import {
  FlexWidget,
  TextWidget,
  type WidgetTaskHandlerProps,
} from 'react-native-android-widget';
import { radius, spacing, themes, typography } from '../../theme/tokens';

// RemoteViews run without the app's React context: use shared tokens directly.
// The feature session can replace these placeholders without another native build.
function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <FlexWidget
      accessibilityLabel={`${title}. ${message}. Open Us.`}
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: themes.Midnight.surface as `#${string}`,
      }}
    >
      <TextWidget
        text={title}
        style={{ color: themes.Midnight.textPrimary as `#${string}`, fontSize: typography.label.fontSize, textAlign: 'center' }}
      />
      <TextWidget
        text={message}
        style={{ color: themes.Midnight.textSecondary as `#${string}`, fontSize: typography.caption.fontSize, textAlign: 'center' }}
      />
    </FlexWidget>
  );
}

export function UsWidget() {
  return <Placeholder title="Us" message="Days together & partner status — coming soon" />;
}

export function PhotoWidget() {
  return <Placeholder title="Photo" message="Photo of the day — coming soon" />;
}

export function DoodleWidget() {
  return <Placeholder title="Doodle" message="Your partner’s latest doodle — coming soon" />;
}

export function HeartbeatWidget() {
  return <Placeholder title="Heartbeat" message="Soon" />;
}

const renderers: Record<string, ComponentType> = { UsWidget, PhotoWidget, DoodleWidget, HeartbeatWidget };

export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  const Widget = renderers[widgetInfo.widgetName];
  if (Widget) renderWidget(<Widget />);
}
