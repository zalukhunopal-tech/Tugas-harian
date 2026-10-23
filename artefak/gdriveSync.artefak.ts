/**
 * Pembungkus `src/lib/gdriveSync.ts` khusus build artefak: semua ekspor asli diteruskan, hanya operasi tulis
 * yang diserialkan lewat antrean (lihat antrean.ts). Impor memakai akhiran `.ts` supaya tidak ikut dialihkan
 * oleh alias di vite.config.ts (yang hanya cocok untuk impor tanpa akhiran).
 */
export * from "../src/lib/gdriveSync.ts";
import * as asli from "../src/lib/gdriveSync.ts";
import { buatAntrean } from "./antrean";

const { berurutan, berurutanGabung } = buatAntrean();

export const kirimSemuaKeDrive = berurutanGabung(asli.kirimSemuaKeDrive);
export const tarikSemuaDariDrive = berurutan(asli.tarikSemuaDariDrive);
export const simpanAsetKeDrive = berurutan(asli.simpanAsetKeDrive);
export const dapatkanFolderBuktiTarget = berurutan(asli.dapatkanFolderBuktiTarget);
