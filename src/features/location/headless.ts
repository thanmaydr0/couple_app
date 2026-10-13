// The shared entry must import this module BEFORE require('expo-router/entry').
// Router layouts are not a reliable cold headless entry point on Android.
import { markLocationHeadlessEntry } from './runtime';
markLocationHeadlessEntry();
