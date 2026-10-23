import React, { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import {
  Transaksi,
  AsetItem,
  DataHarga,
  KarakterId,
  TemaId,
  ViewTab,
  TransaksiBerulang,
  NamaDana,
  PengaturanKeuangan,
  ItemHutangPiutang,
  TargetTabunganItem,
  AppLockConfig,
  ProfilPelapor,
  DataKegiatan,
} from "./types";
import {
  BUDGET_KEY,
  TEMA_KEY,
  KARAKTER_KEY,
  hariIni,
} from "./lib/constants";
import {
  muatTransaksi,
  simpanTransaksi,
  muatAset,
  simpanAset,
  muatHarga,
  simpanHarga,
  muatTransaksiBerulang,
  simpanTransaksiBerulang,
  bacaStorage,
  tulisStorage,
  tambahIdTerhapus,
  muatPengaturan,
  simpanPengaturan,
  muatUtangPiutang,
  simpanUtangPiutang,
  muatTargetTabungan,
  simpanTargetTabungan,
  muatAppLock,
  simpanAppLock,
  muatProfilPelapor,
  simpanProfilPelapor,
  muatDaftarKegiatan,
  simpanDaftarKegiatan,
  muatLaporanKegiatanFile,
} from "./lib/storage";
import { apakahJatuhTempo } from "./lib/transaksiBerulang";
import {
  koinDipakai,
  ambilHargaCoinGecko,
  ambilHargaPasarLengkap,
  hargaBasi,
} from "./lib/aset";
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  cekStatusSesiGoogle,
} from "./lib/googleAuth";
import {
  cariFolderKeuangan,
  ambilIsiFolderKeuangan,
  buatFolderKeuangan,
  kirimSemuaKeDrive,
  tarikSemuaDariDrive,
  simpanAsetKeDrive,
  dapatkanFolderBuktiTarget,
  unggahBuktiKeDrive,
  KeuanganDriveContents,
} from "./lib/gdriveSync";
import {
  simpanBuktiOffline,
  ambilSemuaBuktiOffline,
  hapusBuktiOffline,
  formatNamaFileBukti,
  konversiDataUrlKeBlob,
} from "./lib/buktiStorage";
import { Topbar } from "./components/Topbar";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { RiwayatView } from "./components/RiwayatView";
import { AsetView } from "./components/AsetView";
import { TambahView } from "./components/TambahView";
import { GrafikView } from "./components/GrafikView";
import { SayaView } from "./components/SayaView";
import { TransaksiBerulangModal } from "./components/TransaksiBerulangModal";
import { AppLockModal } from "./components/AppLockModal";

export default function App() {
  const [transaksi, setTransaksi] = useState<Transaksi[]>(() => muatTransaksi());
  const [aset, setAset] = useState<AsetItem[]>(() => muatAset());
  const [harga, setHarga] = useState<DataHarga>(() => muatHarga());
  const [pengaturan, setPengaturan] = useState<PengaturanKeuangan>(() => muatPengaturan());
  const [daftarUtangPiutang, setDaftarUtangPiutang] = useState<ItemHutangPiutang[]>(() => muatUtangPiutang());
  const [daftarTargetTabungan, setDaftarTargetTabungan] = useState<TargetTabunganItem[]>(() => muatTargetTabungan());
  const [appLockConfig, setAppLockConfig] = useState<AppLockConfig>(() => muatAppLock());
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const c = muatAppLock();
    return Boolean(c?.enabled);
  });
  const [targetTabunganAwalId, setTargetTabunganAwalId] = useState<string>("");
  const [profilPelapor, setProfilPelapor] = useState<ProfilPelapor>(() => muatProfilPelapor());
  const [daftarKegiatan, setDaftarKegiatan] = useState<DataKegiatan[]>(() => muatDaftarKegiatan());

  const [anggaran, setAnggaran] = useState<number>(() => {
    const p = muatPengaturan();
    if (typeof p.anggaranHarian === "number" && p.anggaranHarian > 0) {
      return p.anggaranHarian;
    }
    return Number(bacaStorage(BUDGET_KEY, "0")) || 0;
  });

  const [daftarBerulang, setDaftarBerulang] = useState<TransaksiBerulang[]>(() =>
    muatTransaksiBerulang()
  );
  const [modalBerulangBuka, setModalBerulangBuka] = useState(false);
  const jumlahJatuhTempo = daftarBerulang.filter(apakahJatuhTempo).length;

  const [tema, setTema] = useState<TemaId>(() => (bacaStorage(TEMA_KEY, "jujutsu") as TemaId) || "jujutsu");
  const [karakter, setKarakter] = useState<KarakterId>(
    () => (bacaStorage(KARAKTER_KEY, "gojo") as KarakterId) || "gojo"
  );

  const [currentView, setCurrentView] = useState<ViewTab>("riwayat");
  const [lastActiveTab, setLastActiveTab] = useState<ViewTab>("riwayat");

  useEffect(() => {
    if (currentView !== "tambah") {
      setLastActiveTab(currentView);
    }
  }, [currentView]);
  const [bulanTerpilih, setBulanTerpilih] = useState<string>(() => hariIni().slice(0, 7));
  const [editTransaksi, setEditTransaksi] = useState<Transaksi | null>(null);

  // Google Drive Direct Sync States
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [driveContents, setDriveContents] = useState<KeuanganDriveContents | null>(null);
  const [memuatDrive, setMemuatDrive] = useState(false);

  const [syncPesan, setSyncPesan] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<{
    pesan: string;
    status: "kerja" | "sukses" | "gagal" | "idle" | "tunggu";
  }>({ pesan: "", status: "idle" });

  const [memuatHarga, setMemuatHarga] = useState(false);
  const [modalPilihanTambahBuka, setModalPilihanTambahBuka] = useState(false);
  const [initialScanMode, setInitialScanMode] = useState<"kamera" | "galeri" | null>(null);

  // Synchronize HTML attributes for theme and character
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    tulisStorage(TEMA_KEY, tema);
  }, [tema]);

  useEffect(() => {
    document.documentElement.dataset.karakter = karakter;
    tulisStorage(KARAKTER_KEY, karakter);
  }, [karakter]);

  useEffect(() => {
    document.body.dataset.view = currentView;
  }, [currentView]);

  // Kunci otomatis setelah 1 menit di latar belakang
  const backgroundTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (!appLockConfig.enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        backgroundTimerRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        if (backgroundTimerRef.current) {
          const elapsedMs = Date.now() - backgroundTimerRef.current;
          if (elapsedMs >= 60 * 1000) {
            setIsAppLocked(true);
          }
        }
        backgroundTimerRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [appLockConfig.enabled]);



  // Persist transactions and assets
  const perbaruiTransaksi = useCallback((baru: Transaksi[]) => {
    setTransaksi(baru);
    simpanTransaksi(baru);
  }, []);

  const perbaruiAset = useCallback((baru: AsetItem[]) => {
    setAset(baru);
    simpanAset(baru);
  }, []);

  const perbaruiHargaState = useCallback((baru: DataHarga) => {
    setHarga(baru);
    simpanHarga(baru);
  }, []);

  // Update market prices (CoinGecko crypto + spot gold)
  const perbaruiHargaPasar = useCallback(async () => {
    setMemuatHarga(true);
    try {
      const koinList = koinDipakai(aset);
      const dataPasar = await ambilHargaPasarLengkap(koinList);
      const hargaBaru: DataHarga = {
        ...harga,
        crypto: {
          ...(harga.crypto || {}),
          ...dataPasar.crypto,
        },
        emas: dataPasar.emas || harga.emas,
        waktu: new Date().toISOString(),
      };
      perbaruiHargaState(hargaBaru);
    } catch (e: any) {
      console.warn("Gagal memperbarui harga pasar:", e.message);
    } finally {
      setMemuatHarga(false);
    }
  }, [aset, harga, perbaruiHargaState]);

  // Otomatis update harga pasar saat aplikasi dibuka jika data belum ada atau basi
  useEffect(() => {
    if (hargaBasi(harga)) {
      void perbaruiHargaPasar();
    }
  }, []);

  // Otomatis perbarui harga secara berkala & real-time saat pengguna membuka tab Aset
  useEffect(() => {
    if (currentView === "aset") {
      void perbaruiHargaPasar();

      // Interval otomatis setiap 30 menit (30 * 60 * 1000 ms) sesuai permintaan pengguna
      const interval = setInterval(() => {
        void perbaruiHargaPasar();
      }, 30 * 60 * 1000);

      // Otomatis refresh saat layar HP atau tab kembali fokus jika sudah basi
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible" && hargaBasi(harga)) {
          void perbaruiHargaPasar();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [currentView, perbaruiHargaPasar]);

  // ===== Google Drive Direct Synchronization & Auto-Sync =====

  const transaksiRef = React.useRef(transaksi);
  transaksiRef.current = transaksi;
  const asetRef = React.useRef(aset);
  asetRef.current = aset;
  const hargaRef = React.useRef(harga);
  hargaRef.current = harga;
  const pengaturanRef = React.useRef(pengaturan);
  pengaturanRef.current = pengaturan;

  const autoSyncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncPendingRef = React.useRef<boolean>(false);
  const initialPullDoneRef = React.useRef<boolean>(false);

  const periksaDriveOtomatis = useCallback(async (token: string) => {
    setMemuatDrive(true);
    try {
      let folder = await cariFolderKeuangan(token);
      if (!folder) {
        setSyncPesan(
          "Folder 'Keuangan' belum ditemukan di Google Drive Anda. Pastikan folder bernama 'Keuangan' ada di Google Drive Anda."
        );
        setDriveContents(null);
        return;
      }
      const contents = await ambilIsiFolderKeuangan(token, folder.id);
      setDriveContents(contents);
      setSyncPesan(
        `Folder 'Keuangan' ditemukan di Google Drive (${contents.allFiles.length} file).`
      );
    } catch (err: any) {
      setSyncPesan(`Gagal memeriksa Google Drive: ${err.message}`);
    } finally {
      setMemuatDrive(false);
    }
  }, []);

  const jalankanAutoKirimKeDrive = useCallback(async () => {
    let token = await getAccessToken();
    if (!token) {
      syncPendingRef.current = false;
      return;
    }
    const statusSesi = cekStatusSesiGoogle();
    if (!statusSesi.aktif) {
      syncPendingRef.current = false;
      return;
    }

    if (!navigator.onLine) {
      syncPendingRef.current = true;
      setSyncStatus({ pesan: "Belum tersinkron", status: "tunggu" });
      return;
    }

    setSyncStatus({ pesan: "Menyinkronkan ke Drive…", status: "kerja" });
    try {
      await kirimSemuaKeDrive(
        token,
        transaksiRef.current,
        asetRef.current,
        pengaturanRef.current,
        muatLaporanKegiatanFile()
      );
      syncPendingRef.current = false;
      setSyncStatus({ pesan: "Data tersinkron ke Google Drive", status: "sukses" });
      setTimeout(() => {
        setSyncStatus((prev) => (prev.status === "sukses" ? { pesan: "", status: "idle" } : prev));
      }, 3500);
    } catch (err: any) {
      console.warn("Auto-sync ke Drive gagal:", err);
      syncPendingRef.current = true;
      setSyncStatus({ pesan: "Belum tersinkron", status: "gagal" });
    }
  }, []);

  const jadwalkanAutoSync = useCallback(() => {
    syncPendingRef.current = true;
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    if (!navigator.onLine) {
      setSyncStatus({ pesan: "Belum tersinkron", status: "tunggu" });
      return;
    }

    // Kirim ke Drive sekitar 5 detik kemudian tanpa dialog konfirmasi
    autoSyncTimerRef.current = setTimeout(() => {
      void jalankanAutoKirimKeDrive();
    }, 5000);
  }, [jalankanAutoKirimKeDrive]);

  // Unggah bukti transaksi ke Google Drive atau simpan ke antrean offline jika jaringan belum siap
  const prosesUnggahBuktiTransaksi = useCallback(
    async (trx: Transaksi) => {
      if (!trx.bukti || trx.bukti.length === 0) return;
      const buktiPerluDiunggah = trx.bukti.filter((b) => !b.driveLink && b.dataUrl);
      if (buktiPerluDiunggah.length === 0) return;

      const token = await getAccessToken();
      const statusSesi = cekStatusSesiGoogle();
      const online = navigator.onLine && token && statusSesi.aktif;

      if (!online) {
        // Simpan foto di IndexedDB untuk diunggah otomatis saat online (Requirement A6)
        for (const b of buktiPerluDiunggah) {
          try {
            const blob = konversiDataUrlKeBlob(b.dataUrl!);
            const ext = b.tipe === "application/pdf" ? "pdf" : "jpg";
            const namaFile = formatNamaFileBukti(trx.tanggal, trx.deskripsi, b.id, ext);
            await simpanBuktiOffline({
              id: b.id,
              trxId: trx.id,
              namaFile,
              tipe: b.tipe,
              blob,
              dana: trx.dana,
              waktu: b.waktu || new Date().toISOString(),
            });
          } catch (e) {
            console.warn("Gagal menyimpan bukti ke antrean offline:", e);
          }
        }
        return;
      }

      // Online: unggah langsung ke folder target Drive (Requirement A3 & A4)
      try {
        let folder = await cariFolderKeuangan(token);
        if (!folder) {
          folder = await buatFolderKeuangan(token);
        }
        const targetFolder = await dapatkanFolderBuktiTarget(token, folder.id, trx.dana);

        let adaPerubahan = false;
        const buktiBaru = [...trx.bukti];

        for (let i = 0; i < buktiBaru.length; i++) {
          const item = buktiBaru[i];
          if (!item.driveLink && item.dataUrl) {
            try {
              const blob = konversiDataUrlKeBlob(item.dataUrl);
              const ext = item.tipe === "application/pdf" ? "pdf" : "jpg";
              const namaFile = formatNamaFileBukti(trx.tanggal, trx.deskripsi, item.id, ext);
              const hasilUnggah = await unggahBuktiKeDrive(
                token,
                targetFolder.id,
                blob,
                namaFile,
                item.tipe
              );
              buktiBaru[i] = {
                ...item,
                driveId: hasilUnggah.driveId,
                driveLink: hasilUnggah.driveLink,
              };
              adaPerubahan = true;
            } catch (errUnggah) {
              console.warn("Gagal mengunggah bukti ke Drive, menyimpan ke antrean offline:", errUnggah);
              const blob = konversiDataUrlKeBlob(item.dataUrl);
              const ext = item.tipe === "application/pdf" ? "pdf" : "jpg";
              const namaFile = formatNamaFileBukti(trx.tanggal, trx.deskripsi, item.id, ext);
              await simpanBuktiOffline({
                id: item.id,
                trxId: trx.id,
                namaFile,
                tipe: item.tipe,
                blob,
                dana: trx.dana,
                waktu: item.waktu || new Date().toISOString(),
              });
            }
          }
        }

        if (adaPerubahan) {
          const updatedTrx = { ...trx, bukti: buktiBaru, diubah: new Date().toISOString() };
          perbaruiTransaksi(
            transaksiRef.current.map((t) => (t.id === updatedTrx.id ? updatedTrx : t))
          );
          jadwalkanAutoSync();
        }
      } catch (err: any) {
        console.warn("Proses unggah bukti transaksi gagal:", err);
      }
    },
    [jadwalkanAutoSync, perbaruiTransaksi]
  );

  // Proses antrean foto/file bukti yang tersimpan di IndexedDB saat offline
  const prosesAntreanBuktiOffline = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const statusSesi = cekStatusSesiGoogle();
    if (!statusSesi.aktif || !navigator.onLine) return;

    try {
      const antrean = await ambilSemuaBuktiOffline();
      if (!antrean || antrean.length === 0) return;

      let folder = await cariFolderKeuangan(token);
      if (!folder) {
        folder = await buatFolderKeuangan(token);
      }

      let adaPerubahan = false;
      let listTrx = [...transaksiRef.current];

      for (const item of antrean) {
        try {
          const targetFolder = await dapatkanFolderBuktiTarget(token, folder.id, item.dana);
          const hasilUnggah = await unggahBuktiKeDrive(
            token,
            targetFolder.id,
            item.blob,
            item.namaFile,
            item.tipe
          );

          // Update transaksi bersangkutan
          listTrx = listTrx.map((t) => {
            if (t.id === item.trxId && t.bukti) {
              const buktiTerupdate = t.bukti.map((b) =>
                b.id === item.id
                  ? { ...b, driveId: hasilUnggah.driveId, driveLink: hasilUnggah.driveLink }
                  : b
              );
              return { ...t, bukti: buktiTerupdate, diubah: new Date().toISOString() };
            }
            return t;
          });

          await hapusBuktiOffline(item.id);
          adaPerubahan = true;
        } catch (errUpload) {
          console.warn(`Gagal memproses antrean bukti ${item.id}:`, errUpload);
        }
      }

      if (adaPerubahan) {
        perbaruiTransaksi(listTrx);
        jadwalkanAutoSync();
      }
    } catch (err: any) {
      console.warn("Gagal memproses antrean bukti offline:", err);
    }
  }, [jadwalkanAutoSync, perbaruiTransaksi]);

  // Pantau status online/offline untuk otomatis mengirim ulang saat kembali online
  useEffect(() => {
    const handleOnline = () => {
      void prosesAntreanBuktiOffline();
      if (syncPendingRef.current) {
        void jalankanAutoKirimKeDrive();
      }
    };

    const handleOffline = () => {
      if (syncPendingRef.current) {
        setSyncStatus({ pesan: "Belum tersinkron", status: "tunggu" });
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [jalankanAutoKirimKeDrive, prosesAntreanBuktiOffline]);

  const handleTarikDariDrive = async (isAuto = false) => {
    let token = await getAccessToken();
    if (!token) {
      if (isAuto) return;
      token = await handleGoogleLogin();
      if (!token) return;
    }

    setMemuatDrive(true);
    setSyncStatus({
      pesan: isAuto ? "Menyinkronkan data dari Google Drive…" : "Menarik data dari folder Keuangan Google Drive…",
      status: "kerja",
    });

    try {
      const res = await tarikSemuaDariDrive(
        token,
        transaksiRef.current,
        asetRef.current,
        hargaRef.current
      );

      perbaruiTransaksi(res.transaksi);
      perbaruiAset(res.aset);
      perbaruiHargaState(res.harga);
      setDriveContents(res.contents);

      if (res.pengaturan) {
        setPengaturan(res.pengaturan);
        simpanPengaturan(res.pengaturan);
        if (typeof res.pengaturan.anggaranHarian === "number" && res.pengaturan.anggaranHarian > 0) {
          setAnggaran(res.pengaturan.anggaranHarian);
          tulisStorage(BUDGET_KEY, String(res.pengaturan.anggaranHarian));
        }
        if (Array.isArray(res.pengaturan.utangPiutang)) {
          setDaftarUtangPiutang(res.pengaturan.utangPiutang);
          simpanUtangPiutang(res.pengaturan.utangPiutang);
        }
        if (Array.isArray(res.pengaturan.targetTabungan)) {
          setDaftarTargetTabungan(res.pengaturan.targetTabungan);
          simpanTargetTabungan(res.pengaturan.targetTabungan);
        }
        if (res.pengaturan.appLock) {
          setAppLockConfig(res.pengaturan.appLock);
          simpanAppLock(res.pengaturan.appLock);
        }
      }

      if (res.laporanKegiatan) {
        if (res.laporanKegiatan.profilPelapor) {
          setProfilPelapor(res.laporanKegiatan.profilPelapor);
        }
        if (Array.isArray(res.laporanKegiatan.daftarKegiatan)) {
          setDaftarKegiatan(res.laporanKegiatan.daftarKegiatan);
        }
        // Muat ulang transaksi lokal jika rincian kegiatan disinkronkan
        perbaruiTransaksi(muatTransaksi());
      }

      if (res.transaksi.length > 0) {
        const blnTerbaru = res.transaksi[0].tanggal.slice(0, 7);
        const adaDiBulanIni = res.transaksi.some((t) => t.tanggal.startsWith(bulanTerpilih));
        if (!adaDiBulanIni && blnTerbaru) {
          setBulanTerpilih(blnTerbaru);
        }
      }

      const pesanSukses = `Sinkronisasi berhasil: ${res.totalTrxDitarik} transaksi, ${res.totalAsetDitarik} aset, dan pengaturan ditarik dari folder 'Keuangan' Google Drive.`;
      setSyncPesan(pesanSukses);
      setSyncStatus({ pesan: "Data tersinkron dari Google Drive", status: "sukses" });
      setTimeout(() => {
        setSyncStatus((prev) => (prev.status === "sukses" ? { pesan: "", status: "idle" } : prev));
      }, 4000);
    } catch (err: any) {
      const msg = `Gagal menarik dari Drive: ${err.message}`;
      setSyncPesan(msg);
      setSyncStatus({
        pesan: isAuto ? "Belum tersinkron" : `Sinkron Drive gagal: ${err.message}`,
        status: "gagal",
      });
    } finally {
      setMemuatDrive(false);
    }
  };

  // Firebase Google Auth Listener & Auto-pull saat aplikasi dibuka jika sudah login
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        if (token) {
          void periksaDriveOtomatis(token);
          void prosesAntreanBuktiOffline();
          // Saat aplikasi dibuka dan sudah login, tarik data sekali otomatis
          if (!initialPullDoneRef.current) {
            initialPullDoneRef.current = true;
            if (navigator.onLine) {
              void handleTarikDariDrive(true);
            } else {
              setSyncStatus({ pesan: "Belum tersinkron", status: "tunggu" });
            }
          }
        }
      },
      (alasan) => {
        setGoogleUser(null);
        setDriveContents(null);
        if (alasan) {
          setSyncPesan(alasan);
        }
      }
    );
    return () => unsubscribe();
  }, [periksaDriveOtomatis, prosesAntreanBuktiOffline]);

  const handleGoogleLogin = async (): Promise<string | null> => {
    setGoogleLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setSyncStatus({ pesan: "Terhubung ke Google Drive", status: "sukses" });
        await periksaDriveOtomatis(res.accessToken);
        void prosesAntreanBuktiOffline();
        return res.accessToken;
      }
      return null;
    } catch (err: any) {
      setSyncPesan(`Login Google gagal: ${err.message}`);
      setSyncStatus({ pesan: `Login Google gagal: ${err.message}`, status: "gagal" });
      return null;
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setDriveContents(null);
    setSyncPesan("Koneksi akun Google diputuskan.");
    setSyncStatus({ pesan: "", status: "idle" });
  };

  const handleKirimKeDrive = async () => {
    let token = await getAccessToken();
    if (!token) {
      token = await handleGoogleLogin();
      if (!token) return;
    }

    // Konfirmasi eksplisit untuk tombol manual
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menyinkronkan data lokal ke folder 'Keuangan' di Google Drive?\n\nTindakan ini akan memperbarui:\n- ${transaksi.length} transaksi ke spreadsheet per tahun\n- ${aset.length} aset ke file Aset.json\n- Anggaran & pengaturan ke file Pengaturan.json\n- Data kegiatan & pelapor ke file Laporan Kegiatan.json\n\nLanjutkan pembaruan?`
    );
    if (!confirmed) return;

    setMemuatDrive(true);
    setSyncStatus({ pesan: "Menulis data ke folder Keuangan di Google Drive…", status: "kerja" });

    try {
      let folder = await cariFolderKeuangan(token);
      if (!folder) {
        const buat = window.confirm(
          "Folder 'Keuangan' belum ada di Google Drive Anda. Buat folder baru 'Keuangan' sekarang?"
        );
        if (!buat) return;
        folder = await buatFolderKeuangan(token);
      }

      const res = await kirimSemuaKeDrive(
        token,
        transaksi,
        aset,
        pengaturan,
        muatLaporanKegiatanFile()
      );
      syncPendingRef.current = false;

      const contents = await ambilIsiFolderKeuangan(token, folder.id);
      setDriveContents(contents);

      setSyncPesan(
        `Berhasil disimpan ke Google Drive: ${res.jumlahTrx} transaksi diperbarui di spreadsheet, ${res.jumlahAset} aset disimpan di Aset.json, Pengaturan.json diperbarui, dan Laporan Kegiatan.json disinkronkan.`
      );
      setSyncStatus({ pesan: "Data tersimpan di Google Drive", status: "sukses" });
      setTimeout(() => setSyncStatus({ pesan: "", status: "idle" }), 4000);
    } catch (err: any) {
      setSyncPesan(`Gagal menyimpan ke Google Drive: ${err.message}`);
      setSyncStatus({ pesan: `Simpan ke Drive gagal: ${err.message}`, status: "gagal" });
    } finally {
      setMemuatDrive(false);
    }
  };

  const handleSimpanProfilPelapor = useCallback((p: ProfilPelapor) => {
    setProfilPelapor(p);
    simpanProfilPelapor(p);
    jadwalkanAutoSync();
  }, [jadwalkanAutoSync]);

  const handleTambahKegiatan = useCallback((kegiatan: DataKegiatan) => {
    setDaftarKegiatan((prev) => {
      const baru = [...prev.filter((k) => k.id !== kegiatan.id), kegiatan];
      simpanDaftarKegiatan(baru);
      return baru;
    });
    jadwalkanAutoSync();
  }, [jadwalkanAutoSync]);

  // Transaction CRUD handlers dengan field diubah dan auto-sync
  const handleSimpanTransaksi = (t: Transaksi | Transaksi[]) => {
    const listBaru = Array.isArray(t) ? t : [t];
    const daftarTerupdate = listBaru.map((item) => ({
      ...item,
      diubah: new Date().toISOString(),
    }));

    let hasilTransaksi = [...transaksi];
    for (const item of daftarTerupdate) {
      const idx = hasilTransaksi.findIndex((x) => x.id === item.id);
      if (idx >= 0) {
        hasilTransaksi[idx] = item;
      } else {
        hasilTransaksi = [item, ...hasilTransaksi];
      }
    }

    perbaruiTransaksi(hasilTransaksi);
    setEditTransaksi(null);
    setCurrentView("riwayat");
    jadwalkanAutoSync();
    for (const item of daftarTerupdate) {
      void prosesUnggahBuktiTransaksi(item);
    }
  };

  const handleHapusTransaksi = (id: string) => {
    const target = transaksi.find((t) => t.id === id);
    const idsToHapus = [id];
    if (target?.pasanganId) {
      const pasangan = transaksi.find((t) => t.pasanganId === target.pasanganId && t.id !== id);
      if (pasangan) {
        idsToHapus.push(pasangan.id);
      }
    }

    idsToHapus.forEach((hId) => tambahIdTerhapus(hId));
    const baru = transaksi.filter((t) => !idsToHapus.includes(t.id));
    perbaruiTransaksi(baru);
    jadwalkanAutoSync();
  };

  const handleToggleStatusTalangan = (id: string) => {
    const target = transaksi.find((t) => t.id === id);
    if (!target) return;
    const statusBaru: "belum_diganti" | "sudah_diganti" =
      target.statusTalangan === "sudah_diganti" ? "belum_diganti" : "sudah_diganti";

    const baru: Transaksi[] = transaksi.map((t) => {
      if (t.id === id || (target.pasanganId && t.pasanganId === target.pasanganId)) {
        return {
          ...t,
          statusTalangan: statusBaru,
          diubah: new Date().toISOString(),
        };
      }
      return t;
    });

    perbaruiTransaksi(baru);
    jadwalkanAutoSync();
  };

  const handleMulaiEditTransaksi = (t: Transaksi) => {
    setEditTransaksi(t);
    setCurrentView("tambah");
  };

  // Otomatis sinkronkan Aset.json ke Google Drive saat ada perubahan jika sesi aktif
  const autoSimpanAsetKeDrive = useCallback(
    async (asetTerbaru: AsetItem[]) => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const status = cekStatusSesiGoogle();
        if (!status.aktif) return;

        let folderId = driveContents?.folder?.id;
        if (!folderId) {
          const folder = await cariFolderKeuangan(token);
          if (folder) folderId = folder.id;
        }

        if (folderId) {
          const fileAsetId = await simpanAsetKeDrive(
            token,
            folderId,
            driveContents?.fileAset?.id || null,
            asetTerbaru
          );
          if (driveContents && !driveContents.fileAset) {
            setDriveContents({
              ...driveContents,
              fileAset: { id: fileAsetId, name: "Aset.json", mimeType: "application/json" },
            });
          }
          setSyncStatus({ pesan: "Aset tersinkron otomatis ke Google Drive", status: "sukses" });
          setTimeout(() => setSyncStatus({ pesan: "", status: "idle" }), 2500);
        }
      } catch (e: any) {
        console.warn("Auto-sync aset ke Drive:", e.message);
      }
    },
    [driveContents]
  );

  // Asset CRUD handlers
  const handleTambahAset = (item: AsetItem) => {
    const baru = [...aset, item];
    perbaruiAset(baru);
    void autoSimpanAsetKeDrive(baru);
    if (item.jenis === "crypto" || item.jenis === "emas") {
      setTimeout(() => {
        void perbaruiHargaPasar();
      }, 50);
    }
  };

  const handleUbahAset = (item: AsetItem) => {
    const baru = aset.map((a) => (a.id === item.id ? item : a));
    perbaruiAset(baru);
    void autoSimpanAsetKeDrive(baru);
    if (item.jenis === "crypto" || item.jenis === "emas") {
      setTimeout(() => {
        void perbaruiHargaPasar();
      }, 50);
    }
  };

  const handleHapusAset = (id: string) => {
    const baru = aset.filter((a) => a.id !== id);
    perbaruiAset(baru);
    void autoSimpanAsetKeDrive(baru);
  };

  const handleSimpanHargaManual = (jual: number, buyback?: number) => {
    const baru: DataHarga = {
      ...harga,
      manual: {
        emas: {
          jual,
          buyback,
          waktu: new Date().toISOString(),
        },
      },
      waktu: new Date().toISOString(),
    };
    perbaruiHargaState(baru);
  };

  const handleSetAnggaran = (nilai: number) => {
    setAnggaran(nilai);
    tulisStorage(BUDGET_KEY, String(nilai));
    const baruPengaturan: PengaturanKeuangan = {
      ...pengaturan,
      anggaranHarian: nilai,
      diubah: new Date().toISOString(),
    };
    setPengaturan(baruPengaturan);
    simpanPengaturan(baruPengaturan);
    jadwalkanAutoSync();
  };

  const handleSetAnggaranKategori = (dana: NamaDana, kategori: string, nilai: number) => {
    const baruPengaturan: PengaturanKeuangan = {
      ...pengaturan,
      anggaranKategori: {
        ...(pengaturan.anggaranKategori || { "Dana Pribadi": {}, "Dana Kegiatan": {} }),
        [dana]: {
          ...(pengaturan.anggaranKategori?.[dana] || {}),
          [kategori]: nilai,
        },
      },
      diubah: new Date().toISOString(),
    };
    setPengaturan(baruPengaturan);
    simpanPengaturan(baruPengaturan);
    jadwalkanAutoSync();
  };

  const handleSimpanUtangPiutang = (item: ItemHutangPiutang) => {
    const ada = daftarUtangPiutang.some((x) => x.id === item.id);
    const baru = ada
      ? daftarUtangPiutang.map((x) => (x.id === item.id ? item : x))
      : [item, ...daftarUtangPiutang];
    setDaftarUtangPiutang(baru);
    simpanUtangPiutang(baru);

    const pengaturanBaru: PengaturanKeuangan = {
      ...pengaturan,
      utangPiutang: baru,
      diubah: new Date().toISOString(),
    };
    setPengaturan(pengaturanBaru);
    simpanPengaturan(pengaturanBaru);
    jadwalkanAutoSync();
  };

  const handleHapusUtangPiutang = (id: string) => {
    const baru = daftarUtangPiutang.filter((x) => x.id !== id);
    setDaftarUtangPiutang(baru);
    simpanUtangPiutang(baru);

    const pengaturanBaru: PengaturanKeuangan = {
      ...pengaturan,
      utangPiutang: baru,
      diubah: new Date().toISOString(),
    };
    setPengaturan(pengaturanBaru);
    simpanPengaturan(pengaturanBaru);
    jadwalkanAutoSync();
  };

  const handleSimpanTargetTabungan = (item: TargetTabunganItem) => {
    const ada = daftarTargetTabungan.some((x) => x.id === item.id);
    const baru = ada
      ? daftarTargetTabungan.map((x) => (x.id === item.id ? item : x))
      : [item, ...daftarTargetTabungan];
    setDaftarTargetTabungan(baru);
    simpanTargetTabungan(baru);

    const pengaturanBaru: PengaturanKeuangan = {
      ...pengaturan,
      targetTabungan: baru,
      diubah: new Date().toISOString(),
    };
    setPengaturan(pengaturanBaru);
    simpanPengaturan(pengaturanBaru);
    jadwalkanAutoSync();
  };

  const handleHapusTargetTabungan = (id: string) => {
    const baru = daftarTargetTabungan.filter((x) => x.id !== id);
    setDaftarTargetTabungan(baru);
    simpanTargetTabungan(baru);

    const pengaturanBaru: PengaturanKeuangan = {
      ...pengaturan,
      targetTabungan: baru,
      diubah: new Date().toISOString(),
    };
    setPengaturan(pengaturanBaru);
    simpanPengaturan(pengaturanBaru);
    jadwalkanAutoSync();
  };

  const handleSimpanAppLockConfig = (cfg: AppLockConfig) => {
    setAppLockConfig(cfg);
    simpanAppLock(cfg);

    const pengaturanBaru: PengaturanKeuangan = {
      ...pengaturan,
      appLock: cfg,
      diubah: new Date().toISOString(),
    };
    setPengaturan(pengaturanBaru);
    simpanPengaturan(pengaturanBaru);
    jadwalkanAutoSync();
  };

  return (
    <>
      <div className="energi" id="energi" aria-hidden="true" />
      <div className="pulsa" id="pulsa" aria-hidden="true" />

      <div className="app-layout">
        <aside className="sidebar" aria-label="Bilah navigasi samping">
          <Sidebar
            currentView={currentView === "tambah" ? lastActiveTab : currentView}
            onSelectView={(v) => {
              if (editTransaksi) setEditTransaksi(null);
              setCurrentView(v);
              setLastActiveTab(v);
              window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
            }}
            onBukaMenuTambah={() => {
              setEditTransaksi(null);
              setInitialScanMode(null);
              setCurrentView("tambah");
            }}
            karakter={karakter}
          />
        </aside>

        <div className="main-content-wrapper">
          <Topbar
            karakter={karakter}
            bulanTerpilih={bulanTerpilih}
            onPilihBulan={setBulanTerpilih}
            transaksi={transaksi}
          />

          <main className="container">
            {(currentView === "riwayat" || (currentView === "tambah" && lastActiveTab === "riwayat")) && (
              <div className={currentView === "tambah" ? "view-bg-pc-only" : undefined}>
                <RiwayatView
                  transaksi={transaksi}
                  bulanTerpilih={bulanTerpilih}
                  anggaran={anggaran}
                  syncStatus={syncStatus}
                  onEdit={handleMulaiEditTransaksi}
                  onDelete={handleHapusTransaksi}
                  onToggleStatusTalangan={handleToggleStatusTalangan}
                  onGeserBulan={(delta) => {
                    const [th, bl] = bulanTerpilih.split("-").map(Number);
                    const d = new Date(th, bl - 1 + delta, 1);
                    setBulanTerpilih(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
                    );
                  }}
                  onBukaTransaksiBerulang={() => setModalBerulangBuka(true)}
                  jumlahJatuhTempo={jumlahJatuhTempo}
                  daftarUtangPiutang={daftarUtangPiutang}
                  onSimpanUtangPiutang={handleSimpanUtangPiutang}
                  onHapusUtangPiutang={handleHapusUtangPiutang}
                  daftarTargetTabungan={daftarTargetTabungan}
                  onSimpanTargetTabungan={handleSimpanTargetTabungan}
                  onHapusTargetTabungan={handleHapusTargetTabungan}
                  onBukaTambahTabungan={(targetId, targetNama) => {
                    setTargetTabunganAwalId(targetId);
                    setEditTransaksi(null);
                    setInitialScanMode(null);
                    setCurrentView("tambah");
                  }}
                />
              </div>
            )}

            {(currentView === "aset" || (currentView === "tambah" && lastActiveTab === "aset")) && (
              <div className={currentView === "tambah" ? "view-bg-pc-only" : undefined}>
                <AsetView
                  aset={aset}
                  harga={harga}
                  onTambahAset={handleTambahAset}
                  onUbahAset={handleUbahAset}
                  onHapusAset={handleHapusAset}
                  onPerbaruiHarga={perbaruiHargaPasar}
                  onSimpanHargaManual={handleSimpanHargaManual}
                  memuatHarga={memuatHarga}
                  googleUser={googleUser}
                  onTarikDrive={handleTarikDariDrive}
                  onKirimDrive={handleKirimKeDrive}
                  memuatDrive={memuatDrive}
                />
              </div>
            )}

            {(currentView === "grafik" || (currentView === "tambah" && lastActiveTab === "grafik")) && (
              <div className={currentView === "tambah" ? "view-bg-pc-only" : undefined}>
                <GrafikView
                  transaksi={transaksi}
                  bulanTerpilih={bulanTerpilih}
                  anggaran={anggaran}
                  onSetAnggaran={handleSetAnggaran}
                  anggaranKategori={pengaturan.anggaranKategori}
                  onSetAnggaranKategori={handleSetAnggaranKategori}
                  profilPelapor={profilPelapor}
                  daftarKegiatan={daftarKegiatan}
                />
              </div>
            )}

            {(currentView === "saya" || (currentView === "tambah" && lastActiveTab === "saya")) && (
              <div className={currentView === "tambah" ? "view-bg-pc-only" : undefined}>
                <SayaView
                  tema={tema}
                  karakter={karakter}
                  onGantiTema={setTema}
                  onGantiKarakter={setKarakter}
                  googleUser={googleUser}
                  googleLoading={googleLoading}
                  onGoogleLogin={async () => {
                    await handleGoogleLogin();
                  }}
                  onGoogleLogout={handleGoogleLogout}
                  driveContents={driveContents}
                  memuatDrive={memuatDrive}
                  onPeriksaDrive={async () => {
                    const token = await getAccessToken();
                    if (token) await periksaDriveOtomatis(token);
                    else alert("Silakan masuk dengan Google terlebih dahulu.");
                  }}
                  onTarikDariDrive={handleTarikDariDrive}
                  onKirimKeDrive={handleKirimKeDrive}
                  transaksi={transaksi}
                  aset={aset}
                  syncStatusPesan={syncPesan}
                  onBukaTransaksiBerulang={() => setModalBerulangBuka(true)}
                  jumlahTransaksiBerulang={daftarBerulang.filter((d) => d.aktif).length}
                  appLockConfig={appLockConfig}
                  onSimpanAppLockConfig={handleSimpanAppLockConfig}
                  profilPelapor={profilPelapor}
                  onSimpanProfilPelapor={handleSimpanProfilPelapor}
                />
              </div>
            )}

            {currentView === "tambah" && (
              <TambahView
                editTransaksi={editTransaksi}
                onSimpan={(trx) => {
                  handleSimpanTransaksi(trx);
                  setTargetTabunganAwalId("");
                  setCurrentView(lastActiveTab);
                }}
                onBatalEdit={() => {
                  setEditTransaksi(null);
                  setInitialScanMode(null);
                  setTargetTabunganAwalId("");
                  setCurrentView(lastActiveTab);
                }}
                initialScanMode={initialScanMode}
                onResetInitialScanMode={() => setInitialScanMode(null)}
                onBukaTransaksiBerulang={() => setModalBerulangBuka(true)}
                jumlahJatuhTempo={jumlahJatuhTempo}
                daftarBerulang={daftarBerulang}
                daftarTransaksi={transaksi}
                daftarTargetTabungan={daftarTargetTabungan}
                targetTabunganAwalId={targetTabunganAwalId}
                daftarKegiatan={daftarKegiatan}
                onTambahKegiatan={handleTambahKegiatan}
              />
            )}
          </main>
        </div>
      </div>

      <Navbar
        currentView={currentView}
        onSelectView={(v) => {
          if (v === "tambah" && editTransaksi) {
            setEditTransaksi(null);
          }
          setCurrentView(v);
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        }}
        onBukaMenuTambah={() => setModalPilihanTambahBuka(true)}
      />

      {/* Modal Pilihan Pengisian Struk Belanja / Transaksi saat Ikon Plus Ditekan */}
      {modalPilihanTambahBuka && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setModalPilihanTambahBuka(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "440px",
              width: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>➕</span> Tambah Transaksi
              </h3>
              <button
                type="button"
                className="btn-ikon"
                onClick={() => setModalPilihanTambahBuka(false)}
                style={{ fontSize: "1.3rem", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <p className="help" style={{ margin: "0 0 16px", fontSize: "0.85rem" }}>
              Pilih metode pencatatan pengeluaran:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                className="btn-pilihan-tambah"
                onClick={() => {
                  setModalPilihanTambahBuka(false);
                  setInitialScanMode("kamera");
                  setEditTransaksi(null);
                  setCurrentView("tambah");
                }}
              >
                <span className="pilihan-ikon">📸</span>
                <div className="pilihan-teks">
                  <strong>Ambil Foto Struk (Kamera)</strong>
                  <span>Foto struk kasir, dibaca &amp; diinput otomatis oleh Gemini AI</span>
                </div>
                <span className="pilihan-panah">→</span>
              </button>

              <button
                type="button"
                className="btn-pilihan-tambah"
                onClick={() => {
                  setModalPilihanTambahBuka(false);
                  setInitialScanMode("galeri");
                  setEditTransaksi(null);
                  setCurrentView("tambah");
                }}
              >
                <span className="pilihan-ikon">🖼️</span>
                <div className="pilihan-teks">
                  <strong>Unggah Foto Struk (Galeri)</strong>
                  <span>Pilih foto struk belanja yang ada di galeri ponsel Anda</span>
                </div>
                <span className="pilihan-panah">→</span>
              </button>

              <button
                type="button"
                className="btn-pilihan-tambah manual"
                onClick={() => {
                  setModalPilihanTambahBuka(false);
                  setInitialScanMode(null);
                  setEditTransaksi(null);
                  setCurrentView("tambah");
                }}
              >
                <span className="pilihan-ikon">✍️</span>
                <div className="pilihan-teks">
                  <strong>Isi Formulir Manual</strong>
                  <span>Ketik nominal, kategori, dan uraian secara manual</span>
                </div>
                <span className="pilihan-panah">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <TransaksiBerulangModal
        isOpen={modalBerulangBuka}
        onClose={() => setModalBerulangBuka(false)}
        daftarBerulang={daftarBerulang}
        onSimpanDaftar={(daftar) => {
          setDaftarBerulang(daftar);
          simpanTransaksiBerulang(daftar);
        }}
        onTambahTransaksi={(t) => {
          handleSimpanTransaksi(t);
        }}
      />

      {/* Layar Kunci Aplikasi (PIN 4–6 digit & WebAuthn Biometrik) */}
      {isAppLocked && appLockConfig.enabled && (
        <AppLockModal
          config={appLockConfig}
          karakter={karakter}
          onUnlock={() => setIsAppLocked(false)}
        />
      )}
    </>
  );
}
