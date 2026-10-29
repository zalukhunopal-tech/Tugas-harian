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
 * Profil untuk dokumen kegiatan: isian Profil Pelapor, dengan isian yang masih kosong dilengkapi dari kop file timesheet kegiatan
 * itu (Nama, Proyek, Disetujui Oleh). Profil Pelapor sendiri tidak diubah; ini hanya supaya dokumen tidak bernama kosong.
 */
export function profilUntukDokumen(
  profil: ProfilPelapor,
  kegiatan?: { timesheetKop?: { proyek?: string; nama?: string; penyetuju?: string } }
): ProfilPelapor {
  const kop = kegiatan?.timesheetKop;
  if (!kop) return profil;
  const isi = (nilai: string | undefined, cadangan: string | undefined) => (nilai && nilai.trim() ? nilai : cadangan ?? nilai ?? "");
  return {
    ...profil,
    nama: isi(profil.nama, kop.nama),
    proyek: isi(profil.proyek, kop.proyek),
    penyetuju: isi(profil.penyetuju, kop.penyetuju),
  };
}
