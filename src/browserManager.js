"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const USER_CACHE_DIR =
  process.env.TURNSPEEDCL_CACHE_DIR ||
  path.join(os.homedir(), ".turnspeedcl", "chrome");

const LOCAL_CACHE_DIR = path.resolve(__dirname, "..", ".chrome-local");

/**
 * Check if a file exists and is a regular file.
 */
function isValidExecutable(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Read executable path from a chrome-path.txt file.
 */
function readPathFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const p = fs.readFileSync(filePath, "utf-8").trim();
      if (isValidExecutable(p)) return p;
    }
  } catch {}
  return null;
}

/**
 * Find Chrome inside a @puppeteer/browsers cache directory.
 */
function findChromeInDir(cacheDir) {
  if (!cacheDir) return null;
  try {
    const resolved = path.resolve(cacheDir);
    const chromeDir = path.join(resolved, "chrome");
    if (!fs.existsSync(chromeDir)) return null;

    const entries = fs.readdirSync(chromeDir);
    for (const entry of entries) {
      const entryPath = path.join(chromeDir, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        // Windows
        const win64 = path.join(entryPath, "chrome-win64", "chrome.exe");
        if (isValidExecutable(win64)) return win64;
        const win32 = path.join(entryPath, "chrome-win32", "chrome.exe");
        if (isValidExecutable(win32)) return win32;

        // Linux
        const linux = path.join(entryPath, "chrome-linux64", "chrome");
        if (isValidExecutable(linux)) return linux;

        // macOS
        const macIntel = path.join(
          entryPath,
          "chrome-mac-x64",
          "Google Chrome for Testing.app",
          "Contents",
          "MacOS",
          "Google Chrome for Testing"
        );
        if (isValidExecutable(macIntel)) return macIntel;

        const macArm = path.join(
          entryPath,
          "chrome-mac-arm64",
          "Google Chrome for Testing.app",
          "Contents",
          "MacOS",
          "Google Chrome for Testing"
        );
        if (isValidExecutable(macArm)) return macArm;
      }
    }
  } catch {}
  return null;
}

/**
 * Scan cache directories for previously downloaded Chrome binaries.
 */
function findCachedChrome(customCacheDir) {
  const dirs = [customCacheDir, USER_CACHE_DIR, LOCAL_CACHE_DIR].filter(Boolean);

  for (const dir of dirs) {
    // 1. Check chrome-path.txt
    const txtPath = path.join(dir, "chrome-path.txt");
    const p = readPathFile(txtPath);
    if (p) return p;

    // 2. Direct directory scan for Chrome binary
    const found = findChromeInDir(dir);
    if (found) {
      // Cache the found path
      try {
        fs.writeFileSync(txtPath, found, "utf-8");
      } catch {}
      return found;
    }
  }

  return null;
}

/**
 * Look for Google Chrome installed on the system.
 */
function findSystemChrome() {
  try {
    const { Launcher } = require("chrome-launcher");
    const chrome = Launcher.getFirstInstallation();
    if (isValidExecutable(chrome)) return chrome;
  } catch {}

  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  if (isWin) {
    const prefixes = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
    ].filter(Boolean);

    for (const prefix of prefixes) {
      const p = path.join(prefix, "Google", "Chrome", "Application", "chrome.exe");
      if (isValidExecutable(p)) return p;
      const sxs = path.join(prefix, "Google", "Chrome SxS", "Application", "chrome.exe");
      if (isValidExecutable(sxs)) return sxs;
    }
  } else if (isMac) {
    const macPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ];
    for (const p of macPaths) {
      if (isValidExecutable(p)) return p;
    }
  } else if (isLinux) {
    const linuxPaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
    ];
    for (const p of linuxPaths) {
      if (isValidExecutable(p)) return p;
    }
  }

  return null;
}

/**
 * Look for alternative Chromium-based browsers (Edge, Brave, Chromium) on the system.
 */
function findSystemAlternativeBrowser() {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  if (isWin) {
    const prefixes = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
    ].filter(Boolean);

    // Standard Edge
    for (const prefix of prefixes) {
      const edge = path.join(prefix, "Microsoft", "Edge", "Application", "msedge.exe");
      if (isValidExecutable(edge)) return edge;
    }

    // EdgeCore fallback
    for (const prefix of prefixes) {
      const edgeCoreDir = path.join(prefix, "Microsoft", "EdgeCore");
      try {
        if (fs.existsSync(edgeCoreDir)) {
          const subdirs = fs.readdirSync(edgeCoreDir);
          for (const sub of subdirs) {
            const edge = path.join(edgeCoreDir, sub, "msedge.exe");
            if (isValidExecutable(edge)) return edge;
          }
        }
      } catch {}
    }

    // Brave
    for (const prefix of prefixes) {
      const brave = path.join(prefix, "BraveSoftware", "Brave-Browser", "Application", "brave.exe");
      if (isValidExecutable(brave)) return brave;
    }
  } else if (isMac) {
    const macPaths = [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const p of macPaths) {
      if (isValidExecutable(p)) return p;
    }
  } else if (isLinux) {
    const linuxPaths = [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable",
      "/usr/bin/brave-browser",
    ];
    for (const p of linuxPaths) {
      if (isValidExecutable(p)) return p;
    }
  }

  return null;
}

/**
 * Find an existing Chrome or compatible browser executable.
 */
function findChromeExecutable(options = {}) {
  // 1. Explicit option passed by caller
  if (options.chromePath && isValidExecutable(options.chromePath)) {
    return options.chromePath;
  }

  // 2. Environment variables
  const envCandidates = [
    process.env.CHROME_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ];
  for (const envPath of envCandidates) {
    if (isValidExecutable(envPath)) return envPath;
  }

  // 3. Cached Chrome downloads (user cache or local .chrome-local)
  const cached = findCachedChrome(options.cacheDir);
  if (cached) return cached;

  // 4. System Google Chrome
  const systemChrome = findSystemChrome();
  if (systemChrome) return systemChrome;

  // 5. System alternative Chromium browsers (Edge, Brave, Chromium)
  const alt = findSystemAlternativeBrowser();
  if (alt) return alt;

  return null;
}

/**
 * Download Chrome using @puppeteer/browsers.
 */
async function downloadChrome(options = {}) {
  const {
    install,
    resolveBuildId,
    detectBrowserPlatform,
    Browser,
  } = require("@puppeteer/browsers");

  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error(
      `[TurnSpeedCL] Cannot detect browser platform for: ${os.platform()} (${os.arch()})`
    );
  }

  // Resolve stable build ID
  let buildId;
  try {
    buildId = await resolveBuildId(Browser.CHROME, platform, "stable");
  } catch (err) {
    throw new Error(
      `[TurnSpeedCL] Failed to resolve stable Chrome build ID: ${err.message}`
    );
  }

  const cacheDir = path.resolve(options.cacheDir || USER_CACHE_DIR);
  fs.mkdirSync(cacheDir, { recursive: true });

  console.log(
    `[TurnSpeedCL] Downloading Chrome (${buildId}) to ${cacheDir}...`
  );

  const installed = await install({
    browser: Browser.CHROME,
    buildId,
    cacheDir,
    unpack: true,
  });

  const execPath = installed.executablePath;

  // Persist path for instant discovery
  try {
    fs.writeFileSync(path.join(cacheDir, "chrome-path.txt"), execPath, "utf-8");
  } catch {}

  try {
    fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(LOCAL_CACHE_DIR, "chrome-path.txt"), execPath, "utf-8");
  } catch {}

  process.env.CHROME_PATH = execPath;
  process.env.CHROME_EXECUTABLE_PATH = execPath;

  console.log(`[TurnSpeedCL] Chrome downloaded successfully: ${execPath}`);
  return execPath;
}

/**
 * Resolve Chrome path or automatically download it if missing.
 */
async function resolveChrome(options = {}) {
  let execPath = findChromeExecutable(options);
  if (execPath) {
    return execPath;
  }

  if (options.autoInstallChrome !== false) {
    execPath = await downloadChrome(options);
    if (execPath && isValidExecutable(execPath)) {
      return execPath;
    }
  }

  throw new Error(
    "[TurnSpeedCL] No Chrome installation found on your system, and auto-download failed or was disabled.\n" +
      "Please install Google Chrome, set CHROME_PATH, or pass { chromePath: '...' } in TurnSpeedCL options."
  );
}

module.exports = {
  USER_CACHE_DIR,
  LOCAL_CACHE_DIR,
  isValidExecutable,
  findChromeInDir,
  findCachedChrome,
  findSystemChrome,
  findSystemAlternativeBrowser,
  findChromeExecutable,
  downloadChrome,
  resolveChrome,
};
