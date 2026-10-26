import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
];

// 3 Bulan (90 Hari) dalam milidetik
export const DURASI_SESI_MS = 90 * 24 * 60 * 60 * 1000;

export const KEY_TOKEN = "keuangan_gdrive_token";
export const KEY_TOKEN_TIME = "keuangan_gdrive_token_time";
export const KEY_USER_PROFILE = "keuangan_gdrive_user_profile";

export interface ProfilPenggunaGoogle {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;

import {
  ambilAkunAktif,
  setAkunAktif,
  tambahAtauPerbaruiAkun,
  ambilDaftarAkun,
  buatIdAkun,
  migrasiDataLokalKeAkun,
  hapusAkunDariDaftar,
  AkunGoogleTersimpan,
} from "./multiAkun";

export { ambilDaftarAkun, ambilAkunAktif, hapusAkunDariDaftar, type AkunGoogleTersimpan };

// Pulihkan token tersimpan saat inisialisasi jika masih dalam batas 3 bulan
function pulihkanTokenAwal(): string | null {
  try {
    const aktif = ambilAkunAktif();
    const token = aktif?.token || localStorage.getItem(KEY_TOKEN);
    const waktuStr = aktif?.tokenTime ? String(aktif.tokenTime) : localStorage.getItem(KEY_TOKEN_TIME);
    if (!token || !waktuStr) return null;

    const waktu = Number(waktuStr);
    const sekarang = Date.now();
    if (isNaN(waktu) || sekarang - waktu >= DURASI_SESI_MS) {
      // Sesi telah melewati 3 bulan, bersihkan
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_TOKEN_TIME);
      localStorage.removeItem(KEY_USER_PROFILE);
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

let cachedAccessToken: string | null = pulihkanTokenAwal();

/**
 * Cek status dan sisa masa berlaku sesi Google Drive (3 bulan / 90 hari)
 */
export function cekStatusSesiGoogle(waktuSpesifik?: number | null): {
  aktif: boolean;
  sisaHari: number;
  tanggalKedaluwarsa: string;
  kedaluwarsa: boolean;
  pesan: string;
} {
  try {
    const aktif = ambilAkunAktif();
    const token = cachedAccessToken || aktif?.token || localStorage.getItem(KEY_TOKEN);
    const waktu = waktuSpesifik || (aktif?.tokenTime ? Number(aktif.tokenTime) : Number(localStorage.getItem(KEY_TOKEN_TIME)));

    if (!token || !waktu || isNaN(waktu)) {
      return {
        aktif: false,
        sisaHari: 0,
        tanggalKedaluwarsa: "-",
        kedaluwarsa: false,
        pesan: "Belum terhubung ke Google Drive",
      };
    }

    const sekarang = Date.now();
    const selisih = sekarang - waktu;
    const batasAkhir = waktu + DURASI_SESI_MS;
    const dAkhir = new Date(batasAkhir);
    const tglAkhirStr = `${dAkhir.getDate()}/${dAkhir.getMonth() + 1}/${dAkhir.getFullYear()}`;

    if (selisih >= DURASI_SESI_MS) {
      return {
        aktif: false,
        sisaHari: 0,
        tanggalKedaluwarsa: tglAkhirStr,
        kedaluwarsa: true,
        pesan: "Sesi 3 bulan telah kedaluwarsa. Silakan masuk ulang dengan Google.",
      };
    }

    const sisaMs = batasAkhir - sekarang;
    const sisaHari = Math.max(1, Math.ceil(sisaMs / (1000 * 60 * 60 * 24)));

    return {
      aktif: true,
      sisaHari,
      tanggalKedaluwarsa: tglAkhirStr,
      kedaluwarsa: false,
      pesan: `Sesi aktif: ${sisaHari} hari tersisa (${tglAkhirStr})`,
    };
  } catch {
    return {
      aktif: false,
      sisaHari: 0,
      tanggalKedaluwarsa: "-",
      kedaluwarsa: false,
      pesan: "Status sesi tidak diketahui",
    };
  }
}

/**
 * Muat profil Google yang disimpan secara lokal
 */
export function muatProfilPenggunaTersimpan(): ProfilPenggunaGoogle | null {
  try {
    const aktif = ambilAkunAktif();
    if (aktif) {
      return {
        uid: aktif.uid,
        displayName: aktif.displayName,
        email: aktif.email,
        photoURL: aktif.photoURL,
      };
    }
    const raw = localStorage.getItem(KEY_USER_PROFILE);
    if (!raw) return null;
    return JSON.parse(raw) as ProfilPenggunaGoogle;
  } catch {
    return null;
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (pesanAlasan?: string) => void
) => {
  // Cek apakah token masih tersimpan dan berlaku dalam 3 bulan
  cachedAccessToken = pulihkanTokenAwal();

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const idAkun = buatIdAkun(user.email || user.uid);
      migrasiDataLokalKeAkun(idAkun);

      const status = cekStatusSesiGoogle();
      if (status.aktif && cachedAccessToken) {
        // Pastikan akun tercatat aktif di daftar akun
        tambahAtauPerbaruiAkun({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName,
          photoURL: user.photoURL,
          terakhirAktif: Date.now(),
          token: cachedAccessToken,
          tokenTime: Date.now(),
        });
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (status.kedaluwarsa) {
        // Lewat 3 bulan
        await logoutGoogle();
        if (onAuthFailure) onAuthFailure(status.pesan);
      } else if (!isSigningIn) {
        // Ada user Firebase tapi token Drive belum ada
        if (onAuthFailure) onAuthFailure("Silakan hubungkan akun Google untuk akses Drive.");
      }
    } else {
      // Cek apakah ada profil tersimpan yang masih berlaku dalam 3 bulan
      const status = cekStatusSesiGoogle();
      if (!status.aktif && !isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure(status.kedaluwarsa ? status.pesan : undefined);
      }
    }
  });
};

export const googleSignIn = async (options?: {
  forceSelectAccount?: boolean;
}): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const dynamicProvider = new GoogleAuthProvider();
    for (const scope of SCOPES) {
      dynamicProvider.addScope(scope);
    }
    // Jika ganti akun / tambah akun, minta Google menampilkan pemilih akun
    if (options?.forceSelectAccount) {
      dynamicProvider.setCustomParameters({ prompt: "select_account" });
    }

    const result = await signInWithPopup(auth, dynamicProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal memperoleh access token dari Google Auth");
    }

    cachedAccessToken = credential.accessToken;
    const sekarang = Date.now();
    const idAkun = buatIdAkun(result.user.email || result.user.uid);

    // Migrasi data lama ke partisi akun ini jika belum pernah
    migrasiDataLokalKeAkun(idAkun);

    // Daftarkan ke multi-akun
    const akunBaru: AkunGoogleTersimpan = {
      uid: result.user.uid,
      email: result.user.email || "",
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      terakhirAktif: sekarang,
      token: cachedAccessToken,
      tokenTime: sekarang,
    };
    tambahAtauPerbaruiAkun(akunBaru);

    // Simpan ke localStorage untuk persistensi 3 bulan
    try {
      localStorage.setItem(KEY_TOKEN, cachedAccessToken);
      localStorage.setItem(KEY_TOKEN_TIME, String(sekarang));
      localStorage.setItem(KEY_USER_PROFILE, JSON.stringify(akunBaru));
    } catch (e) {
      console.warn("Gagal menyimpan sesi Google ke storage:", e);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const beralihAkunGoogle = (emailOrUid: string): AkunGoogleTersimpan | null => {
  const daftar = ambilDaftarAkun();
  const idTarget = buatIdAkun(emailOrUid);
  const target = daftar.find((a) => buatIdAkun(a.email || a.uid) === idTarget);
  if (!target) return null;

  setAkunAktif(target);
  cachedAccessToken = target.token || null;
  if (target.token) {
    try {
      localStorage.setItem(KEY_TOKEN, target.token);
      localStorage.setItem(KEY_TOKEN_TIME, String(target.tokenTime || Date.now()));
      localStorage.setItem(KEY_USER_PROFILE, JSON.stringify(target));
    } catch {}
  } else {
    try {
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_TOKEN_TIME);
    } catch {}
  }
  return target;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = pulihkanTokenAwal();
  }
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  const aktif = ambilAkunAktif();
  if (token) {
    const sekarang = Date.now();
    try {
      localStorage.setItem(KEY_TOKEN, token);
      localStorage.setItem(KEY_TOKEN_TIME, String(sekarang));
    } catch {}
    if (aktif) {
      tambahAtauPerbaruiAkun({
        ...aktif,
        token,
        tokenTime: sekarang,
      });
    }
  } else {
    try {
      localStorage.removeItem(KEY_TOKEN);
      localStorage.removeItem(KEY_TOKEN_TIME);
      localStorage.removeItem(KEY_USER_PROFILE);
    } catch {}
    if (aktif) {
      tambahAtauPerbaruiAkun({
        ...aktif,
        token: null,
        tokenTime: null,
      });
    }
  }
};

export const logoutGoogle = async (hapusDariPerangkat: boolean = false) => {
  const aktif = ambilAkunAktif();
  try {
    await auth.signOut();
  } catch (e) {
    console.warn("Sign out auth warning:", e);
  }
  cachedAccessToken = null;
  try {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_TOKEN_TIME);
    localStorage.removeItem(KEY_USER_PROFILE);
  } catch {}

  if (aktif && hapusDariPerangkat) {
    hapusAkunDariDaftar(aktif.email || aktif.uid);
  } else {
    setAkunAktif(null);
  }
};
