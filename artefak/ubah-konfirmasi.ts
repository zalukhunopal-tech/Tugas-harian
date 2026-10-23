/**
 * Mengubah panggilan `confirm(...)` / `window.confirm(...)` di kode aplikasi menjadi
 * `(await __konfirmasi(...))` saat build artefak, lalu menjadikan fungsi pembungkus terdekatnya `async`.
 *
 * Kenapa: sandbox artefak membuat `confirm()` selalu false, dan `confirm()` yang sinkron tidak bisa menunggu
 * dialog buatan di halaman. Pengganti lama (dialog.ts, klik ulang tombol) gagal bila tombol pemicunya sudah
 * hilang saat `confirm` dipanggil, misalnya menu tekan-lama di Riwayat yang menutup dirinya dulu. Dengan
 * `await`, fungsi menunggu jawaban dialog di tempat, apa pun yang terjadi pada tombolnya.
 *
 * Berkas di `src/` tidak diubah; hanya hasil transformasi di memori saat build. Yang tidak bisa diubah dengan
 * aman (confirm di luar fungsi, di dalam konstruktor/method/accessor) dilewati dan dilaporkan sebagai
 * peringatan; panggilan itu tetap ditangani pengganti lama.
 */
import ts from "typescript";

export const NAMA_KONFIRMASI = "__konfirmasi";

export interface HasilUbah {
  kode: string;
  jumlah: number;
  peringatan: string[];
}

interface Suntingan {
  mulai: number;
  akhir: number;
  teks: string;
}

function jenisBerkas(nama: string): ts.ScriptKind {
  if (/\.tsx$/i.test(nama)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(nama)) return ts.ScriptKind.JSX;
  if (/\.js$/i.test(nama)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function adalahConfirm(e: ts.Expression): boolean {
  if (ts.isIdentifier(e)) return e.text === "confirm";
  return (
    ts.isPropertyAccessExpression(e) &&
    e.name.text === "confirm" &&
    ts.isIdentifier(e.expression) &&
    e.expression.text === "window"
  );
}

function fungsiTerdekat(n: ts.Node): ts.FunctionLikeDeclaration | undefined {
  let p: ts.Node | undefined = n.parent;
  while (p && !ts.isFunctionLike(p)) p = p.parent;
  return p as ts.FunctionLikeDeclaration | undefined;
}

function sudahAsync(f: ts.FunctionLikeDeclaration): boolean {
  return Boolean(ts.canHaveModifiers(f) && ts.getModifiers(f)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword));
}

export function ubahKonfirmasi(kode: string, nama: string): HasilUbah {
  if (!/\bconfirm\s*\(/.test(kode)) return { kode, jumlah: 0, peringatan: [] };

  const sf = ts.createSourceFile(nama, kode, ts.ScriptTarget.Latest, true, jenisBerkas(nama));
  const suntingan: Suntingan[] = [];
  const peringatan: string[] = [];
  const diasyncKan = new Set<ts.Node>();
  let jumlah = 0;

  const lokasi = (n: ts.Node) => `${nama}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;

  function jadikanAsync(f: ts.FunctionLikeDeclaration): void {
    if (sudahAsync(f) || diasyncKan.has(f)) return;
    diasyncKan.add(f);
    if (ts.isFunctionDeclaration(f)) {
      // `export function x` / `export default function x`: sisipkan tepat sebelum kata kunci `function`.
      const kata = f.getChildren(sf).find((c) => c.kind === ts.SyntaxKind.FunctionKeyword);
      const pos = (kata ?? f).getStart(sf);
      suntingan.push({ mulai: pos, akhir: pos, teks: "async " });
    } else {
      // arrow function dan function expression
      const pos = f.getStart(sf);
      suntingan.push({ mulai: pos, akhir: pos, teks: "async " });
    }
  }

  function kunjungi(n: ts.Node): void {
    if (ts.isCallExpression(n) && adalahConfirm(n.expression)) {
      const f = fungsiTerdekat(n);
      if (!f) {
        peringatan.push(`${lokasi(n)}: confirm() di luar fungsi dilewati`);
      } else if (
        ts.isMethodDeclaration(f) ||
        ts.isConstructorDeclaration(f) ||
        ts.isGetAccessorDeclaration(f) ||
        ts.isSetAccessorDeclaration(f)
      ) {
        peringatan.push(`${lokasi(n)}: confirm() di dalam method/konstruktor/accessor dilewati`);
      } else if (ts.isFunctionDeclaration(f) && f.asteriskToken) {
        peringatan.push(`${lokasi(n)}: confirm() di dalam generator dilewati`);
      } else {
        const callee = n.expression;
        suntingan.push({ mulai: callee.getStart(sf), akhir: callee.getEnd(), teks: `(await ${NAMA_KONFIRMASI}` });
        suntingan.push({ mulai: n.getEnd(), akhir: n.getEnd(), teks: ")" });
        jadikanAsync(f);
        jumlah++;
      }
    }
    ts.forEachChild(n, kunjungi);
  }

  kunjungi(sf);
  if (jumlah === 0) return { kode, jumlah: 0, peringatan };

  // Terapkan dari belakang ke depan supaya posisi suntingan sebelumnya tetap benar. Urutan seri pada posisi
  // yang sama dipertahankan (sisipan `async ` lebih dulu daripada `(await` yang berada di posisi berbeda).
  const urut = suntingan
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => b.mulai - a.mulai || b.i - a.i);
  let hasil = kode;
  for (const s of urut) hasil = hasil.slice(0, s.mulai) + s.teks + hasil.slice(s.akhir);
  return { kode: hasil, jumlah, peringatan };
}
