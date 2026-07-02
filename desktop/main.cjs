const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow;
let startedServer;

function appPath(...segments) {
  return path.join(app.getAppPath(), ...segments);
}

async function startBackend() {
  const backendEntry = appPath("backend", "dist", "index.js");
  const frontendPath = appPath("frontend");
  const backendModule = await import(pathToFileURL(backendEntry).href);

  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  process.env.HOST = "127.0.0.1";

  startedServer = await backendModule.startServer({
    frontendPath,
    host: "127.0.0.1",
    port: 0
  });

  return startedServer.url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "Career Signal Engine",
    backgroundColor: "#f6f4ef",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });
}

async function boot() {
  try {
    const url = await startBackend();
    createWindow(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The desktop app could not start.";
    dialog.showErrorBox("Career Signal Engine", message);
    app.quit();
  }
}

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (startedServer?.server) {
    startedServer.server.close();
  }
});
