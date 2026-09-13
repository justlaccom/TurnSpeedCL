const TurnSpeedCL = require("../index");

(async () => {
  const solver = new TurnSpeedCL({ turnstile: true, headless: false });

  try {
    const result = await solver.solve({
      url: "https://leak.fun",
      timeout: 60_000,
    });

    console.log("Solved:", result.solved);
    console.log("Elapsed:", result.elapsed, "ms");
    console.log("cf_clearance:", result.cookies.cloudflare.cf_clearance);
    console.log("Cookies count:", result.cookies.all.length);
  } finally {
    await solver.destroy();
  }
})();
