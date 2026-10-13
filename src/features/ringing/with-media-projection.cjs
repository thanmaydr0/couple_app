const { withMainApplication } = require('expo/config-plugins');
// Declarative prebuild integration; never edit generated native files by hand.
module.exports = config => {
  config.extra = { ...config.extra, ringingMediaProjectionReady: true };
  return withMainApplication(config, mod => {
  const source = mod.modResults;
  const setting = 'com.oney.WebRTCModule.WebRTCModuleOptions.getInstance().enableMediaProjectionService = true';
  if (!source.contents.includes(setting)) {
    const anchor = source.language === 'kt' ? 'super.onCreate()' : 'super.onCreate();';
    if (!source.contents.includes(anchor)) throw new Error('Cannot locate MainApplication.onCreate for WebRTC MediaProjection configuration');
    source.contents = source.contents.replace(anchor, `${anchor}\n    ${setting}${source.language === 'kt' ? '' : ';'}`);
  }
  return mod;
  });
};
