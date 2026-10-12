// Headless widget registration must run before Expo Router mounts the app.
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/features/widgets/widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);

// Keep Expo Router's entry last, as required for custom Router entry points.
require('expo-router/entry');
