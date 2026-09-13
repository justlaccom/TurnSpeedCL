"use strict";

/** Version of the library. */
const VERSION = "1.0.5";

/**
 * Cloudflare cookies that TurnSpeedCL is interested in.
 * These are the cookies that confirm the "Managed Challenge" / Turnstile
 * (or classic CF challenge) has been solved for the target site.
 */
const CLOUDFLARE_COOKIES = [
  "cf_clearance", // main proof that the challenge was passed
  "cf_chl_rc_i", // challenge response cookies (www challenge)
  "cf_chl_rc_ni",
  "cf_chl_rc_m",
  "__cf_bm", // bot management cookie
];

/**
 * Default, realistic User-Agents used when the caller does not provide one.
 * The library rotates through them to vary per run.
 */
const DEFAULT_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
];

module.exports = {
  VERSION,
  CLOUDFLARE_COOKIES,
  DEFAULT_USER_AGENTS,
};