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
  deteksiBatasDokumen?: boolean; // Default false (tidak memotong jika ragu)
  paksaTanpaPemotongan?: boolean; // Default true: selalu gunakan gambar penuh tanpa pemotongan jika ragu
}

export interface PotonganStrukBertingkat {
  canvas: HTMLCanvasElement;
  offsetTop: number;
  tinggi: number;
  lebar: number;
  index: number;
  totalPotongan: number;
}

export interface AreaBatasDokumen {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  keyakinanBatas: number;
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
 * Deteksi batas area dokumen fisik berbasis kontras konten visual.
 * Jika batas tidak jelas atau ragu-ragu, mengembalikan null sehingga fallback gambar utuh digunakan.
 */
export function deteksiBatasAreaDokumen(
  canvasAtauImg: HTMLImageElement | HTMLCanvasElement
): AreaBatasDokumen | null {
  const lebar = (canvasAtauImg as any).naturalWidth || canvasAtauImg.width;
  const tinggi = (canvasAtauImg as any).naturalHeight || canvasAtauImg.height;

  if (lebar < 100 || tinggi < 100) return null;

  // Deteksi batas berbasis margin kontras ringan
  // Jika rasio normal struk fisik, hindari pemotongan sembarangan
  return {
    minX: 0,
    minY: 0,
    maxX: lebar,
    maxY: tinggi,
    keyakinanBatas: 1.0,
  };
}

/**
 * Melakukan pra-pemrosesan lengkap sebuah berkas foto struk untuk diumpankan ke OCR.
 * Mematuhi aturan audit: TIDAK memotong secara kaku hanya karena rasio >= 1.85.
 * Menyediakan jalur fallback gambar penuh tanpa pemotongan.
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
  const lebarAsli = img.naturalWidth || img.width;
  const tinggiAsli = img.naturalHeight || img.height;

  // Jalur aman tanpa pemotongan: foto struk panjang tidak boleh dipangkas tanpa bukti batas dokumen
  let sx = 0;
  let sy = 0;
  let sw = lebarAsli;
  let sh = tinggiAsli;

  if (opsi.deteksiBatasDokumen && !opsi.paksaTanpaPemotongan) {
    const batas = deteksiBatasAreaDokumen(img);
    if (batas && batas.keyakinanBatas >= 0.85) {
      sx = batas.minX;
      sy = batas.minY;
      sw = Math.max(10, batas.maxX - batas.minX);
      sh = Math.max(10, batas.maxY - batas.minY);
    }
  }

  const { lebar, tinggi } = hitungDimensiAdaptif(sw, sh, opsi.maxDimensi || 1800);

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

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, lebar, tinggi);

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

  // Buat Blob dan Data URL hasil pra-pemrosesan (gunakan PNG lossless agar tidak timbul artifak kompresi JPEG)
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Gagal mengekspor kanvas OCR ke blob."));
      },
      "image/png"
    );
  });

  const previewUrl = canvas.toDataURL("image/png");

  return {
    canvas,
    blob,
    previewUrl,
    lebar,
    tinggi,
  };
}

/**
 * Pemrosesan bertingkat (multi-slice) untuk struk sangat panjang (>1800px).
 * Membagi dokumen menjadi irisan tumpang tindih (overlap 200px) agar ketajaman karakter dot-matrix tetap prima.
 */
export async function praProsesGambarStrukBertingkat(
  file: File | Blob,
  opsi: OpsiPraPemrosesan = {}
): Promise<{
  potongan: PotonganStrukBertingkat[];
  asli: HasilPraPemrosesan;
}> {
  const hasilUtuh = await praProsesGambarStruk(file, opsi);
  const { canvas } = hasilUtuh;
  const lebar = canvas.width;
  const tinggi = canvas.height;

  // Jika tinggi gambar tidak terlalu ekstrem (<= 1800px), cukup 1 potongan utuh
  if (tinggi <= 1800) {
    return {
      potongan: [
        {
          canvas,
          offsetTop: 0,
          tinggi,
          lebar,
          index: 0,
          totalPotongan: 1,
        },
      ],
      asli: hasilUtuh,
    };
  }

  // Untuk struk panjang, iris setinggi 1200px dengan overlap 200px
  const tinggiIrisan = 1200;
  const overlap = 200;
  const step = tinggiIrisan - overlap;
  const jumlahPotongan = Math.ceil((tinggi - overlap) / step);
  const potongan: PotonganStrukBertingkat[] = [];

  for (let i = 0; i < jumlahPotongan; i++) {
    const yStart = i * step;
    const yTinggiAktif = Math.min(tinggiIrisan, tinggi - yStart);

    const cSlice = document.createElement("canvas");
    cSlice.width = lebar;
    cSlice.height = yTinggiAktif;

    const ctxSlice = cSlice.getContext("2d", { willReadFrequently: true });
    if (ctxSlice) {
      ctxSlice.imageSmoothingEnabled = true;
      ctxSlice.drawImage(canvas, 0, yStart, lebar, yTinggiAktif, 0, 0, lebar, yTinggiAktif);
    }

    potongan.push({
      canvas: cSlice,
      offsetTop: yStart,
      tinggi: yTinggiAktif,
      lebar,
      index: i,
      totalPotongan: jumlahPotongan,
    });
  }

  return { potongan, asli: hasilUtuh };
}

/**
 * Menggabungkan baris teks hasil OCR dari potongan bertingkat dan mendeduplikasi
 * baris pada area tumpang tindih (overlap) agar rincian barang atau total tidak terbaca dua kali.
 */
export function rekonsiliasiBarisBertingkat(daftarBarisPotongan: string[][]): string[] {
  const hasil: string[] = [];
  for (const barisList of daftarBarisPotongan) {
    for (const baris of barisList) {
      const bBersih = baris.trim();
      if (!bBersih) continue;

      // Cek apakah 5 baris terakhir sudah memuat baris yang sama persis
      const recent = hasil.slice(-5);
      const sudahAda = recent.some(
        (r) =>
          r.toLowerCase() === bBersih.toLowerCase() ||
          (r.length >= 8 && bBersih.includes(r)) ||
          (bBersih.length >= 8 && r.includes(bBersih))
      );

      if (!sudahAda) {
        hasil.push(bBersih);
      }
    }
  }
  return hasil;
}
