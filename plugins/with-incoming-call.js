const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// NotifyKit handles its own services. Its plugin deliberately leaves full-screen
// activity flags to consumers; keep this declarative and safe to reapply.
module.exports = function withIncomingCall(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity.$['android:showWhenLocked'] = 'true';
    activity.$['android:turnScreenOn'] = 'true';
    return mod;
  });
};
