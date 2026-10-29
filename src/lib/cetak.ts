/**
 * Cetak dokumen laporan kegiatan dalam satu langkah. Orientasi diatur oleh CSS halaman bernama (lihat style.css): lembar
 * timesheet memakai `@page timesheet-page` (A4 lanskap), semua halaman lain A4 potret. Peramban yang mendukung properti `page`
 * (Chrome, Edge, Firefox, Safari modern) mengganti orientasi otomatis di tengah satu dokumen. Peramban yang mengabaikannya
 * mencetak semua halaman dengan orientasi bawaan; dokumen Word memiliki orientasi per bagian yang selalu benar.
 */
export const MARGIN_HALAMAN = "10mm 12mm";

export function cetakDokumen(): void {
  window.print();
}
