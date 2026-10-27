import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ubahKonfirmasi } from "./ubah-konfirmasi";

/**
 * Build khusus artefak Claude. Berbeda dari `vite.config.ts` di akar repo (yang dikelola Google AI Studio):
 * - tanpa PWA/service worker (tidak jalan di sandbox artefak);
 * - modul login Google diganti `googleAuth.artefak.ts` (konektor Drive/Sheets, bukan Firebase);
 * - operasi tulis `gdriveSync` diserialkan lewat antrean (`gdriveSync.artefak.ts`);
 * - `window.fetch` ke googleapis.com diterjemahkan ke konektor, `alert` diganti dialog di halaman, dan setiap
 *   `confirm(...)` di `src/` diubah saat build menjadi `await` pada dialog di halaman (ubah-konfirmasi.ts).
 * Kode aplikasi di `src/` tidak diubah. Pakai: `npx vite build --config artefak/vite.config.ts`.
 */
const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function entriArtefak(): Plugin {
  return {
    name: "entri-artefak",
    // order "pre": harus berjalan sebelum Vite memproses tag <script> di index.html.
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!html.includes('src="/src/main.tsx"')) {
          throw new Error("index.html tidak lagi memuat /src/main.tsx; sesuaikan artefak/vite.config.ts.");
        }
        return html.replace('src="/src/main.tsx"', 'src="/artefak/entry.ts"');
      },
    },
  };
}

/**
 * Penyesuaian teks di SayaView supaya tidak menjanjikan "login Google" dan "sesi 3 bulan" yang tidak
 * berlaku di mode konektor. Hanya kosmetik: bila teks sumber berubah, penggantian dilewati dengan peringatan.
 */
const GANTI_TEKS: Array<{ dari: string; ke: string }> = [
  { dari: "Masuk dengan Google & Sinkron Drive", ke: "Sambungkan konektor Google Drive" },
  {
    dari: '"Akses Google Drive Aktif & Tersambung"',
    ke: '"Konektor Google Drive aktif"',
  },
  {
    dari: "`Sesi akun Google di perangkat aktif hingga ${statusSesi.tanggalKedaluwarsa} (${statusSesi.sisaHari} hari tersisa). Data otomatis disinkronkan ke folder Keuangan.`",
    ke: '"Sinkronisasi memakai konektor Google Drive dan Google Sheets di akun Claude Anda. Izinnya bisa dicabut dari menu Izin halaman ini."',
  },
];

function teksArtefak(): Plugin {
  return {
    name: "teks-artefak",
    transform(kode, id) {
      if (!id.endsWith("/components/SayaView.tsx")) return null;
      let hasil = kode;
      for (const { dari, ke } of GANTI_TEKS) {
        if (hasil.includes(dari)) hasil = hasil.split(dari).join(ke);
        else this.warn(`Teks tidak ditemukan di SayaView.tsx, dilewati: ${dari.slice(0, 50)}…`);
      }
      return { code: hasil, map: null };
    },
  };
}

function konfirmasiAsync(): Plugin {
  return {
    name: "konfirmasi-async",
    enforce: "pre", // sebelum esbuild/React mengubah TSX
    transform(kode, id) {
      const berkas = id.split("?")[0];
      if (!/\/src\/.*\.(tsx?|jsx?)$/.test(berkas)) return null;
      const hasil = ubahKonfirmasi(kode, berkas);
      for (const w of hasil.peringatan) this.warn(w);
      return hasil.jumlah > 0 ? { code: hasil.kode, map: null } : null;
    },
  };
}

/**
 * Penerbitan artefak menolak karakter pengganti U+FFFD di berkas JS. Karakter itu muncul sebagai string literal
 * di polyfill `string_decoder` milik pustaka pihak ketiga (pembuat .docx); menuliskannya sebagai escape `\ufffd`
 * tidak mengubah artinya.
 */
function escapeKarakterPengganti(): Plugin {
  return {
    name: "escape-karakter-pengganti",
    enforce: "post",
    generateBundle(_opsi, bundel) {
      for (const berkas of Object.values(bundel)) {
        if (berkas.type === "chunk" && berkas.code.includes("\ufffd")) {
          berkas.code = berkas.code.split("\ufffd").join("\\ufffd");
        }
      }
    },
  };
}

export default defineConfig({
  root: akar,
  base: "./",
  plugins: [konfirmasiAsync(), react(), entriArtefak(), teksArtefak(), escapeKarakterPengganti()],
  resolve: {
    alias: [
      {
        find: /^\.{1,2}\/(?:.*\/)?lib\/googleAuth$/,
        replacement: path.resolve(akar, "artefak/googleAuth.artefak.ts"),
      },
      {
        find: /^\.{1,2}\/(?:.*\/)?lib\/gdriveSync$/,
        replacement: path.resolve(akar, "artefak/gdriveSync.artefak.ts"),
      },
    ],
  },
  build: { outDir: "dist-artefak", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
