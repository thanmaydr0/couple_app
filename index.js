// Headless widget registration must run before Expo Router mounts the app.
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/features/widgets/widget-task-handler';
import './src/features/location/headless';
import { handleLocationEvent, runLocationService } from './src/features/location/runtime';
import { installRingingHeadless } from './src/features/ringing/headless';

registerWidgetTaskHandler(widgetTaskHandler);
installRingingHeadless({ onEvent: handleLocationEvent, runService: runLocationService });

// Keep Expo Router's entry last, as required for custom Router entry points.
require('expo-router/entry');
