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
  await expect(page.getByTestId("scene-count")).toHaveText("4");
  const cards = page.getByTestId("scene-card");
  await expect(cards.first()).toContainText("25 Sep 2026");
  await expect(cards.first()).toContainText("4.2%");
  await expect(cards.first()).toContainText("48MUB");
  await expect(cards.first()).toContainText("L2A");
  await expect(cards.nth(1)).toContainText("18 Sep 2026");
  await expect(cards.nth(3)).toContainText("8 Sep 2026");

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
  await page.getByLabel("Cloud cover kustom (%)").fill("0");
  await page.getByTestId("search").click();
  await expect(page.getByTestId("no-scenes")).toContainText("Tidak tersedia citra dengan cloud cover ≤0% pada periode tersebut.");
  await expect(page.getByTestId("no-scenes")).toContainText("1%"); // cloud cover terendah yang ada

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


// ============================================================ tahap 2: cloud masking

// AOI 6x6 km yang mencakup seluruh pola awan sintetis (lon/lat WGS84)
const CLOUD_AOI = {
  type: "Feature", properties: {},
  geometry: { type: "Polygon", coordinates: [[[103.209842, -2.776141], [103.2638, -2.776222], [103.263878, -2.721964], [103.209923, -2.721885], [103.209842, -2.776141]]] },
};

async function selectSceneWithAoi(page: Page, cardIndex: number) {
  await openAndFly(page);
  await page.getByTestId("aoi-file").setInputFiles({ name: "aoi.geojson", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(CLOUD_AOI)) });
  await expect(page.getByTestId("aoi-info")).toContainText("AOI poligon");
  await setDates(page, "2026-09-01", "2026-09-30");
  await page.getByLabel("Cloud cover kustom (%)").fill("100");
  await page.getByTestId("search").click();
  await expect(page.getByTestId("scene-count")).toHaveText("4");
  await page.getByTestId("scene-card").nth(cardIndex).getByRole("button", { name: "Pilih" }).click();
  await expect(page.getByTestId("cloudmask")).toBeVisible();
}

test("cloud masking SCL + isi dari dua citra sebelumnya → unduh dengan peta QA", async ({ page, request }) => {
  await selectSceneWithAoi(page, 0); // 25 Sep
  const cm = page.getByTestId("cloudmask");
  await cm.getByLabel("Aktifkan mask dari SCL").check();

  // % awan tepat di AOI dari SCL (bukan cloud cover katalog 4.2%)
  await expect(page.getByTestId("aoi-cloud-current")).toHaveText(/^\d+\.\d%$/, { timeout: 15_000 });
  const cloudPct = parseFloat((await page.getByTestId("aoi-cloud-current").textContent())!);
  expect(cloudPct).toBeGreaterThan(4);
  expect(cloudPct).toBeLessThan(14);

  // tanpa citra sebelumnya terpilih -> tidak boleh diproses
  await cm.getByLabel("Isi piksel ter-mask dari citra sebelumnya").check();
  await expect(page.getByTestId("mask-problem")).toHaveText("Pilih minimal satu citra sebelumnya.");
  await expect(page.getByTestId("start-download")).toBeDisabled();

  const cands = page.getByTestId("prev-candidate");
  await expect(cands).toHaveCount(3);
  await expect(cands.nth(0)).toContainText("18 Sep 2026");
  await expect(cands.nth(1)).toContainText("13 Sep 2026");
  await expect(cands.nth(0)).toContainText(/di AOI \d+\.\d%/, { timeout: 15_000 });
  await cands.nth(0).click();
  await cands.nth(1).click();
  await expect(cands.nth(0).locator(".badge")).toHaveText("1");
  await expect(cands.nth(1).locator(".badge")).toHaveText("2");
  await expect(page.getByTestId("mask-problem")).toHaveCount(0);

  // pratinjau: ter-mask X%, semuanya terisi
  await page.getByTestId("preview-mask").click();
  await expect(page.getByTestId("mask-preview-stats")).toContainText("terisi", { timeout: 30_000 });
  const txt = (await page.getByTestId("mask-preview-stats").textContent())!;
  const [masked, filled, rest] = [...txt.matchAll(/(\d+\.\d)%/g)].map((m) => parseFloat(m[1]!));
  expect(masked).toBeGreaterThan(0);
  expect(filled).toBeCloseTo(masked!, 1);
  expect(rest).toBe(0);
  await shot(page, "4-cloudmask");

  await page.getByRole("button", { name: "RGB", exact: true }).click();
  await page.getByTestId("start-download").click();
  await expect(page.getByTestId("job")).toHaveAttribute("data-status", "COMPLETED", { timeout: 60_000 });
  const links = await page.getByTestId("files").getByRole("link").evaluateAll((els) => els.map((e) => [e.textContent, (e as HTMLAnchorElement).href]));
  const names = links.map((l) => (l[0] ?? "").replace("⬇", "").trim()).sort();
  expect(names).toEqual(["AOI_2026-09-25.tif", "AOI_2026-09-25_COG.tif", "AOI_2026-09-25_QA.tif", "metadata.json"]);

  const meta = await (await request.get(links.find((l) => (l[0] ?? "").includes("metadata"))![1]!)).json();
  expect(meta.processing).toContain("cloud_mask_multi_date_composite");
  expect(meta.cloud_masking.method).toBe("scl_multi_date_composite");
  expect(meta.cloud_masking.previous_scenes.map((p: { id: string }) => p.id)).toEqual(["S2B_48MUB_20260918_0_L2A", "S2A_48MUB_20260913_0_L2A"]);
  expect(meta.cloud_masking.statistics.unfilled_masked_pixels).toBe(0);
  expect(meta.cloud_masking.statistics.masked_pct).toBeCloseTo(masked!, 0);
});

test("pesan bila citra sebelumnya tidak tersedia (scene tertua)", async ({ page }) => {
  await selectSceneWithAoi(page, 3); // 8 Sep: tak ada yang lebih lama
  const cm = page.getByTestId("cloudmask");
  await cm.getByLabel("Aktifkan mask dari SCL").check();
  await cm.getByLabel("Isi piksel ter-mask dari citra sebelumnya").check();
  await expect(page.getByTestId("no-previous")).toHaveText("Citra sebelumnya tidak tersedia. Cloud masking berbasis previous image tidak dapat dilakukan.");
  await expect(page.getByTestId("start-download")).toBeDisabled();
  // tanpa pengisian, mask saja tetap bisa diproses
  await cm.getByLabel("Isi piksel ter-mask dari citra sebelumnya").uncheck();
  await expect(page.getByTestId("start-download")).toBeEnabled();
});

test("mask saja: piksel awan menjadi NoData dan tercatat di metadata", async ({ page, request }) => {
  await selectSceneWithAoi(page, 0);
  await page.getByTestId("cloudmask").getByLabel("Aktifkan mask dari SCL").check();
  await page.getByTestId("start-download").click();
  await expect(page.getByTestId("job")).toHaveAttribute("data-status", "COMPLETED", { timeout: 60_000 });
  const links = await page.getByTestId("files").getByRole("link").evaluateAll((els) => els.map((e) => [e.textContent, (e as HTMLAnchorElement).href]));
  const meta = await (await request.get(links.find((l) => (l[0] ?? "").includes("metadata"))![1]!)).json();
  expect(meta.cloud_masking.method).toBe("scl_mask_only");
  expect(meta.cloud_masking.statistics.filled_pct).toBe(0);
  expect(meta.cloud_masking.statistics.unfilled_masked_pct).toBe(meta.cloud_masking.statistics.masked_pct);
});

// ============================================================ tahap 3: indeks, perubahan, batch

async function fileLinks(page: Page) {
  const links = await page.getByTestId("files").getByRole("link").evaluateAll((els) => els.map((e) => [e.textContent, (e as HTMLAnchorElement).href]));
  return links.map(([t, h]) => [(t ?? "").replace("⬇", "").trim(), h!] as const);
}

test("indeks NDVI: preview berlegenda dan keluaran Float32 dengan statistik", async ({ page, request }) => {
  await selectSceneWithAoi(page, 0);

  // preview NDVI (mode + legenda)
  await page.getByRole("radio", { name: "NDVI", exact: true }).click();
  await expect(page.getByTestId("legend")).toBeVisible();
  const resp = page.waitForResponse((r) => r.url().includes("/api/scenes/preview") && r.status() === 200);
  await page.getByTestId("scene-card").first().getByRole("button", { name: "Preview" }).click();
  expect((await (await resp).json()).mode).toBe("ndvi");
  await page.waitForTimeout(500);
  await shot(page, "5-ndvi");

  // keluaran: hanya indeks (tanpa band)
  await page.getByRole("button", { name: "Tanpa band" }).click();
  await expect(page.getByTestId("output-problem")).toHaveText("Pilih minimal satu band, indeks, atau deteksi perubahan.");
  await expect(page.getByTestId("start-download")).toBeDisabled();
  await page.getByTestId("indices").getByRole("checkbox", { name: /NDVI/ }).check();
  await expect(page.getByTestId("output-problem")).toHaveCount(0);
  await page.getByTestId("start-download").click();
  await expect(page.getByTestId("job")).toHaveAttribute("data-status", "COMPLETED", { timeout: 60_000 });
  const names = (await fileLinks(page)).map((l) => l[0]).sort();
  expect(names).toEqual(["AOI_2026-09-25_NDVI.tif", "AOI_2026-09-25_NDVI_COG.tif", "metadata.json"]);
  const meta = await (await request.get((await fileLinks(page)).find((l) => l[0] === "metadata.json")![1])).json();
  const nd = meta.products.indices[0];
  expect(nd.name).toBe("NDVI");
  expect(nd.statistics.mean).toBeGreaterThan(-1);
  expect(nd.statistics.mean).toBeLessThan(1);
  expect(nd.statistics.valid_pct).toBeGreaterThan(50);
  expect(meta.bands).toEqual([]);
});

test("deteksi perubahan: referensi wajib, peringatan tanpa mask, keluaran & luas per kelas", async ({ page, request }) => {
  await selectSceneWithAoi(page, 0);
  const box = page.getByTestId("changebox");
  await box.getByLabel("Bandingkan dengan citra yang lebih lama").check();
  await expect(page.getByTestId("ref-candidate")).toHaveCount(3);
  await expect(page.getByTestId("output-problem")).toHaveText("Pilih citra referensi (lebih lama) untuk deteksi perubahan.");
  await expect(page.getByTestId("start-download")).toBeDisabled();
  await expect(box).toContainText("Cloud masking mati"); // awan terbaca sebagai perubahan bila tidak di-mask

  await page.getByTestId("cloudmask").getByLabel("Aktifkan mask dari SCL").check();
  await expect(box).not.toContainText("Cloud masking mati");
  await page.getByTestId("ref-candidate").nth(1).click();          // 13 Sep
  await expect(page.getByTestId("ref-candidate").nth(1)).toHaveAttribute("aria-checked", "true");
  await box.getByLabel("Ambang perubahan").fill("0.15");
  await page.getByTestId("start-download").click();
  await expect(page.getByTestId("job")).toHaveAttribute("data-status", "COMPLETED", { timeout: 60_000 });

  const links = await fileLinks(page);
  const names = links.map((l) => l[0]);
  expect(names).toContain("AOI_2026-09-25_change_NDVI_vs_2026-09-13.tif");
  expect(names).toContain("AOI_2026-09-25_dNDVI_vs_2026-09-13.tif");
  const meta = await (await request.get(links.find((l) => l[0] === "metadata.json")![1])).json();
  const cd = meta.products.change_detection;
  expect(cd).toMatchObject({ index: "NDVI", threshold: 0.15, reference_cloud_masked: true });
  expect(cd.reference_scene.date).toBe("2026-09-13");
  const c = cd.statistics.classes;
  const pct = c.decrease.pct_of_valid + c.stable.pct_of_valid + c.increase.pct_of_valid;
  expect(pct).toBeGreaterThan(99.8);
  expect(pct).toBeLessThan(100.2);
  expect(c.stable.area_ha).toBeGreaterThan(0);
});

test("batch: satu job per scene, kegagalan terisolasi, ZIP hasil", async ({ page, request }) => {
  await openAndFly(page);
  await page.getByTestId("aoi-file").setInputFiles({ name: "aoi.geojson", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(CLOUD_AOI)) });
  await expect(page.getByTestId("aoi-info")).toContainText("AOI poligon");
  await setDates(page, "2026-09-01", "2026-09-30");
  await page.getByLabel("Cloud cover kustom (%)").fill("100");
  await page.getByTestId("search").click();
  await expect(page.getByTestId("scene-count")).toHaveText("4");

  await page.getByRole("button", { name: /Pilih semua/ }).click();
  await expect(page.getByTestId("batch-count")).toHaveText("Batch: 4 dipilih");
  await expect(page.getByTestId("batch-info")).toContainText("4 scene");
  // mode batch tidak menawarkan pemilihan manual maupun deteksi perubahan
  await expect(page.getByTestId("changebox")).toHaveCount(0);

  const cm = page.getByTestId("cloudmask");
  await cm.getByLabel("Aktifkan mask dari SCL").check();
  await cm.getByLabel("Isi piksel ter-mask dari citra sebelumnya").check();
  const sel = cm.getByLabel("Pemilihan citra sebelumnya");
  await expect(sel.locator("option[value='0']")).toHaveCount(0);       // manual tak tersedia di batch
  await expect(sel).toHaveValue("1");                                    // otomatis 1 terdekat
  await page.getByRole("button", { name: "RGB", exact: true }).click();
  await page.getByTestId("indices").getByRole("checkbox", { name: /NDVI/ }).check();
  await expect(page.getByTestId("start-download")).toHaveText("Proses batch (4 scene)");
  await page.getByTestId("start-download").click();

  // 8 Sep tidak punya pendahulu -> gagal; tiga lainnya selesai
  await expect(page.getByTestId("batch")).toHaveAttribute("data-status", "COMPLETED_WITH_ERRORS", { timeout: 90_000 });
  const jobs = page.getByTestId("batch-job");
  await expect(jobs).toHaveCount(4);
  await expect(page.locator("[data-testid=batch-job][data-status=COMPLETED]")).toHaveCount(3);
  await expect(page.locator("[data-testid=batch-job][data-status=FAILED]")).toHaveCount(1);
  await expect(page.locator("[data-testid=batch-job][data-status=FAILED]")).toContainText("Citra sebelumnya tidak tersedia");
  await shot(page, "6-batch");

  const href = await page.getByTestId("batch-zip").getAttribute("href");
  const zip = await request.get(href!);
  expect(zip.status()).toBe(200);
  const names = (await zip.body()).toString("latin1");            // ZIP tanpa kompresi: nama berkas terbaca
  for (const [id, d] of [["S2A_48MUB_20260925_0_L2A", "2026-09-25"], ["S2B_48MUB_20260918_0_L2A", "2026-09-18"], ["S2A_48MUB_20260913_0_L2A", "2026-09-13"]]) {
    expect(names).toContain(`${id}/AOI_${d}.tif`);
    expect(names).toContain(`${id}/AOI_${d}_NDVI.tif`);
  }
  expect(names).not.toContain("S2A_48MUB_20260908_0_L2A/");        // scene yang gagal tidak ada di ZIP
});

test("batch dikosongkan -> kembali ke mode unduh satu scene", async ({ page }) => {
  await selectSceneWithAoi(page, 0);
  await page.getByTestId("scene-card").nth(1).getByLabel(/^Batch/).check();
  await expect(page.getByTestId("batch-info")).toBeVisible();
  await page.getByRole("button", { name: "Kosongkan" }).click();
  await expect(page.getByTestId("batch-info")).toHaveCount(0);
  await expect(page.getByTestId("changebox")).toBeVisible();
  await expect(page.getByTestId("start-download")).toHaveText("Proses & unduh");
});
