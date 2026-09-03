import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and visual evidence for Lab 2 (§8.8, §12).
 *
 * This is the only suite in the repository that runs the real application. Every
 * other test imports a module into jsdom, which loads no stylesheet and has no
 * layout engine — so "is this the right green?", "does the page scroll
 * sideways?" and "is that label clipped?" are questions nothing else here can
 * even ask. Four defects in Issue #19 were found by a person opening the screen
 * because of that gap; this is the suite that closes it.
 *
 * Edge rather than a downloaded Chromium: `channel` drives the browser already
 * installed on the machine, so nothing has to fetch a hundred megabytes before
 * the evidence can be produced.
 */

const HOST = "http://localhost:5173";

/** §8.7's three bands, at the sizes ui-spec.md §10 names. */
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
} as const;

export default defineConfig({
  testDir: "./e2e/lab-02",
  outputDir: "./test-results",

  // The screenshots are evidence, and evidence produced by two workers racing
  // over one database is evidence of nothing. The journey spec creates tickets
  // and removes attachments; running it three times at once would have the
  // three viewports fighting over the same rows.
  workers: 1,
  fullyParallel: false,

  // A retry hides exactly the flakiness this suite exists to catch.
  retries: 0,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: HOST,
    trace: "retain-on-failure",
    video: "off",
    // The screenshots we keep are taken deliberately and named; Playwright's
    // own failure captures go to test-results, which is gitignored.
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        viewport: VIEWPORTS.desktop,
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        viewport: VIEWPORTS.tablet,
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        viewport: VIEWPORTS.mobile,
      },
    },
  ],

  /**
   * Both halves of the application, started by the runner and reused if they
   * are already up.
   *
   * `reuseExistingServer` is deliberately on outside CI: during development the
   * dev servers are usually already running, and a config that insists on
   * starting its own would fail on the port rather than use what is there.
   */
  webServer: [
    {
      command: "npm run dev -w server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
    },
    {
      command: "npm run dev -w client",
      url: HOST,
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
    },
  ],
});
