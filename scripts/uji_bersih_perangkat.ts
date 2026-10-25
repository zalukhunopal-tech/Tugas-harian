/**
 * Uji pembersihan data keuangan dari perangkat (src/lib/bersihkanPerangkat.ts). Jalankan: npx tsx scripts/uji_bersih_perangkat.ts
 */
import { KUNCI_DIPERTAHANKAN, bersihkanDataPerangkat, daftarKunciData, hapusKunciData } from "../src/lib/bersihkanPerangkat";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

/** localStorage palsu dengan urutan kunci seperti browser. */
function buatPenyimpanan(awal: Record<string, string>) {
  const peta = new Map(Object.entries(awal));
  return {
    peta,
    get length() {
      return peta.size;
    },
    key: (i: number) => [...peta.keys()][i] ?? null,
    removeItem: (k: string) => void peta.delete(k),
    getItem: (k: string) => (peta.has(k) ? peta.get(k)! : null),
    setItem: (k: string, v: string) => void peta.set(k, v),
    clear: () => peta.clear(),
  };
}

// Semua kunci yang dipakai aplikasi (lihat src/lib/constants.ts, storage.ts, dan komponen) ditambah kunci asing.
const DATA = [
  "pengeluaran-harian",
  "pengeluaran-harian-anggaran",
  "keuangan-aset",
  "keuangan-harga",
  "keuangan-transaksi-berulang",
  "keuangan-laporan-agenda",
  "keuangan-laporan-kegiatan",
  "keuangan-profil-pelapor",
  "keuangan-daftar-kegiatan",
  "keuangan-pengaturan",
  "keuangan-utang-piutang",
  "keuangan-target-tabungan",
  "keuangan-app-lock",
  "keuangan-totp",
  "keuangan-jejak-timesheet",
  "keuangan-timesheet-indeks",
  "keuangan-mencurigakan-diabaikan",
  "keuangan-tarif-perdiem",
  "keuangan-sync-url",
  "keuangan-sync-kunci",
  "keuangan-sync-antrean",
  "keuangan-sync-terakhir",
  "keuangan_terhapus_ids",
  "keuangan_gdrive_token",
  "keuangan_gdrive_token_time",
  "keuangan_gdrive_user_profile",
  "keuangan_konektor_aktif",
  "keuangan_email_saya",
  "keuangan_nama_tampil",
  "keuangan_nama_anggota",
];
const SELERA = ["keuangan-tema", "keuangan-karakter", "keuangan-isi-bertahap", "app-layout"];
const ASING = ["situs-lain", "theme"];

console.log("Daftar kunci");
const p = buatPenyimpanan(Object.fromEntries([...DATA, ...SELERA, ...ASING].map((k) => [k, "x"])));
const daftar = daftarKunciData(p);
cek("semua kunci data terdaftar", DATA.every((k) => daftar.includes(k)), DATA.filter((k) => !daftar.includes(k)));
cek("selera tampilan tidak ikut", SELERA.every((k) => !daftar.includes(k)) && JSON.stringify([...KUNCI_DIPERTAHANKAN].sort()) === JSON.stringify([...SELERA].sort()));
cek("kunci milik situs lain tidak ikut", ASING.every((k) => !daftar.includes(k)));
cek("mendaftar tidak menghapus", p.length === DATA.length + SELERA.length + ASING.length);

console.log("Menghapus");
const dihapus = hapusKunciData(p);
cek("jumlah dihapus sama dengan daftar", dihapus.length === DATA.length);
cek("yang tersisa hanya selera tampilan dan kunci asing", [...p.peta.keys()].sort().join() === [...SELERA, ...ASING].sort().join(), [...p.peta.keys()]);
cek("menghapus ulang aman", hapusKunciData(p).length === 0);

console.log("Lewat bersihkanDataPerangkat (localStorage global, tanpa IndexedDB)");
const g = buatPenyimpanan({ "keuangan_gdrive_token": "t", "pengeluaran-harian": "[]", "keuangan-tema": "jujutsu" });
(globalThis as any).localStorage = g;
(globalThis as any).sessionStorage = buatPenyimpanan({ sementara: "1" });
bersihkanDataPerangkat().then((h) => {
  cek("hasil melaporkan dua kunci dihapus", h.kunciDihapus === 2 && h.penyimpananTersedia, h);
  cek("tema tetap", g.getItem("keuangan-tema") === "jujutsu" && g.getItem("pengeluaran-harian") === null);
  cek("sessionStorage dikosongkan", (globalThis as any).sessionStorage.length === 0);

  (globalThis as any).localStorage = {
    get length(): number {
      throw new Error("diblokir");
    },
  };
  return bersihkanDataPerangkat();
}).then((h) => {
  cek("penyimpanan diblokir: tidak melempar, dilaporkan tidak tersedia", !h.penyimpananTersedia && h.kunciDihapus === 0, h);
  if (gagal) {
    console.log(`\n${gagal} uji gagal`);
    process.exit(1);
  }
  console.log("\nSemua uji lolos");
});
