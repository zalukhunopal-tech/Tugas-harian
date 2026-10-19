import express from "express";
import cors from "cors";
import path from "path";
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

    const promptTeks = `Anda adalah asisten AI pencatat keuangan cerdas untuk aplikasi Catatan Keuangan.
Tugas Anda adalah membaca dan menganalisis foto struk belanja, nota kasir, kuitansi, atau bukti transaksi yang dikirimkan.

Ekstrak data transaksi dengan teliti dan kembalikan HANYA dalam format JSON valid dengan struktur berikut:
{
  "sukses": true,
  "deskripsi": "Nama merchant / toko / resto / minimarket dan ringkasan singkat barang belanjaan, misal: 'Indomaret - Belanja Kebutuhan Dapur', 'SPBU Pertamina - Bensin', 'Kopi Kenangan - Minuman'",
  "jumlah": 50000, // Total nominal akhir pembayaran dalam Rupiah (angka murni integer positif tanpa titik/koma/Rp)
  "tanggal": "YYYY-MM-DD", // Tanggal transaksi. Jika tahun tidak tercantum, gunakan tahun ${currentYear}. Jika tanggal tidak terbaca, gunakan tanggal hari ini: "${todayIso}"
  "kategori": "Makanan & Minuman", // Pilih satu kategori paling cocok dari daftar: ["Makanan & Minuman", "Belanja", "Transportasi", "Hiburan", "Tagihan", "Kesehatan", "Pendidikan", "Donasi", "Lain-lain"]
  "metode": "Tunai", // Metode pembayaran yang tertera, pilih dari: ["Tunai", "Transfer", "QRIS", "Debit", "Kredit", "Lainnya"]
  "catatan": "Rincian item belanjaan dan harga per item jika terbaca (contoh: '1. Susu Segar 1L (Rp22.000)\\n2. Roti Tawar (Rp16.000)\\nNo. Struk: 10294')",
  "ringkasan": "Kalimat singkat 1 kalimat hasil ringkasan struk (contoh: 'Total belanja Rp38.000 di Indomaret pada 18 Oktober')"
}

Jika gambar sama sekali bukan struk belanja / transaksi atau terlalu buram untuk dibaca, kembalikan:
{
  "sukses": false,
  "pesan": "Gambar tidak dapat dikenali sebagai struk belanja atau tulisan terlalu buram."
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

// Setup Vite middleware untuk mode development
const isDev = process.env.NODE_ENV !== "production";

async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Mode produksi: layani static build
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server Catatan Keuangan berjalan di port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Gagal menjalankan server:", err);
});
