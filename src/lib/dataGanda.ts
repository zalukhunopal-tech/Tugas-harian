import type { Transaksi } from "../types";

/** Beberapa catatan yang tampak sama: dana, jenis, tanggal, jumlah, dan uraian (tanpa membedakan huruf besar/kecil). */
export interface KelompokGanda {
  kunci: string;
  /** Yang pertama disarankan dipertahankan; sisanya disarankan dihapus. */
  anggota: Transaksi[];
}

/** "Gemini AI Pro" dan "Gemini Ai Pro." dianggap sama. */
export function normalisasiUraian(uraian: string): string {
  return uraian
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** ID buatan aplikasi diawali waktu pembuatan (base36, 8 karakter); 0 untuk ID dari sumber lain (mis. baris sheet). */
export function waktuDariId(id: string): number {
  const m = /^([0-9a-z]{8})[0-9a-z]{6}$/.exec(id);
  return m ? parseInt(m[1], 36) : 0;
}

/** Makin banyak keterangan yang melekat, makin layak dipertahankan: bukti, kaitan kegiatan, catatan. */
function skorKeterangan(t: Transaksi): number {
  return (t.bukti?.length ?? 0) * 100 + (t.kaitan ? 10 : 0) + (t.catatan ? 5 : 0) + (t.kegiatanId ? 3 : 0) + (t.detailKegiatan ? 3 : 0);
}

function urutPertahankan(a: Transaksi, b: Transaksi): number {
  return (
    skorKeterangan(b) - skorKeterangan(a) ||
    waktuDariId(b.id) - waktuDariId(a.id) ||
    (b.diubah || "").localeCompare(a.diubah || "") ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Mencari catatan yang kemungkinan tercatat dua kali (mis. diketik di aplikasi dan lewat chat, atau terbaca ulang dari
 * Drive dengan ID berbeda). Hanya saran: pengguna yang memutuskan. Catatan perdiem dan pasangan (pindah dana) dilewati
 * karena sudah dijaga pasangannya sendiri.
 */
export function cariDataGanda(transaksi: Transaksi[]): KelompokGanda[] {
  const peta = new Map<string, Transaksi[]>();
  for (const t of transaksi) {
    const uraian = normalisasiUraian(t.deskripsi || "");
    if (!uraian || t.kategori === "Perdiem" || t.pasanganId) continue;
    const kunci = [t.dana, t.jenis, t.tanggal, t.jumlah, uraian].join("|");
    const daftar = peta.get(kunci);
    if (daftar) daftar.push(t);
    else peta.set(kunci, [t]);
  }
  const hasil: KelompokGanda[] = [];
  for (const [kunci, daftar] of peta) {
    if (daftar.length < 2) continue;
    hasil.push({ kunci, anggota: [...daftar].sort(urutPertahankan) });
  }
  return hasil.sort((a, b) => b.anggota[0].tanggal.localeCompare(a.anggota[0].tanggal) || a.kunci.localeCompare(b.kunci));
}

/** ID yang disarankan dihapus: semua anggota kelompok kecuali yang pertama. */
export function idDisarankanDihapus(kelompok: KelompokGanda[]): string[] {
  return kelompok.flatMap((k) => k.anggota.slice(1).map((t) => t.id));
}
