const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("learningfans", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
  platform: process.platform,
  isElectron: true,
});
