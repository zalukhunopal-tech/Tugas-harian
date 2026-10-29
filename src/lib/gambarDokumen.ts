import { ambilBlobBuktiTersimpan, ekstrakDriveFileId } from "./driveBuktiLoader";
import { ambilSemuaBuktiOffline } from "./buktiStorage";

/**
 * Foto bukti untuk dokumen Word: muat bytenya dari data lokal, cache pratinjau, Google Drive (ID atau tautan dari kolom Bukti di
 * sheet), atau antrean unggah offline; kenali format dan ukuran aslinya supaya rasio terjaga; WebP dan format lain yang tidak
 * didukung Word diubah ke JPEG lewat kanvas peramban.
 */

export type JenisGambarWord = "png" | "jpg" | "gif" | "bmp";

export interface GambarDokumen {
  data: Uint8Array;
  jenis: JenisGambarWord;
  lebar: number;
  tinggi: number;
}

export interface InfoGambar {
  jenis: JenisGambarWord | "webp" | "pdf" | null;
  lebar?: number;
  tinggi?: number;
  /** Orientasi EXIF JPEG (1 = tegak); 5-8 berarti foto diputar 90 derajat saat ditampilkan. */
  orientasi?: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const i32le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24);
const teks = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function orientasiExif(b: Uint8Array, mulai: number, panjang: number): number | undefined {
  // Segmen APP1: "Exif\0\0" lalu header TIFF.
  if (teks(b, mulai, 4) !== "Exif") return undefined;
  const tiff = mulai + 6;
  const le = teks(b, tiff, 2) === "II";
  const r16 = (i: number) => (le ? u16le(b, i) : u16be(b, i));
  const r32 = (i: number) => (le ? (i32le(b, i) >>> 0) : u32be(b, i));
  const ifd = tiff + r32(tiff + 4);
  if (ifd + 2 > mulai + panjang) return undefined;
  const n = r16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > b.length) break;
    if (r16(e) === 0x0112) return r16(e + 8);
  }
  return undefined;
}

/** Kenali format dan ukuran gambar dari bytenya (PNG, JPEG, GIF, BMP, WebP), atau PDF. */
export function kenaliGambar(b: Uint8Array): InfoGambar {
  if (b.length < 12) return { jenis: null };
  if (b[0] === 0x89 && teks(b, 1, 3) === "PNG") return { jenis: "png", lebar: u32be(b, 16), tinggi: u32be(b, 20) };
  if (teks(b, 0, 4) === "%PDF") return { jenis: "pdf" };
  if (teks(b, 0, 3) === "GIF") return { jenis: "gif", lebar: u16le(b, 6), tinggi: u16le(b, 8) };
  if (teks(b, 0, 2) === "BM") return { jenis: "bmp", lebar: Math.abs(i32le(b, 18)), tinggi: Math.abs(i32le(b, 22)) };
  if (teks(b, 0, 4) === "RIFF" && teks(b, 8, 4) === "WEBP") return { jenis: "webp" };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    let orientasi: number | undefined;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const penanda = b[i + 1];
      if (penanda === 0xd8 || penanda === 0x01 || (penanda >= 0xd0 && penanda <= 0xd7)) {
        i += 2;
        continue;
      }
      const panjang = u16be(b, i + 2);
      if (penanda === 0xe1 && orientasi === undefined) orientasi = orientasiExif(b, i + 4, panjang - 2);
      const sof = penanda >= 0xc0 && penanda <= 0xcf && penanda !== 0xc4 && penanda !== 0xc8 && penanda !== 0xcc;
      if (sof) return { jenis: "jpg", tinggi: u16be(b, i + 5), lebar: u16be(b, i + 7), orientasi };
      i += 2 + panjang;
    }
    return { jenis: "jpg", orientasi };
  }
  return { jenis: null };
}

/** Ukuran tampil yang muat di kotak maksLebar × maksTinggi (piksel), rasio asli dijaga dan tidak diperbesar dari aslinya. */
export function pasDalamKotak(lebar: number, tinggi: number, maksLebar: number, maksTinggi: number): { lebar: number; tinggi: number } {
  if (!(lebar > 0) || !(tinggi > 0)) return { lebar: maksLebar, tinggi: Math.round((maksLebar * 3) / 4) };
  const skala = Math.min(maksLebar / lebar, maksTinggi / tinggi, 1);
  return { lebar: Math.max(1, Math.round(lebar * skala)), tinggi: Math.max(1, Math.round(tinggi * skala)) };
}

function base64KeByte(isi: string): Uint8Array {
  const biner = atob(isi);
  const hasil = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i);
  return hasil;
}

/** Bukti/foto yang bisa dimuat: data lokal, ID Drive, tautan Drive (kolom Bukti di sheet), atau antrean unggah offline. */
export interface SumberGambar {
  id?: string;
  dataUrl?: string;
  driveId?: string;
  driveLink?: string;
}

/** Byte berkas bukti, atau null bila tidak bisa dimuat dari mana pun. */
export async function ambilByteBukti(item: SumberGambar, token?: string): Promise<Uint8Array | null> {
  if (item.dataUrl && item.dataUrl.startsWith("data:")) {
    try {
      const potong = item.dataUrl.indexOf(";base64,");
      if (potong >= 0) return base64KeByte(item.dataUrl.slice(potong + 8));
    } catch (e) {
      console.warn("Gagal mengurai data foto bukti:", e);
    }
  }

  const idDrive = item.driveId || ekstrakDriveFileId(item.driveLink) || undefined;
  if (idDrive) {
    const tersimpan = await ambilBlobBuktiTersimpan(idDrive).catch(() => null);
    if (tersimpan) return new Uint8Array(await tersimpan.blob.arrayBuffer());
    if (token) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${idDrive}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
      } catch (e) {
        console.warn("Gagal mengunduh foto bukti dari Drive:", e);
      }
    }
  }

  if (item.id) {
    try {
      const antrean = await ambilSemuaBuktiOffline();
      const cocok = antrean.find((b) => b.id === item.id);
      if (cocok?.blob) return new Uint8Array(await cocok.blob.arrayBuffer());
    } catch (e) {
      console.warn("Gagal membaca foto bukti dari antrean offline:", e);
    }
  }
  return null;
}

/** Sisi terpanjang foto di dokumen; foto kamera yang jauh lebih besar diperkecil supaya berkas Word tidak membengkak. */
const SISI_MAKS_PIKSEL = 1800;
const BATAS_UKURAN_BYTE = 1_500_000;

async function ubahLewatKanvas(data: Uint8Array): Promise<GambarDokumen | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(new Blob([data as BlobPart]), { imageOrientation: "from-image" } as ImageBitmapOptions);
    const skala = Math.min(1, SISI_MAKS_PIKSEL / Math.max(bitmap.width, bitmap.height));
    const lebar = Math.max(1, Math.round(bitmap.width * skala));
    const tinggi = Math.max(1, Math.round(bitmap.height * skala));
    const kanvas = document.createElement("canvas");
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lebar, tinggi);
    ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((selesai) => kanvas.toBlob(selesai, "image/jpeg", 0.86));
    if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), jenis: "jpg", lebar, tinggi };
  } catch (e) {
    console.warn("Foto bukti tidak bisa diubah untuk dokumen:", e);
    return null;
  }
}

/**
 * Gambar siap disisipkan ke Word: format yang didukung Word dipakai apa adanya; WebP, foto berorientasi EXIF miring, atau foto
 * yang sangat besar diubah lewat kanvas peramban (di luar peramban dilewati). PDF dan berkas bukan gambar -> null.
 */
export async function siapkanGambarDokumen(data: Uint8Array): Promise<GambarDokumen | null> {
  const info = kenaliGambar(data);
  if (info.jenis === "pdf") return null;
  const perluDiubah =
    info.jenis === null ||
    info.jenis === "webp" ||
    (info.orientasi !== undefined && info.orientasi > 1) ||
    data.length > BATAS_UKURAN_BYTE ||
    Math.max(info.lebar ?? 0, info.tinggi ?? 0) > SISI_MAKS_PIKSEL;
  if (perluDiubah) {
    const diubah = await ubahLewatKanvas(data);
    if (diubah) return diubah;
    if (info.jenis === null || info.jenis === "webp") return null;
  }
  if (info.jenis === null || info.jenis === "webp") return null;
  return { data, jenis: info.jenis, lebar: info.lebar ?? 0, tinggi: info.tinggi ?? 0 };
}

/** Berkas bukti berupa PDF menurut tipe atau namanya (tidak bisa disisipkan sebagai foto). */
export function buktiPdf(b: { tipe?: string; nama?: string; driveLink?: string }): boolean {
  return b.tipe === "application/pdf" || /\.pdf$/i.test(b.nama ?? "") || /\.pdf(\?|$)/i.test(b.driveLink ?? "");
}
