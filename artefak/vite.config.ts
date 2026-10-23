import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Build khusus artefak Claude. Berbeda dari `vite.config.ts` di akar repo (yang dikelola Google AI Studio):
 * - tanpa PWA/service worker (tidak jalan di sandbox artefak);
 * - modul login Google diganti `googleAuth.artefak.ts` (konektor Drive/Sheets, bukan Firebase);
 * - operasi tulis `gdriveSync` diserialkan lewat antrean (`gdriveSync.artefak.ts`);
 * - `window.fetch` ke googleapis.com diterjemahkan ke konektor, `confirm`/`alert` diganti dialog di halaman.
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
    dari: "`Sesi Sinkronisasi 3 Bulan Aktif (${statusSesi.sisaHari} Hari Tersisa)`",
    ke: '"Konektor Google Drive aktif"',
  },
  {
    dari: "`Sesi login & sinkronisasi Drive disimpan otomatis hingga ${statusSesi.tanggalKedaluwarsa}. Aplikasi tetap tersambung tanpa perlu login ulang.`",
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

export default defineConfig({
  root: akar,
  base: "./",
  plugins: [react(), entriArtefak(), teksArtefak()],
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
