import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
// Naikkan limit payload JSON untuk mengakomodasi foto struk beresolusi tinggi dari kamera HP
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

// Inisialisasi Google GenAI SDK di server-side sesuai instruksi
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Endpoint pemrosesan struk belanja dengan model Gemini 3.8 Flash
app.post("/api/gemini/baca-struk", async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({
        sukses: false,
        pesan: "Gambar struk tidak ditemukan dalam permintaan.",
      });
    }

    // Bersihkan prefix data URL jika ada (e.g. data:image/jpeg;base64,...)
    let cleanBase64 = image;
    let detectedMime = mimeType || "image/jpeg";

    if (image.includes(";base64,")) {
      const parts = image.split(";base64,");
      const mimeMatch = parts[0].match(/data:(.*?)$/);
      if (mimeMatch) {
        detectedMime = mimeMatch[1];
      }
      cleanBase64 = parts[1];
    }

    const currentYear = new Date().getFullYear();
    const todayIso = new Date().toISOString().slice(0, 10);

    const promptTeks = `Anda adalah asisten AI pencatat keuangan cerdas untuk aplikasi Catatan Keuangan dan Laporan Pertanggungjawaban SPJ Dana Kegiatan.
Tugas Anda adalah membaca dan menganalisis foto struk belanja, nota kasir, kuitansi, karcis tiket, faktur/invoice, atau bukti transaksi yang dikirimkan.

Ekstrak data transaksi dengan teliti dan kembalikan HANYA dalam format JSON valid dengan struktur berikut:
{
  "sukses": true,
  "deskripsi": "Nama merchant / toko / resto / penyedia dan ringkasan singkat barang, misal: 'SPBU Pertamina - BBM Pertalite', 'RM Sederhana - Makan Siang', 'Toko ATK Berkah - Kertas & Map'",
  "namaPenjualPenyedia": "Nama toko / merchant / penyedia / pengemudi / pemilik yang tertera di bukti",
  "jumlah": 50000, // Total nominal akhir pembayaran dalam Rupiah (angka murni integer positif tanpa titik/koma/Rp)
  "tanggal": "YYYY-MM-DD", // Tanggal transaksi. Jika tahun tidak tercantum, gunakan tahun ${currentYear}. Jika tanggal tidak terbaca, gunakan tanggal hari ini: "${todayIso}"
  "kategori": "Makan & Minum", // Untuk Dana Pribadi, pilih dari: ["Makan & Minum", "Transportasi", "Belanja Harian", "Pulsa & Internet", "Tagihan & Sewa", "Keluarga", "Tabungan", "Hiburan", "Lain-lain"]
  "kategoriDanaKegiatan": "Konsumsi", // Untuk Dana Kegiatan, pilih dari: ["Transportasi", "Rental Kendaraan", "BBM", "Akomodasi", "Konsumsi", "Honorarium & Ganti Hari", "Pengadaan Barang & Perlengkapan", "Komunikasi, Listrik & Kurir", "Perdiem", "Lain-lain"]
  "jenisBukti": "Struk thermal (minimarket/SPBU)", // Pilih satu dari: ["Kuitansi", "Nota", "Struk thermal (minimarket/SPBU)", "Tiket", "Tiket pesawat/e-ticket", "Invoice + kuitansi", "Bukti tidak lengkap"]
  "rincian": {
    "banyaknya": 1, // Kuantitas (angka, misal: 15, 1, 3)
    "satuan": "porsi", // Satuan (contoh: "liter", "porsi", "hari", "kg", "lembar", "unit", "orang", "paket")
    "hargaSatuan": 50000, // Harga satuan dalam angka Rupiah
    "total": 50000 // Total kuantitas x harga satuan
  },
  "keteranganLaporan": "Tulis 1-2 kalimat dalam bahasa Indonesia baku yang formal untuk laporan kegiatan fisik SPJ (contoh: 'Pembelian bahan bakar minyak jenis Pertalite sebanyak 15 liter untuk mobilitas tim survei.', 'Pembayaran konsumsi makan siang sebanyak 12 porsi bagi peserta kegiatan pelatihan.')",
  "metode": "Tunai", // Metode pembayaran yang tertera, pilih dari: ["Tunai", "Transfer", "QRIS", "Debit", "Kredit", "Lainnya"]
  "catatan": "Rincian item belanjaan dan harga per item jika terbaca",
  "ringkasan": "Kalimat singkat ringkasan struk"
}

Jika gambar sama sekali bukan struk belanja / kuitansi / transaksi atau terlalu buram untuk dibaca, kembalikan:
{
  "sukses": false,
  "pesan": "Gambar tidak dapat dikenali sebagai bukti transaksi atau tulisan terlalu buram."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: detectedMime,
              data: cleanBase64,
            },
          },
          {
            text: promptTeks,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    const hasilTeks = response.text;
    if (!hasilTeks) {
      return res.status(500).json({
        sukses: false,
        pesan: "Tidak ada respon teks dari Gemini.",
      });
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(hasilTeks);
    } catch {
      // Jika ada formatting tambahan, ekstrak json string
      const match = hasilTeks.match(/\{[\s\S]*\}/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        throw new Error("Gagal mengurai format JSON dari Gemini.");
      }
    }

    return res.json(parsedResult);
  } catch (error: any) {
    console.error("Gagal membaca struk dengan Gemini:", error);
    return res.status(500).json({
      sukses: false,
      pesan: `Gagal membaca struk: ${error.message || "Terjadi kesalahan pada server AI"}`,
    });
  }
});

// Endpoint untuk menyusun 2-3 paragraf narasi surat justifikasi ketidaklengkapan dokumen
app.post("/api/gemini/susun-surat-justifikasi", async (req, res) => {
  try {
    const {
      alasanSingkat,
      jenisBukti,
      uraian,
      jumlah,
      tanggal,
      namaKegiatan,
      lokasiKegiatan,
      namaPelapor,
      jabatanPelapor,
      lembagaProyek,
    } = req.body;

    const nominalFmt = typeof jumlah === "number" ? `Rp${jumlah.toLocaleString("id-ID")}` : "Rp0";

    const promptTeks = `Anda adalah seorang staf administrasi keuangan dan surveyor lapangan profesional di lembaga nirlaba/organisasi konservasi.
Tugas Anda adalah menulis narasi isi SURAT JUSTIFIKASI KETIDAKLENGKAPAN DOKUMEN BUKTI TRANSAKSI PENGELUARAN DANA KEGIATAN LAPANGAN dalam Bahasa Indonesia formal dan baku.

DATA TRANSAKSI & KEGIATAN:
- Nama Kegiatan: ${namaKegiatan || "-"}
- Lokasi Kegiatan: ${lokasiKegiatan || "-"}
- Pelapor: ${namaPelapor || "-"} (${jabatanPelapor || "-"}, ${lembagaProyek || "-"})
- Tanggal Pengeluaran: ${tanggal || "-"}
- Uraian Transaksi: ${uraian || "-"}
- Nominal Pengeluaran: ${nominalFmt}
- Jenis Bukti yang Tersedia / Status Bukti: ${jenisBukti || "Bukti tidak lengkap"}
- Alasan Singkat dari Pelapor: "${alasanSingkat || "Penyedia/warung lokal tidak menyediakan nota resmi berstempel dan bukti asli hilang/rusak karena kondisi lapangan"}"

INSTRUKSI:
1. Tulis 2 sampai 3 paragraf naratif yang utuh, padat, profesional, dan meyakinkan untuk ditaruh di dalam surat pernyataan/justifikasi resmi.
2. Paragraf 1: Menerangkan kronologi dan konteks pelaksanaan transaksi pengeluaran tersebut dalam rangka kegiatan lapangan yang sedang berlangsung, disertai rincian uraian, tanggal, dan nominal riil yang telah dikeluarkan.
3. Paragraf 2: Menjelaskan kondisi faktual di lapangan mengapa bukti transaksi asli tidak lengkap, tidak resmi, atau hilang/rusak (sesuai alasan singkat pelapor, misalnya kendala geografis, transaksi di daerah pedalaman/remote area, warung perahu tradisional yang tidak punya cap/stempel, atau faktor alam lainnya).
4. Paragraf 3: Menyatakan penegasan bahwa pengeluaran tersebut benar-benar terjadi, bersifat sah, wajar, digunakan sepenuhnya untuk kepentingan kedinasan/kegiatan program tanpa adanya unsur keuntungan pribadi, serta dapat dipertanggungjawabkan kebenarannya.
5. JANGAN menuliskan kop surat, judul surat, kalimat "Yang bertanda tangan di bawah ini", atau tanda tangan. Cukup kembalikan 2-3 paragraf narasi saja, dipisahkan oleh baris baru ganda (\\n\\n).`;

    const modelName = "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: promptTeks,
    });

    const hasilTeks = response.text?.trim() || "";
    if (hasilTeks) {
      const paragraf = hasilTeks.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
      return res.json({ sukses: true, paragraf, teks: hasilTeks });
    }

    throw new Error("Teks respons kosong dari Gemini.");
  } catch (error: any) {
    console.warn("Gagal menyusun narasi surat justifikasi dari Gemini, menggunakan narasi cadangan baku:", error?.message);
    const { uraian, jumlah, tanggal, alasanSingkat, jenisBukti, namaKegiatan, lokasiKegiatan } = req.body;
    const nominalFmt = typeof jumlah === "number" ? `Rp${jumlah.toLocaleString("id-ID")}` : "Rp0";
    const p1 = `Sehubungan dengan pelaksanaan kegiatan ${namaKegiatan || "lapangan"} yang berlokasi di ${lokasiKegiatan || "lapangan"}, bersama ini saya menerangkan bahwa pada tanggal ${tanggal || "tanggal pelaksanaan"} telah dilakukan transaksi pengeluaran riil sebesar ${nominalFmt} untuk keperluan ${uraian || "kegiatan operasional"}.`;
    const p2 = `Adapun mengenai dokumen pertanggungjawaban transaksi tersebut, dokumen yang dapat dilampirkan berstatus ${jenisBukti || "bukti tidak lengkap"} dikarenakan ${alasanSingkat || "keterbatasan fasilitas administrasi penyedia jasa/penjual di lokasi kegiatan lapangan serta kondisi geografis yang berada di wilayah terpencil"}.`;
    const p3 = `Dengan ini saya menyatakan dengan sesungguhnya bahwa transaksi tersebut di atas adalah benar-benar terlaksana dan mutlak dipergunakan untuk mendukung kelancaran operasional kegiatan kedinasan, tanpa adanya unsur manipulasi atau kepentingan pribadi, serta saya bersedia bertanggung jawab sepenuhnya atas kebenaran keterangan ini.`;
    return res.json({
      sukses: true,
      paragraf: [p1, p2, p3],
      teks: `${p1}\n\n${p2}\n\n${p3}`,
    });
  }
});


// Health check endpoint untuk memverifikasi kesiapan container server
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Jalur folder dist hasil build
const distPath = path.resolve(__dirname, "dist");
const hasDist = fs.existsSync(path.resolve(distPath, "index.html"));

// Penentuan mode:
// Di Cloud Run (K_SERVICE terdefinisi), mode produksi (NODE_ENV=production),
// atau saat folder dist sudah ada dan bukan mode dev eksplisit: layani static build.
// Vite middleware hanya digunakan saat development lokal eksplisit.
const isDev =
  process.env.NODE_ENV === "development" ||
  (!hasDist && !process.env.K_SERVICE && process.env.NODE_ENV !== "production");

async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Mode produksi: layani static build secara efisien untuk container Cloud Run
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Server Catatan Keuangan aktif pada port ${PORT} [mode: ${
        isDev ? "development (vite middleware)" : "production (static dist)"
      }]`
    );
  });
}

startServer().catch((err) => {
  console.error("Gagal menjalankan server:", err);
});

