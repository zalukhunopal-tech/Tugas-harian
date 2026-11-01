/**
 * Pra-pemrosesan gambar berbasis Canvas API untuk meningkatkan akurasi pembacaan OCR lokal (Tesseract.js).
 * Gambar asli transaksi TIDAK diubah, modul ini hanya memproduksi salinan yang dioptimasi
 * (grayscale, peningkatan kontras, orientasi, dan resize adaptif) untuk diumpankan ke OCR.
 */

export interface HasilPraPemrosesan {
  canvas: HTMLCanvasElement;
  blob: Blob;
  previewUrl: string;
  lebar: number;
  tinggi: number;
}

export interface OpsiPraPemrosesan {
  maxDimensi?: number; // Default 1800px untuk ketajaman teks thermal
  tingkatkanKontras?: boolean; // Default true
  ubahGrayscale?: boolean; // Default true
}

const TIPE_GAMBAR_DIDUKUNG = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
];

const BATAS_UKURAN_FILE_BYTE = 25 * 1024 * 1024; // 25 MB

/**
 * Validasi berkas gambar yang diunggah pengguna.
 */
export function validasiBerkasGambar(file: File | Blob): { valid: boolean; pesan?: string } {
  if (!file) {
    return { valid: false, pesan: "Berkas tidak ditemukan." };
  }

  if (file.size > BATAS_UKURAN_FILE_BYTE) {
    const mb = Math.round(file.size / (1024 * 1024));
    return {
      valid: false,
      pesan: `Ukuran berkas terlalu besar (${mb} MB). Batas maksimal adalah 25 MB.`,
    };
  }

  const tipe = file.type?.toLowerCase();
  if (tipe && !TIPE_GAMBAR_DIDUKUNG.includes(tipe) && !tipe.startsWith("image/")) {
    return {
      valid: false,
      pesan: `Format berkas (${tipe}) tidak didukung. Harap gunakan format JPG, PNG, atau WebP.`,
    };
  }

  return { valid: true };
}

/**
 * Memuat berkas gambar menjadi HTMLImageElement.
 */
export function muatElemenGambar(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal menguraikan gambar ke memori."));
      img.onload = () => resolve(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Menghitung dimensi adaptif dengan mempertahankan rasio aspek.
 */
export function hitungDimensiAdaptif(
  lebarAsli: number,
  tinggiAsli: number,
  maxDimensi: number = 1800
): { lebar: number; tinggi: number } {
  let lebar = lebarAsli;
  let tinggi = tinggiAsli;

  if (lebar > maxDimensi || tinggi > maxDimensi) {
    if (lebar > tinggi) {
      tinggi = Math.round((tinggi * maxDimensi) / lebar);
      lebar = maxDimensi;
    } else {
      lebar = Math.round((lebar * maxDimensi) / tinggi);
      tinggi = maxDimensi;
    }
  }

  return { lebar: Math.max(1, lebar), tinggi: Math.max(1, tinggi) };
}

/**
 * Menerapkan peningkatan kontras dan grayscale pada ImageData Canvas.
 * Ini mempertajam karakter teks hitam pada latar belakang kertas struk putih/kusam.
 */
export function terapkanFilterOcr(imageData: ImageData, opsi: { grayscale?: boolean; kontras?: boolean }): void {
  const data = imageData.data;
  const len = data.length;

  const grayscale = opsi.grayscale ?? true;
  const kontras = opsi.kontras ?? true;

  if (!grayscale && !kontras) return;

  // 1. Hitung histogram intensitas untuk perentangan kontras dinamis
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < len; i += 4) {
    // Luminansi perseptual standar (Rec. 709)
    const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // Lindungi dari pembagian dengan nol jika gambar monokrom total
  const rangeLum = Math.max(1, maxLum - minLum);

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    if (kontras && rangeLum > 30) {
      // Perentangan kontras linier (Linear Contrast Stretch)
      lum = Math.round(((lum - minLum) / rangeLum) * 255);
      // Terapkan sedikit kurva S kurvatur untuk mempertajam teks hitam terhadap kertas
      if (lum < 110) {
        lum = Math.max(0, Math.round(lum * 0.85)); // Pergelap teks
      } else if (lum > 150) {
        lum = Math.min(255, Math.round(lum * 1.15)); // Perterang latar kertas
      }
    }

    if (grayscale) {
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    } else {
      // Pertahankan warna tapi sesuaikan kontras
      const faktor = rangeLum > 30 ? (lum - 128) / 128 : 0;
      data[i] = Math.min(255, Math.max(0, Math.round(r + faktor * 30)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(g + faktor * 30)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(b + faktor * 30)));
    }
  }
}

/**
 * Melakukan pra-pemrosesan lengkap sebuah berkas foto struk untuk diumpankan ke OCR.
 */
export async function praProsesGambarStruk(
  file: File | Blob,
  opsi: OpsiPraPemrosesan = {}
): Promise<HasilPraPemrosesan> {
  const validasi = validasiBerkasGambar(file);
  if (!validasi.valid) {
    throw new Error(validasi.pesan);
  }

  const img = await muatElemenGambar(file);
  const { lebar, tinggi } = hitungDimensiAdaptif(img.naturalWidth || img.width, img.naturalHeight || img.height, opsi.maxDimensi || 1800);

  const canvas = document.createElement("canvas");
  canvas.width = lebar;
  canvas.height = tinggi;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Gagal menginisialisasi konteks grafis 2D Canvas.");
  }

  // Gambar dengan penghalusan gambar berkualitas tinggi
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, lebar, tinggi);

  // Ambil piksel dan terapkan filter perjelas teks
  try {
    const imgData = ctx.getImageData(0, 0, lebar, tinggi);
    terapkanFilterOcr(imgData, {
      grayscale: opsi.ubahGrayscale ?? true,
      kontras: opsi.tingkatkanKontras ?? true,
    });
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn("Gagal menerapkan filter piksel OCR Canvas, menggunakan gambar prapemrosesan standar:", err);
  }

  // Buat Blob dan Data URL hasil pra-pemrosesan
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Gagal mengekspor kanvas OCR ke blob."));
      },
      "image/jpeg",
      0.9
    );
  });

  const previewUrl = canvas.toDataURL("image/jpeg", 0.9);

  return {
    canvas,
    blob,
    previewUrl,
    lebar,
    tinggi,
  };
}
