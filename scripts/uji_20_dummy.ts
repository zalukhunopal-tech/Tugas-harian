import fs from "fs";
import path from "path";
import { createWorker } from "tesseract.js";
import { uraiTeksOcrTransaksi } from "../src/lib/ocrParser";

interface HasilUji20 {
  nomor: number;
  berkas: string;
  waktuMs: number;
  teksMentah: string;
  parsed: any;
}

async function jalankanUji20Dummy() {
  const folderLatihan = path.resolve(process.cwd(), "public/latihan-ocr");
  if (!fs.existsSync(folderLatihan)) {
    console.error("Folder latihan-ocr tidak ditemukan:", folderLatihan);
    process.exit(1);
  }

  const files = fs
    .readdirSync(folderLatihan)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();

  console.log(`Ditemukan ${files.length} berkas bukti transaksi dummy untuk pengujian.`);

  console.log("Menginisialisasi Tesseract OCR Worker (ind+eng)...");
  const worker = await createWorker("ind+eng", 1, {
    logger: () => {},
  });

  const hasilSemua: HasilUji20[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(folderLatihan, file);
    const sizeKb = Math.round(fs.statSync(fullPath).size / 1024);
    console.log(`\n==================================================`);
    console.log(`[UJI ${i + 1}/${files.length}] Memindai: ${file} (${sizeKb} KB)`);
    console.log(`==================================================`);

    const mulai = Date.now();
    try {
      const res = await worker.recognize(fullPath);
      const waktuMs = Date.now() - mulai;
      const teks = res.data.text || "";

      console.log(`Waktu OCR: ${waktuMs} ms. Karakter: ${teks.length}`);
      console.log("--- Cuplikan Teks OCR Mentah (10 baris pertama) ---");
      const baris = teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
      baris.slice(0, 10).forEach((b, idx) => console.log(`  [${idx + 1}] ${b}`));

      const parsed = uraiTeksOcrTransaksi(teks);

      console.log("\n--- Hasil Analisis Parser Transaksi Aplikasi ---");
      console.log(`  Status Sukses : ${parsed.sukses}`);
      console.log(`  Merchant/Toko : ${parsed.namaPenjualPenyedia || "(belum terdeteksi)"}`);
      console.log(`  Nominal Utama : ${parsed.jumlah ? `Rp ${parsed.jumlah.toLocaleString("id-ID")}` : "(belum terdeteksi)"}`);
      console.log(`  Tanggal       : ${parsed.tanggal || "(belum terdeteksi)"}`);
      console.log(`  Kategori (P)  : ${parsed.kategori}`);
      console.log(`  Kategori (K)  : ${parsed.kategoriDanaKegiatan}`);
      console.log(`  Jenis Bukti   : ${parsed.jenisBukti}`);
      console.log(`  Metode Bayar  : ${parsed.metode}`);
      console.log(`  Deskripsi     : ${parsed.deskripsi}`);
      console.log(`  Kandidat Uang : ${parsed.kandidatJumlah?.map((k: any) => `${k.nominal} (${k.label})`).join(", ") || "-"}`);
      if (parsed.peringatan && parsed.peringatan.length > 0) {
        console.log(`  Peringatan    : ${parsed.peringatan.join(" | ")}`);
      }

      hasilSemua.push({
        nomor: i + 1,
        berkas: file,
        waktuMs,
        teksMentah: teks,
        parsed,
      });
    } catch (err: any) {
      console.error(`Gagal memindai ${file}:`, err.message);
    }
  }

  await worker.terminate();

  const pathJson = path.resolve(folderLatihan, "ringkasan_uji_20.json");
  fs.writeFileSync(pathJson, JSON.stringify(hasilSemua, null, 2), "utf8");
  console.log(`\n✓ Pengujian 20 bukti transaksi dummy selesai! Ringkasan disimpan di: ${pathJson}`);
}

jalankanUji20Dummy().catch(console.error);
