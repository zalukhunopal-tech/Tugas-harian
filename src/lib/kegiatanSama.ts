import type { DataKegiatan, Transaksi } from "../types";

/**
 * Satu kegiatan bisa tercatat dua kali: lewat Penerimaan Dana (judul diketik pengguna) dan lewat Timesheet (judul di file
 * timesheet, sering berakhiran "(Batch N)", kadang terpotong). Modul ini mengenali keduanya sebagai kegiatan yang sama dan
 * menyatukan catatannya tanpa menghilangkan data.
 */

export interface KegiatanBanding {
  nama: string;
  batch?: number;
  tanggalMulai: string; // YYYY-MM-DD
  tanggalSelesai: string; // YYYY-MM-DD
  timesheetId?: string;
  timesheetNama?: string;
  timesheetBaris?: unknown[];
  lokasi?: string;
  docxDriveId?: string;
}

/** Judul terpotong hanya dianggap kegiatan yang sama bila potongan itu cukup panjang untuk khas. */
const PANJANG_MINIMUM_POTONGAN = 40;
/** Kegiatan tanpa kepastian batch dianggap satu periode bila rentangnya beririsan atau berjarak tidak lebih dari ini. */
const JARAK_PERIODE_HARI = 31;

const POLA_BATCH_AKHIR = /\s*[([]?\s*batch\s*(\d+)\s*[)\]]?\s*$/i;

/** Batch yang tertulis di akhir judul: "(Batch 4)" maupun "Batch 4". */
export function batchDiAkhirJudul(judul: string): number | undefined {
  const m = POLA_BATCH_AKHIR.exec((judul || "").trim());
  return m ? Number(m[1]) : undefined;
}

/**
 * Kunci pembanding judul: tanpa "(Batch N)" di akhir, tanpa pemotongan "..." di akhir, huruf kecil, dan tanda baca serta
 * spasi ganda diratakan menjadi satu spasi.
 */
export function kunciNamaKegiatan(nama: string | undefined): string {
  const mentah = nama || "";
  const tersimpan = cacheKunci.get(mentah);
  if (tersimpan !== undefined) return tersimpan;
  let s = mentah.normalize("NFKC").trim();
  s = s.replace(/(\.{2,}|…)\s*$/u, "");
  s = s.replace(POLA_BATCH_AKHIR, "");
  const kunci = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  // Dicocokkan untuk ribuan transaksi sekaligus; judul yang sama tidak perlu dirapikan berulang.
  if (cacheKunci.size >= 2000) cacheKunci.clear();
  cacheKunci.set(mentah, kunci);
  return kunci;
}

const cacheKunci = new Map<string, string>();

function batchBanding(k: KegiatanBanding): number | undefined {
  if (k.batch && k.batch > 0) return k.batch;
  const dariJudul = batchDiAkhirJudul(k.nama);
  if (dariJudul) return dariJudul;
  const m = k.timesheetNama ? /batch\s*(\d+)/i.exec(k.timesheetNama) : null;
  return m ? Number(m[1]) : undefined;
}

/** Judul sama setelah dirapikan, atau salah satunya potongan awal judul lain yang cukup panjang. */
export function namaKegiatanSama(a: string | undefined, b: string | undefined): boolean {
  const ka = kunciNamaKegiatan(a);
  const kb = kunciNamaKegiatan(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const [pendek, panjang] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return pendek.length >= PANJANG_MINIMUM_POTONGAN && panjang.startsWith(pendek);
}

/**
 * Catatan placeholder dari Penerimaan Dana: dibuat otomatis dari judul yang diketik, jadi belum tersambung ke timesheet atau
 * berkas Word dan belum punya lokasi. Tanggalnya hanya tanggal terima dana, bukan tanggal kerja.
 */
export function kegiatanPlaceholder(k: KegiatanBanding): boolean {
  return !k.timesheetId && !(k.timesheetBaris && k.timesheetBaris.length > 0) && !k.docxDriveId && !(k.lokasi || "").trim();
}

function geserHariIso(tanggal: string, hari: number): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + hari));
  return dt.toISOString().slice(0, 10);
}

function periodeDekat(a: KegiatanBanding, b: KegiatanBanding): boolean {
  return (
    a.tanggalMulai <= geserHariIso(b.tanggalSelesai, JARAK_PERIODE_HARI) &&
    b.tanggalMulai <= geserHariIso(a.tanggalSelesai, JARAK_PERIODE_HARI)
  );
}

/**
 * Dua catatan kegiatan yang sama: judul cocok, batch tidak bertentangan, dan (bila batch tidak menegaskan, atau judulnya hanya
 * potongan) periodenya berdekatan. Catatan placeholder Penerimaan Dana tidak dibatasi periode karena dana biasanya diterima
 * jauh sebelum hari pertama timesheet.
 */
export function kegiatanSama(a: KegiatanBanding, b: KegiatanBanding): boolean {
  if (!namaKegiatanSama(a.nama, b.nama)) return false;
  const ba = batchBanding(a);
  const bb = batchBanding(b);
  if (ba && bb && ba !== bb) return false;
  const judulSamaPersis = kunciNamaKegiatan(a.nama) === kunciNamaKegiatan(b.nama);
  const batchMenegaskan = Boolean(ba && bb && ba === bb);
  // Batch dihitung ulang tiap tahun (batch 1 tahun depan), jadi batch dan judul yang sama baru menegaskan bila tahun mulainya sama.
  if (judulSamaPersis && batchMenegaskan && a.tanggalMulai.slice(0, 4) === b.tanggalMulai.slice(0, 4)) return true;
  if (kegiatanPlaceholder(a) !== kegiatanPlaceholder(b)) return true;
  return periodeDekat(a, b);
}

const hariKe = (iso: string) => Date.parse(iso + "T00:00:00Z") / 86400000;

/** Selisih hari antara tanggal dan rentang kegiatan (0 bila di dalam rentang). */
function jarakKeRentang(k: KegiatanBanding, tanggal: string): number {
  if (tanggal < k.tanggalMulai) return hariKe(k.tanggalMulai) - hariKe(tanggal);
  if (tanggal > k.tanggalSelesai) return hariKe(tanggal) - hariKe(k.tanggalSelesai);
  return 0;
}

/** Kegiatan yang rentangnya memuat tanggal, atau paling dekat dengannya. */
function terdekat<T extends KegiatanBanding>(pool: T[], tanggal: string): T | undefined {
  return [...pool].sort((x, y) => jarakKeRentang(x, tanggal) - jarakKeRentang(y, tanggal))[0];
}

/**
 * Kegiatan dalam `daftar` yang sama dengan `calon` (mis. judul yang baru diketik di Penerimaan Dana). Bila beberapa cocok, yang
 * rentangnya paling dekat dengan tanggal calon: dana biasanya diterima sebelum kegiatan mulai, jadi penerimaan Oktober milik
 * batch yang mulai November, bukan batch bulan Februari tahun depan.
 */
export function cariKegiatanSama<T extends KegiatanBanding>(daftar: T[], calon: KegiatanBanding): T | undefined {
  const cocok = daftar.filter((k) => kegiatanSama(k, calon));
  return cocok.length <= 1 ? cocok[0] : terdekat(cocok, calon.tanggalMulai);
}

/**
 * Kegiatan pemilik sebuah teks kaitan pada transaksi: yang judulnya cocok. Bila beberapa kegiatan cocok (mis. batch berbeda),
 * pilih yang rentangnya memuat `tanggal`, lalu yang batch-nya tertulis pada kaitan, lalu yang paling dekat dengan tanggal itu.
 */
export function kegiatanDariKaitan<T extends KegiatanBanding>(daftar: T[], kaitan: string | undefined, tanggal: string): T | undefined {
  if (!kunciNamaKegiatan(kaitan)) return undefined;
  const batchKaitan = batchDiAkhirJudul(kaitan || "");
  const cocok = daftar.filter((k) => {
    if (!namaKegiatanSama(k.nama, kaitan)) return false;
    const bk = batchBanding(k);
    return !(batchKaitan && bk && batchKaitan !== bk);
  });
  if (cocok.length <= 1) return cocok[0];
  const dalam = cocok.filter((k) => tanggal >= k.tanggalMulai && tanggal <= k.tanggalSelesai);
  if (dalam.length === 1) return dalam[0];
  const pool = dalam.length > 1 ? dalam : cocok;
  const denganBatch = batchKaitan ? pool.filter((k) => batchBanding(k) === batchKaitan) : [];
  if (denganBatch.length === 1) return denganBatch[0];
  return terdekat(pool, tanggal);
}

/* ---------- penyatuan ---------- */

const punyaTimesheet = (k: DataKegiatan) => Boolean(k.timesheetId || (k.timesheetBaris && k.timesheetBaris.length > 0));

/** Skor kelengkapan: kegiatan yang tersambung ke timesheet atau berkas Word menjadi induk saat penyatuan. */
function skorInduk(k: DataKegiatan): number {
  return (punyaTimesheet(k) ? 4 : 0) + (k.docxDriveId ? 2 : 0) + (k.lokasi?.trim() ? 1 : 0);
}

/** Rentang kegiatan hasil penyatuan: placeholder Penerimaan Dana tidak melebarkan rentang kegiatan yang sudah punya tanggal kerja. */
function rentangGabungan(induk: DataKegiatan, lain: DataKegiatan): { mulai: string; selesai: string } {
  const pInduk = kegiatanPlaceholder(induk);
  const pLain = kegiatanPlaceholder(lain);
  const dari = (k: DataKegiatan) => ({ mulai: k.tanggalMulai, selesai: k.tanggalSelesai });
  if (pInduk !== pLain) return dari(pInduk ? lain : induk);
  if (!pInduk && punyaTimesheet(induk)) return dari(induk);
  if (!pInduk && punyaTimesheet(lain)) return dari(lain);
  return {
    mulai: induk.tanggalMulai < lain.tanggalMulai ? induk.tanggalMulai : lain.tanggalMulai,
    selesai: induk.tanggalSelesai > lain.tanggalSelesai ? induk.tanggalSelesai : lain.tanggalSelesai,
  };
}

function satukan(induk: DataKegiatan, lain: DataKegiatan): DataKegiatan {
  const namaInduk = induk.nama.trim();
  const namaLain = lain.nama.trim();
  // Judul yang lebih panjang (tidak terpotong) dipertahankan bila judul induk hanya potongannya.
  const indukTerpotong = kunciNamaKegiatan(namaLain).length > kunciNamaKegiatan(namaInduk).length && !batchDiAkhirJudul(namaInduk);
  const nama = indukTerpotong ? namaLain : namaInduk;
  const { mulai, selesai } = rentangGabungan(induk, lain);
  const urutan = [...(induk.urutanTransaksi ?? [])];
  for (const id of lain.urutanTransaksi ?? []) if (!urutan.includes(id)) urutan.push(id);
  const dibuat = [induk.dibuat, lain.dibuat].filter(Boolean).sort()[0];
  // Hasil penyatuan dianggap baru diubah, supaya menang atas salinan lama (yang masih memuat kembarannya) saat sinkron.
  const diubah = new Date().toISOString();
  return {
    ...lain,
    ...induk,
    nama,
    lokasi: induk.lokasi?.trim() ? induk.lokasi : lain.lokasi,
    tanggalMulai: mulai,
    tanggalSelesai: selesai,
    catatan: induk.catatan?.trim() ? induk.catatan : lain.catatan,
    urutanTransaksi: urutan.length > 0 ? urutan : undefined,
    sertakanDaftarPeriksa: induk.sertakanDaftarPeriksa ?? lain.sertakanDaftarPeriksa,
    docxDriveId: induk.docxDriveId ?? lain.docxDriveId,
    batch: induk.batch ?? lain.batch,
    timesheetId: induk.timesheetId ?? lain.timesheetId,
    timesheetNama: induk.timesheetNama ?? lain.timesheetNama,
    timesheetBaris: induk.timesheetBaris && induk.timesheetBaris.length > 0 ? induk.timesheetBaris : lain.timesheetBaris,
    timesheetSinkron: induk.timesheetSinkron ?? lain.timesheetSinkron,
    timesheetDibuatApp: induk.timesheetDibuatApp ?? lain.timesheetDibuatApp,
    penandatangan: induk.penandatangan ?? lain.penandatangan,
    dibuat,
    diubah,
  };
}

/** Placeholder hanya dilebur ke kegiatan nyata yang paling dekat dengannya; pasangan lain tidak dipaksakan. */
function pasanganTerbaik(k: DataKegiatan, calon: DataKegiatan, semua: DataKegiatan[]): boolean {
  if (!kegiatanPlaceholder(k) || kegiatanPlaceholder(calon)) return true;
  const cocok = semua.filter((x) => x.id !== k.id && !kegiatanPlaceholder(x) && kegiatanSama(k, x));
  return terdekat(cocok, k.tanggalMulai)?.id === calon.id;
}

export interface HasilPenyatuan {
  daftar: DataKegiatan[];
  transaksi: Transaksi[];
  /** id kegiatan yang dilebur -> id kegiatan induknya */
  dilebur: Record<string, string>;
}

/**
 * Menyatukan kegiatan kembar dalam `daftar`. Isi kegiatan yang dilebur digabung ke induknya (tidak ada data yang dibuang) dan
 * transaksi yang menunjuk id atau judul kegiatan yang dilebur dialihkan ke induknya. Urutan daftar dipertahankan.
 */
export function satukanKegiatanKembar(daftar: DataKegiatan[], transaksi: Transaksi[] = []): HasilPenyatuan {
  const dilebur: Record<string, string> = {};
  let sisa = [...daftar];
  let berubah = true;
  while (berubah) {
    berubah = false;
    outer: for (let i = 0; i < sisa.length; i++) {
      for (let j = i + 1; j < sisa.length; j++) {
        if (!kegiatanSama(sisa[i], sisa[j])) continue;
        if (!pasanganTerbaik(sisa[i], sisa[j], sisa) || !pasanganTerbaik(sisa[j], sisa[i], sisa)) continue;
        const [induk, lain] = skorInduk(sisa[j]) > skorInduk(sisa[i]) ? [sisa[j], sisa[i]] : [sisa[i], sisa[j]];
        const gabungan = satukan(induk, lain);
        dilebur[lain.id] = induk.id;
        sisa = sisa.filter((k) => k.id !== lain.id).map((k) => (k.id === induk.id ? gabungan : k));
        berubah = true;
        break outer;
      }
    }
  }
  if (Object.keys(dilebur).length === 0) return { daftar, transaksi, dilebur };

  // Induk yang kemudian ikut dilebur ke kegiatan lain diikuti sampai induk terakhir.
  const indukAkhir = (id: string) => {
    let sekarang = id;
    while (dilebur[sekarang]) sekarang = dilebur[sekarang];
    return sekarang;
  };
  for (const id of Object.keys(dilebur)) dilebur[id] = indukAkhir(id);
  const namaLama = new Map<string, string>(); // kunci judul kegiatan yang dilebur -> judul induk
  for (const k of daftar) {
    if (!dilebur[k.id]) continue;
    const induk = sisa.find((x) => x.id === indukAkhir(k.id));
    if (induk) namaLama.set(kunciNamaKegiatan(k.nama), induk.nama);
  }
  const waktu = new Date().toISOString();
  const transaksiBaru = transaksi.map((t) => {
    const idBaru = t.kegiatanId && dilebur[t.kegiatanId] ? indukAkhir(t.kegiatanId) : t.kegiatanId;
    const namaBaru = t.kaitan && namaLama.has(kunciNamaKegiatan(t.kaitan)) ? namaLama.get(kunciNamaKegiatan(t.kaitan)) : undefined;
    if (idBaru === t.kegiatanId && (!namaBaru || namaBaru === t.kaitan)) return t;
    return { ...t, kegiatanId: idBaru, kaitan: namaBaru ?? t.kaitan, diubah: waktu };
  });
  return { daftar: sisa, transaksi: transaksiBaru, dilebur };
}

/**
 * Menggabungkan daftar kegiatan dari dua sumber (mis. Drive dan perangkat ini) tanpa menghapus satu pun. Kegiatan dengan id
 * yang sama dipakai versi yang lebih baru diubah (isian yang kosong di versi itu dilengkapi dari yang lain); kegiatan yang
 * hanya ada di salah satu sumber tetap dipertahankan. Kegiatan kembar disatukan sesudahnya oleh `satukanKegiatanKembar`.
 */
export function gabungDaftarKegiatan(jauh: DataKegiatan[], lokal: DataKegiatan[]): DataKegiatan[] {
  const hasil = new Map<string, DataKegiatan>();
  for (const k of jauh) hasil.set(k.id, k);
  for (const k of lokal) {
    const ada = hasil.get(k.id);
    if (!ada) {
      hasil.set(k.id, k);
      continue;
    }
    const lokalLebihBaru = (k.diubah ?? "") > (ada.diubah ?? "");
    const [utama, pelengkap] = lokalLebihBaru ? [k, ada] : [ada, k];
    const lengkap: DataKegiatan = { ...pelengkap, ...utama };
    for (const kunci of Object.keys(pelengkap) as Array<keyof DataKegiatan>) {
      const nilai = utama[kunci];
      const kosong = nilai === undefined || nilai === null || (typeof nilai === "string" && !nilai.trim()) || (Array.isArray(nilai) && nilai.length === 0);
      if (kosong && pelengkap[kunci] !== undefined) (lengkap as unknown as Record<string, unknown>)[kunci] = pelengkap[kunci];
    }
    if (utama.penandatangan || pelengkap.penandatangan) {
      lengkap.penandatangan = {
        ...(pelengkap.penandatangan ?? {}),
        ...(utama.penandatangan ?? {}),
      };
    }
    hasil.set(k.id, lengkap);
  }
  return Array.from(hasil.values());
}
