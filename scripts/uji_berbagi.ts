/**
 * Uji logika berbagi keluarga/komunitas (src/lib/berbagi.ts). Jalankan: npx tsx scripts/uji_berbagi.ts
 */
import {
  AWALAN_KODE,
  adalahEmail,
  akunPemilikDariIzin,
  BerkasKeuangan,
  berkasTautanPublik,
  bacaKodeAnggota,
  buatKodeAnggota,
  danaDariNamaFile,
  kelompokkanDibagikan,
  rencanaBerbagi,
  ringkasAnggota,
} from "../src/lib/berbagi";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

console.log("Kode QR anggota");
const kode = buatKodeAnggota({ nama: "Siti Aminah Zalukhu", email: "Siti.Aminah@Gmail.com" });
cek("diawali penanda aplikasi dan berukuran kecil", kode.startsWith(AWALAN_KODE) && kode.length < 120, kode.length);
cek("dibaca balik, email dijadikan huruf kecil", JSON.stringify(bacaKodeAnggota(kode)) === JSON.stringify({ nama: "Siti Aminah Zalukhu", email: "siti.aminah@gmail.com" }));
cek("nama berhuruf non-ASCII utuh", bacaKodeAnggota(buatKodeAnggota({ nama: "Nöl Ünal ’Ba", email: "a@b.co" }))?.nama === "Nöl Ünal ’Ba");
cek("spasi dan teks di sekitarnya tidak mengganggu", bacaKodeAnggota(`  salin ini: ${kode}  \n`)?.email === "siti.aminah@gmail.com");
cek("nama kosong -> bagian depan email", bacaKodeAnggota(buatKodeAnggota({ nama: "  ", email: "budi@x.id" }))?.nama === "budi");
cek("bukan kode aplikasi -> null", bacaKodeAnggota("https://contoh.com") === null && bacaKodeAnggota("") === null);
cek("kode rusak -> null", bacaKodeAnggota(AWALAN_KODE + "@@@") === null && bacaKodeAnggota(AWALAN_KODE + "eyJ4IjoxfQ") === null);
cek("email tak sah -> null", bacaKodeAnggota(AWALAN_KODE + "eyJlIjoidGFrLXNhaCJ9") === null);

console.log("Dana dari nama file");
cek("pribadi dan kegiatan per tahun", danaDariNamaFile("Keuangan Pribadi 2026") === "pribadi" && danaDariNamaFile("Keuangan Kegiatan 2025") === "kegiatan");
cek("timesheet dan file lain bukan bagian berbagi", danaDariNamaFile("FORM LAPORAN TIMESHEET KEGIATAN BATCH 4 (SEPTEMBER - OKTOBER 2026)") === null && danaDariNamaFile("Aset.json") === null);

const izinPemilik = { type: "user", role: "owner", emailAddress: "saya@gmail.com" };
const b = (id: string, nama: string, dana: "pribadi" | "kegiatan", izin: BerkasKeuangan["izin"] = []): BerkasKeuangan => ({
  id,
  nama,
  dana,
  izin: [izinPemilik, ...izin],
});
const adik = (role = "reader", id = "p-adik") => ({ type: "user", role, emailAddress: "adik@gmail.com", displayName: "Adik", id });

console.log("Ringkasan siapa melihat apa");
const berkas = [
  b("p26", "Keuangan Pribadi 2026", "pribadi"),
  b("p25", "Keuangan Pribadi 2025", "pribadi"),
  b("k26", "Keuangan Kegiatan 2026", "kegiatan", [adik()]),
  b("k25", "Keuangan Kegiatan 2025", "kegiatan", [adik()]),
];
const r1 = ringkasAnggota(berkas, "saya@gmail.com");
cek("satu orang: kegiatan ya, pribadi tidak", r1.length === 1 && r1[0].email === "adik@gmail.com" && r1[0].dana.kegiatan === "ya" && r1[0].dana.pribadi === "tidak", r1);
cek("pemilik sendiri tidak dihitung sebagai anggota", !r1.some((a) => a.email === "saya@gmail.com"));
const r2 = ringkasAnggota([...berkas.slice(0, 2), b("k26", "Keuangan Kegiatan 2026", "kegiatan", [adik()]), b("k25", "Keuangan Kegiatan 2025", "kegiatan")], "saya@gmail.com");
cek("hanya sebagian tahun -> sebagian", r2[0].dana.kegiatan === "sebagian", r2[0].dana);
cek("peran penulis ditandai", ringkasAnggota([b("k26", "Keuangan Kegiatan 2026", "kegiatan", [adik("writer")])], "saya@gmail.com")[0].bisaMengubah === true && r1[0].bisaMengubah === false);
cek("tautan publik dan grup tidak dianggap anggota", ringkasAnggota([b("p26", "Keuangan Pribadi 2026", "pribadi", [{ type: "anyone", role: "reader" }, { type: "group", role: "reader", emailAddress: "grup@x.id" }])], "saya@gmail.com").length === 0);

console.log("Tautan publik");
const publik = [b("p26", "Keuangan Pribadi 2026", "pribadi", [{ type: "anyone", role: "reader" }]), b("k26", "Keuangan Kegiatan 2026", "kegiatan")];
cek("berkas dengan tautan publik ditandai", berkasTautanPublik(publik).map((x) => x.id).join() === "p26");
cek("tanpa tautan publik -> kosong", berkasTautanPublik(berkas).length === 0);

console.log("Akun saya dari izin");
cek("email pemilik diambil dari izin owner, huruf kecil", akunPemilikDariIzin(berkas)?.email === "saya@gmail.com", akunPemilikDariIzin(berkas));
cek("tanpa izin owner -> null", akunPemilikDariIzin([{ id: "p26", nama: "Keuangan Pribadi 2026", dana: "pribadi", izin: [{ type: "user", role: "reader", emailAddress: "adik@gmail.com" }] }]) === null && akunPemilikDariIzin([]) === null);
cek("adalahEmail menolak teks biasa", adalahEmail("a@b.id") && !adalahEmail("lewat akun Claude Anda") && !adalahEmail(""));

console.log("Rencana izin");
const r = rencanaBerbagi(berkas, "adik@gmail.com", { pribadi: false, kegiatan: true });
cek("sudah sesuai pilihan -> tidak ada tindakan", r.bagikan.length === 0 && r.cabut.length === 0, r);
const buka = rencanaBerbagi(berkas, "Adik@Gmail.com", { pribadi: true, kegiatan: true });
cek("tambah Dana Pribadi: kedua file pribadi dibagikan", buka.bagikan.map((x) => x.id).sort().join() === "p25,p26" && buka.cabut.length === 0, buka);
const tutup = rencanaBerbagi(berkas, "adik@gmail.com", { pribadi: false, kegiatan: false });
cek("cabut Dana Kegiatan: kedua file kegiatan dicabut dengan ID izin", tutup.cabut.length === 2 && tutup.cabut.every((c) => c.idIzin === "p-adik") && tutup.bagikan.length === 0, tutup);
const baru = rencanaBerbagi(berkas, "tamu@gmail.com", { pribadi: false, kegiatan: true });
cek("orang baru: hanya file dana terpilih", baru.bagikan.map((x) => x.id).sort().join() === "k25,k26" && baru.cabut.length === 0, baru);
cek("pemilik tidak pernah dicabut", rencanaBerbagi(berkas, "saya@gmail.com", { pribadi: false, kegiatan: false }).cabut.length === 0);

console.log("Dibagikan kepada saya");
const dibagikan = kelompokkanDibagikan([
  { id: "1", nama: "Keuangan Pribadi 2026", mimeType: "application/vnd.google-apps.spreadsheet", pemilikEmail: "Ibu@gmail.com", pemilikNama: "Ibu" },
  { id: "2", nama: "Keuangan Pribadi 2025", mimeType: "application/vnd.google-apps.spreadsheet", pemilikEmail: "ibu@gmail.com" },
  { id: "3", nama: "Keuangan Kegiatan 2026", mimeType: "application/vnd.google-apps.spreadsheet", pemilikEmail: "kak@gmail.com" },
  { id: "4", nama: "Resep Kue", mimeType: "application/vnd.google-apps.document", pemilikEmail: "ibu@gmail.com" },
  { id: "5", nama: "TIMESHEET KEGIATAN 2026", mimeType: "application/vnd.google-apps.spreadsheet", pemilikEmail: "kak@gmail.com" },
]);
cek("dikelompokkan per pemilik, dokumen lain dan timesheet diabaikan", dibagikan.length === 2 && dibagikan[0].email === "ibu@gmail.com" && dibagikan[1].email === "kak@gmail.com", dibagikan.map((d) => d.email));
cek("file per dana, tahun terbaru dulu", dibagikan[0].berkas.pribadi.map((x) => x.id).join() === "1,2" && dibagikan[0].berkas.kegiatan.length === 0 && dibagikan[1].berkas.kegiatan.length === 1);

if (gagal) {
  console.log(`\n${gagal} uji gagal`);
  process.exit(1);
}
console.log("\nSemua uji lolos");
