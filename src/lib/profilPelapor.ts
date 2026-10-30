import type { ProfilPelapor } from "../types";

const BIDANG: Array<keyof ProfilPelapor> = ["nama", "jabatan", "lembaga", "proyek", "penyetuju"];

/** Tidak satu pun isian Profil Pelapor yang terisi (spasi saja dianggap kosong). Profil yang tidak ada juga kosong. */
export function profilKosong(profil?: Partial<ProfilPelapor> | null): boolean {
  if (!profil) return true;
  return BIDANG.every((bidang) => !String(profil[bidang] ?? "").trim());
}

/**
 * Memilih profil bila dua sumber bertemu (mis. berkas di Drive dan perangkat ini). Profil yang sama sekali kosong tidak pernah
 * menggantikan profil yang sudah terisi: perangkat atau artefak yang baru dibuka (penyimpanan lokal kosong) bisa saja mengirim
 * profil kosong, dan Drive yang kosong bisa saja ditarik ke perangkat yang profilnya terisi. Selain itu `kandidat` dipakai apa
 * adanya, jadi perubahan sengaja (mengisi, mengubah, atau mengosongkan sebagian isian) tetap berjalan.
 */
export function lindungiProfil(
  kandidat: ProfilPelapor | null | undefined,
  pegangan: ProfilPelapor | null | undefined
): ProfilPelapor | undefined {
  if (profilKosong(kandidat) && !profilKosong(pegangan)) return pegangan as ProfilPelapor;
  return kandidat ?? undefined;
}

/**
 * Profil untuk dokumen kegiatan:
 * Urutan sumber nama pelapor dan penyetuju:
 *   1. Isian formulir kegiatan (kegiatan.penandatangan?.dilaporkanOleh / disetujuiOleh)
 *   2. Profil Pelapor (profil.nama / penyetuju)
 *   3. Kosong ("")
 * timesheetKop dari Drive TIDAK lagi dipakai diam-diam untuk nama penandatangan (hanya proyek yang dapat dilengkapi dari kop).
 */
export function profilUntukDokumen(
  profil: ProfilPelapor,
  kegiatan?: {
    penandatangan?: { dilaporkanOleh?: string; disetujuiOleh?: string };
    timesheetKop?: { proyek?: string; nama?: string; penyetuju?: string };
  }
): ProfilPelapor {
  const p = kegiatan?.penandatangan;
  const nama = p?.dilaporkanOleh !== undefined ? p.dilaporkanOleh : (profil.nama || "");
  const penyetuju = p?.disetujuiOleh !== undefined ? p.disetujuiOleh : (profil.penyetuju || "");
  const proyek = profil.proyek && profil.proyek.trim() ? profil.proyek : (kegiatan?.timesheetKop?.proyek ?? "");
  return {
    ...profil,
    nama,
    penyetuju,
    proyek,
  };
}
