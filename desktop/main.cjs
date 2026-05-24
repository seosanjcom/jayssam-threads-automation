const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

let serverModule = null;
let server = null;
const port = Number(process.env.THREADS_STUDIO_PORT || "8788");

function appRoot() {
  if (app.isPackaged) {
    const unpackedApp = path.join(process.resourcesPath, "app");
    if (fs.existsSync(unpackedApp)) return unpackedApp;
    return process.resourcesPath;
  }
  return path.resolve(__dirname, "..");
}

function loadEnv(...roots) {
  for (const root of roots) {
    const envPath = path.join(root, ".env");
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").trim();
    }
  }
}

function isPortOpen(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection(targetPort, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(700, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function startStudioServer(root) {
  if (await isPortOpen(port)) return;
  const serverPath = path.join(root, "scripts", "threads_studio_server.mjs");
  serverModule = await import(serverPath);
  server = serverModule.createStudioServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

async function createWindow() {
  const root = appRoot();
  process.chdir(root);
  loadEnv(root, process.resourcesPath);
  await startStudioServer(root);

  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1040,
    minHeight: 720,
    title: "Threads Automation",
    backgroundColor: "#f4f5f7",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await win.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox("Threads Automation failed to start", error instanceof Error ? error.stack || error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => {
  if (server) server.close();
  app.quit();
});
