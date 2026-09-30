import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

const SHOT = process.env.E2E_SHOTS; // folder tangkapan layar (opsional)
const shot = async (page: Page, name: string) => {
  if (SHOT) await page.screenshot({ path: `${SHOT}/${name}.png` });
};

// Scene sintetis (tile 12x12 km) berada di sekitar sini.
const SCENE_BBOX = [103.19, -2.83, 103.32, -2.7];

async function openAndFly(page: Page) {
  await page.route("**/api/geocode*", (route) =>
    route.fulfill({ json: [{ name: "Lokasi uji", lat: -2.767, lon: 103.2548, bbox: SCENE_BBOX }] }),
  );
  await page.goto("/");
  await expect(page.getByTestId("map")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByLabel("Cari lokasi").fill("lokasi uji");
  await page.getByRole("button", { name: "Lokasi uji" }).click();
  await page.waitForTimeout(1500); // animasi fitBounds
}

async function drawRectangle(page: Page, dx = 90, dy = 70) {
  const box = (await page.getByTestId("map").boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.getByRole("button", { name: "Rectangle" }).click();
  await page.mouse.move(cx - dx, cy - dy);
  await page.mouse.click(cx - dx, cy - dy);
  await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
  await page.mouse.click(cx + dx, cy + dy);
}

async function setDates(page: Page, start: string, end: string) {
  await page.getByLabel("Tanggal mulai").fill(start);
  await page.getByLabel("Tanggal akhir").fill(end);
}

test("alur utama: gambar AOI → cari → preview → pilih → proses → unduh", async ({ page, request }) => {
  await openAndFly(page);
  await shot(page, "1-peta");

  // ---- AOI (Rectangle)
  await drawRectangle(page);
  await expect(page.getByTestId("aoi-info")).toBeVisible();
  await expect(page.getByTestId("aoi-info")).toContainText("km²");
  await expect(page.getByTestId("aoi-info")).toContainText("EPSG:4326");

  // ---- Filter + cari
  await setDates(page, "2026-09-01", "2026-09-30");
  await page.getByLabel("Cloud cover kustom (%)").fill("20");
  await page.getByTestId("search").click();
  await expect(page.getByTestId("scene-count")).toHaveText("2");
  const cards = page.getByTestId("scene-card");
  await expect(cards.first()).toContainText("25 Sep 2026");
  await expect(cards.first()).toContainText("4.2%");
  await expect(cards.first()).toContainText("48MUB");
  await expect(cards.first()).toContainText("L2A");
  await expect(cards.nth(1)).toContainText("18 Sep 2026");

  // ---- Preview
  const previewResp = page.waitForResponse((r) => r.url().includes("/api/scenes/preview") && r.status() === 200);
  await cards.first().getByRole("button", { name: "Preview" }).click();
  const pv = await (await previewResp).json();
  expect(pv.image).toMatch(/^data:image\/png;base64,/);
  await expect(cards.first().getByRole("button", { name: "Sembunyikan" })).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, "2-preview");

  // ---- Pilih + unduh
  await cards.first().getByRole("button", { name: "Pilih" }).click();
  await expect(page.getByRole("heading", { name: /Unduh/ })).toBeVisible();
  await page.getByRole("button", { name: "RGB", exact: true }).click();
  await page.getByRole("radio", { name: "20 m" }).click();
  await expect(page.getByTestId("resample-note")).toContainText("B04 (10 m → 20 m, average)");
  await page.getByRole("radio", { name: "10 m" }).click();
  await page.getByTestId("start-download").click();
  await expect(page.getByTestId("job")).toHaveAttribute("data-status", "COMPLETED", { timeout: 60_000 });
  await shot(page, "3-selesai");

  const links = await page.getByTestId("files").getByRole("link").evaluateAll((els) => els.map((e) => [e.textContent, (e as HTMLAnchorElement).href]));
  const names = links.map((l) => (l[0] ?? "").replace("⬇", "").trim());
  expect(names.sort()).toEqual(["AOI_2026-09-25.tif", "AOI_2026-09-25_COG.tif", "metadata.json"]);

  const metaUrl = links.find((l) => (l[0] ?? "").includes("metadata"))![1]!;
  const meta = await (await request.get(metaUrl)).json();
  expect(meta).toMatchObject({
    satellite: "Sentinel-2", acquisition_date: "2026-09-25", cloud_cover: 4.2,
    bands: ["B04", "B03", "B02"], resolution: "10m", crs: "EPSG:32748", cloud_masking: "not_applied",
  });
  const tif = await request.get(links.find((l) => (l[0] ?? "").endsWith("2026-09-25.tif"))![1]!);
  expect(tif.status()).toBe(200);
  const body = await tif.body();
  expect(["II*\0", "MM\0*"].includes(body.subarray(0, 4).toString("latin1"))).toBe(true);
  if (process.env.E2E_OUT) fs.writeFileSync(`${process.env.E2E_OUT}/AOI_2026-09-25.tif`, body);
});

test("AOI polygon (klik) dan hapus AOI", async ({ page }) => {
  await openAndFly(page);
  const box = (await page.getByTestId("map").boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.getByRole("button", { name: "Polygon" }).click();
  for (const [x, y] of [[-80, -60], [90, -50], [60, 70]] as const) {
    await page.mouse.move(cx + x, cy + y);
    await page.mouse.click(cx + x, cy + y);
  }
  await page.mouse.dblclick(cx - 70, cy + 60);
  await expect(page.getByTestId("aoi-info")).toContainText("AOI poligon");
  await page.getByRole("button", { name: "Hapus AOI" }).click();
  await expect(page.getByTestId("aoi-info")).toHaveCount(0);
  await expect(page.getByTestId("search")).toBeDisabled();
});

test("titik + radius dan perubahan radius menghitung ulang luas", async ({ page }) => {
  await openAndFly(page);
  const box = (await page.getByTestId("map").boundingBox())!;
  await page.getByLabel("Radius (meter)").fill("1000");
  await page.getByRole("button", { name: "Titik + radius" }).click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const info = page.getByTestId("aoi-info");
  await expect(info).toContainText("AOI titik + radius");
  await expect(info).toContainText(/3,1\d km²/); // π · 1² km²
  await page.getByLabel("Radius (meter)").fill("2000");
  await expect(info).toContainText(/12,[56]\d km²/, { timeout: 5000 }); // π · 2² km²
});

test("koordinat manual + validasi", async ({ page }) => {
  await openAndFly(page);
  await page.getByText("Masukkan koordinat").click();
  await page.getByRole("button", { name: "Buat AOI dari koordinat" }).click();
  await expect(page.getByText("Isi latitude dan longitude dengan angka.")).toBeVisible();
  await page.getByPlaceholder("-2.5").fill("-2.767");
  await page.getByPlaceholder("102.3").fill("103.2548");
  await page.getByRole("button", { name: "Buat AOI dari koordinat" }).click();
  await expect(page.getByTestId("aoi-info")).toContainText("AOI titik + radius");
});

test("unggah GeoJSON valid; format salah dan AOI terlalu besar menampilkan pesan", async ({ page }) => {
  await openAndFly(page);
  const ring = [[103.24, -2.78], [103.26, -2.78], [103.26, -2.76], [103.24, -2.76], [103.24, -2.78]];
  const gj = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
  await page.getByTestId("aoi-file").setInputFiles({ name: "aoi.geojson", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(gj)) });
  await expect(page.getByTestId("aoi-info")).toContainText("AOI poligon");

  await page.getByTestId("aoi-file").setInputFiles({ name: "aoi.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByRole("alert")).toContainText("Format berkas tidak didukung");

  const big = { type: "Polygon", coordinates: [[[100, -3], [104, -3], [104, 1], [100, 1], [100, -3]]] };
  await page.getByTestId("aoi-file").setInputFiles({ name: "big.geojson", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(big)) });
  await expect(page.getByRole("alert")).toContainText("terlalu besar");
});

test("pesan bila tidak ada citra / semua terlalu berawan", async ({ page }) => {
  await openAndFly(page);
  await drawRectangle(page);
  await expect(page.getByTestId("aoi-info")).toBeVisible();

  await setDates(page, "2026-09-01", "2026-09-30");
  await page.getByLabel("Cloud cover kustom (%)").fill("1");
  await page.getByTestId("search").click();
  await expect(page.getByTestId("no-scenes")).toContainText("Tidak tersedia citra dengan cloud cover ≤1% pada periode tersebut.");
  await expect(page.getByTestId("no-scenes")).toContainText("4.2%");

  await setDates(page, "2025-01-01", "2025-01-31");
  await page.getByTestId("search").click();
  await expect(page.getByTestId("no-scenes")).toContainText("Tidak ditemukan citra yang memenuhi kriteria.");

  await setDates(page, "2026-09-30", "2026-09-01");
  await expect(page.getByText("Tanggal akhir harus sama dengan atau setelah tanggal mulai.")).toBeVisible();
  await expect(page.getByTestId("search")).toBeDisabled();
});

test("tanggal tunggal dan relatif", async ({ page }) => {
  await openAndFly(page);
  await drawRectangle(page);
  await expect(page.getByTestId("aoi-info")).toBeVisible();
  await page.getByRole("radio", { name: "Satu tanggal" }).click();
  await page.getByLabel("Tanggal", { exact: true }).fill("2026-09-18");
  await page.getByLabel("Cloud cover kustom (%)").fill("100");
  await page.getByTestId("search").click();
  await expect(page.getByTestId("scene-count")).toHaveText("1");
  await expect(page.getByTestId("scene-card")).toContainText("18 Sep 2026");

  await page.getByRole("radio", { name: "Relatif" }).click();
  await page.getByRole("radio", { name: "Citra terbaru" }).click();
  await page.getByTestId("search").click();
  await expect(page.getByTestId("scene-count")).toHaveText(/^[01]$/); // bergantung tanggal hari ini
});
