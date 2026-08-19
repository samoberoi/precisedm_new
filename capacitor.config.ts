import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.precisedm.app',
  appName: 'PreciseDM',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#38B6FF',
    },
    StatusBar: {
      style: 'DARK',
    },
  },
};

export default config;
