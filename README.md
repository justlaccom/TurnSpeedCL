# TurnSpeedCL

> **Turn**stile **Speed** — **C**loudflare **L**ibrary

Node.js library that drives a **real (headful) Chrome** through
[`puppeteer-real-browser`](https://www.npmjs.com/package/puppeteer-real-browser),
navigates to a Cloudflare-protected site, lets the **Turnstile / Managed Challenge**
be solved (auto-clicked), and hands you back the valuable **Cloudflare cookies**:

- `cf_clearance`
- `cf_chl_rc_i`
- `cf_chl_rc_ni`
- `cf_chl_rc_m`
- `__cf_bm`

No fake user-agent strings, no headless flags to trip CF — the browser window
actually opens and behaves like a human's.

---

## Install

```bash
npm install turnspeedcl
```

> `puppeteer-real-browser` bundles **`rebrowser-puppeteer-core`** and
> `chrome-launcher`. On first run it will download/attach the system Chrome;
> a visible desktop session is expected (Windows/macOS work out of the box,
> on Linux headless servers you'll want `xvfb`).

---

## Quick start

```js
const TurnSpeedCL = require("turnspeedcl");

(async () => {
  const solver = new TurnSpeedCL({ turnstile: true, headless: false });

  try {
    const result = await solver.solve({
      url: "https://example-protected-site.com",
      timeout: 120_000,
    });

    console.log("Solved:", result.solved);           // true | false
    console.log("Elapsed:", result.elapsed, "ms");

    console.log("cf_clearance:", result.cookies.cloudflare.cf_clearance);
    console.log("__cf_bm:", result.cookies.cloudflare.__cf_bm);
    console.log("cf_chl_rc_*:", result.cookies.cloudflare.cf_chl_rc_m);

    // Every cookie from the page context, if you need more
    console.log(result.cookies.all);
  } finally {
    await solver.destroy();
  }
})();
```

---

## API

### `new TurnSpeedCL(options)`

| Option              | Type      | Default | Description                                                                                 |
| ------------------- | --------- | ------- | ------------------------------------------------------------------------------------------- |
| `turnstile`         | `boolean` | `true`  | Auto-click the Turnstile checkbox when it appears.                                          |
| `headless`          | `boolean` | `true`  | `true`: runs invisibly off-screen while spoofing headful state. `false`: visible window.    |
| `closePageOnSolved` | `boolean` | `true`  | Automatically closes the page tab immediately when cookies are detected.                    |
| `pollInterval`      | `number`  | `200`   | Polling interval in ms for detecting clearance cookies (sub-second resolution).             |
| `autoInstallChrome` | `boolean` | `true`  | Automatically downloads stable Chrome via `@puppeteer/browsers` if not found.               |
| `chromePath`        | `string`  | —       | Explicit path to Chrome or Chromium binary.                                                 |
| `disableXvfb`       | `boolean` | `false` | Linux-only; `true` to force direct display.                                                 |
| `proxy`             | `object`  | —       | `{ host, port, username?, password? }`.                                                     |
| `args`              | `string[]`| `[]`    | Extra Chromium flags.                                                                       |
| `connectOption`     | `object`  | `{}`    | Extra `puppeteer.connect()` options.                                                        |

### `await solver.solve({ url, userAgent?, timeout? })`

Opens the browser, navigates to `url`, waits for the challenge cookies and returns:

```js
{
  url,                       // the URL you asked for
  userAgent,                 // the UA actually used (defaults are realistic)
  solved,                    // true if cf_clearance appeared before timeout
  elapsed,                   // ms spent waiting
  cookies: {
    cloudflare: { cf_clearance, cf_chl_rc_i, cf_chl_rc_ni, cf_chl_rc_m, __cf_bm, ... },
    all: [ /* full raw cookie list from page.cookies() */ ]
  }
}
```

If `cf_clearance` hasn't appeared by `timeout` (default `120_000` ms), the
function **returns anyway** with `solved: false`, so you can inspect whatever
cookies did get set (`__cf_bm` often arrives first).

### `await solver.getCookies()`

Returns the same `{ cloudflare, all }` shape on demand (useful after the page
is canvassing for an additional challenge).

### `await solver.destroy()`

Closes the browser and frees references.

### Events

`TurnSpeedCL` extends `EventEmitter`:

```js
solver.on("navigating", (url) => console.log("Going to", url));
solver.on("challenge-detected", (url) => console.log("Challenge page hit"));
solver.on("challenge-solved", (cfCookies) => console.log("In!"));
solver.on("challenge-timeout", (cfCookies) => console.log("Gave up waiting"));
```

---

## Using the cookies afterwards

The value of this library is the **`cf_clearance`** cookie combined with the
same client-aspect (UA, IP). To actually stay cleared you usually must replay
**all** the cookies back into your own HTTP client, with the same
`User-Agent` header. Example with `fetch`:

```js
const cookieHeader = result.cookies.all
  .map((c) => `${c.name}=${c.value}`)
  .join("; ");

const res = await fetch(url, {
  headers: { "User-Agent": result.userAgent, Cookie: cookieHeader },
});
```

> ⚠️ Cloudflare binds cookies to the client/IP; swapping IPs between solving
> and reusing will invalidate `cf_clearance`.

---

## Notes & caveats

- **This is not a "bypass hack".** It just runs a genuine browser session and
  completes the same human challenge a real visitor would. Use it to fetch data
  you're allowed to access.
- Turnstile challenges sometimes require a human to tick the box themselves —
  with a headful browser the user can click it live during the run.
- If the site uses higher-interactivity checks, you can extend the session
  yourself: the returned `browser`/`page` are reachable via
  `solver.browser` / `solver.page`.

---

## License

MIT.