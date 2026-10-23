/**
 * Uji pengubah confirm -> await (ubah-konfirmasi.ts) tanpa browser:
 *   npx tsx artefak/uji/uji_ubah_konfirmasi.ts
 * Hasil transformasi juga harus berupa TSX yang sah (diperiksa dengan transpileModule) dan, untuk kasus
 * yang bisa dijalankan, berperilaku benar.
 */
import assert from "node:assert/strict";
import ts from "typescript";
import { ubahKonfirmasi } from "../ubah-konfirmasi";

function sah(kode: string, nama: string): void {
  const r = ts.transpileModule(kode, {
    fileName: nama,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const galat = (r.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(galat.length, 0, `hasil tidak sah: ${galat.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("; ")}\n${kode}`);
}

function ubah(kode: string, nama = "x.tsx") {
  const h = ubahKonfirmasi(kode, nama);
  sah(h.kode, nama);
  return h;
}

// 1. arrow di atribut JSX, window.confirm di dalam if
{
  const h = ubah(`const A = () => <button onClick={() => { if (window.confirm("Hapus?")) hapus(); }}>x</button>;`);
  assert.equal(h.jumlah, 1);
  assert.match(h.kode, /onClick=\{async \(\) => \{ if \(\(await __konfirmasi\("Hapus\?"\)\)\) hapus\(\); \}\}/);
}

// 2. confirm tanpa window, template literal dengan ekspresi, dua kali dalam satu fungsi (async cukup sekali)
{
  const h = ubah("const f = (n: string) => { if (!confirm(`Hapus ${n}?`)) return; if (confirm('lagi?')) go(); };", "x.ts");
  assert.equal(h.jumlah, 2);
  assert.equal((h.kode.match(/async /g) ?? []).length, 1, "async hanya sekali");
  assert.match(h.kode, /\(await __konfirmasi\(`Hapus \$\{n\}\?`\)\)/);
}

// 3. function declaration: async disisipkan sebelum kata kunci function, bukan sebelum export
{
  const h = ubah(`export function hapusSemua() { const ok = window.confirm("Yakin?"); if (ok) x(); }`, "x.ts");
  assert.match(h.kode, /^export async function hapusSemua\(\)/);
  assert.match(h.kode, /const ok = \(await __konfirmasi\("Yakin\?"\)\);/);
}

// 4. sudah async: tidak digandakan
{
  const h = ubah(`const f = async () => { await a(); if (confirm("x")) b(); };`, "x.ts");
  assert.equal((h.kode.match(/async /g) ?? []).length, 1);
  assert.match(h.kode, /\(await __konfirmasi\("x"\)\)/);
}

// 5. confirm di dalam fungsi bersarang: hanya fungsi terdekat yang jadi async
{
  const h = ubah(`function luar() { return list.map((i) => () => { if (confirm("h")) i.hapus(); }); }`, "x.ts");
  assert.match(h.kode, /^function luar\(\)/, "fungsi luar tidak diubah");
  assert.match(h.kode, /\(i\) => async \(\) => \{/);
}

// 6. dilewati dengan peringatan: di luar fungsi, di dalam method
{
  const luar = ubah(`const ok = confirm("modul");`, "x.ts");
  assert.equal(luar.jumlah, 0);
  assert.equal(luar.peringatan.length, 1);
  assert.equal(luar.kode, `const ok = confirm("modul");`);

  const m = ubah(`class K { hapus() { return confirm("m"); } }`, "x.ts");
  assert.equal(m.jumlah, 0);
  assert.match(m.peringatan[0], /method/);
}

// 7. kata "confirm" bukan panggilan: tidak disentuh
{
  const h = ubah(`const confirmed = true; obj.confirm(1); const teks = "confirm(x)";`, "x.ts");
  assert.equal(h.jumlah, 0);
  assert.equal(h.peringatan.length, 0);
}

// 8. dijalankan sungguhan: janji menunggu jawaban, false menghentikan aksi
{
  const kode = `
    export async function jalankan(ok, catat) {
      return await (async () => { if (confirm("hapus?")) catat("dihapus"); else catat("batal"); })();
    }`;
  const h = ubah(kode, "x.js");
  const js = ts.transpileModule(h.kode, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const jadi = new Function("exports", "__konfirmasi", js + "\nreturn exports;");
  const catat: string[] = [];
  const lihat: string[] = [];
  const modulTrue = jadi({}, async (p: string) => (lihat.push(p), true));
  await modulTrue.jalankan(true, (s: string) => catat.push(s));
  const modulFalse = jadi({}, async () => false);
  await modulFalse.jalankan(false, (s: string) => catat.push(s));
  assert.deepEqual(catat, ["dihapus", "batal"]);
  assert.deepEqual(lihat, ["hapus?"]);
}

// 9. kode nyata dari src/ (bila ada): semuanya harus sah dan tidak ada confirm tersisa yang bisa diubah
{
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const akar = join(new URL("../../src", import.meta.url).pathname);
  const berkas: string[] = [];
  (function jelajah(d: string) {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) jelajah(p);
      else if (/\.(tsx?|jsx?)$/.test(n)) berkas.push(p);
    }
  })(akar);
  let total = 0;
  for (const b of berkas) {
    const h = ubah(readFileSync(b, "utf8"), b);
    total += h.jumlah;
    assert.deepEqual(h.peringatan, [], `peringatan di ${b}: ${h.peringatan.join("; ")}`);
    assert.doesNotMatch(h.kode.replace(/__konfirmasi/g, ""), /\bwindow\.confirm\s*\(|[^.\w]confirm\s*\(/, `confirm tersisa di ${b}`);
  }
  console.log(`  src/: ${berkas.length} berkas diperiksa, ${total} panggilan confirm diubah`);
}

console.log("Semua pemeriksaan pengubah confirm lolos.");
