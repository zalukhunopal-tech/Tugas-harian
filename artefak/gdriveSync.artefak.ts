/**
 * Pembungkus `src/lib/gdriveSync.ts` khusus build artefak: semua ekspor asli diteruskan; operasi tulis
 * diserialkan lewat antrean (antrean.ts) dan dijaga agar tidak menimpa Drive dengan data lokal yang belum
 * lengkap. Impor memakai akhiran `.ts` supaya tidak ikut dialihkan oleh alias di vite.config.ts (yang hanya
 * cocok untuk impor tanpa akhiran).
 *
 * Penjaga "tarik dulu": artefak dibuka dengan data lokal kosong (localStorage miliknya sendiri), sedangkan
 * `kirimSemuaKeDrive` menulis ulang sheet dari data lokal dan mengosongkan sheet tahun yang tidak ada di data
 * lokal. Mengirim sebelum menarik berarti menghapus isi sheet. Karena itu pengiriman ditolak sampai satu
 * "tarik data" selesai tanpa galat baca di sesi ini. Galat baca per spreadsheet ditelan oleh aplikasi, jadi
 * kelengkapan tarik dinilai dari hitungan galat di konektor.ts, bukan dari hasil kembaliannya.
 */
export * from "../src/lib/gdriveSync.ts";
import * as asli from "../src/lib/gdriveSync.ts";
import { buatAntrean } from "./antrean";
import { hitungGalatBaca } from "./konektor";

const { berurutan, berurutanGabung } = buatAntrean();

let sudahTarik = false;

const PESAN_TARIK_DULU =
  "Tarik data dari folder Keuangan dulu (tombol \"Tarik Data dari Folder Keuangan\") sampai berhasil tanpa galat, " +
  "supaya isi sheet Anda tidak tertimpa data lokal yang belum lengkap.";

function tolakBilaBelumTarik(): Promise<never> | null {
  return sudahTarik ? null : Promise.reject(new Error(PESAN_TARIK_DULU));
}

export const tarikSemuaDariDrive = berurutan(async (...args: Parameters<typeof asli.tarikSemuaDariDrive>) => {
  const galatAwal = hitungGalatBaca();
  try {
    const hasil = await asli.tarikSemuaDariDrive(...args);
    if (hitungGalatBaca() === galatAwal) sudahTarik = true;
    return hasil;
  } catch (err) {
    // Folder Keuangan memang belum ada: tidak ada isi yang bisa tertimpa.
    if (err instanceof Error && /tidak ditemukan/i.test(err.message) && hitungGalatBaca() === galatAwal) sudahTarik = true;
    throw err;
  }
});

// Penjaga dicek saat dipanggil (bukan saat giliran jalan): argumen yang dibawa panggilan itu dibaca sebelum
// tarik selesai, jadi sudah basi begitu data hasil tarik masuk.
const kirimBerurutan = berurutanGabung(asli.kirimSemuaKeDrive);
export const kirimSemuaKeDrive: typeof asli.kirimSemuaKeDrive = (...args) => tolakBilaBelumTarik() ?? kirimBerurutan(...args);

const simpanAsetBerurutan = berurutan(asli.simpanAsetKeDrive);
export const simpanAsetKeDrive: typeof asli.simpanAsetKeDrive = (...args) => tolakBilaBelumTarik() ?? simpanAsetBerurutan(...args);

export const dapatkanFolderBuktiTarget = berurutan(asli.dapatkanFolderBuktiTarget);
