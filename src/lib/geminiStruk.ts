import { JenisBukti, RincianBarangJasa } from "../types";

export interface HasilBacaStruk {
  sukses: boolean;
  deskripsi?: string;
  jumlah?: number;
  tanggal?: string;
  kategori?: string;
  kategoriDanaKegiatan?: string;
  metode?: string;
  catatan?: string;
  ringkasan?: string;
  pesan?: string;
  jenisBukti?: JenisBukti;
  namaPenjualPenyedia?: string;
  rincian?: RincianBarangJasa;
  keteranganLaporan?: string;
}

export type GeminiModelTier = "flash" | "pro";

export interface PengaturanGemini {
  tier: GeminiModelTier;
  apiKey: string;
}

export const KEY_GEMINI_TIER = "gemini_model_tier";
export const KEY_GEMINI_API_KEY = "gemini_user_api_key";

/**
 * Mengambil preferensi model Gemini pengguna dari penyimpanan lokal
 */
export function ambilPengaturanGemini(): PengaturanGemini {
  try {
    const tier = (localStorage.getItem(KEY_GEMINI_TIER) as GeminiModelTier) || "flash";
    const apiKey = localStorage.getItem(KEY_GEMINI_API_KEY) || "";
    return {
      tier: tier === "pro" ? "pro" : "flash",
      apiKey: apiKey.trim(),
    };
  } catch {
    return { tier: "flash", apiKey: "" };
  }
}

/**
 * Menyimpan preferensi model dan API key pengguna
 */
export function simpanPengaturanGemini(pengaturan: PengaturanGemini): void {
  try {
    localStorage.setItem(KEY_GEMINI_TIER, pengaturan.tier);
    if (pengaturan.apiKey) {
      localStorage.setItem(KEY_GEMINI_API_KEY, pengaturan.apiKey.trim());
    } else {
      localStorage.removeItem(KEY_GEMINI_API_KEY);
    }
  } catch (err) {
    console.warn("Gagal menyimpan preferensi Gemini:", err);
  }
}

/**
 * Membaca File gambar dari input kamera/file, lalu melakukan kompresi cerdas di browser.
 * Disesuaikan ke maksimal dimensi 1080px (bukan 1600px) dan kualitas JPEG 82%
 * agar teks tetap tajam terbaca namun memangkas konsumsi token Gemini hingga ~75%.
 */
export async function optimalkanGambarStruk(
  file: File | Blob
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat elemen gambar"));
      img.onload = () => {
        // 1080px adalah sweet spot: teks struk kecil tetap terbaca jernih,
        // namun resolusi token image Gemini turun drastis sehingga kuota token jauh lebih awet
        const MAX_DIM = 1080;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback tanpa canvas
          const raw = String(reader.result || "");
          const clean = raw.includes(";base64,") ? raw.split(";base64,")[1] : raw;
          resolve({
            base64: clean,
            mimeType: file.type || "image/jpeg",
            previewUrl: raw,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64Data = compressedDataUrl.split(";base64,")[1];

        resolve({
          base64: base64Data,
          mimeType: "image/jpeg",
          previewUrl: compressedDataUrl,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Mengirim gambar struk ke endpoint backend /api/gemini/baca-struk
 * Menyertakan modelTier ('flash' | 'pro') dan personal apiKey jika pengguna menyetelnya.
 */
export async function prosesStrukDenganGemini(
  base64: string,
  mimeType: string = "image/jpeg",
  opsi?: { modelTier?: GeminiModelTier; apiKey?: string }
): Promise<HasilBacaStruk> {
  const settings = ambilPengaturanGemini();
  const tier = opsi?.modelTier || settings.tier;
  const apiKey = opsi?.apiKey !== undefined ? opsi.apiKey : settings.apiKey;

  const res = await fetch("/api/gemini/baca-struk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: base64,
      mimeType,
      modelTier: tier,
      apiKey: apiKey || undefined,
    }),
  });

  if (!res.ok) {
    let errorMsg = `Server error HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.pesan) errorMsg = errJson.pesan;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const data: HasilBacaStruk = await res.json();
  return data;
}
