const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Keep Metro's transformation pool modest on the 8 GB development laptop.
config.maxWorkers = 2;

module.exports = config;
