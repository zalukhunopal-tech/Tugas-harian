/**
 * Google Authenticator (TOTP, RFC 6238) sebagai langkah kedua pembuka Kunci Aplikasi.
 *
 * Rahasia dibuat dan diperiksa di perangkat ini saja: tidak ada server, dan rahasia TIDAK ikut tersinkron ke Google Drive
 * (berbeda dari konfigurasi PIN di Pengaturan.json). Aplikasi Authenticator di ponsel memberi kode 6 angka yang berganti
 * tiap 30 detik; aplikasi ini menghitung kode yang sama dari rahasia yang sama dan membandingkannya.
 *
 * Bagian murni (base32, HOTP/TOTP, pemeriksaan, URI otpauth) ada di atas dan diuji dengan vektor RFC di
 * scripts/uji_totp.ts; penyimpanan lokal dan pembatasan percobaan ada di bagian bawah.
 */

/* ---------- base32 (RFC 4648) ---------- */

const ABJAD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bit = 0;
  let nilai = 0;
  let hasil = "";
  for (const b of bytes) {
    nilai = (nilai << 8) | b;
    bit += 8;
    while (bit >= 5) {
      hasil += ABJAD[(nilai >>> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  if (bit > 0) hasil += ABJAD[(nilai << (5 - bit)) & 31];
  return hasil;
}

/** Spasi, tanda hubung, '=' dan huruf kecil ditoleransi (kunci sering disalin dalam kelompok 4 huruf). */
export function base32Decode(teks: string): Uint8Array {
  const bersih = teks.toUpperCase().replace(/[\s=-]/g, "");
  let bit = 0;
  let nilai = 0;
  const keluar: number[] = [];
  for (const c of bersih) {
    const idx = ABJAD.indexOf(c);
    if (idx < 0) throw new Error("Kunci tidak sah: hanya huruf A-Z dan angka 2-7.");
    nilai = (nilai << 5) | idx;
    bit += 5;
    if (bit >= 8) {
      keluar.push((nilai >>> (bit - 8)) & 255);
      bit -= 8;
    }
  }
  return Uint8Array.from(keluar);
}

/** Rahasia baru: 20 byte acak (kunci SHA-1 yang disarankan RFC) sebagai 32 huruf base32. */
export function buatRahasiaTotp(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** "ABCD EFGH …": kelompok 4 huruf supaya mudah diketik di Authenticator. */
export const formatRahasia = (rahasia: string): string => rahasia.replace(/(.{4})/g, "$1 ").trim();

/* ---------- HOTP / TOTP ---------- */

export const PERIODE_DETIK = 30;
export const JUMLAH_DIGIT = 6;

export const langkahDariWaktu = (waktuMs: number, periode = PERIODE_DETIK): number => Math.floor(waktuMs / 1000 / periode);

async function hmacSha1(kunci: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // Salinan ber-ArrayBuffer: tipe Uint8Array<ArrayBufferLike> tidak diterima langsung oleh WebCrypto di TypeScript baru.
  const k = await crypto.subtle.importKey("raw", new Uint8Array(kunci), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new Uint8Array(data)));
}

/** HOTP (RFC 4226): `hitungan` sebagai 8 byte big-endian, pemotongan dinamis, lalu sisa bagi 10^digit. */
export async function hotp(kunci: Uint8Array, hitungan: number, digit = JUMLAH_DIGIT): Promise<string> {
  const data = new Uint8Array(8);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, Math.floor(hitungan / 2 ** 32));
  dv.setUint32(4, hitungan >>> 0);
  const h = await hmacSha1(kunci, data);
  const o = h[h.length - 1] & 15;
  const biner = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(biner % 10 ** digit).padStart(digit, "0");
}

export async function kodeTotp(rahasiaBase32: string, waktuMs: number, digit = JUMLAH_DIGIT): Promise<string> {
  return hotp(base32Decode(rahasiaBase32), langkahDariWaktu(waktuMs), digit);
}

function samaWaktuTetap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

export interface HasilPeriksaKode {
  cocok: boolean;
  /** Langkah waktu yang cocok; simpan sebagai `langkahTerakhir` supaya kode yang sama tidak dipakai dua kali. */
  langkah?: number;
}

/**
 * Cocokkan kode 6 angka. `jendela` = berapa langkah 30 detik di kiri-kanan yang diterima (selisih jam ponsel). Kode pada
 * langkah yang sudah dipakai (<= langkahTerakhir) ditolak: kode yang diintip tidak bisa dipakai ulang.
 */
export async function periksaKodeTotp(
  rahasiaBase32: string,
  kode: string,
  waktuMs: number,
  langkahTerakhir = -1,
  jendela = 1
): Promise<HasilPeriksaKode> {
  const bersih = String(kode ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(bersih)) return { cocok: false };
  const kunci = base32Decode(rahasiaBase32);
  const sekarang = langkahDariWaktu(waktuMs);
  let temu: number | undefined;
  // Semua langkah diperiksa tanpa berhenti di yang pertama cocok, supaya waktu pemeriksaan tidak membocorkan apa pun.
  for (let d = -jendela; d <= jendela; d++) {
    const langkah = sekarang + d;
    if (langkah <= langkahTerakhir || langkah < 0) continue;
    const harapan = await hotp(kunci, langkah);
    if (samaWaktuTetap(harapan, bersih) && temu === undefined) temu = langkah;
  }
  return temu === undefined ? { cocok: false } : { cocok: true, langkah: temu };
}

/** URI yang dibaca Google Authenticator dari kode QR. Label "penerbit:akun" muncul sebagai nama entri di aplikasinya. */
export function buatUriOtpauth(opsi: { email: string; rahasia: string; penerbit?: string }): string {
  const penerbit = opsi.penerbit ?? "Catatan Keuangan";
  const label = `${encodeURIComponent(penerbit)}:${encodeURIComponent(opsi.email)}`;
  const q = new URLSearchParams({ secret: opsi.rahasia, issuer: penerbit, algorithm: "SHA1", digits: String(JUMLAH_DIGIT), period: String(PERIODE_DETIK) });
  return `otpauth://totp/${label}?${q.toString().replace(/\+/g, "%20")}`;
}

/* ---------- penyimpanan lokal dan pembatasan percobaan ---------- */

export type IntervalTotp = "selalu" | "8jam" | "24jam";

export const LABEL_INTERVAL: Record<IntervalTotp, string> = {
  selalu: "Setiap kali kunci dibuka",
  "8jam": "Sekali tiap 8 jam",
  "24jam": "Sekali tiap 24 jam",
};

const MS_INTERVAL: Record<IntervalTotp, number> = { selalu: 0, "8jam": 8 * 3600 * 1000, "24jam": 24 * 3600 * 1000 };

export interface TotpTersimpan {
  rahasia: string;
  /** Akun Google (Drive) yang tertaut pada saat Authenticator diaktifkan; hanya label dan pengingat. */
  email: string;
  interval: IntervalTotp;
  aktifSejak: string;
  /** Langkah waktu terakhir yang diterima (cegah pemakaian ulang kode). */
  langkahTerakhir: number;
  percobaanGagal: number;
  terkunciSampai: number;
  /** Sampai kapan perangkat ini dianggap sudah lolos langkah kedua (sesuai `interval`). */
  terverifikasiSampai: number;
}

export const KUNCI_TOTP = "keuangan-totp";

export function muatTotp(): TotpTersimpan | null {
  try {
    const mentah = localStorage.getItem(KUNCI_TOTP);
    if (!mentah) return null;
    const d = JSON.parse(mentah) as Partial<TotpTersimpan>;
    if (!d || typeof d.rahasia !== "string" || !/^[A-Z2-7]{16,}$/.test(d.rahasia)) return null;
    return {
      rahasia: d.rahasia,
      email: typeof d.email === "string" ? d.email : "",
      interval: d.interval === "selalu" || d.interval === "24jam" ? d.interval : "8jam",
      aktifSejak: typeof d.aktifSejak === "string" ? d.aktifSejak : "",
      langkahTerakhir: Number.isFinite(d.langkahTerakhir) ? Number(d.langkahTerakhir) : -1,
      percobaanGagal: Number.isFinite(d.percobaanGagal) ? Number(d.percobaanGagal) : 0,
      terkunciSampai: Number.isFinite(d.terkunciSampai) ? Number(d.terkunciSampai) : 0,
      terverifikasiSampai: Number.isFinite(d.terverifikasiSampai) ? Number(d.terverifikasiSampai) : 0,
    };
  } catch {
    return null;
  }
}

export function simpanTotp(t: TotpTersimpan): void {
  try {
    localStorage.setItem(KUNCI_TOTP, JSON.stringify(t));
  } catch {
    // penyimpanan tidak tersedia: Authenticator hanya berlaku sampai halaman ditutup
  }
}

export function hapusTotp(): void {
  try {
    localStorage.removeItem(KUNCI_TOTP);
  } catch {
    // abaikan
  }
}

/** Apakah pembuka kunci masih harus memasukkan kode Authenticator sekarang? */
export const perluKodeTotp = (t: TotpTersimpan | null, sekarang: number): boolean => t !== null && sekarang >= t.terverifikasiSampai;

/** Sisa detik penguncian akibat salah kode berulang; 0 bila boleh mencoba. */
export const sisaDetikKunci = (t: TotpTersimpan | null, sekarang: number): number =>
  t && t.terkunciSampai > sekarang ? Math.ceil((t.terkunciSampai - sekarang) / 1000) : 0;

/** Lima salah pertama gratis; sesudahnya jeda 30 detik, berlipat dua tiap salah, maksimal 15 menit. */
export function lamaKunciMs(percobaanGagal: number): number {
  if (percobaanGagal < 5) return 0;
  return Math.min(30_000 * 2 ** (percobaanGagal - 5), 15 * 60_000);
}

/** Periksa kode untuk pembuka kunci dan catat hasilnya (jumlah gagal, jeda, langkah terakhir, masa percaya perangkat). */
export async function periksaDanCatatTotp(
  kode: string,
  sekarang: number = Date.now()
): Promise<{ cocok: boolean; terkunciDetik: number; pesan: string }> {
  const t = muatTotp();
  if (!t) return { cocok: true, terkunciDetik: 0, pesan: "" };
  const kunci = sisaDetikKunci(t, sekarang);
  if (kunci > 0) return { cocok: false, terkunciDetik: kunci, pesan: `Terlalu banyak percobaan. Coba lagi dalam ${kunci} detik.` };

  const hasil = await periksaKodeTotp(t.rahasia, kode, sekarang, t.langkahTerakhir);
  if (hasil.cocok) {
    simpanTotp({
      ...t,
      langkahTerakhir: hasil.langkah ?? t.langkahTerakhir,
      percobaanGagal: 0,
      terkunciSampai: 0,
      terverifikasiSampai: sekarang + MS_INTERVAL[t.interval],
    });
    return { cocok: true, terkunciDetik: 0, pesan: "" };
  }
  const gagal = t.percobaanGagal + 1;
  const lama = lamaKunciMs(gagal);
  simpanTotp({ ...t, percobaanGagal: gagal, terkunciSampai: lama > 0 ? sekarang + lama : 0 });
  return {
    cocok: false,
    terkunciDetik: Math.ceil(lama / 1000),
    pesan: lama > 0 ? `Kode salah. Coba lagi dalam ${Math.ceil(lama / 1000)} detik.` : "Kode salah atau sudah dipakai. Masukkan kode terbaru dari Google Authenticator.",
  };
}

/** Aktifkan setelah pengguna membuktikan Authenticator-nya bekerja (kode pertama cocok). */
export async function aktifkanTotp(
  rahasia: string,
  email: string,
  kode: string,
  interval: IntervalTotp,
  sekarang: number = Date.now()
): Promise<boolean> {
  const hasil = await periksaKodeTotp(rahasia, kode, sekarang);
  if (!hasil.cocok) return false;
  simpanTotp({
    rahasia,
    email,
    interval,
    aktifSejak: new Date(sekarang).toISOString(),
    langkahTerakhir: hasil.langkah ?? -1,
    percobaanGagal: 0,
    terkunciSampai: 0,
    // Baru saja membuktikan kodenya: tidak perlu langsung diminta lagi di kunci berikutnya.
    terverifikasiSampai: sekarang + MS_INTERVAL[interval],
  });
  return true;
}

/** Matikan Authenticator hanya dengan kode yang sah (bukan sekadar menekan tombol). */
export async function nonaktifkanTotp(kode: string, sekarang: number = Date.now()): Promise<{ berhasil: boolean; pesan: string }> {
  const t = muatTotp();
  if (!t) return { berhasil: true, pesan: "" };
  const hasil = await periksaDanCatatTotp(kode, sekarang);
  if (!hasil.cocok) return { berhasil: false, pesan: hasil.pesan };
  hapusTotp();
  return { berhasil: true, pesan: "" };
}

export function ubahIntervalTotp(interval: IntervalTotp): void {
  const t = muatTotp();
  if (t) simpanTotp({ ...t, interval, terverifikasiSampai: Math.min(t.terverifikasiSampai, Date.now() + MS_INTERVAL[interval]) });
}
