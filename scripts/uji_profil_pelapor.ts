/**
 * Uji pengaman "profil pelapor kosong tidak boleh menimpa yang terisi" (src/lib/profilPelapor.ts dan src/lib/gdriveSync.ts), dengan
 * Google Drive dan Sheets palsu di memori yang menjawab fetch. Jalankan: npx tsx scripts/uji_profil_pelapor.ts
 *
 * Dua arah: TARIK (Drive kosong, perangkat terisi) dan KIRIM (perangkat/artefak kosong, Drive terisi). Perubahan sengaja
 * (profil terisi menggantikan yang lain) tetap berjalan.
 */
import {
  kirimSemuaKeDrive,
  resetStatusTarik,
  simpanLaporanKegiatanKeDrive,
  tarikSemuaDariDrive,
} from "../src/lib/gdriveSync";
import { lindungiProfil, profilKosong } from "../src/lib/profilPelapor";
import { muatProfilPelapor, simpanProfilPelapor } from "../src/lib/storage";
import type { DataHarga } from "../src/lib/aset";
import type { LaporanKegiatanFileContent, ProfilPelapor } from "../src/types";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

/* ---------- localStorage palsu ---------- */
const penyimpanan = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (penyimpanan.has(k) ? penyimpanan.get(k)! : null),
  setItem: (k: string, v: string) => void penyimpanan.set(k, String(v)),
  removeItem: (k: string) => void penyimpanan.delete(k),
  clear: () => penyimpanan.clear(),
};

/* ---------- Google Drive palsu ---------- */
const FOLDER = "application/vnd.google-apps.folder";
interface Berkas {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  isi?: string;
  diubah?: string;
}
const files = new Map<string, Berkas>();
const log: Array<{ metode: string; url: string }> = [];
let urut = 1;
const galatIsiBerkas = new Set<string>();

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
const info = (f: Berkas) => ({ id: f.id, name: f.name, mimeType: f.mimeType, webViewLink: `https://drive.google.com/${f.id}`, ownedByMe: true, modifiedTime: f.diubah });

function tambah(f: Partial<Berkas> & { name: string; mimeType: string }): Berkas {
  const b: Berkas = { id: f.id ?? "id" + urut++, parents: ["root"], ...f };
  files.set(b.id, b);
  return b;
}

function cocokKlausa(f: Berkas, k: string): boolean {
  let m: RegExpExecArray | null;
  if ((m = /^name\s*=\s*'(.*)'$/.exec(k))) return f.name === m[1];
  if ((m = /^name contains '(.*)'$/.exec(k))) return f.name.toLowerCase().includes(m[1].toLowerCase());
  if ((m = /^'(.*)' in parents$/.exec(k))) return f.parents.includes(m[1]);
  if ((m = /^mimeType\s*=\s*'(.*)'$/.exec(k))) return f.mimeType === m[1];
  if (/^trashed\s*=\s*false$/.test(k)) return true;
  throw new Error("Klausa tidak dikenal: " + k);
}

const fetchPalsu = async (input: any, init: any = {}): Promise<Response> => {
  const url = new URL(String(input));
  const metode = String(init.method || "GET").toUpperCase();
  log.push({ metode, url: url.pathname + url.search });
  const p = decodeURIComponent(url.pathname);

  if (url.hostname === "www.googleapis.com") {
    if (p === "/drive/v3/files" && metode === "GET") {
      const klausa = (url.searchParams.get("q") || "").split(/ and /);
      return json({ files: [...files.values()].filter((f) => klausa.every((k) => cocokKlausa(f, k.trim()))).map(info) });
    }
    if (p === "/drive/v3/files" && metode === "POST") {
      const body = JSON.parse(init.body);
      return json(info(tambah({ name: body.name, mimeType: body.mimeType, parents: body.parents || ["root"] })));
    }
    const m = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (m && metode === "GET") {
      const f = files.get(m[1]);
      if (!f) return json({}, 404);
      if (url.searchParams.get("alt") === "media") {
        if (galatIsiBerkas.has(f.id)) return json({ error: { message: "galat sementara" } }, 500);
        return new Response(f.isi ?? "", { status: 200 });
      }
      return json(info(f));
    }
    if (m && metode === "PATCH") {
      const f = files.get(m[1]);
      return f ? json(info(f)) : json({}, 404);
    }
    const u = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (u && metode === "PATCH") {
      const f = files.get(u[1]);
      if (!f) return json({}, 404);
      f.isi = typeof init.body === "string" ? init.body : await (init.body as Blob).text();
      return json(info(f));
    }
    if (p === "/upload/drive/v3/files" && metode === "POST") {
      const form = init.body as FormData;
      const meta = JSON.parse(await (form.get("metadata") as Blob).text());
      const isi = await (form.get("file") as Blob).text();
      return json(info(tambah({ name: meta.name, mimeType: meta.mimeType || "application/octet-stream", parents: meta.parents || ["root"], isi })));
    }
  }
  throw new Error(`Permintaan tidak dikenal: ${metode} ${url.href}`);
};
(globalThis as any).fetch = fetchPalsu;

/* ---------- data uji ---------- */
const TOKEN = "token-uji";
const HARGA = {} as unknown as DataHarga;
const KOSONG: ProfilPelapor = { nama: "", jabatan: "", lembaga: "", proyek: "", penyetuju: "" };
const PROFIL_A: ProfilPelapor = { nama: "Contoh Pelapor", jabatan: "Staf", lembaga: "Lembaga Contoh", proyek: "Proyek Contoh", penyetuju: "Contoh Penyetuju" };
const PROFIL_B: ProfilPelapor = { nama: "Pelapor Lain", jabatan: "Manajer", lembaga: "Lembaga Lain", proyek: "Proyek Lain", penyetuju: "" };
const KEGIATAN = [{ id: "kg1", nama: "Kegiatan Contoh", lokasi: "Lokasi Contoh", tanggalMulai: "2026-10-01", tanggalSelesai: "2026-10-05" }];

const laporan = (profil: ProfilPelapor | undefined, daftar: unknown[] = []): LaporanKegiatanFileContent =>
  ({ versi: 1, terakhirDiubah: "2026-10-27T00:00:00.000Z", ...(profil ? { profilPelapor: profil } : {}), daftarKegiatan: daftar, rincianTransaksi: {} }) as LaporanKegiatanFileContent;

/** Drive baru: folder Keuangan + Aset/Sinkron + (opsional) Laporan Kegiatan.json dengan isi yang ditentukan. */
function isiDrive(isiLaporan: unknown | null) {
  files.clear();
  log.length = 0;
  urut = 1;
  galatIsiBerkas.clear();
  const f = tambah({ id: "F", name: "Keuangan", mimeType: FOLDER });
  tambah({ id: "AS", name: "Aset.json", mimeType: "application/json", parents: [f.id], isi: "[]" });
  tambah({ id: "SN", name: "Sinkron.json", mimeType: "application/json", parents: [f.id], isi: JSON.stringify({ terhapus: [], diubah: {}, terakhirSinkron: "2026-10-01T00:00:00.000Z" }) });
  if (isiLaporan !== null) tambah({ id: "LK", name: "Laporan Kegiatan.json", mimeType: "application/json", parents: [f.id], isi: JSON.stringify(isiLaporan) });
}

const bacaLK = (): LaporanKegiatanFileContent => JSON.parse(files.get("LK")!.isi!);
const tulis = () => log.filter((l) => l.metode !== "GET");
const tulisLK = () => tulis().filter((l) => l.url.includes("/upload/drive/v3/files"));
const mulaiBaru = (profilLokal: ProfilPelapor | null) => {
  penyimpanan.clear();
  resetStatusTarik();
  if (profilLokal) simpanProfilPelapor(profilLokal);
};

async function main() {
  console.log("Fungsi dasar");
  cek("semua isian kosong = kosong", profilKosong(KOSONG));
  cek("hanya spasi = kosong", profilKosong({ nama: "  ", jabatan: "\t", lembaga: "", proyek: " ", penyetuju: "" }));
  cek("tidak ada (undefined/null) = kosong", profilKosong(undefined) && profilKosong(null));
  cek("satu isian terisi = tidak kosong", !profilKosong({ ...KOSONG, penyetuju: "X" }));
  cek("kosong tidak menggantikan yang terisi", lindungiProfil(KOSONG, PROFIL_A) === PROFIL_A);
  cek("undefined tidak menggantikan yang terisi", lindungiProfil(undefined, PROFIL_A) === PROFIL_A);
  cek("terisi menggantikan terisi (perubahan sengaja)", lindungiProfil(PROFIL_B, PROFIL_A) === PROFIL_B);
  cek("terisi menggantikan kosong", lindungiProfil(PROFIL_A, KOSONG) === PROFIL_A);
  cek("kosong dan kosong tetap kosong", profilKosong(lindungiProfil(KOSONG, KOSONG)));
  cek("pengosongan sebagian tetap berjalan", lindungiProfil({ ...PROFIL_A, penyetuju: "" }, PROFIL_A)?.penyetuju === "");

  console.log("TARIK: Drive kosong, perangkat terisi");
  isiDrive(laporan(KOSONG, KEGIATAN));
  mulaiBaru(PROFIL_A);
  const t1 = await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  cek("profil di perangkat tetap terisi", JSON.stringify(muatProfilPelapor()) === JSON.stringify({ ...PROFIL_A, diubah: undefined }), muatProfilPelapor());
  cek("hasil tarik membawa profil yang dipertahankan (dipakai App)", t1.laporanKegiatan?.profilPelapor?.nama === PROFIL_A.nama, t1.laporanKegiatan?.profilPelapor);
  cek("daftar kegiatan dari Drive tetap ditarik", (t1.laporanKegiatan?.daftarKegiatan?.length ?? 0) === 1);
  cek("tarik hanya membaca", tulis().length === 0, tulis());

  console.log("TARIK: Drive tanpa kunci profil sama sekali, perangkat terisi");
  isiDrive({ versi: 1, daftarKegiatan: [] });
  mulaiBaru(PROFIL_A);
  const t2 = await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  cek("profil di perangkat tetap terisi", muatProfilPelapor().nama === PROFIL_A.nama);
  cek("hasil tarik membawa profil perangkat", t2.laporanKegiatan?.profilPelapor?.nama === PROFIL_A.nama);

  console.log("TARIK: Drive terisi, perangkat kosong (pasang ulang)");
  isiDrive(laporan(PROFIL_A));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  cek("perangkat memakai profil dari Drive", muatProfilPelapor().nama === PROFIL_A.nama && muatProfilPelapor().penyetuju === PROFIL_A.penyetuju, muatProfilPelapor());

  console.log("TARIK: Drive terisi berbeda dari perangkat (perilaku lama tetap)");
  isiDrive(laporan(PROFIL_B));
  mulaiBaru(PROFIL_A);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  cek("profil dari Drive menggantikan profil perangkat", muatProfilPelapor().nama === PROFIL_B.nama, muatProfilPelapor());

  console.log("TARIK: dua kosong");
  isiDrive(laporan(KOSONG));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  cek("tetap kosong, tidak galat", profilKosong(muatProfilPelapor()));

  console.log("KIRIM: perangkat kosong, Drive terisi");
  isiDrive(laporan(PROFIL_A));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  log.length = 0;
  await kirimSemuaKeDrive(TOKEN, [], [], undefined, laporan(KOSONG, KEGIATAN));
  cek("profil di Drive tetap terisi", bacaLK().profilPelapor?.nama === PROFIL_A.nama && bacaLK().profilPelapor?.penyetuju === PROFIL_A.penyetuju, bacaLK().profilPelapor);
  cek("bagian lain tetap ditulis (daftar kegiatan baru masuk)", bacaLK().daftarKegiatan.length === 1, bacaLK().daftarKegiatan);

  console.log("KIRIM: perangkat tanpa kunci profil, Drive terisi");
  isiDrive(laporan(PROFIL_A));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  await kirimSemuaKeDrive(TOKEN, [], [], undefined, { versi: 1, terakhirDiubah: "x", daftarKegiatan: KEGIATAN } as unknown as LaporanKegiatanFileContent);
  cek("profil di Drive tetap terisi", bacaLK().profilPelapor?.nama === PROFIL_A.nama, bacaLK().profilPelapor);

  console.log("KIRIM: perangkat terisi menggantikan Drive (perubahan sengaja)");
  isiDrive(laporan(PROFIL_A));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  await kirimSemuaKeDrive(TOKEN, [], [], undefined, laporan(PROFIL_B));
  cek("profil baru dari perangkat masuk ke Drive", bacaLK().profilPelapor?.nama === PROFIL_B.nama, bacaLK().profilPelapor);

  console.log("KIRIM: perangkat mengosongkan sebagian isian (perubahan sengaja)");
  isiDrive(laporan(PROFIL_A));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  await kirimSemuaKeDrive(TOKEN, [], [], undefined, laporan({ ...PROFIL_A, penyetuju: "" }));
  cek("penyetuju dikosongkan, isian lain tetap", bacaLK().profilPelapor?.penyetuju === "" && bacaLK().profilPelapor?.nama === PROFIL_A.nama, bacaLK().profilPelapor);

  console.log("KIRIM: perangkat kosong, Drive tidak punya Laporan Kegiatan.json");
  isiDrive(null);
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  await kirimSemuaKeDrive(TOKEN, [], [], undefined, laporan(KOSONG, KEGIATAN));
  cek("berkas dibuat (tidak ada yang perlu dilindungi)", [...files.values()].filter((f) => f.name === "Laporan Kegiatan.json").length === 1);

  console.log("KIRIM: perangkat kosong, isi Drive tidak bisa diperiksa");
  isiDrive(laporan(PROFIL_A));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  const sebelum = files.get("LK")!.isi;
  galatIsiBerkas.add("LK");
  log.length = 0;
  let galat: unknown = null;
  try {
    await simpanLaporanKegiatanKeDrive(TOKEN, "F", "LK", laporan(KOSONG, KEGIATAN));
  } catch (e) {
    galat = e;
  }
  cek("penulisan dibatalkan dengan pesan yang jelas", galat instanceof Error && /tidak ditulis/i.test(galat.message), String(galat));
  cek("isi Drive tidak berubah dan tidak ada permintaan tulis", files.get("LK")!.isi === sebelum && tulisLK().length === 0, tulisLK());

  console.log("KIRIM: perangkat terisi tidak perlu membaca Drive dulu");
  isiDrive(laporan(KOSONG));
  mulaiBaru(null);
  await tarikSemuaDariDrive(TOKEN, [], [], HARGA);
  galatIsiBerkas.add("LK");
  await simpanLaporanKegiatanKeDrive(TOKEN, "F", "LK", laporan(PROFIL_A));
  cek("ditulis meski isi Drive tidak terbaca (tidak ada yang bisa tertimpa)", bacaLK().profilPelapor?.nama === PROFIL_A.nama);

  console.log(gagal === 0 ? "\nSemua uji lolos" : `\n${gagal} uji GAGAL`);
  process.exit(gagal === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
