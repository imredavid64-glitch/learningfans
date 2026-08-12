export {};

declare global {
  interface Window {
    /** Exposed by desktop/preload.js in the Electron app. */
    learningfans?: {
      getAppVersion?: () => Promise<string>;
      getAppPath?: () => Promise<string>;
      platform?: string;
      isElectron?: boolean;
    };
  }
}
