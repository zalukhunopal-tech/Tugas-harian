/**
 * Berbagi data dengan keluarga atau komunitas lewat izin Google Drive.
 *
 * Tidak ada server perantara: data tetap di Google Drive pemiliknya. "Terhubung" berarti pemilik memberi akses BACA pada
 * spreadsheet Dana Pribadi dan/atau Dana Kegiatan kepada akun Google orang lain, jadi dana yang tidak dipilih memang tidak
 * bisa dibuka (Google yang menegakkannya, bukan sekadar disembunyikan di layar). Orang itu mengenalkan diri lewat kode QR
 * berisi nama dan email Google-nya; pemilik memindainya, memilih dana, dan aplikasi memberi izin.
 *
 * Modul ini hanya berisi logika murni (kode QR, penyusunan rencana izin, ringkasan siapa-melihat-apa) supaya mudah diuji;
 * pemanggilan Google ada di berbagiDrive.ts.
 */

export type DanaBerbagi = "pribadi" | "kegiatan";

export const SEMUA_DANA: DanaBerbagi[] = ["pribadi", "kegiatan"];

export const LABEL_DANA: Record<DanaBerbagi, string> = {
  pribadi: "Dana Pribadi",
  kegiatan: "Dana Kegiatan",
};

/* ---------- kode QR anggota ---------- */

export interface KodeAnggota {
  nama: string;
  email: string;
}

/** Awalan kode: membedakan kode aplikasi ini dari QR lain, dan memberi nomor versi format. */
export const AWALAN_KODE = "CKH1:";

const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function keBase64Url(teks: string): string {
  const bytes = new TextEncoder().encode(teks);
  let biner = "";
  bytes.forEach((b) => (biner += String.fromCharCode(b)));
  return btoa(biner).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function dariBase64Url(b64: string): string {
  const baku = b64.replace(/-/g, "+").replace(/_/g, "/");
  const biner = atob(baku + "=".repeat((4 - (baku.length % 4)) % 4));
  const bytes = Uint8Array.from(biner, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Teks untuk dijadikan QR: awalan + {n: nama, e: email} dalam base64url. Sengaja kecil supaya QR tetap mudah dipindai. */
export function buatKodeAnggota(k: KodeAnggota): string {
  return AWALAN_KODE + keBase64Url(JSON.stringify({ n: k.nama.trim().slice(0, 60), e: k.email.trim().toLowerCase() }));
}

/** Baca teks hasil pindai atau tempel. Kode yang bukan milik aplikasi ini, rusak, atau beremail tak sah -> null. */
export function bacaKodeAnggota(teks: string): KodeAnggota | null {
  const t = String(teks ?? "").trim();
  const awal = t.indexOf(AWALAN_KODE);
  if (awal < 0) return null;
  const isi = t.slice(awal + AWALAN_KODE.length).split(/\s/)[0];
  try {
    const d = JSON.parse(dariBase64Url(isi));
    const email = typeof d?.e === "string" ? d.e.trim().toLowerCase() : "";
    if (!POLA_EMAIL.test(email)) return null;
    const nama = typeof d?.n === "string" && d.n.trim() ? d.n.trim().slice(0, 60) : email.split("@")[0];
    return { nama, email };
  } catch {
    return null;
  }
}

/* ---------- berkas keuangan dan izinnya ---------- */

/** Dana yang dimuat sebuah spreadsheet keuangan menurut namanya; file timesheet dan file lain bukan bagian dari berbagi. */
export function danaDariNamaFile(nama: string): DanaBerbagi | null {
  const n = nama.toLowerCase();
  if (n.includes("timesheet")) return null;
  if (n.includes("pribadi")) return "pribadi";
  if (n.includes("kegiatan")) return "kegiatan";
  return null;
}

export interface IzinFile {
  /** "user", "anyone", "group", "domain". */
  type: string;
  /** "owner", "writer", "commenter", "reader". */
  role: string;
  emailAddress?: string;
  displayName?: string;
  /** ID izin Google (diperlukan untuk mencabut); tidak selalu tersedia. */
  id?: string;
}

export interface BerkasKeuangan {
  id: string;
  nama: string;
  dana: DanaBerbagi;
  izin: IzinFile[];
}

export type TingkatAkses = "ya" | "sebagian" | "tidak";

export interface Anggota {
  email: string;
  nama: string;
  /** "ya" bila semua berkas dana itu terbuka baginya, "sebagian" bila hanya sebagian tahun. */
  dana: Record<DanaBerbagi, TingkatAkses>;
  /** Peran tertinggi di antara berkasnya: writer berarti orang itu juga bisa mengubah data. */
  bisaMengubah: boolean;
}

const sama = (a?: string, b?: string) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** Siapa saja (selain saya) yang punya akses langsung ke berkas keuangan saya, dan ke dana mana. */
export function ringkasAnggota(berkas: BerkasKeuangan[], emailSaya: string): Anggota[] {
  const total: Record<DanaBerbagi, number> = { pribadi: 0, kegiatan: 0 };
  const orang = new Map<string, { nama: string; jumlah: Record<DanaBerbagi, number>; ubah: boolean }>();
  for (const b of berkas) {
    total[b.dana]++;
    for (const i of b.izin) {
      if (i.type !== "user" || i.role === "owner" || !i.emailAddress || sama(i.emailAddress, emailSaya)) continue;
      const kunci = i.emailAddress.trim().toLowerCase();
      const o = orang.get(kunci) ?? { nama: i.displayName?.trim() || kunci.split("@")[0], jumlah: { pribadi: 0, kegiatan: 0 }, ubah: false };
      o.jumlah[b.dana]++;
      if (i.role === "writer") o.ubah = true;
      if (i.displayName?.trim()) o.nama = i.displayName.trim();
      orang.set(kunci, o);
    }
  }
  const tingkat = (ada: number, semua: number): TingkatAkses => (ada === 0 ? "tidak" : ada >= semua ? "ya" : "sebagian");
  return [...orang.entries()]
    .map(([email, o]) => ({
      email,
      nama: o.nama,
      dana: { pribadi: tingkat(o.jumlah.pribadi, total.pribadi), kegiatan: tingkat(o.jumlah.kegiatan, total.kegiatan) },
      bisaMengubah: o.ubah,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

/** Apakah teks berbentuk alamat email (untuk isian manual dan kode QR). */
export const adalahEmail = (teks: string): boolean => POLA_EMAIL.test(String(teks ?? "").trim());

/**
 * Akun Google pemilik berkas-berkas ini, dari izin berperan owner. Dipakai sebagai "email saya" ketika profil masuk tidak
 * membawa email asli (mode artefak: profilnya hanya pengganti, jadi satu-satunya sumber email adalah izin berkas sendiri).
 */
export function akunPemilikDariIzin(berkas: BerkasKeuangan[]): { email: string; nama?: string } | null {
  for (const b of berkas) {
    for (const i of b.izin) {
      if (i.role === "owner" && i.type === "user" && i.emailAddress && adalahEmail(i.emailAddress)) {
        return { email: i.emailAddress.trim().toLowerCase(), nama: i.displayName?.trim() || undefined };
      }
    }
  }
  return null;
}

/** Berkas yang bisa dibuka siapa saja yang punya tautannya: melemahkan pilihan dana, jadi harus diperingatkan. */
export function berkasTautanPublik(berkas: BerkasKeuangan[]): BerkasKeuangan[] {
  return berkas.filter((b) => b.izin.some((i) => i.type === "anyone" || i.type === "domain"));
}

export interface RencanaBerbagi {
  /** Berkas yang perlu diberi izin baca kepada orang itu. */
  bagikan: BerkasKeuangan[];
  /** Berkas yang izinnya perlu dicabut (idIzin kosong bila Google tidak memberi tahu ID izinnya). */
  cabut: Array<{ berkas: BerkasKeuangan; idIzin?: string }>;
}

/**
 * Selisih antara izin yang ada dan dana yang dipilih pemilik untuk satu orang: dana yang dipilih dan belum terbuka
 * dibagikan, dana yang tidak dipilih tetapi masih terbuka dicabut.
 */
export function rencanaBerbagi(berkas: BerkasKeuangan[], email: string, dipilih: Record<DanaBerbagi, boolean>): RencanaBerbagi {
  const rencana: RencanaBerbagi = { bagikan: [], cabut: [] };
  for (const b of berkas) {
    const izin = b.izin.find((i) => i.type === "user" && sama(i.emailAddress, email));
    if (dipilih[b.dana] && !izin) rencana.bagikan.push(b);
    if (!dipilih[b.dana] && izin && izin.role !== "owner") rencana.cabut.push({ berkas: b, idIzin: izin.id });
  }
  return rencana;
}

/* ---------- data yang dibagikan kepada saya ---------- */

export interface BerkasDibagikan {
  id: string;
  nama: string;
  mimeType?: string;
  pemilikEmail?: string;
  pemilikNama?: string;
  diubah?: string;
}

export interface PemilikDibagikan {
  email: string;
  nama: string;
  berkas: Record<DanaBerbagi, BerkasDibagikan[]>;
}

/** Spreadsheet keuangan yang dibagikan orang lain kepada saya, dikelompokkan per pemilik dan dana. */
export function kelompokkanDibagikan(daftar: BerkasDibagikan[]): PemilikDibagikan[] {
  const peta = new Map<string, PemilikDibagikan>();
  for (const f of daftar) {
    if (f.mimeType && !f.mimeType.includes("spreadsheet")) continue;
    const dana = danaDariNamaFile(f.nama);
    if (!dana) continue;
    const kunci = (f.pemilikEmail || "tidak dikenal").toLowerCase();
    const p = peta.get(kunci) ?? {
      email: kunci,
      nama: f.pemilikNama?.trim() || kunci.split("@")[0],
      berkas: { pribadi: [], kegiatan: [] },
    };
    p.berkas[dana].push(f);
    peta.set(kunci, p);
  }
  for (const p of peta.values()) for (const d of SEMUA_DANA) p.berkas[d].sort((a, b) => b.nama.localeCompare(a.nama));
  return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama));
}
