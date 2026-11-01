import fs from "fs";
import path from "path";
import { createWorker } from "tesseract.js";
import { uraiTeksOcrTransaksi } from "../src/lib/ocrParser";

interface ItemLatihan {
  nomor: number;
  berkas: string;
  judul: string;
  tag: string;
  nominalTeks: string;
  url: string;
}

async function uji250Dummy() {
  const dirLatihan = path.resolve(process.cwd(), "public/latihan-ocr");
  const jsonPath = path.join(dirLatihan, "daftar_latihan.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error("Berkas daftar_latihan.json tidak ditemukan!");
  }

  const daftar: ItemLatihan[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Ditemukan ${daftar.length} berkas bukti transaksi dummy untuk pengujian.`);

  console.log("Menginisialisasi Tesseract OCR Worker (ind+eng)...");
  const worker = await createWorker("ind+eng");

  const ringkasanUji: any[] = [];
  let totalSukses = 0;
  let nominalTepat = 0;
  let merchantTerisi = 0;
  let metodeTerdeteksi = 0;

  for (let i = 0; i < daftar.length; i++) {
    const item = daftar[i];
    const imagePath = path.join(dirLatihan, item.berkas);
    if (!fs.existsSync(imagePath)) {
      console.warn(`[SKIP] Berkas tidak ditemukan: ${item.berkas}`);
      continue;
    }

    const tAwal = Date.now();
    const ret = await worker.recognize(imagePath);
    const durasi = Date.now() - tAwal;
    const rawText = ret?.data?.text || "";

    const parsed = uraiTeksOcrTransaksi(rawText);

    // Ambil nilai target integer dari nominalTeks (mis. "Rp 82.140" -> 82140)
    const targetNominal = parseInt(item.nominalTeks.replace(/[^0-9]/g, ""), 10);
    const cocokNominal = parsed.jumlah === targetNominal;
    const adaMerchant = Boolean(parsed.namaPenjualPenyedia && parsed.namaPenjualPenyedia.trim());
    const adaMetode = Boolean(parsed.metode && parsed.metode !== "Tunai" || /tunai|cash|kontan/i.test(rawText));

    if (parsed.sukses) totalSukses++;
    if (cocokNominal) nominalTepat++;
    if (adaMerchant) merchantTerisi++;
    if (adaMetode) metodeTerdeteksi++;

    ringkasanUji.push({
      nomor: item.nomor,
      berkas: item.berkas,
      judul: item.judul,
      tag: item.tag,
      targetNominal,
      parsedNominal: parsed.jumlah,
      cocokNominal,
      merchant: parsed.namaPenjualPenyedia,
      metode: parsed.metode,
      kategoriP: parsed.kategori,
      kategoriK: parsed.kategoriDanaKegiatan,
      waktuMs: durasi,
      teksMentah: rawText,
      parsed,
    });

    if (item.nomor % 10 === 0 || item.nomor <= 5 || item.nomor >= 245) {
      console.log(
        `[${item.nomor}/${daftar.length}] ${item.berkas} | Target: ${item.nominalTeks} | Terbaca: Rp ${(parsed.jumlah || 0).toLocaleString("id-ID")} | ${cocokNominal ? "COCOK" : "BEDA"} | Metode: ${parsed.metode} | Merchant: ${parsed.namaPenjualPenyedia || "KOSONG"} (${durasi}ms)`
      );
    }
  }

  await worker.terminate();

  // Simpan hasil ke ringkasan_uji_250.json
  const outRingkasan = path.join(dirLatihan, "ringkasan_uji_250.json");
  fs.writeFileSync(outRingkasan, JSON.stringify(ringkasanUji, null, 2), "utf8");

  console.log("\n==========================================");
  console.log("=== RINGKASAN BENCHMARK 250 STRUK OCR ===");
  console.log("==========================================");
  console.log(`Total Bukti Diuji      : ${daftar.length}`);
  console.log(`Sukses Pembacaan OCR   : ${totalSukses}/${daftar.length} (${((totalSukses / daftar.length) * 100).toFixed(1)}%)`);
  console.log(`Nominal Tepat 100%     : ${nominalTepat}/${daftar.length} (${((nominalTepat / daftar.length) * 100).toFixed(1)}%)`);
  console.log(`Merchant Berhasil Temu : ${merchantTerisi}/${daftar.length} (${((merchantTerisi / daftar.length) * 100).toFixed(1)}%)`);
  console.log(`Hasil Lengkap disimpan : ${outRingkasan}`);
}

uji250Dummy().catch(console.error);
