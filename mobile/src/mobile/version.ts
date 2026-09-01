import Constants from 'expo-constants';

const expoConfig = Constants.expoConfig;

export const APP_VERSION = String(
  expoConfig?.version
  ?? expoConfig?.extra?.releaseVersion
  ?? 'development',
);

export const APP_BUILD_NUMBER = String(
  expoConfig?.ios?.buildNumber
  ?? expoConfig?.android?.versionCode
  ?? '—',
);
