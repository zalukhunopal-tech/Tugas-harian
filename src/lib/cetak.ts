/**
 * Cetak dokumen klaim kegiatan dalam tiga mode:
 *   semua      Seluruh dokumen sekaligus. Peramban desktop memakai halaman bernama (CSS `page`): timesheet lanskap, lainnya potret.
 *   timesheet  Hanya timesheet, A4 lanskap.
 *   klaim      Laporan, rekapitulasi klaim, dan lembar tempel bukti, A4 potret.
 *
 * Peramban ponsel (Android) sering mengabaikan halaman bernama dalam satu sesi cetak. Karena itu dua mode terakhir juga
 * menyuntikkan `@page { size: A4 landscape|portrait }` sebelum `window.print()`, dan CSS menyembunyikan bagian dokumen yang
 * bukan milik mode itu (lihat aturan `html[data-mode-cetak]` di style.css).
 */
export type ModeCetak = "semua" | "timesheet" | "klaim";

export const MARGIN_HALAMAN = "10mm 12mm";
const ID_GAYA_HALAMAN = "dsc-gaya-halaman";

/** Aturan `@page` yang disuntikkan untuk sebuah mode; "semua" tidak menyuntikkan apa pun (halaman bernama di CSS). */
export function aturanHalaman(mode: ModeCetak): string | null {
  if (mode === "semua") return null;
  return `@page { size: A4 ${mode === "timesheet" ? "landscape" : "portrait"}; margin: ${MARGIN_HALAMAN}; }`;
}

let pembersih: (() => void) | null = null;

/** Mengembalikan dokumen ke keadaan semula (mode dan gaya halaman sementara dilepas). */
export function bersihkanModeCetak(): void {
  pembersih?.();
  pembersih = null;
}

export function cetakDokumen(mode: ModeCetak): void {
  bersihkanModeCetak();
  const akar = document.documentElement;
  akar.dataset.modeCetak = mode;

  const aturan = aturanHalaman(mode);
  let gaya: HTMLStyleElement | null = null;
  if (aturan) {
    gaya = document.createElement("style");
    gaya.id = ID_GAYA_HALAMAN;
    gaya.textContent = aturan;
    document.head.appendChild(gaya);
  }

  const selesai = () => {
    window.removeEventListener("afterprint", selesai);
    document.removeEventListener("visibilitychange", saatKembali);
    clearTimeout(batas);
    delete akar.dataset.modeCetak;
    gaya?.remove();
    if (pembersih === selesai) pembersih = null;
  };
  // Di Android jendela cetak berada di luar halaman dan window.print() langsung kembali; halaman baru tampak lagi setelah
  // jendela itu ditutup. Gaya sementara harus bertahan selama pratinjau dibuat, jadi dilepas saat itu atau saat afterprint.
  let sempatTersembunyi = false;
  const saatKembali = () => {
    if (document.visibilityState === "hidden") sempatTersembunyi = true;
    else if (sempatTersembunyi) selesai();
  };
  const batas = setTimeout(selesai, 10 * 60 * 1000);
  window.addEventListener("afterprint", selesai);
  document.addEventListener("visibilitychange", saatKembali);
  pembersih = selesai;

  window.print();
}
