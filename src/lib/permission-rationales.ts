// Android's system permission copy is fixed by the OS. Feature screens should
// display these explanations before requesting consent; installing enables none.
export const permissionRationales = {
  location: 'Allow Us to share your location with your partner only while sharing is switched on.',
  backgroundLocation: 'Allow location all the time only to keep optional partner sharing and place alerts working when Us is closed. You can stop sharing at any time.',
  microphone: 'Allow Us to record voice notes and let your partner hear you during calls.',
  camera: 'Allow Us to use your camera for partner video calls and memories you choose to capture.',
  mediaProjection: 'Share your screen with your partner only after you approve Android’s screen-sharing prompt. Stop sharing at any time.',
  biometric: 'Use your fingerprint or device biometrics to unlock private content when you enable the lock.',
  notifications: 'Allow Us to show partner messages and incoming calls. Active sharing and calls show an ongoing notification.',
  fullScreenIntent: 'Allow incoming partner calls to appear on the lock screen when you enable call notifications.',
  activityRecognition: 'Allow Us to read step and motion activity only when you enable a feature that needs it.',
} as const;
