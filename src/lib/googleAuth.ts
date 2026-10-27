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

// Sesi Akun Google di perangkat: 3 Bulan (90 Hari) dalam milidetik
export const DURASI_SESI_AKUN_MS = 90 * 24 * 60 * 60 * 1000;
export const DURASI_SESI_MS = DURASI_SESI_AKUN_MS;

// Google OAuth Access Token berlaku selama 3600 detik (1 jam).
// Berikan ambang batas aman 50 menit (3000 detik) untuk pembaruan sebelum kedaluwarsa.
export const DURASI_TOKEN_AKSES_MS = 50 * 60 * 1000;

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

/**
 * Memeriksa apakah token akses Google Drive telah kedaluwarsa (> 50 menit)
 */
export function apakahTokenKedaluwarsa(waktu?: number | null): boolean {
  if (!waktu || isNaN(waktu)) return true;
  return Date.now() - waktu >= DURASI_TOKEN_AKSES_MS;
}

// Pulihkan token tersimpan saat inisialisasi jika masih dalam batas 3 bulan
function pulihkanTokenAwal(): string | null {
  try {
    const aktif = ambilAkunAktif();
    const token = aktif?.token || localStorage.getItem(KEY_TOKEN);
    const waktuStr = aktif?.tokenTime ? String(aktif.tokenTime) : localStorage.getItem(KEY_TOKEN_TIME);
    if (!token || !waktuStr) return null;

    const waktu = Number(waktuStr);
    const sekarang = Date.now();
    if (isNaN(waktu) || sekarang - waktu >= DURASI_SESI_AKUN_MS) {
      // Sesi akun telah melewati 3 bulan, bersihkan
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
 * Cek status sesi akun (3 bulan) dan masa berlaku token akses Google Drive (1 jam)
 */
export function cekStatusSesiGoogle(waktuSpesifik?: number | null): {
  aktif: boolean;
  tokenAktif: boolean;
  sisaHari: number;
  tanggalKedaluwarsa: string;
  kedaluwarsa: boolean;
  perluPembaruanToken: boolean;
  pesan: string;
} {
  try {
    const aktif = ambilAkunAktif();
    const token = cachedAccessToken || aktif?.token || localStorage.getItem(KEY_TOKEN);
    const waktuAkun = waktuSpesifik || (aktif?.terakhirAktif ? Number(aktif.terakhirAktif) : Number(localStorage.getItem(KEY_TOKEN_TIME)));
    const waktuToken = aktif?.tokenTime ? Number(aktif.tokenTime) : Number(localStorage.getItem(KEY_TOKEN_TIME));

    if (!aktif && !token) {
      return {
        aktif: false,
        tokenAktif: false,
        sisaHari: 0,
        tanggalKedaluwarsa: "-",
        kedaluwarsa: false,
        perluPembaruanToken: false,
        pesan: "Belum terhubung ke Google Drive",
      };
    }

    const sekarang = Date.now();
    const waktuMulai = waktuAkun || waktuToken || sekarang;
    const selisihAkun = sekarang - waktuMulai;
    const batasAkhir = waktuMulai + DURASI_SESI_AKUN_MS;
    const dAkhir = new Date(batasAkhir);
    const tglAkhirStr = `${dAkhir.getDate()}/${dAkhir.getMonth() + 1}/${dAkhir.getFullYear()}`;

    if (selisihAkun >= DURASI_SESI_AKUN_MS) {
      return {
        aktif: false,
        tokenAktif: false,
        sisaHari: 0,
        tanggalKedaluwarsa: tglAkhirStr,
        kedaluwarsa: true,
        perluPembaruanToken: true,
        pesan: "Sesi 3 bulan telah kedaluwarsa. Silakan masuk ulang dengan Google.",
      };
    }

    const sisaMs = batasAkhir - sekarang;
    const sisaHari = Math.max(1, Math.ceil(sisaMs / (1000 * 60 * 60 * 24)));
    const tokenKedaluwarsa = !token || apakahTokenKedaluwarsa(waktuToken);

    if (tokenKedaluwarsa) {
      return {
        aktif: true,
        tokenAktif: false,
        sisaHari,
        tanggalKedaluwarsa: tglAkhirStr,
        kedaluwarsa: false,
        perluPembaruanToken: true,
        pesan: "Akses Google Drive perlu diperbarui (1 ketukan tanpa keluar)",
      };
    }

    return {
      aktif: true,
      tokenAktif: true,
      sisaHari,
      tanggalKedaluwarsa: tglAkhirStr,
      kedaluwarsa: false,
      perluPembaruanToken: false,
      pesan: `Sesi aktif: ${sisaHari} hari tersisa (${tglAkhirStr})`,
    };
  } catch {
    return {
      aktif: false,
      tokenAktif: false,
      sisaHari: 0,
      tanggalKedaluwarsa: "-",
      kedaluwarsa: false,
      perluPembaruanToken: false,
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

/**
 * Mencoba memperbarui token akses secara hening (silent) di latar belakang
 * menggunakan Google Identity Services (GIS) tanpa memunculkan popup atau mengganggu pengguna.
 */
export function cobaRefreshSilentGIS(emailHint?: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || !(window as any).google?.accounts?.oauth2 || !firebaseConfig.oAuthClientId) {
        return resolve(null);
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: SCOPES.join(" "),
        prompt: "",
        hint: emailHint || ambilAkunAktif()?.email || "",
        callback: (resp: any) => {
          if (resp && resp.access_token) {
            setCachedAccessToken(resp.access_token);
            resolve(resp.access_token);
          } else {
            resolve(null);
          }
        },
        error_callback: () => {
          resolve(null);
        },
      });

      client.requestAccessToken({ prompt: "", hint: emailHint || ambilAkunAktif()?.email || "" });

      // Batasi waktu tunggu bila browser memblokir iframe pihak ketiga
      setTimeout(() => {
        resolve(null);
      }, 3500);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Memperbarui token akses Google Drive.
 * Mendukung pembaharuan instan 1-ketukan tanpa harus logout atau menghapus data.
 */
export const perbaruiTokenDrive = async (options?: {
  interactive?: boolean;
}): Promise<string | null> => {
  const aktif = ambilAkunAktif() || muatProfilPenggunaTersimpan();
  const emailHint = aktif?.email || auth.currentUser?.email || undefined;

  // 1. Coba silent refresh di latar belakang terlebih dahulu jika tidak dipaksa interaktif
  if (!options?.interactive) {
    try {
      const silentToken = await cobaRefreshSilentGIS(emailHint);
      if (silentToken) {
        return silentToken;
      }
    } catch (e) {
      console.warn("Silent GIS refresh belum berhasil, butuh konfirmasi:", e);
    }
  }

  // 2. Jika interaktif (dipicu tombol / aksi pengguna)
  if (options?.interactive) {
    isSigningIn = true;
    try {
      const dynamicProvider = new GoogleAuthProvider();
      for (const scope of SCOPES) {
        dynamicProvider.addScope(scope);
      }
      if (emailHint) {
        dynamicProvider.setCustomParameters({ login_hint: emailHint });
      }

      const result = await signInWithPopup(auth, dynamicProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error("Gagal memperoleh token akses baru dari Google");
      }

      const tokenBaru = credential.accessToken;
      setCachedAccessToken(tokenBaru);

      const sekarang = Date.now();
      const akunUpdate: AkunGoogleTersimpan = {
        uid: result.user.uid,
        email: result.user.email || emailHint || "",
        displayName: result.user.displayName || aktif?.displayName || null,
        photoURL: result.user.photoURL || aktif?.photoURL || null,
        terakhirAktif: sekarang,
        token: tokenBaru,
        tokenTime: sekarang,
      };
      tambahAtauPerbaruiAkun(akunUpdate);

      return tokenBaru;
    } finally {
      isSigningIn = false;
    }
  }

  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (pesanAlasan?: string) => void
) => {
  // Cek apakah token masih tersimpan dalam batas 3 bulan
  cachedAccessToken = pulihkanTokenAwal();

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const idAkun = buatIdAkun(user.email || user.uid);
      migrasiDataLokalKeAkun(idAkun);

      const status = cekStatusSesiGoogle();
      if (status.aktif) {
        const tokenAda = cachedAccessToken || ambilAkunAktif()?.token || "";
        if (tokenAda) {
          cachedAccessToken = tokenAda;
          if (onAuthSuccess) onAuthSuccess(user, tokenAda);
        }

        // Jika token sudah kedaluwarsa (> 50 menit), coba perbarui secara hening (silent) di latar belakang
        if (status.perluPembaruanToken) {
          void cobaRefreshSilentGIS(user.email || undefined).then((tokenBaru) => {
            if (tokenBaru && onAuthSuccess) {
              onAuthSuccess(user, tokenBaru);
            }
          });
        }
      } else if (status.kedaluwarsa) {
        // Sesi 3 bulan di perangkat habis
        await logoutGoogle();
        if (onAuthFailure) onAuthFailure(status.pesan);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure("Silakan hubungkan akun Google untuk akses Drive.");
      }
    } else {
      // Tidak ada user Firebase aktif saat ini
      const akunAktif = ambilAkunAktif();
      const profilTersimpan = muatProfilPenggunaTersimpan();
      const aktif = akunAktif || profilTersimpan;
      const status = cekStatusSesiGoogle();

      if (aktif && status.aktif) {
        // Ada profil akun tersimpan di perangkat dalam batas 3 bulan
        const tokenAda = cachedAccessToken || akunAktif?.token || localStorage.getItem(KEY_TOKEN) || "";
        if (tokenAda) {
          cachedAccessToken = tokenAda;
          const fakeUser = {
            uid: aktif.uid,
            email: aktif.email,
            displayName: aktif.displayName,
            photoURL: aktif.photoURL,
          } as User;
          if (onAuthSuccess) onAuthSuccess(fakeUser, tokenAda);
        }

        // Coba silent refresh di latar belakang
        void cobaRefreshSilentGIS(aktif.email || undefined).then((tokenBaru) => {
          if (tokenBaru) {
            const fakeUser = {
              uid: aktif.uid,
              email: aktif.email,
              displayName: aktif.displayName,
              photoURL: aktif.photoURL,
            } as User;
            if (onAuthSuccess) onAuthSuccess(fakeUser, tokenBaru);
          }
        });
      } else if (!status.aktif && !isSigningIn) {
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

export const getAccessToken = async (options?: {
  forceRefresh?: boolean;
  interactive?: boolean;
}): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = pulihkanTokenAwal();
  }

  const aktif = ambilAkunAktif();
  const waktuStr = aktif?.tokenTime ? String(aktif.tokenTime) : localStorage.getItem(KEY_TOKEN_TIME);
  const waktuToken = waktuStr ? Number(waktuStr) : 0;
  const expired = !cachedAccessToken || options?.forceRefresh || apakahTokenKedaluwarsa(waktuToken);

  if (expired) {
    // Coba silent refresh otomatis terlebih dahulu
    try {
      const refreshed = await perbaruiTokenDrive({ interactive: options?.interactive ?? false });
      if (refreshed) {
        cachedAccessToken = refreshed;
        return refreshed;
      }
    } catch {
      // Lanjut memakai cached token bila silent belum bisa
    }
  }

  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  const aktif = ambilAkunAktif();
  const sekarang = Date.now();
  if (token) {
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
