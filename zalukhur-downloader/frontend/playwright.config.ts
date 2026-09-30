import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const backend = path.resolve(here, "../backend");
const python = process.env.PYTHON ?? path.join(backend, ".venv/bin/python");
const dist = path.resolve(here, "dist");
const jobsDir = path.resolve(here, "../backend/.e2e-data");

// E2E: backend sungguhan + katalog STAC palsu (scene sintetis). Frontend hasil build dilayani backend.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8000",
    viewport: { width: 1400, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `${python} -m tests.fake_stac_server --port 9100`,
      cwd: backend,
      url: "http://127.0.0.1:9100/health",
      reuseExistingServer: false,
      env: { PYTHONPATH: backend, ALLOW_LOCAL_ASSETS: "1" },
    },
    {
      command: `${python} -m uvicorn app.main:create_app --factory --port 8000`,
      cwd: backend,
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
      env: {
        PYTHONPATH: backend,
        ALLOW_LOCAL_ASSETS: "1",
        STAC_URL: "http://127.0.0.1:9100/v1",
        FRONTEND_DIST: dist,
        DATA_DIR: jobsDir,
      },
    },
  ],
});
