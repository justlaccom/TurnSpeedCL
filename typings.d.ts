import { EventEmitter } from "events";
import type { Browser, Page } from "rebrowser-puppeteer-core";

export interface TurnSpeedCLOptions {
  /** Let puppeteer-real-browser auto-click the Turnstile checkbox. Default: true */
  turnstile?: boolean;
  /** true: runs invisibly offscreen while spoofing headful state. false: visible window. Default: true */
  headless?: boolean | "auto" | "new";
  /** Linux only — set to true to see the window on bare Linux. Default: false */
  disableXvfb?: boolean;
  /** Proxy configuration { host, port, username?, password? } */
  proxy?: {
    host: string;
    port: number | string;
    username?: string;
    password?: string;
  };
  /** Extra Chromium flags */
  args?: string[];
  /** Extra puppeteer.connect() options */
  connectOption?: Record<string, any>;
  /** Explicit path to Chrome or Chromium executable */
  chromePath?: string;
  /** Automatically download Chrome via @puppeteer/browsers if not found. Default: true */
  autoInstallChrome?: boolean;
  /** Custom directory to store downloaded Chrome */
  cacheDir?: string;
  /** Polling interval in ms to check for challenge clearance. Default: 200 */
  pollInterval?: number;
  /** Automatically close the page immediately when clearance cookies are found. Default: true */
  closePageOnSolved?: boolean;
  /** Whether to wait for network idle after navigation. Default: false */
  waitForNetworkIdle?: boolean;
}

export interface SolveParams {
  /** Target URL (http or https) */
  url: string;
  /** Custom User-Agent override */
  userAgent?: string;
  /** Max ms to wait for the challenge to be solved. Default: 120_000 */
  timeout?: number;
}

export interface CloudflareCookies {
  cf_clearance?: string;
  cf_chl_rc_i?: string;
  cf_chl_rc_ni?: string;
  cf_chl_rc_m?: string;
  __cf_bm?: string;
  [key: string]: string | undefined;
}

export interface CookieObject {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  [key: string]: any;
}

export interface SolveResult {
  url: string;
  userAgent: string;
  solved: boolean;
  elapsed: number;
  cookies: {
    cloudflare: CloudflareCookies;
    all: CookieObject[];
  };
}

export interface GetCookiesResult {
  cloudflare: CloudflareCookies;
  all: CookieObject[];
}

export class TurnSpeedCL extends EventEmitter {
  constructor(options?: TurnSpeedCLOptions);

  browser: Browser | null;
  page: Page | null;
  url: string | null;
  userAgent: string | null;
  running: boolean;
  options: TurnSpeedCLOptions;

  isConnected(): boolean;
  solve(params: SolveParams): Promise<SolveResult>;
  getCookies(): Promise<GetCookiesResult>;
  reset(): void;
  destroy(): Promise<void>;
}

export const VERSION: string;
export default TurnSpeedCL;
