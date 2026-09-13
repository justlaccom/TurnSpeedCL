"use strict";

const { EventEmitter } = require("events");
const { connect } = require("puppeteer-real-browser");
const { CLOUDFLARE_COOKIES, DEFAULT_USER_AGENTS } = require("./constants");
const { resolveChrome, findChromeExecutable } = require("./browserManager");

const DEFAULT_TIMEOUT = 120_000; // max time to wait for the challenge to be solved
const DEFAULT_POLL_INTERVAL = 200; // poll every 200ms for instant detection

/**
 * Chromium flags that eliminate background bloat and dramatically accelerate startup.
 */
const FAST_LAUNCH_FLAGS = [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-extensions-with-background-pages",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-features=Translate,OptimizationHints,MediaRouter",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-popup-blocking",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--disable-sync",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-service-autorun",
  "--password-store=basic",
  "--use-mock-keychain",
];

/**
 * TurnSpeedCL: Solves Cloudflare Turnstile challenges at high speed
 * using a real browser pipeline with fake-headful (off-screen) stealth.
 */
class TurnSpeedCL extends EventEmitter {
  /**
   * @param {object}   [options]
   * @param {boolean}  [options.turnstile=true]          Auto-click the Turnstile checkbox when it appears.
   * @param {boolean|string} [options.headless=true]     true: runs invisibly offscreen while spoofing headful state. false: visible window.
   * @param {boolean}  [options.disableXvfb=false]        Linux only — set to true to force direct display.
   * @param {object}   [options.proxy]                   { host, port, username?, password? }
   * @param {string[]} [options.args]                    Extra Chromium flags.
   * @param {object}   [options.connectOption]           Extra puppeteer.connect() options.
   * @param {string}   [options.chromePath]              Explicit path to Chrome or Chromium executable.
   * @param {boolean}  [options.autoInstallChrome=true]  Automatically download Chrome if not found.
   * @param {string}   [options.cacheDir]                Custom directory to store downloaded Chrome.
   * @param {number}   [options.pollInterval=200]        Interval in ms to check for challenge resolution.
   * @param {boolean}  [options.closePageOnSolved=true]  Automatically close the page once cookies are found.
   * @param {boolean}  [options.waitForNetworkIdle=false] Whether to wait for network idle after navigation.
   */
  constructor(options = {}) {
    super();
    this.options = {
      turnstile: true,
      headless: true, // default to invisible headful mode
      disableXvfb: false,
      proxy: undefined,
      args: [],
      connectOption: {},
      autoInstallChrome: true,
      chromePath: undefined,
      cacheDir: undefined,
      pollInterval: DEFAULT_POLL_INTERVAL,
      closePageOnSolved: true,
      waitForNetworkIdle: false,
      ...options,
    };

    this.browser = null;
    this.page = null;
    this.url = null;
    this.userAgent = null;
    this.running = false;
  }

  /**
   * Do we currently have a live browser?
   */
  isConnected() {
    return Boolean(this.browser && this.browser.isConnected && this.browser.isConnected());
  }

  /**
   * Resolve the Chrome executable path: explicit option > env var > disk cache > system > auto-download.
   * Returns the customConfig object expected by chrome-launcher.
   */
  async _resolveChromeConfig() {
    const config = {};
    const execPath = await resolveChrome({
      chromePath: this.options.chromePath,
      autoInstallChrome: this.options.autoInstallChrome,
      cacheDir: this.options.cacheDir,
    });

    if (execPath) {
      config.chromePath = execPath;
    }
    return config;
  }

  /**
   * Reads or resolves any existing chrome path.
   */
  _readChromePathFromDisk() {
    return findChromeExecutable({
      chromePath: this.options.chromePath,
      cacheDir: this.options.cacheDir,
    });
  }

  /**
   * Inject properties to make the browser report that it is fully open,
   * active, focused, and rendered at normal screen coordinates.
   */
  async _injectHeadfulSpoof(page) {
    if (!page) return;
    try {
      await page.evaluateOnNewDocument(() => {
        // Report active and visible state
        try {
          Object.defineProperty(document, "hidden", { get: () => false });
          Object.defineProperty(document, "visibilityState", { get: () => "visible" });
        } catch {}

        // Spoof standard monitor coordinates (hide offscreen offset)
        try {
          Object.defineProperty(window, "screenX", { get: () => 0 });
          Object.defineProperty(window, "screenY", { get: () => 0 });
          Object.defineProperty(window, "screenLeft", { get: () => 0 });
          Object.defineProperty(window, "screenTop", { get: () => 0 });
          Object.defineProperty(window, "outerWidth", { get: () => window.innerWidth || 1920 });
          Object.defineProperty(window, "outerHeight", { get: () => window.innerHeight || 1080 });
        } catch {}

        // Ensure window.screen has realistic desktop resolution
        try {
          if (window.screen) {
            Object.defineProperty(window.screen, "availWidth", { get: () => 1920 });
            Object.defineProperty(window.screen, "availHeight", { get: () => 1040 });
            Object.defineProperty(window.screen, "width", { get: () => 1920 });
            Object.defineProperty(window.screen, "height", { get: () => 1080 });
          }
        } catch {}

        // Dispatch focus event
        try {
          window.dispatchEvent(new Event("focus"));
        } catch {}
      });
    } catch {}
  }

  /**
   * Launch the browser. If headless: true, uses an invisible off-screen window
   * so the browser believes it is open on a real display without bothering the user.
   */
  async _ensureBrowser() {
    if (this.isConnected()) return;

    const chromeConfig = await this._resolveChromeConfig();

    // Prepare optimized launch flags
    const userArgs = this.options.args || [];
    const combinedArgs = [...FAST_LAUNCH_FLAGS, ...userArgs];

    let connectHeadless = false;

    if (this.options.headless === true) {
      // "Fake headful" (invisible offscreen window):
      // Launch as genuine headful to the OS/GPU, positioned far off-screen (-10000,-10000).
      // Cloudflare sees a 100% genuine display pipeline, while the user sees NO window!
      combinedArgs.push("--window-position=-10000,-10000");
      combinedArgs.push("--window-size=1920,1080");
      connectHeadless = false;
    } else if (this.options.headless === "new") {
      connectHeadless = "new";
    } else {
      // Explicit false or visible window
      connectHeadless = false;
    }

    const { browser, page } = await connect({
      headless: connectHeadless,
      turnstile: this.options.turnstile,
      disableXvfb: this.options.disableXvfb,
      proxy: this.options.proxy,
      args: combinedArgs,
      connectOption: this.options.connectOption,
      customConfig: chromeConfig,
    });

    this.browser = browser;
    this.page = page;

    // Apply headful spoofing if running in fake headful mode
    if (this.options.headless === true) {
      await this._injectHeadfulSpoof(page);
    }

    // Safety net: clean references on process exit
    browser.on("disconnected", () => {
      this.browser = null;
      this.page = null;
      this.running = false;
    });
  }

  /**
   * Apply a realistic User-Agent (override if provided, else rotate a default one).
   */
  async _setUserAgent(userAgent) {
    if (!this.page) return;
    if (userAgent) {
      this.userAgent = userAgent;
    } else {
      const idx = Math.floor(Math.random() * DEFAULT_USER_AGENTS.length);
      this.userAgent = DEFAULT_USER_AGENTS[idx];
    }
    await this.page.setUserAgent(this.userAgent);
  }

  /**
   * Read every cookie currently stored for the page's context
   * (includes HttpOnly ones like cf_clearance).
   */
  async getCookies() {
    const raw = this.page ? await this.page.cookies() : [];
    const named = CLOUDFLARE_COOKIES;
    const filtered = raw.filter((c) => named.includes(c.name));

    const byName = {};
    for (const cookie of filtered) {
      byName[cookie.name] = cookie.value;
    }

    return {
      cloudflare: byName,
      all: raw,
    };
  }

  /**
   * Visit `url`, wait for the Cloudflare challenge to clear, then hand back
   * the CF cookies and immediately close the page.
   *
   * @param {object} params
   * @param {string}  params.url                Target site (any scheme, http(s)).
   * @param {string}  [params.userAgent]         Override the User-Agent.
   * @param {number}  [params.timeout=120000]    Max ms to wait for the challenge.
   * @returns {Promise<object>} { url, userAgent, cookies: { cloudflare, all }, solved, elapsed }
   */
  async solve({ url, userAgent, timeout = DEFAULT_TIMEOUT } = {}) {
    if (!url) throw new Error("TurnSpeedCL: a `url` is required.");

    this._validateUrl(url);
    this.running = true;
    this.url = url;

    const started = Date.now();
    const pollInterval = this.options.pollInterval || DEFAULT_POLL_INTERVAL;

    await this._ensureBrowser();

    // If page was closed from a previous solve, open a fresh page in the same browser
    if (!this.page || this.page.isClosed()) {
      this.page = await this.browser.newPage();
      if (this.options.headless === true) {
        await this._injectHeadfulSpoof(this.page);
      }
    }

    await this._setUserAgent(userAgent);

    this.emit("navigating", url);

    // Fast navigation: domcontentloaded is enough for Turnstile scripts to run
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout });

    if (this.options.waitForNetworkIdle) {
      await this.page.waitForNetworkIdle({ timeout: 5_000 }).catch(() => {});
    }

    this.emit("challenge-detected", url);

    // --- High-speed polling until cf_clearance shows up ---
    let solved = false;
    let lastCookies = null;

    while (Date.now() - started < timeout) {
      if (!this.page || this.page.isClosed()) break;

      lastCookies = await this.getCookies().catch(() => null);

      if (lastCookies && lastCookies.cloudflare && lastCookies.cloudflare.cf_clearance) {
        solved = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Read final cookies if needed
    if (!lastCookies && this.page && !this.page.isClosed()) {
      lastCookies = await this.getCookies().catch(() => ({
        cloudflare: {},
        all: [],
      }));
    }

    const elapsed = Date.now() - started;

    if (solved) this.emit("challenge-solved", lastCookies?.cloudflare);
    if (!solved && this.options.turnstile) {
      this.emit("challenge-timeout", lastCookies?.cloudflare);
    }

    // Fermer la page immédiatement dès que les cookies sont détectés
    if (this.options.closePageOnSolved && this.page && !this.page.isClosed()) {
      try {
        await this.page.close();
      } catch {}
      this.page = null;
    }

    this.running = false;

    return {
      url,
      userAgent: this.userAgent,
      solved,
      elapsed,
      cookies: lastCookies || { cloudflare: {}, all: [] },
    };
  }

  /**
   * Cleanup that keeps the browser alive for potential follow-up calls.
   */
  reset() {
    this.url = null;
    this.running = false;
  }

  /**
   * Fully close the browser and drop references.
   */
  async destroy() {
    if (this.browser) {
      // Temporarily suppress harmless Windows EPERM from chrome-launcher's destroyTmp()
      const originalLog = console.log;
      const filter = (...args) => {
        if (
          args[0] &&
          args[0].code === "EPERM" &&
          typeof args[0].path === "string" &&
          args[0].path.includes("lighthouse")
        ) {
          return;
        }
        originalLog.apply(console, args);
      };
      console.log = filter;

      try {
        await this.browser.close();
      } catch (err) {
        /* already closed */
      } finally {
        setTimeout(() => {
          if (console.log === filter) {
            console.log = originalLog;
          }
        }, 500).unref();
      }
    }
    this.browser = null;
    this.page = null;
    this.running = false;
  }

  _validateUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`TurnSpeedCL: "${url}" is not a valid URL.`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`TurnSpeedCL: only http(s) URLs are supported, got "${parsed.protocol}".`);
    }
  }
}

module.exports = TurnSpeedCL;