import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.desborde.chainreaction',
  appName: 'DESBORDE',
  webDir: 'dist',
  backgroundColor: '#09090b',
  android: {
    allowMixedContent: false,
    backgroundColor: '#09090b',
  },
};

export default config;
