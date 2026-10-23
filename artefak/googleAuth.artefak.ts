/**
 * Pengganti `src/lib/googleAuth.ts` khusus build artefak (lihat artefak/README.md).
 *
 * Di sandbox artefak tidak ada popup login Firebase dan tidak ada token Google. "Masuk" di sini berarti:
 * halaman ini boleh memakai konektor Google Drive dan Google Sheets milik akun Claude pemilik halaman.
 * Bentuk ekspornya sama dengan modul asli supaya `App.tsx` dan `SayaView.tsx` tidak perlu diubah.
 */
import type { User } from "firebase/auth";
import { dapatkanIzin, dapatkanMcp, SERVER_DRIVE, SERVER_SHEETS } from "./konektor";

export const SCOPES: string[] = [];
export const DURASI_SESI_MS = 90 * 24 * 60 * 60 * 1000;
export const KEY_TOKEN = "keuangan_gdrive_token";
export const KEY_TOKEN_TIME = "keuangan_gdrive_token_time";
export const KEY_USER_PROFILE = "keuangan_gdrive_user_profile";

/** Nilai pengganti token; tidak pernah dikirim ke mana pun, penerjemah di konektor.ts mengabaikannya. */
const TOKEN_KONEKTOR = "konektor-claude";
const KEY_AKTIF = "keuangan_konektor_aktif";

export interface ProfilPenggunaGoogle {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const PROFIL: ProfilPenggunaGoogle = {
  uid: "konektor-claude",
  displayName: "Konektor Google Drive",
  email: "lewat akun Claude Anda",
  photoURL: null,
};

let aktif = false;

// Pendengar yang didaftarkan App lewat initAuth. Di Firebase, onAuthStateChanged ikut terpanggil setelah
// popup login berhasil, dan App memakainya untuk menarik data dari Drive sekali. Tanpa itu, sambungan
// pertama tidak menarik data apa pun dan sinkron berikutnya akan menimpa Drive dengan data lokal yang kosong.
let saatBerhasil: ((user: User, token: string) => void) | undefined;

function bacaFlag(): boolean {
  try {
    return localStorage.getItem(KEY_AKTIF) === "1";
  } catch {
    return false;
  }
}

function tulisFlag(nilai: boolean): void {
  try {
    if (nilai) localStorage.setItem(KEY_AKTIF, "1");
    else localStorage.removeItem(KEY_AKTIF);
  } catch {
    // penyimpanan tidak tersedia; sambungan hanya berlaku selama halaman terbuka
  }
}

export function cekStatusSesiGoogle(): {
  aktif: boolean;
  sisaHari: number;
  tanggalKedaluwarsa: string;
  kedaluwarsa: boolean;
  pesan: string;
} {
  return {
    aktif,
    sisaHari: 0,
    tanggalKedaluwarsa: "-",
    kedaluwarsa: false,
    pesan: aktif ? "Terhubung lewat konektor Google Drive di akun Claude" : "Belum terhubung ke Google Drive",
  };
}

export function muatProfilPenggunaTersimpan(): ProfilPenggunaGoogle | null {
  return aktif ? PROFIL : null;
}

/**
 * Pulihkan sambungan otomatis hanya bila izin konektor sudah diberikan sebelumnya, supaya membuka
 * halaman tidak memunculkan dialog izin tanpa ada yang mengklik.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (pesanAlasan?: string) => void
) => {
  let dibatalkan = false;
  saatBerhasil = onAuthSuccess;
  void (async () => {
    if (!bacaFlag()) {
      onAuthFailure?.();
      return;
    }
    const izin = await dapatkanIzin();
    const status = izin ? await izin.state("mcp").catch(() => "unavailable") : "unavailable";
    const mcp = status === "granted" ? await dapatkanMcp() : null;
    if (dibatalkan) return;
    if (!mcp) {
      onAuthFailure?.();
      return;
    }
    aktif = true;
    onAuthSuccess?.(PROFIL as unknown as User, TOKEN_KONEKTOR);
  })();
  return () => {
    dibatalkan = true;
    if (saatBerhasil === onAuthSuccess) saatBerhasil = undefined;
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const mcp = await dapatkanMcp();
  if (!mcp) {
    throw new Error(
      "Tampilan ini tidak diberi akses konektor. Buka artefak lewat claude.ai dengan akun pemilik, lalu izinkan konektor Google Drive dan Google Sheets."
    );
  }

  // Satu dialog untuk kedua konektor. Penolakan bukan galat: cukup jelaskan cara membukanya lagi.
  const izin = await dapatkanIzin();
  if (izin) {
    const hasil = await izin.request(["mcp"]).catch(() => ({}) as Record<string, string>);
    if (hasil.mcp === "denied") {
      throw new Error("Izin konektor ditolak. Aktifkan lagi dari menu Izin halaman ini, lalu coba masuk lagi.");
    }
  }

  // Pemeriksaan awal yang ramah; runtime lama mungkin tidak punya listTools, dan itu bukan alasan menolak.
  const daftar = await Promise.resolve()
    .then(() => mcp.listTools())
    .catch(() => null);
  if (daftar && Array.isArray(daftar.servers)) {
    for (const nama of [SERVER_DRIVE, SERVER_SHEETS]) {
      const server = daftar.servers.find((s) => s.server === nama);
      if (!server || server.tools.length === 0) {
        throw new Error(`Konektor ${nama} belum tersambung di akun Claude ini. Tambahkan di claude.ai → Settings → Connectors.`);
      }
      if (server.authStatus === "needs_reauth") {
        throw new Error(`Sambungan ${nama} kedaluwarsa. Sambungkan ulang di claude.ai → Settings → Connectors.`);
      }
    }
  }

  // Uji nyata supaya galat yang tersisa (kebijakan, izin) muncul sekarang dan bukan saat sinkron pertama.
  await mcp.callTool(
    SERVER_DRIVE,
    "search_files",
    { query: "title = 'Keuangan' and mimeType = 'application/vnd.google-apps.folder'", pageSize: 1, excludeContentSnippets: true },
    { cache: false }
  ).catch((err: { message?: string }) => {
    throw new Error(err?.message || "Google Drive tidak bisa dihubungi lewat konektor.");
  });

  aktif = true;
  tulisFlag(true);
  // Seperti onAuthStateChanged Firebase: App menarik data dari Drive sekali setelah tersambung.
  saatBerhasil?.(PROFIL as unknown as User, TOKEN_KONEKTOR);
  return { user: PROFIL as unknown as User, accessToken: TOKEN_KONEKTOR };
};

export const getAccessToken = async (): Promise<string | null> => (aktif ? TOKEN_KONEKTOR : null);

export const setCachedAccessToken = (token: string | null) => {
  aktif = Boolean(token);
  tulisFlag(aktif);
};

export const logoutGoogle = async () => {
  aktif = false;
  tulisFlag(false);
};
