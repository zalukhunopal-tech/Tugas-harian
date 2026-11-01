/**
 * Modul OCR Lokal Terpadu (Tesseract.js) untuk Scan Struk Belanja.
 * Berjalan sepenuhnya di sisi klien (browser / PWA) tanpa API Key, tanpa token Gemini,
 * dan tanpa mengirimkan gambar ke server.
 */

import type { HasilBacaStruk } from "./geminiStruk";
import { praProsesGambarStruk, validasiBerkasGambar } from "./ocrPraPemrosesan";
import { uraiTeksOcrTransaksi, uraikanQrisEMVCo, KandidatNominal } from "./ocrParser";
import { dekodeQRDariPiksel } from "./qr";
import type { NamaDana, JenisTransaksi } from "../types";

export interface ProgressOcrInfo {
  status: string; // Deskripsi langkah yang sedang berlangsung (mis. "Membaca teks...")
  progres: number; // Nilai 0.0 - 1.0
}

export interface OpsiProsesStrukLokal {
  onProgress?: (info: ProgressOcrInfo) => void;
  dana?: NamaDana;
  jenisTransaksi?: JenisTransaksi;
}

export interface HasilOcrLokal extends HasilBacaStruk {
  kandidatJumlah?: KandidatNominal[];
  peringatan?: string[];
  teksMentah?: string;
}

// Singleton Worker untuk efisiensi memori dan waktu inisialisasi
let workerInstance: any = null;
let bahasaTerpasang = "";
let sedangMemproses = false;

/**
 * Menghentikan dan membersihkan worker OCR lokal dari memori jika diperlukan.
 */
export async function bersihkanWorkerOcr(): Promise<void> {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
    } catch (e) {
      console.warn("Gagal menghentikan worker OCR:", e);
    } finally {
      workerInstance = null;
      bahasaTerpasang = "";
      sedangMemproses = false;
    }
  }
}

/**
 * Menginisialisasi Tesseract Worker dengan penanganan offline dan fallback bahasa.
 */
async function dapatkanWorkerOcr(
  bahasaTarget: string = "ind+eng",
  onProgress?: (info: ProgressOcrInfo) => void
): Promise<any> {
  // Jika worker sudah aktif dengan bahasa yang sama, gunakan kembali
  if (workerInstance && bahasaTerpasang === bahasaTarget) {
    return workerInstance;
  }

  // Jika bahasa berbeda atau belum ada worker, buat baru
  await bersihkanWorkerOcr();

  onProgress?.({
    status: "Menyiapkan mesin OCR lokal...",
    progres: 0.1,
  });

  // Lazy loading Tesseract.js agar tidak membebani initial bundle
  const { createWorker } = await import("tesseract.js");

  const tanganiLogger = (m: any) => {
    if (!m) return;
    let labelStatus = "Memproses teks struk...";
    let p = m.progress || 0;

    if (m.status === "loading tesseract core") {
      labelStatus = "Memuat modul inti OCR...";
    } else if (m.status === "initializing tesseract") {
      labelStatus = "Menginisialisasi mesin pengenal...";
    } else if (m.status === "loading language traineddata") {
      labelStatus = `Mengunduh/memuat model bahasa (${Math.round(p * 100)}%)...`;
    } else if (m.status === "initializing api") {
      labelStatus = "Menyiapkan antarmuka pembaca...";
    } else if (m.status === "recognizing text") {
      labelStatus = `Membaca teks dari struk (${Math.round(p * 100)}%)...`;
    }

    onProgress?.({
      status: labelStatus,
      progres: p,
    });
  };

  try {
    const worker = await createWorker(bahasaTarget, 1, {
      logger: tanganiLogger,
      errorHandler: (err: any) => {
        console.warn("Peringatan internal Tesseract Worker:", err);
      },
    });

    workerInstance = worker;
    bahasaTerpasang = bahasaTarget;
    return worker;
  } catch (err: any) {
    console.warn(`Gagal memuat worker dengan bahasa ${bahasaTarget}:`, err);

    // Cek apakah perangkat offline dan model belum ada di cache
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    const isNetworkErr = err?.message && /fetch|network|failed to load/i.test(err.message);

    if (isOffline || isNetworkErr) {
      throw new Error(
        "Dukungan OCR lokal offline belum siap karena model bahasa (ind/eng) belum terunduh. " +
        "Sambungkan perangkat ke internet sekali untuk mengunduh modul pengenal teks."
      );
    }

    // Jika gagal pada gabungan 'ind+eng', coba fallback ke 'eng' saja
    if (bahasaTarget.includes("+")) {
      console.info("Mencoba fallback bahasa OCR ke 'eng'...");
      return dapatkanWorkerOcr("eng", onProgress);
    }

    throw new Error(
      `Gagal menginisialisasi mesin OCR lokal: ${err?.message || "Kesalahan memuat worker"}`
    );
  }
}

/**
 * Memproses berkas foto struk secara lokal di browser:
 * 1. Validasi berkas
 * 2. Pra-pemrosesan Canvas (resize, grayscale, contrast enhancement)
 * 3. Ekstraksi teks via Tesseract.js Web Worker
 * 4. Parsing deterministik via ocrParser
 */
export async function prosesStrukLokal(
  file: File | Blob,
  opsi: OpsiProsesStrukLokal = {}
): Promise<HasilOcrLokal> {
  // Cegah pemrosesan paralel yang tidak terkendali
  if (sedangMemproses) {
    throw new Error("Proses scan struk sedang berjalan. Harap tunggu hingga selesai.");
  }

  const validasi = validasiBerkasGambar(file);
  if (!validasi.valid) {
    return {
      sukses: false,
      pesan: validasi.pesan,
    };
  }

  sedangMemproses = true;
  let canvasDipakai: HTMLCanvasElement | null = null;

  try {
    opsi.onProgress?.({
      status: "Mengoptimalkan gambar struk...",
      progres: 0.15,
    });

    // 1. Pra-pemrosesan gambar menggunakan Canvas
    const pra = await praProsesGambarStruk(file, {
      maxDimensi: 1800,
      tingkatkanKontras: true,
      ubahGrayscale: true,
    });
    canvasDipakai = pra.canvas;

    // 2. Dekode kode QR jika ada di struk/layar (khususnya bukti QRIS dinamis)
    let nominalQris: number | undefined;
    let merchantQris: string | undefined;
    try {
      const ctx = pra.canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        const imgData = ctx.getImageData(0, 0, pra.canvas.width, pra.canvas.height);
        const teksQR = dekodeQRDariPiksel(imgData.data, pra.canvas.width, pra.canvas.height);
        if (teksQR) {
          const infoQris = uraikanQrisEMVCo(teksQR);
          if (infoQris?.amount) {
            nominalQris = infoQris.amount;
          }
          if (infoQris?.merchantName) {
            merchantQris = infoQris.merchantName;
          }
        }
      }
    } catch (e) {
      // Dekode QR bersifat progressive enhancement
    }

    opsi.onProgress?.({
      status: "Menghubungkan mesin OCR lokal...",
      progres: 0.3,
    });

    // 3. Dapatkan worker OCR (lazy load)
    const worker = await dapatkanWorkerOcr("ind+eng", opsi.onProgress);

    opsi.onProgress?.({
      status: "Membaca teks dari struk belanja...",
      progres: 0.6,
    });

    // 4. Jalankan pengenalan teks pada canvas hasil pra-pemrosesan
    const res = await worker.recognize(pra.canvas);
    const teksMentah = res?.data?.text || "";

    opsi.onProgress?.({
      status: "Menganalisis rincian transaksi...",
      progres: 0.95,
    });

    // 5. Parse teks menjadi transaksi terstruktur
    const hasilParse = uraiTeksOcrTransaksi(teksMentah, {
      dana: opsi.dana,
      jenisTransaksi: opsi.jenisTransaksi,
      nominalQrisTerverifikasi: nominalQris,
      merchantQrisTerverifikasi: merchantQris,
    });

    opsi.onProgress?.({
      status: "Selesai",
      progres: 1.0,
    });

    return {
      sukses: hasilParse.sukses,
      pesan: hasilParse.pesan,
      deskripsi: hasilParse.deskripsi,
      jumlah: hasilParse.jumlah,
      tanggal: hasilParse.tanggal,
      kategori: hasilParse.kategori,
      kategoriDanaKegiatan: hasilParse.kategoriDanaKegiatan,
      metode: hasilParse.metode,
      catatan: hasilParse.catatan,
      ringkasan: hasilParse.ringkasan,
      jenisBukti: hasilParse.jenisBukti,
      namaPenjualPenyedia: hasilParse.namaPenjualPenyedia,
      rincian: hasilParse.rincian,
      keteranganLaporan: hasilParse.keteranganLaporan,
      kandidatJumlah: hasilParse.kandidatJumlah,
      peringatan: hasilParse.peringatan,
      teksMentah: hasilParse.teksMentah,
    };
  } catch (err: any) {
    console.error("Kesalahan dalam proses OCR lokal:", err);
    return {
      sukses: false,
      pesan: err?.message || "Gagal memproses struk dengan OCR lokal.",
    };
  } finally {
    sedangMemproses = false;
    // Bersihkan referensi canvas
    if (canvasDipakai) {
      canvasDipakai.width = 1;
      canvasDipakai.height = 1;
      canvasDipakai = null;
    }
  }
}
