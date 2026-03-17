const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/ict.html`;

let serverProcess = null;

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/api/status`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const attempt = async () => {
      const up = await checkServer();
      if (up) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(attempt, 400);
    };
    attempt();
  });
}

async function ensureServer() {
  const up = await checkServer();
  if (up) return;
  serverProcess = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    stdio: "inherit",
    env: process.env,
  });
  await waitForServer();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: "#0b1118",
    icon: path.join(__dirname, "image", "logo.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.removeMenu();
  win.loadURL(BASE_URL);
  win.once("ready-to-show", () => win.show());
}

app.whenReady().then(async () => {
  await ensureServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
