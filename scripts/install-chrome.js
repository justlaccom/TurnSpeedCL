#!/usr/bin/env node
"use strict";

/**
 * scripts/install-chrome.js
 *
 * Installs Chrome (stable via @puppeteer/browsers) if Chrome or a
 * compatible Chromium browser is not already available.
 */

const { findChromeExecutable, downloadChrome } = require("../src/browserManager");

async function main() {
  try {
    const existing = findChromeExecutable();
    if (existing) {
      console.log("[TurnSpeedCL] Browser detected:", existing);
      return;
    }

    console.log("[TurnSpeedCL] No browser found. Downloading Chrome via @puppeteer/browsers...");
    await downloadChrome();
    console.log("[TurnSpeedCL] Chrome installation completed successfully.");
  } catch (err) {
    console.warn("[TurnSpeedCL] Postinstall Chrome download failed:", err.message);
    console.warn("[TurnSpeedCL] TurnSpeedCL will attempt to download Chrome automatically on first run,");
    console.warn("[TurnSpeedCL] or you can set CHROME_PATH / provide { chromePath } in options.");
    process.exitCode = 0;
  }
}

main();
