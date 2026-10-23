/**
 * Uji antrean tulis (antrean.ts) tanpa browser:  npx tsx artefak/uji/uji_antrean.ts
 */
import assert from "node:assert/strict";
import { buatAntrean } from "../antrean";

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // berurutan: tidak pernah tumpang tindih, urutan datang dipertahankan
  {
    const { berurutan } = buatAntrean();
    const log: string[] = [];
    let aktif = 0;
    let puncak = 0;
    const kerja = berurutan(async (nama: string, ms: number) => {
      aktif++;
      puncak = Math.max(puncak, aktif);
      log.push(`mulai ${nama}`);
      await tidur(ms);
      log.push(`selesai ${nama}`);
      aktif--;
      return nama;
    });
    const hasil = await Promise.all([kerja("a", 30), kerja("b", 5), kerja("c", 1)]);
    assert.deepEqual(hasil, ["a", "b", "c"]);
    assert.equal(puncak, 1, "tidak boleh ada dua pekerjaan berjalan bersamaan");
    assert.deepEqual(log, ["mulai a", "selesai a", "mulai b", "selesai b", "mulai c", "selesai c"]);
  }

  // berurutanGabung: paling banyak satu yang menunggu, argumen terbaru menang, hasil dibagi
  {
    const { berurutanGabung } = buatAntrean();
    const dipanggil: number[][] = [];
    const kirim = berurutanGabung(async (...nilai: number[]) => {
      dipanggil.push(nilai);
      await tidur(20);
      return nilai.reduce((a, b) => a + b, 0);
    });
    const p1 = kirim(1);
    await tidur(1); // p1 sudah berjalan
    const p2 = kirim(2);
    const p3 = kirim(3);
    const p4 = kirim(4, 4);
    assert.equal(p3, p2, "panggilan yang menunggu berbagi satu janji");
    assert.equal(p4, p2);
    assert.deepEqual(await Promise.all([p1, p2, p3, p4]), [1, 8, 8, 8]);
    assert.deepEqual(dipanggil, [[1], [4, 4]], "hanya pekerjaan pertama dan argumen terbaru yang dijalankan");
    // setelah selesai, panggilan baru berjalan lagi
    assert.equal(await kirim(5), 5);
  }

  // galat tidak menahan antrean, dan galat dikembalikan ke semua yang berbagi janji
  {
    const { berurutanGabung, berurutan } = buatAntrean();
    let n = 0;
    const gagalDulu = berurutanGabung(async () => {
      n++;
      await tidur(5);
      if (n === 1) throw new Error("gagal pertama");
      return "ok";
    });
    const lain = berurutan(async () => "lain");
    const a = gagalDulu();
    await tidur(1); // a sudah berjalan; panggilan berikutnya menunggu giliran sendiri
    const b = gagalDulu();
    const c = lain();
    assert.notEqual(a, b);
    await assert.rejects(a, /gagal pertama/);
    assert.equal(await b, "ok", "panggilan yang menunggu tetap jalan setelah yang pertama gagal");
    assert.equal(await c, "lain");
    // dua panggilan dalam satu tarikan napas (belum ada yang mulai) digabung menjadi satu
    const d1 = gagalDulu();
    const d2 = gagalDulu();
    assert.equal(d1, d2);
    assert.equal(await d1, "ok");
  }

  // dua jenis di satu antrean saling menunggu
  {
    const { berurutan, berurutanGabung } = buatAntrean();
    const log: string[] = [];
    const tarik = berurutan(async () => {
      log.push("tarik mulai");
      await tidur(15);
      log.push("tarik selesai");
    });
    const kirim = berurutanGabung(async () => {
      log.push("kirim mulai");
      await tidur(5);
      log.push("kirim selesai");
    });
    await Promise.all([tarik(), kirim()]);
    assert.deepEqual(log, ["tarik mulai", "tarik selesai", "kirim mulai", "kirim selesai"]);
  }

  console.log("Semua pemeriksaan antrean lolos.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
