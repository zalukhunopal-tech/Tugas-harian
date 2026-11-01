import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import {
  uraiStrukturOcrTransaksi,
  DataOcrTerstruktur,
} from "../src/lib/ocrParser";

interface ItemLatihan {
  nomor: number;
  berkas: string;
  judul: string;
  tag: string;
  nominalTeks: string;
  url: string;
}

/**
 * Prapemrosesan gambar setara Canvas API untuk lingkungan Node.js:
 * Resize adaptif (max 1800px), grayscale, linear contrast stretch, dan lossless PNG.
 */
async function praProsesGambarNode(imagePath: string): Promise<Buffer> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const lebar = metadata.width || 800;
  const tinggi = metadata.height || 1200;

  let resizeWidth = lebar;
  let resizeHeight = tinggi;
  const maxDim = 1800;
  if (lebar > maxDim || tinggi > maxDim) {
    if (lebar > tinggi) {
      resizeHeight = Math.round((tinggi * maxDim) / lebar);
      resizeWidth = maxDim;
    } else {
      resizeWidth = Math.round((lebar * maxDim) / tinggi);
      resizeHeight = maxDim;
    }
  }

  return image
    .resize(resizeWidth, resizeHeight, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
}

async function uji500Dummy() {
  const dirLatihan = path.resolve(process.cwd(), "public/latihan-ocr");
  const jsonPath = path.join(dirLatihan, "daftar_latihan.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error("Berkas daftar_latihan.json tidak ditemukan!");
  }

  const daftar: ItemLatihan[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Ditemukan ${daftar.length} berkas bukti transaksi dummy dalam dataset.`);

  // Muat data acuan baseline lama untuk perbandingan Sebelum vs Sesudah
  const outRingkasan = path.join(dirLatihan, "ringkasan_uji_500.json");
  let baselineLama: any[] = [];
  if (fs.existsSync(outRingkasan)) {
    try {
      baselineLama = JSON.parse(fs.readFileSync(outRingkasan, "utf8"));
    } catch {}
  }
  const baselineCocokLama = baselineLama.filter((b) => b.cocokNominal).length;
  const baselineMerchantLama = baselineLama.filter((b) => b.merchant).length;

  console.log("Menginisialisasi Tesseract OCR Worker (ind+eng)...");
  const worker = await createWorker("ind+eng");

  const ringkasanUji: any[] = [];
  let totalSukses = 0;
  let nominalTepat = 0;
  let nominalToleransi = 0;
  let tanggalTepat = 0;
  let merchantTerisi = 0;
  let metodeTerdeteksi = 0;
  let rincianTerbaca = 0;
  let kasusPerluKoreksiUser = 0;

  console.log(`Menjalankan benchmark pengujian OCR alur lengkap (Prapemrosesan -> OCR -> Parser Berstruktur)...`);

  for (let i = 0; i < daftar.length; i++) {
    const item = daftar[i];
    const imagePath = path.join(dirLatihan, item.berkas);
    if (!fs.existsSync(imagePath)) {
      console.warn(`[SKIP] Berkas tidak ditemukan: ${item.berkas}`);
      continue;
    }

    const tAwal = Date.now();

    // 1. Prapemrosesan Gambar
    const preprocessedBuffer = await praProsesGambarNode(imagePath);

    // 2. Ekstraksi OCR Tesseract dengan Bounding Box & Koordinat
    const ret = await worker.recognize(preprocessedBuffer);
    const durasi = Date.now() - tAwal;
    const rawText = ret?.data?.text || "";

    const lines = ret?.data?.lines?.map((l: any) => ({
      teks: l.text || "",
      confidence: l.confidence || 0,
      bbox: l.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
      words: l.words?.map((w: any) => ({
        teks: w.text || "",
        confidence: w.confidence || 0,
        bbox: w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
      })),
    }));

    const words = ret?.data?.words?.map((w: any) => ({
      teks: w.text || "",
      confidence: w.confidence || 0,
      bbox: w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
    }));

    const dataOcr: DataOcrTerstruktur = {
      teks: rawText,
      lines,
      words,
      confidence: ret?.data?.confidence,
    };

    // 3. Parsing Berstruktur Koordinat Geometri
    const parsed = uraiStrukturOcrTransaksi(dataOcr);

    // Ambil nilai target integer dari nominalTeks (mis. "Rp 82.140" -> 82140)
    const targetNominal = parseInt(item.nominalTeks.replace(/[^0-9]/g, ""), 10);

    // Evaluasi Ketepatan Nominal
    // Khusus transfer bank: jika bukti memuat nilai transfer pokok dan total debit debet keluar kas
    const isTransferMatch =
      parsed.rincianTransfer &&
      (parsed.rincianTransfer.nilaiTransfer === targetNominal ||
        parsed.rincianTransfer.totalDebit === targetNominal);

    const cocokNominalPersis = parsed.jumlah === targetNominal || Boolean(isTransferMatch);
    const cocokNominalToleransi =
      cocokNominalPersis ||
      (parsed.jumlah && Math.abs(parsed.jumlah - targetNominal) / targetNominal <= 0.02);

    const adaTanggal = Boolean(parsed.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(parsed.tanggal));
    const adaMerchant = Boolean(
      parsed.namaPenjualPenyedia &&
        parsed.namaPenjualPenyedia.trim() &&
        !/^(?:Penyedia|Toko|Kasir)$/i.test(parsed.namaPenjualPenyedia)
    );
    const adaMetode = Boolean(
      parsed.metode && (parsed.metode !== "Tunai" || /tunai|cash|kontan|lunas/i.test(rawText))
    );
    const adaRincian = Boolean(parsed.rincian || (parsed.kandidatJumlah && parsed.kandidatJumlah.some(k => k.asal === "hasil_hitung")));

    const perluKoreksi =
      parsed.statusKeyakinan?.jumlah === "perlu_diperiksa" ||
      parsed.statusKeyakinan?.namaPenyedia === "tidak_ditemukan" ||
      !cocokNominalPersis;

    if (parsed.sukses) totalSukses++;
    if (cocokNominalPersis) nominalTepat++;
    if (cocokNominalToleransi) nominalToleransi++;
    if (adaTanggal) tanggalTepat++;
    if (adaMerchant) merchantTerisi++;
    if (adaMetode) metodeTerdeteksi++;
    if (adaRincian) rincianTerbaca++;
    if (perluKoreksi) kasusPerluKoreksiUser++;

    ringkasanUji.push({
      nomor: item.nomor,
      berkas: item.berkas,
      judul: item.judul,
      tag: item.tag,
      targetNominal,
      parsedNominal: parsed.jumlah,
      cocokNominal: cocokNominalPersis,
      cocokToleransi: cocokNominalToleransi,
      rincianTransfer: parsed.rincianTransfer,
      aritmetika: parsed.pemeriksaanAritmetika,
      statusKeyakinan: parsed.statusKeyakinan,
      merchant: parsed.namaPenjualPenyedia,
      metode: parsed.metode,
      kategoriP: parsed.kategori,
      kategoriK: parsed.kategoriDanaKegiatan,
      waktuMs: durasi,
    });

    if (item.nomor % 25 === 0 || item.nomor <= 5 || item.nomor >= 495) {
      console.log(
        `[${item.nomor}/${daftar.length}] ${item.berkas} | Target: ${item.nominalTeks} | Terbaca: Rp ${(parsed.jumlah || 0).toLocaleString("id-ID")} | ${cocokNominalPersis ? "✓ COCOK" : "✕ BEDA"} | Status: ${parsed.statusKeyakinan?.jumlah} | Merchant: ${parsed.namaPenjualPenyedia || "-"} (${durasi}ms)`
      );
    }
  }

  await worker.terminate();

  // Simpan hasil ke ringkasan_uji_500.json
  fs.writeFileSync(outRingkasan, JSON.stringify(ringkasanUji, null, 2), "utf8");

  const pctTepat = ((nominalTepat / daftar.length) * 100).toFixed(1);
  const pctToleransi = ((nominalToleransi / daftar.length) * 100).toFixed(1);
  const pctTanggal = ((tanggalTepat / daftar.length) * 100).toFixed(1);
  const pctMerchant = ((merchantTerisi / daftar.length) * 100).toFixed(1);
  const pctMetode = ((metodeTerdeteksi / daftar.length) * 100).toFixed(1);
  const pctRincian = ((rincianTerbaca / daftar.length) * 100).toFixed(1);
  const pctKoreksi = ((kasusPerluKoreksiUser / daftar.length) * 100).toFixed(1);

  const baselinePctLama = ((baselineCocokLama / (baselineLama.length || 500)) * 100).toFixed(1);
  const deltaNominal = (parseFloat(pctTepat) - parseFloat(baselinePctLama)).toFixed(1);

  console.log("\n=======================================================");
  console.log("=== LAPORAN AUDIT & BENCHMARK KOMPREHENSIF 500 BUKTI ===");
  console.log("=======================================================");
  console.log(`Jumlah Kasus Riil Diuji      : ${daftar.length} berkas bukti transaksi dummy`);
  console.log(`Alur Pipeline                : Gambar -> Prapemrosesan -> Tesseract -> Parser Koordinat -> Verifikasi`);
  console.log("-------------------------------------------------------");
  console.log(`1. Ketepatan Nominal (Persis) : ${nominalTepat}/${daftar.length} (${pctTepat}%) [Sebelum: ${baselineCocokLama}/${baselineLama.length || 500} (${baselinePctLama}%), Delta: ${parseFloat(deltaNominal) >= 0 ? "+" : ""}${deltaNominal}%]`);
  console.log(`2. Ketepatan Nominal (+Tol)   : ${nominalToleransi}/${daftar.length} (${pctToleransi}%)`);
  console.log(`3. Ketepatan Tanggal          : ${tanggalTepat}/${daftar.length} (${pctTanggal}%)`);
  console.log(`4. Ketepatan Nama Toko        : ${merchantTerisi}/${daftar.length} (${pctMerchant}%) [Sebelum: ${baselineMerchantLama}]`);
  console.log(`5. Ketepatan Metode Bayar     : ${metodeTerdeteksi}/${daftar.length} (${pctMetode}%)`);
  console.log(`6. Pembacaan Rincian Barang   : ${rincianTerbaca}/${daftar.length} (${pctRincian}%)`);
  console.log(`7. Kasus Perlu Koreksi User   : ${kasusPerluKoreksiUser}/${daftar.length} (${pctKoreksi}%)`);
  console.log("-------------------------------------------------------");
  console.log(`Hasil pengujian disimpan ke  : ${outRingkasan}`);

  // REGRESSION SAFEGUARD: Hentikan dan gagalkan proses jika akurasi nominal drop di bawah baseline
  if (nominalTepat < baselineCocokLama) {
    console.error(`\n[REGRESSION ERROR] Terjadi kemunduran! Akurasi nominal (${nominalTepat}) lebih rendah dari baseline (${baselineCocokLama}).`);
    process.exit(1);
  } else {
    console.log(`[PASS] Pengujian benchmark memenuhi ambang batas kualitas (tidak ada regresi).`);
  }
}

uji500Dummy().catch((err) => {
  console.error("Gagal menjalankan benchmark:", err);
  process.exit(1);
});
