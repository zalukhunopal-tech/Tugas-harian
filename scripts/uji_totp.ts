/**
 * Uji Google Authenticator (src/lib/totp.ts): vektor resmi RFC 4226 dan RFC 6238, jendela waktu, pemakaian ulang kode,
 * pembatasan percobaan, dan siklus aktifkan-nonaktifkan. Jalankan: npx tsx scripts/uji_totp.ts
 */
import {
  aktifkanTotp,
  base32Decode,
  base32Encode,
  buatRahasiaTotp,
  buatUriOtpauth,
  formatRahasia,
  hotp,
  kodeTotp,
  lamaKunciMs,
  muatTotp,
  nonaktifkanTotp,
  perluKodeTotp,
  periksaDanCatatTotp,
  periksaKodeTotp,
  sisaDetikKunci,
  ubahIntervalTotp,
} from "../src/lib/totp";

let gagal = 0;
function cek(nama: string, kondisi: boolean, rincian?: unknown) {
  if (kondisi) console.log(`  ok   ${nama}`);
  else {
    gagal++;
    console.log(`  GAGAL ${nama}`, rincian !== undefined ? JSON.stringify(rincian) : "");
  }
}

const penyimpanan = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (penyimpanan.has(k) ? penyimpanan.get(k)! : null),
  setItem: (k: string, v: string) => void penyimpanan.set(k, String(v)),
  removeItem: (k: string) => void penyimpanan.delete(k),
  clear: () => penyimpanan.clear(),
};

const KUNCI_RFC = new TextEncoder().encode("12345678901234567890");
const RAHASIA_RFC = base32Encode(KUNCI_RFC);

async function main() {
  console.log("base32");
  cek("kunci uji RFC -> GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", RAHASIA_RFC === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", RAHASIA_RFC);
  cek("dibaca balik, toleran spasi, huruf kecil, dan '='", new TextDecoder().decode(base32Decode("gezd gnbv-gy3t qojq GEZDGNBVGY3TQOJQ=")) === "12345678901234567890");
  let menolak = false;
  try {
    base32Decode("ABC1");
  } catch {
    menolak = true;
  }
  cek("karakter di luar abjad ditolak", menolak);
  const r = buatRahasiaTotp();
  cek("rahasia baru: 32 huruf base32, 20 byte, berbeda tiap kali", /^[A-Z2-7]{32}$/.test(r) && base32Decode(r).length === 20 && r !== buatRahasiaTotp(), r);
  cek("format kelompok 4 huruf", formatRahasia("ABCDEFGHIJKLMNOP") === "ABCD EFGH IJKL MNOP");

  console.log("HOTP (RFC 4226, Lampiran D)");
  const harapanHotp = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  const hasilHotp = await Promise.all(harapanHotp.map((_, i) => hotp(KUNCI_RFC, i)));
  cek("10 nilai pertama cocok", JSON.stringify(hasilHotp) === JSON.stringify(harapanHotp), hasilHotp);

  console.log("TOTP (RFC 6238, SHA-1, 8 digit)");
  const vektor: Array<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  for (const [detik, harapan] of vektor) {
    cek(`t=${detik} -> ${harapan}`, (await kodeTotp(RAHASIA_RFC, detik * 1000, 8)) === harapan);
  }
  cek("6 digit = 6 angka terakhir (t=59 -> 287082)", (await kodeTotp(RAHASIA_RFC, 59_000)) === "287082");

  console.log("Pemeriksaan kode");
  const T = 1_800_000_000_000;
  const kode = await kodeTotp(RAHASIA_RFC, T);
  const sebelum = await kodeTotp(RAHASIA_RFC, T - 30_000);
  const duaSebelum = await kodeTotp(RAHASIA_RFC, T - 60_000);
  const sesudah = await kodeTotp(RAHASIA_RFC, T + 30_000);
  cek("kode sekarang diterima", (await periksaKodeTotp(RAHASIA_RFC, kode, T)).cocok);
  cek("kode 30 detik lalu dan 30 detik lagi diterima (selisih jam ponsel)", (await periksaKodeTotp(RAHASIA_RFC, sebelum, T)).cocok && (await periksaKodeTotp(RAHASIA_RFC, sesudah, T)).cocok);
  cek("kode 60 detik lalu ditolak", !(await periksaKodeTotp(RAHASIA_RFC, duaSebelum, T)).cocok);
  cek("spasi di tengah kode ditoleransi", (await periksaKodeTotp(RAHASIA_RFC, `${kode.slice(0, 3)} ${kode.slice(3)}`, T)).cocok);
  cek("bukan 6 angka ditolak", !(await periksaKodeTotp(RAHASIA_RFC, "12345", T)).cocok && !(await periksaKodeTotp(RAHASIA_RFC, "abcdef", T)).cocok && !(await periksaKodeTotp(RAHASIA_RFC, "", T)).cocok);
  const pertama = await periksaKodeTotp(RAHASIA_RFC, kode, T);
  cek("kode yang sama tidak bisa dipakai dua kali", pertama.cocok && !(await periksaKodeTotp(RAHASIA_RFC, kode, T, pertama.langkah)).cocok);
  cek("kode lama (sebelum yang terakhir dipakai) juga ditolak", !(await periksaKodeTotp(RAHASIA_RFC, sebelum, T, pertama.langkah)).cocok);

  console.log("URI otpauth");
  const uri = buatUriOtpauth({ email: "nama+uji@example.org", rahasia: RAHASIA_RFC });
  const u = new URL(uri);
  cek("skema, jenis, dan label penerbit:akun", u.protocol === "otpauth:" && u.host === "totp" && decodeURIComponent(u.pathname) === "/Catatan Keuangan:nama+uji@example.org", uri);
  cek("parameter rahasia, penerbit, SHA1, 6 digit, 30 detik", u.searchParams.get("secret") === RAHASIA_RFC && u.searchParams.get("issuer") === "Catatan Keuangan" && u.searchParams.get("algorithm") === "SHA1" && u.searchParams.get("digits") === "6" && u.searchParams.get("period") === "30");

  console.log("Pembatasan percobaan");
  cek("5 salah pertama tanpa jeda", [1, 2, 3, 4].every((n) => lamaKunciMs(n) === 0));
  cek("jeda 30 dtk, 60 dtk, 120 dtk … maksimal 15 menit", lamaKunciMs(5) === 30_000 && lamaKunciMs(6) === 60_000 && lamaKunciMs(7) === 120_000 && lamaKunciMs(30) === 15 * 60_000);

  console.log("Siklus aktifkan - buka kunci - nonaktifkan");
  penyimpanan.clear();
  const rahasia = buatRahasiaTotp();
  const t0 = 1_800_000_000_000;
  cek("kode salah tidak mengaktifkan", !(await aktifkanTotp(rahasia, "nama@example.org", "000000", "8jam", t0)) && muatTotp() === null);
  const kodeAktif = await kodeTotp(rahasia, t0);
  cek("kode benar mengaktifkan dan menyimpan akun email", (await aktifkanTotp(rahasia, "Nama@Example.org", kodeAktif, "8jam", t0)) && muatTotp()?.email === "Nama@Example.org");
  cek("segera sesudah aktif tidak diminta lagi (percaya 8 jam)", !perluKodeTotp(muatTotp(), t0 + 60_000));
  cek("sesudah 8 jam diminta lagi", perluKodeTotp(muatTotp(), t0 + 8 * 3600_000 + 1));

  // Tiga langkah berikutnya memakai kode dari waktu berbeda.
  let t = t0 + 9 * 3600_000;
  const salah = await periksaDanCatatTotp("111111", t);
  cek("kode salah: ditolak dengan pesan, belum ada jeda", !salah.cocok && salah.terkunciDetik === 0 && muatTotp()!.percobaanGagal === 1, salah);
  for (let i = 0; i < 3; i++) await periksaDanCatatTotp("222222", t);
  const kelima = await periksaDanCatatTotp("333333", t);
  cek("salah kelima: dikunci 30 detik", !kelima.cocok && kelima.terkunciDetik === 30 && sisaDetikKunci(muatTotp(), t) === 30, kelima);
  const benarTapiTerkunci = await periksaDanCatatTotp(await kodeTotp(rahasia, t), t + 5_000);
  cek("selama dikunci kode benar pun ditolak", !benarTapiTerkunci.cocok && benarTapiTerkunci.terkunciDetik > 0, benarTapiTerkunci);
  t += 31_000;
  const kodeBenar = await kodeTotp(rahasia, t);
  const lolos = await periksaDanCatatTotp(kodeBenar, t);
  cek("sesudah jeda kode benar diterima, hitungan gagal di-nol-kan", lolos.cocok && muatTotp()!.percobaanGagal === 0);
  cek("kode yang sama tidak dapat dipakai lagi", !(await periksaDanCatatTotp(kodeBenar, t + 1000)).cocok);
  cek("lolos -> percaya 8 jam lagi", !perluKodeTotp(muatTotp(), t + 3600_000));
  ubahIntervalTotp("selalu");
  cek("interval 'selalu': diminta pada pembukaan berikutnya", perluKodeTotp(muatTotp(), Date.now() + 1000));

  console.log("Nonaktifkan butuh kode sah");
  const tn = t + 120_000;
  const tolak = await nonaktifkanTotp("000000", tn);
  cek("kode salah: tetap aktif", !tolak.berhasil && muatTotp() !== null, tolak);
  const ok = await nonaktifkanTotp(await kodeTotp(rahasia, tn), tn);
  cek("kode benar: dinonaktifkan dan rahasia dihapus dari penyimpanan", ok.berhasil && muatTotp() === null && !penyimpanan.has("keuangan-totp"));

  console.log("Data rusak");
  penyimpanan.set("keuangan-totp", "{bukan json");
  cek("JSON rusak -> dianggap tidak aktif", muatTotp() === null);
  penyimpanan.set("keuangan-totp", JSON.stringify({ rahasia: "pendek" }));
  cek("rahasia tak sah -> dianggap tidak aktif", muatTotp() === null);

  if (gagal) {
    console.log(`\n${gagal} uji gagal`);
    process.exit(1);
  }
  console.log("\nSemua uji lolos");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
