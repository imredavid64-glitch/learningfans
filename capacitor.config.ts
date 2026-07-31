import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.learningfans.app",
  appName: "LearningFans",
  webDir: ".next",
  server: {
    url: "https://learningfans.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#030711",
      showSpinner: true,
      spinnerColor: "#0f7670",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#030711",
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
    },
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#030711",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#030711",
  },
};

export default config;
