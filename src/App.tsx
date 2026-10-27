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
  ItemPenyusutan,
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
  bacaJsonStorage,
  simpanIndeksTimesheet,
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
import { adalahPemasukanPerdiemOtomatis, cariPasanganPerdiem } from "./lib/perdiemOtomatis";
import { apakahJatuhTempo, buatTransaksiDariBerulang, formatTanggalIso, tanggalJadwalSaatIni } from "./lib/transaksiBerulang";
import { TOKOH_TEMA } from "./lib/tokohTema";
import { useGesekMenu } from "./lib/useGesekMenu";
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
  perbaruiTokenDrive,
  cekStatusSesiGoogle,
  ambilDaftarAkun,
  ambilAkunAktif,
  beralihAkunGoogle,
  hapusAkunDariDaftar,
  AkunGoogleTersimpan,
} from "./lib/googleAuth";
import {
  cariFolderKeuangan,
  ambilIsiFolderKeuangan,
  pastikanFolderKeuangan,
  kirimSemuaKeDrive,
  tarikSemuaDariDrive,
  simpanAsetKeDrive,
  dapatkanFolderBuktiTarget,
  unggahBuktiKeDrive,
  KeuanganDriveContents,
  dapatkanFolderLaporanKegiatan,
  simpanDocxLaporanKeDrive,
  sudahTarikLengkap,
  resetStatusTarik,
  daftarkanTokenRefresher,
} from "./lib/gdriveSync";
import { buatDokumenLaporanKegiatanDocx } from "./lib/docxGenerator";
import { batchKegiatan, cariCatatanMencurigakan, cariTransaksiNyasarTimesheet } from "./lib/timesheet";
import { KartuCatatanMencurigakan } from "./components/KartuCatatanMencurigakan";
import { DataGandaModal, KartuDataGanda } from "./components/DataGandaModal";
import { cariDataGanda } from "./lib/dataGanda";
import { bersihkanDataPerangkat } from "./lib/bersihkanPerangkat";
import { periksaKeberadaanFolder, ringkasSetup, siapkanFolderKeuangan } from "./lib/setupDrive";
import { kumpulkanKeteranganTimesheet, siapkanTimesheetKegiatan, tarikTimesheetSemuaKegiatan } from "./lib/timesheetDrive";
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
import { DialogDepresiasi, ModeDialogDepresiasi } from "./components/DialogDepresiasi";
import { itemPerluPeringatan } from "./lib/penyusutan";
import { nilaiTawaranDepresiasi } from "./lib/tawaranDepresiasi";
import { TransaksiBerulangModal } from "./components/TransaksiBerulangModal";
import { AppLockModal } from "./components/AppLockModal";
import { hapusTotp } from "./lib/totp";

/** Kegiatan yang selesai sebelum tanggal ini dianggap lama: file timesheet-nya tidak dibuat otomatis. */
const KUNCI_JEJAK_TIMESHEET = "keuangan-jejak-timesheet";
const KUNCI_MENCURIGAKAN_DIABAIKAN = "keuangan-mencurigakan-diabaikan";
const KUNCI_GANDA_DIABAIKAN = "keuangan-ganda-diabaikan";

const tanggalBatasKegiatanLama = () => new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

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
  // Jadwal rutin yang transaksinya untuk periode ini belum ada: hanya inilah yang diingatkan di Riwayat.
  const rutinBelumDicatat = daftarBerulang.filter((d) => apakahJatuhTempo(d, transaksi));
  const jumlahPerhatianDepresiasi = itemPerluPeringatan(pengaturan.penyusutan ?? [], hariIni()).length;

  const [tema, setTema] = useState<TemaId>(() => (bacaStorage(TEMA_KEY, "jujutsu") as TemaId) || "jujutsu");
  const [karakter, setKarakter] = useState<KarakterId>(
    () => (bacaStorage(KARAKTER_KEY, "gojo") as KarakterId) || "gojo"
  );

  const [currentView, setCurrentView] = useState<ViewTab>("riwayat");
  // Arah geser terakhir (bila pindah menu dengan menggeser jari), untuk animasi masuk halaman.
  const [arahGeser, setArahGeser] = useState<"kiri" | "kanan" | null>(null);
  const [lastActiveTab, setLastActiveTab] = useState<ViewTab>("riwayat");

  useEffect(() => {
    if (currentView !== "tambah") {
      setLastActiveTab(currentView);
    }
  }, [currentView]);
  const [bulanTerpilih, setBulanTerpilih] = useState<string>(() => hariIni().slice(0, 7));
  const [editTransaksi, setEditTransaksi] = useState<Transaksi | null>(null);
  // Tawaran "hitung depresiasi?" setelah pembelian barang tahan lama dicatat, dan permintaan membuka layar Depresiasi Aset di tab Saya.
  const [dialogDepresiasi, setDialogDepresiasi] = useState<ModeDialogDepresiasi | null>(null);
  const [bukaDepresiasiSaya, setBukaDepresiasiSaya] = useState(false);
  // True bila transaksi yang diubah dialihkan dari pemasukan pribadi otomatis ke perdiem Dana Kegiatan-nya.
  const [editDialihkanDariPerdiem, setEditDialihkanDariPerdiem] = useState(false);

  // Google Drive Direct Sync States
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string>("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [daftarAkunGoogle, setDaftarAkunGoogle] = useState<AkunGoogleTersimpan[]>(() => ambilDaftarAkun());
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

  // Geser jari ke kiri/kanan untuk pindah menu (urutan sama dengan navigasi bawah, tanpa tombol tambah).
  useGesekMenu(currentView !== "tambah" && !modalPilihanTambahBuka, (arah) => {
    const urutan: ViewTab[] = ["riwayat", "aset", "grafik", "saya"];
    const tujuan = urutan[urutan.indexOf(currentView) + arah];
    if (!tujuan || (isAppLocked && appLockConfig.enabled)) return;
    setArahGeser(arah === 1 ? "kiri" : "kanan");
    setCurrentView(tujuan);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  });

  // Arah geser hanya dibutuhkan selama animasi masuk halaman; setelah itu dihapus agar tidak terulang di halaman lain.
  useEffect(() => {
    if (!arahGeser) return;
    const jeda = window.setTimeout(() => setArahGeser(null), 450);
    return () => window.clearTimeout(jeda);
  }, [arahGeser, currentView]);

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
  // Ref ikut diperbarui seketika (bukan menunggu render berikutnya), supaya langkah kirim yang menyusul tarik data
  // dalam satu rangkaian sinkronisasi selalu memakai hasil gabungan terbaru.
  const perbaruiTransaksi = useCallback((baru: Transaksi[]) => {
    transaksiRef.current = baru;
    setTransaksi(baru);
    simpanTransaksi(baru);
  }, []);

  const perbaruiAset = useCallback((baru: AsetItem[]) => {
    asetRef.current = baru;
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
  const profilPelaporRef = React.useRef(profilPelapor);
  profilPelaporRef.current = profilPelapor;
  const daftarKegiatanRef = React.useRef(daftarKegiatan);
  daftarKegiatanRef.current = daftarKegiatan;

  const autoSyncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSyncDocxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDocxKegiatanIdsRef = React.useRef<Set<string>>(new Set());
  // Keterangan hari di semua file timesheet (diambil saat tarik dari Drive), untuk mengenali transaksi nyasar dari file itu.
  const [jejakTimesheet, setJejakTimesheet] = useState<string[]>(() => {
    const data = bacaJsonStorage<string[]>(KUNCI_JEJAK_TIMESHEET, []);
    return Array.isArray(data) ? data.filter((x) => typeof x === "string") : [];
  });
  // Catatan mencurigakan yang sudah dipilih "Biarkan" oleh pengguna tidak ditanyakan lagi.
  const [mencurigakanDiabaikan, setMencurigakanDiabaikan] = useState<string[]>(() => {
    const data = bacaJsonStorage<string[]>(KUNCI_MENCURIGAKAN_DIABAIKAN, []);
    return Array.isArray(data) ? data : [];
  });
  // Kelompok catatan kembar yang dipilih "Biarkan": dikenali dari ID anggotanya, jadi kembaran baru tetap ditanyakan.
  const [gandaDiabaikan, setGandaDiabaikan] = useState<string[]>(() => {
    const data = bacaJsonStorage<string[]>(KUNCI_GANDA_DIABAIKAN, []);
    return Array.isArray(data) ? data : [];
  });
  const [modalGandaBuka, setModalGandaBuka] = useState(false);
  const autoTimesheetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimesheetIdsRef = React.useRef<Set<string>>(new Set());
  // Kegiatan yang sudah dicoba disiapkan file timesheet-nya pada sesi ini, supaya perubahan kecil tidak mengulang.
  const percobaanTimesheetRef = React.useRef<Set<string>>(new Set());
  const syncPendingRef = React.useRef<boolean>(false);
  const initialPullDoneRef = React.useRef<boolean>(false);
  // Diisi setelah handleTarikDariDrive dan jadwalkanAutoSync didefinisikan (keduanya dibuat sesudah jalankanAutoKirimKeDrive).
  const tarikDuluRef = React.useRef<((auto?: boolean) => Promise<void>) | null>(null);
  const jadwalkanAutoSyncRef = React.useRef<(() => void) | null>(null);

  // Mengembalikan true bila folder Keuangan baru saja dibuat (isinya masih kosong, jadi tidak ada yang perlu ditarik).
  const periksaDriveOtomatis = useCallback(async (token: string): Promise<boolean> => {
    setMemuatDrive(true);
    try {
      let folder = await cariFolderKeuangan(token);
      if (!folder) {
        // Belum ada folder (mis. aplikasi baru dipasang): siapkan otomatis, tetapi hanya bila pencarian benar-benar
        // berhasil dan folder memang tidak ada, supaya gangguan sesaat tidak membuat folder Keuangan kedua.
        const ada = await periksaKeberadaanFolder(token);
        if (ada.status === "tidak-ada") {
          const hasil = await siapkanFolderKeuangan(token);
          setDriveContents(hasil.contents);
          setSyncPesan(ringkasSetup(hasil));
          setSyncStatus({ pesan: "Folder Keuangan disiapkan otomatis di Google Drive", status: "sukses" });
          setTimeout(() => setSyncStatus((prev) => (prev.status === "sukses" ? { pesan: "", status: "idle" } : prev)), 6000);
          return true;
        }
        setSyncPesan(
          ada.status === "galat"
            ? `Folder 'Keuangan' belum bisa diperiksa: ${ada.pesan}. Coba lagi sebentar lagi.`
            : "Folder 'Keuangan' belum ditemukan di Google Drive Anda."
        );
        setDriveContents(null);
        return false;
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
    return false;
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

    // Pasang ulang atau sesi baru: data lokal bisa kosong atau belum lengkap. Tarik dulu; kirim baru dijadwalkan setelah itu
    // (supaya state hasil tarik sudah terpasang), jadi isi Drive tidak pernah tertimpa data lokal yang belum lengkap.
    if (!sudahTarikLengkap()) {
      setSyncStatus({ pesan: "Menarik data dari Drive dulu…", status: "kerja" });
      await tarikDuluRef.current?.(true);
      if (sudahTarikLengkap()) {
        jadwalkanAutoSyncRef.current?.();
      } else {
        syncPendingRef.current = true;
        setSyncStatus({ pesan: "Belum tersinkron", status: "gagal" });
      }
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
  jadwalkanAutoSyncRef.current = jadwalkanAutoSync;

  // Otomatis buat dan perbarui dokumen Word SPJ di Drive: Keuangan / Laporan Kegiatan / "Laporan Keuangan – <nama kegiatan>.docx" (jeda ±10 detik)
  const jalankanAutoSyncDocxKegiatan = useCallback(async () => {
    let token = await getAccessToken();
    if (!token) return;
    const statusSesi = cekStatusSesiGoogle();
    if (!statusSesi.aktif || !navigator.onLine) return;

    const targetIds = Array.from(pendingDocxKegiatanIdsRef.current);
    pendingDocxKegiatanIdsRef.current.clear();
    if (targetIds.length === 0) return;

    try {
      let folderKeuangan = await cariFolderKeuangan(token);
      if (!folderKeuangan) {
        folderKeuangan = (await pastikanFolderKeuangan(token)).folder;
      }
      const folderLaporan = await dapatkanFolderLaporanKegiatan(token, folderKeuangan.id);

      for (const kgId of targetIds) {
        const kg = daftarKegiatanRef.current.find((k) => k.id === kgId);
        if (!kg) continue;

        try {
          const blob = await buatDokumenLaporanKegiatanDocx({
            transaksi: transaksiRef.current,
            kegiatan: kg,
            daftarKegiatan: daftarKegiatanRef.current,
            profilPelapor: profilPelaporRef.current,
            urutanTransaksiIds: kg.urutanTransaksi,
            sertakanDaftarPeriksa: kg.sertakanDaftarPeriksa !== false,
            googleToken: token,
          });

          const namaFileDrive = `Laporan Keuangan – ${kg.nama}.docx`;
          const res = await simpanDocxLaporanKeDrive(
            token,
            folderLaporan.id,
            namaFileDrive,
            blob,
            kg.docxDriveId
          );

          if (res.id && res.id !== kg.docxDriveId) {
            setDaftarKegiatan((prev) => {
              const updated = prev.map((item) =>
                item.id === kg.id ? { ...item, docxDriveId: res.id } : item
              );
              simpanDaftarKegiatan(updated);
              return updated;
            });
          }
        } catch (errKg: any) {
          console.warn(`Gagal auto-sync docx kegiatan ${kg.nama}:`, errKg);
        }
      }
    } catch (err: any) {
      console.warn("Gagal sinkron docx laporan kegiatan ke Drive:", err);
    }
  }, []);

  const jadwalkanAutoSyncDocx = useCallback(
    (kegiatanIds: string[]) => {
      kegiatanIds.forEach((id) => pendingDocxKegiatanIdsRef.current.add(id));
      if (autoSyncDocxTimerRef.current) {
        clearTimeout(autoSyncDocxTimerRef.current);
      }
      if (!navigator.onLine) return;

      // Jeda ±10 detik sesuai instruksi
      autoSyncDocxTimerRef.current = setTimeout(() => {
        void jalankanAutoSyncDocxKegiatan();
      }, 10000);
    },
    [jalankanAutoSyncDocxKegiatan]
  );

  // Tiap kegiatan baru (atau kegiatan yang baru diberi batch): pakai file timesheet batch dan tahunnya di folder Keuangan,
  // dan bila belum ada buat salinan dari file timesheet terbaru. Isi Keterangan/Lokasi ditarik dari file itu.
  const jalankanAutoTimesheet = useCallback(async () => {
    const ids = Array.from(pendingTimesheetIdsRef.current);
    pendingTimesheetIdsRef.current.clear();
    if (ids.length === 0) return;
    const token = await getAccessToken();
    if (!token || !cekStatusSesiGoogle().aktif || !navigator.onLine) return;

    try {
      const folder = await cariFolderKeuangan(token);
      if (!folder) return;
      const contents = await ambilIsiFolderKeuangan(token, folder.id);
      let daftar = daftarKegiatanRef.current;
      let berubah = false;
      for (const id of ids) {
        const k = daftar.find((x) => x.id === id);
        if (!k || !batchKegiatan(k)) continue;
        try {
          // File baru hanya dibuat otomatis untuk kegiatan yang batch-nya diisi dan belum lama selesai; kegiatan lama cukup ditarik.
          const bolehBuat = Boolean(k.batch) && k.tanggalSelesai >= tanggalBatasKegiatanLama();
          const h = await siapkanTimesheetKegiatan(token, contents, k, profilPelaporRef.current, transaksiRef.current, daftar, { bolehBuat });
          if (h.kegiatan !== k) {
            daftar = daftar.map((x) => (x.id === k.id ? h.kegiatan : x));
            if (h.berubah) berubah = true;
          }
        } catch (errKg: any) {
          console.warn(`Timesheet kegiatan ${k.nama} belum bisa disiapkan:`, errKg);
        }
      }
      if (daftar !== daftarKegiatanRef.current) {
        setDaftarKegiatan(daftar);
        simpanDaftarKegiatan(daftar);
        if (berubah) {
          jadwalkanAutoSync();
          jadwalkanAutoSyncDocx(ids);
        }
      }
    } catch (err) {
      console.warn("Gagal menyiapkan file timesheet:", err);
    }
  }, [jadwalkanAutoSync, jadwalkanAutoSyncDocx]);

  const jadwalkanAutoTimesheet = useCallback(
    (kegiatan: DataKegiatan) => {
      if (!batchKegiatan(kegiatan) || percobaanTimesheetRef.current.has(kegiatan.id)) return;
      percobaanTimesheetRef.current.add(kegiatan.id);
      pendingTimesheetIdsRef.current.add(kegiatan.id);
      if (autoTimesheetTimerRef.current) clearTimeout(autoTimesheetTimerRef.current);
      if (!navigator.onLine) return;
      autoTimesheetTimerRef.current = setTimeout(() => {
        void jalankanAutoTimesheet();
      }, 4000);
    },
    [jalankanAutoTimesheet]
  );

  // Sisa pembacaan keliru versi lama: baris file timesheet yang masuk sebagai pemasukan Dana Kegiatan yang tidak pernah
  // dicatat. Dikenali dengan ketat (lihat cariTransaksiNyasarTimesheet), dihapus, dan ID-nya dicatat sebagai terhapus.
  useEffect(() => {
    const nyasar = cariTransaksiNyasarTimesheet(transaksi, daftarKegiatan, jejakTimesheet);
    if (nyasar.length === 0) return;
    const ids = new Set(nyasar.map((t) => t.id));
    ids.forEach((id) => tambahIdTerhapus(id));
    perbaruiTransaksi(transaksi.filter((t) => !ids.has(t.id)));
    jadwalkanAutoSync();
    setSyncStatus({ pesan: `${nyasar.length} catatan nyasar dari file timesheet dibersihkan`, status: "sukses" });
    setTimeout(() => setSyncStatus((prev) => (prev.status === "sukses" ? { pesan: "", status: "idle" } : prev)), 6000);
  }, [transaksi, daftarKegiatan, jejakTimesheet, perbaruiTransaksi, jadwalkanAutoSync]);

  const catatanMencurigakan = React.useMemo(
    () => cariCatatanMencurigakan(transaksi).filter((t) => !mencurigakanDiabaikan.includes(t.id)),
    [transaksi, mencurigakanDiabaikan]
  );

  const hapusCatatanMencurigakan = useCallback(() => {
    const ids = new Set(catatanMencurigakan.map((t) => t.id));
    ids.forEach((id) => tambahIdTerhapus(id));
    perbaruiTransaksi(transaksi.filter((t) => !ids.has(t.id)));
    jadwalkanAutoSync();
  }, [catatanMencurigakan, transaksi, perbaruiTransaksi, jadwalkanAutoSync]);

  const abaikanCatatanMencurigakan = useCallback(() => {
    const baru = [...new Set([...mencurigakanDiabaikan, ...catatanMencurigakan.map((t) => t.id)])];
    setMencurigakanDiabaikan(baru);
    tulisStorage(KUNCI_MENCURIGAKAN_DIABAIKAN, JSON.stringify(baru));
  }, [catatanMencurigakan, mencurigakanDiabaikan]);

  const cariIdKegiatanTerdampak = useCallback(
    (daftarTrx: Transaksi[]): string[] => {
      const ids = new Set<string>();
      for (const t of daftarTrx) {
        if (t.kegiatanId) {
          ids.add(t.kegiatanId);
        }
        if (t.dana === "Dana Kegiatan" && t.kaitan) {
          const kg = daftarKegiatanRef.current.find((k) => k.nama === t.kaitan);
          if (kg) ids.add(kg.id);
        }
      }
      return Array.from(ids);
    },
    []
  );

  // Catatan kembar: hanya saran. Dihapus lewat jendela periksa, yang menjaga satu catatan tiap kelompok.
  const tandaKelompokGanda = (ids: string[]) => [...ids].sort().join("+");
  const kelompokGanda = React.useMemo(
    () => cariDataGanda(transaksi).filter((k) => !gandaDiabaikan.includes(tandaKelompokGanda(k.anggota.map((t) => t.id)))),
    [transaksi, gandaDiabaikan]
  );
  const abaikanDataGanda = useCallback(() => {
    const baru = [...new Set([...gandaDiabaikan, ...kelompokGanda.map((k) => tandaKelompokGanda(k.anggota.map((t) => t.id)))])];
    setGandaDiabaikan(baru);
    tulisStorage(KUNCI_GANDA_DIABAIKAN, JSON.stringify(baru));
  }, [kelompokGanda, gandaDiabaikan]);
  const hapusDataGanda = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      const terdampak = cariIdKegiatanTerdampak(transaksi.filter((t) => set.has(t.id)));
      set.forEach((id) => tambahIdTerhapus(id));
      perbaruiTransaksi(transaksi.filter((t) => !set.has(t.id)));
      jadwalkanAutoSync();
      if (terdampak.length > 0) jadwalkanAutoSyncDocx(terdampak);
      setModalGandaBuka(false);
      setSyncStatus({ pesan: `${set.size} catatan ganda dihapus`, status: "sukses" });
      setTimeout(() => setSyncStatus((prev) => (prev.status === "sukses" ? { pesan: "", status: "idle" } : prev)), 6000);
    },
    [transaksi, cariIdKegiatanTerdampak, perbaruiTransaksi, jadwalkanAutoSync, jadwalkanAutoSyncDocx]
  );

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
          folder = (await pastikanFolderKeuangan(token)).folder;
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
          const affectedKgIds = cariIdKegiatanTerdampak([updatedTrx]);
          if (affectedKgIds.length > 0) {
            jadwalkanAutoSyncDocx(affectedKgIds);
          }
        }
      } catch (err: any) {
        console.warn("Proses unggah bukti transaksi gagal:", err);
      }
    },
    [jadwalkanAutoSync, perbaruiTransaksi, cariIdKegiatanTerdampak, jadwalkanAutoSyncDocx]
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
        folder = (await pastikanFolderKeuangan(token)).folder;
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
        const affectedKgIds = cariIdKegiatanTerdampak(listTrx);
        if (affectedKgIds.length > 0) {
          jadwalkanAutoSyncDocx(affectedKgIds);
        }
      }
    } catch (err: any) {
      console.warn("Gagal memproses antrean bukti offline:", err);
    }
  }, [jadwalkanAutoSync, perbaruiTransaksi, cariIdKegiatanTerdampak, jadwalkanAutoSyncDocx]);

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
    let token = await getAccessToken({ interactive: !isAuto });
    if (!token) {
      if (isAuto) {
        setSyncStatus({ pesan: "Akses Drive kedaluwarsa — Ketuk untuk perbarui", status: "gagal" });
        return;
      }
      token = await handlePerbaruiAksesDrive();
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
        // Pengaturan.json lama tidak memuat pantauan umur barang: yang ada di perangkat dipertahankan.
        if (!Array.isArray(res.pengaturan.penyusutan)) res.pengaturan.penyusutan = pengaturanRef.current.penyusutan ?? [];
        pengaturanRef.current = res.pengaturan;
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

      // Tarik Keterangan/Lokasi dari file timesheet tiap kegiatan (hanya baca; kegagalan tidak membatalkan sinkron lain).
      try {
        const daftarSekarang = res.laporanKegiatan?.daftarKegiatan ?? daftarKegiatanRef.current;
        const ts = await tarikTimesheetSemuaKegiatan(token, res.contents, daftarSekarang);
        if (ts.berubah) {
          setDaftarKegiatan(ts.daftar);
          simpanDaftarKegiatan(ts.daftar);
          jadwalkanAutoSync();
          jadwalkanAutoSyncDocx(ts.daftar.map((k) => k.id));
        }
        if (ts.galat.length) console.warn("Sebagian timesheet gagal ditarik:", ts.galat);
        simpanIndeksTimesheet((res.contents.timesheets ?? []).map((f) => f.name));
        const jejak = await kumpulkanKeteranganTimesheet(token, res.contents);
        if (jejak.length > 0) {
          const dibatasi = jejak.slice(0, 3000);
          tulisStorage(KUNCI_JEJAK_TIMESHEET, JSON.stringify(dibatasi));
          setJejakTimesheet(dibatasi);
        }
      } catch (errTs) {
        console.warn("Gagal menarik timesheet:", errTs);
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
      const is401 = String(err.message || "").includes("401");
      if (is401 && !isAuto) {
        try {
          const tokenBaru = await handlePerbaruiAksesDrive();
          if (tokenBaru) return;
        } catch {}
      }
      setSyncStatus({
        pesan: isAuto
          ? is401
            ? "Akses Drive kedaluwarsa — Ketuk untuk perbarui"
            : "Belum tersinkron"
          : `Sinkron Drive gagal: ${err.message}`,
        status: "gagal",
      });
    } finally {
      setMemuatDrive(false);
    }
  };

  tarikDuluRef.current = handleTarikDariDrive;

  const handlePerbaruiAksesDrive = useCallback(async (): Promise<string | null> => {
    setGoogleLoading(true);
    setSyncStatus({ pesan: "Menyambungkan ke Google Drive…", status: "kerja" });
    try {
      const tokenBaru = await perbaruiTokenDrive({ interactive: true });
      if (tokenBaru) {
        setGoogleAccessToken(tokenBaru);
        setSyncStatus({ pesan: "Akses Google Drive berhasil diperbarui!", status: "sukses" });
        setTimeout(() => {
          setSyncStatus((prev) => (prev.status === "sukses" ? { pesan: "", status: "idle" } : prev));
        }, 3500);
        void periksaDriveOtomatis(tokenBaru);
        void handleTarikDariDrive(true);
        return tokenBaru;
      }
      setSyncStatus({ pesan: "Akses Drive kedaluwarsa — Ketuk untuk perbarui", status: "gagal" });
      return null;
    } catch (err: any) {
      console.warn("Gagal memperbarui akses Google Drive:", err);
      setSyncPesan(`Pembaruan akses Drive gagal: ${err.message || err}`);
      setSyncStatus({ pesan: "Gagal memperbarui akses — Coba lagi", status: "gagal" });
      return null;
    } finally {
      setGoogleLoading(false);
    }
  }, [periksaDriveOtomatis]);

  // Aplikasi baru dipasang di perangkat (PWA): bila sudah masuk Google, siapkan folder Keuangan saat itu juga. Bila belum
  // masuk, penyiapan berjalan pada masuk pertama lewat periksaDriveOtomatis.
  useEffect(() => {
    const saatTerpasang = async () => {
      const token = await getAccessToken();
      if (token) void periksaDriveOtomatis(token);
    };
    window.addEventListener("appinstalled", saatTerpasang);
    return () => window.removeEventListener("appinstalled", saatTerpasang);
  }, [periksaDriveOtomatis]);

  // Firebase Google Auth Listener, Token Refresher & Auto-pull saat aplikasi dibuka jika sudah login
  useEffect(() => {
    daftarkanTokenRefresher(async () => {
      const tokenBaru = await getAccessToken({ forceRefresh: true, interactive: false });
      if (tokenBaru) return tokenBaru;
      setSyncStatus({ pesan: "Akses Drive kedaluwarsa — Ketuk untuk perbarui", status: "gagal" });
      return null;
    });

    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        if (token) {
          setGoogleAccessToken(token);
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
        setGoogleAccessToken("");
        setDriveContents(null);
        if (alasan) {
          setSyncPesan(alasan);
        }
      }
    );
    return () => unsubscribe();
  }, [periksaDriveOtomatis, prosesAntreanBuktiOffline]);

  const muatUlangSemuaState = () => {
    const trxBaru = muatTransaksi();
    setTransaksi(trxBaru);
    transaksiRef.current = trxBaru;

    const asetBaru = muatAset();
    setAset(asetBaru);
    asetRef.current = asetBaru;

    const hargaBaru = muatHarga();
    setHarga(hargaBaru);

    const pengBaru = muatPengaturan();
    setPengaturan(pengBaru);
    pengaturanRef.current = pengBaru;

    const kegBaru = muatDaftarKegiatan();
    setDaftarKegiatan(kegBaru);

    const profBaru = muatProfilPelapor();
    setProfilPelapor(profBaru);

    setDaftarBerulang(muatTransaksiBerulang());
    setAppLockConfig(muatAppLock());
  };

  const handleBeralihAkun = async (emailOrUid: string) => {
    // 1. Simpan dulu perubahan di memori untuk akun saat ini
    simpanTransaksi(transaksiRef.current);
    simpanAset(asetRef.current);
    simpanPengaturan(pengaturanRef.current);
    simpanDaftarKegiatan(daftarKegiatan);
    simpanProfilPelapor(profilPelapor);

    // 2. Alihkan akun aktif
    const target = beralihAkunGoogle(emailOrUid);
    if (!target) return;

    // 3. Muat ulang seluruh state dari partisi akun baru
    muatUlangSemuaState();
    resetStatusTarik();
    setDriveContents(null);
    setDaftarAkunGoogle(ambilDaftarAkun());

    // 4. Perbarui data profil Google user di state
    setGoogleUser({
      uid: target.uid,
      email: target.email,
      displayName: target.displayName,
      photoURL: target.photoURL,
    } as User);

    const token = await getAccessToken();
    if (token) {
      setGoogleAccessToken(token);
      setSyncStatus({ pesan: `Beralih ke akun ${target.email || target.displayName}`, status: "sukses" });
      const folderBaru = await periksaDriveOtomatis(token);
      void prosesAntreanBuktiOffline();
      // Folder yang baru dibuat masih kosong; menariknya hanya akan menimpa pesan penyiapan dengan "0 transaksi".
      if (!folderBaru) void handleTarikDariDrive(true);
    } else {
      setGoogleAccessToken("");
      setSyncStatus({ pesan: `Sesi ${target.email} perlu masuk ulang`, status: "tunggu" });
    }
  };

  const handleTambahAkun = async (): Promise<string | null> => {
    simpanTransaksi(transaksiRef.current);
    simpanAset(asetRef.current);
    simpanPengaturan(pengaturanRef.current);
    simpanDaftarKegiatan(daftarKegiatan);
    simpanProfilPelapor(profilPelapor);

    setGoogleLoading(true);
    try {
      const res = await googleSignIn({ forceSelectAccount: true });
      if (res) {
        setGoogleUser(res.user);
        setGoogleAccessToken(res.accessToken);
        setDaftarAkunGoogle(ambilDaftarAkun());
        muatUlangSemuaState();
        resetStatusTarik();
        setDriveContents(null);
        setSyncStatus({ pesan: `Terhubung dengan ${res.user.email}`, status: "sukses" });
        const folderBaru = await periksaDriveOtomatis(res.accessToken);
        void prosesAntreanBuktiOffline();
        if (!folderBaru) void handleTarikDariDrive(true);
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

  const handleHapusAkun = async (emailOrUid: string) => {
    hapusAkunDariDaftar(emailOrUid);
    setDaftarAkunGoogle(ambilDaftarAkun());
    const aktif = ambilAkunAktif();
    if (!aktif) {
      await logoutGoogle(false);
      resetStatusTarik();
      setGoogleUser(null);
      setGoogleAccessToken("");
      setDriveContents(null);
    } else {
      await handleBeralihAkun(aktif.email || aktif.uid);
    }
    muatUlangSemuaState();
    setSyncStatus({ pesan: "Akun berhasil dihapus dari perangkat ini", status: "sukses" });
  };

  const handleGoogleLogin = async (): Promise<string | null> => {
    return handleTambahAkun();
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle(false);
    resetStatusTarik();
    setGoogleUser(null);
    setGoogleAccessToken("");
    setDriveContents(null);
    setDaftarAkunGoogle(ambilDaftarAkun());
    muatUlangSemuaState();
    setSyncPesan("Koneksi akun Google diputuskan. Data lokal tetap tersimpan di perangkat.");
    setSyncStatus({ pesan: "", status: "idle" });
  };

  // Sebelum data dihapus dari perangkat: kirim ke Drive. Hanya bila sesi ini sudah menarik isi Drive dengan lengkap; kalau tidak,
  // data lokal bisa belum lengkap dan mengirimnya akan menimpa isi Drive.
  const handleKirimSebelumKeluar = async (): Promise<{ ok: boolean; pesan?: string }> => {
    try {
      const token = await getAccessToken();
      if (!token) return { ok: false, pesan: "Sambungan ke Google Drive tidak aktif." };
      if (!navigator.onLine) return { ok: false, pesan: "Perangkat sedang tidak terhubung ke internet." };
      if (!sudahTarikLengkap()) {
        return { ok: false, pesan: "Isi Drive belum ditarik lengkap di sesi ini, jadi data tidak dikirim supaya isi Drive tidak tertimpa. Tekan Tarik Data dulu." };
      }
      await kirimSemuaKeDrive(token, transaksiRef.current, asetRef.current, pengaturanRef.current, muatLaporanKegiatanFile());
      syncPendingRef.current = false;
      return { ok: true };
    } catch (err: any) {
      return { ok: false, pesan: `Kirim ke Drive gagal: ${err?.message ?? err}.` };
    }
  };

  // Keluar sekaligus membersihkan perangkat: tanpa ini salinan data tertinggal di browser dan ikut tertulis balik ke Drive
  // (atau terlihat orang lain) pada sambungan berikutnya. Halaman dimuat ulang supaya semua keadaan di memori ikut bersih.
  const handleKeluarDanHapus = async () => {
    if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    await logoutGoogle();
    resetStatusTarik();
    await bersihkanDataPerangkat();
    window.location.reload();
  };

  /** Kirim data lokal ke Drive. `tanpaKonfirmasi`: dipakai sinkronisasi tahan-3-detik, yang sendiri sudah merupakan konfirmasi. Mengembalikan true bila berhasil. */
  const handleKirimKeDrive = async (opsi?: { tanpaKonfirmasi?: boolean }): Promise<boolean> => {
    let token = await getAccessToken({ interactive: true });
    if (!token) {
      token = await handlePerbaruiAksesDrive();
      if (!token) return false;
    }

    // Setelah pasang ulang data lokal bisa kosong: tarik dulu, jangan kirim sebelum isi Drive terbaca lengkap.
    if (!sudahTarikLengkap()) {
      await handleTarikDariDrive(false);
      if (sudahTarikLengkap()) {
        setSyncPesan("Data dari Google Drive ditarik dulu supaya isinya tidak tertimpa. Tekan kirim lagi bila masih ingin menyimpan.");
      } else {
        setSyncPesan(
          "Tarik data dari folder Keuangan dulu sampai berhasil tanpa galat. Sebagian isi Drive belum terbaca, jadi data tidak dikirim supaya isi Drive tidak tertimpa."
        );
        setSyncStatus({ pesan: "Kirim ditahan: tarik data dulu", status: "gagal" });
      }
      return false;
    }

    // Konfirmasi eksplisit untuk tombol manual
    if (!opsi?.tanpaKonfirmasi) {
      const confirmed = window.confirm(
        `Apakah Anda yakin ingin menyinkronkan data lokal ke folder 'Keuangan' di Google Drive?\n\nTindakan ini akan memperbarui:\n- ${transaksiRef.current.length} transaksi ke spreadsheet per tahun\n- ${asetRef.current.length} aset ke file Aset.json\n- Anggaran & pengaturan ke file Pengaturan.json\n- Data kegiatan & pelapor ke file Laporan Kegiatan.json\n\nLanjutkan pembaruan?`
      );
      if (!confirmed) return false;
    }

    setMemuatDrive(true);
    setSyncStatus({ pesan: "Menulis data ke folder Keuangan di Google Drive…", status: "kerja" });

    try {
      let folder = await cariFolderKeuangan(token);
      if (!folder) {
        const buat = window.confirm(
          "Folder 'Keuangan' belum ada di Google Drive Anda. Buat folder baru 'Keuangan' sekarang?"
        );
        if (!buat) return false;
        folder = (await pastikanFolderKeuangan(token)).folder;
      }

      const res = await kirimSemuaKeDrive(
        token,
        transaksiRef.current,
        asetRef.current,
        pengaturanRef.current,
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
      return true;
    } catch (err: any) {
      setSyncPesan(`Gagal menyimpan ke Google Drive: ${err.message}`);
      setSyncStatus({ pesan: `Simpan ke Drive gagal: ${err.message}`, status: "gagal" });
      return false;
    } finally {
      setMemuatDrive(false);
    }
  };

  /**
   * Sinkronisasi satu langkah (tombol lingkaran di tab Saya): pastikan akses Drive, siapkan folder Keuangan bila belum ada,
   * tarik dan gabungkan isi Drive, lalu kirim hasilnya. Kirim hanya berjalan bila tarik lengkap, jadi isi Drive tidak tertimpa.
   * Mengembalikan true bila seluruh rangkaian berhasil.
   */
  const handleSinkronkanData = async (): Promise<boolean> => {
    let token = await getAccessToken({ interactive: true });
    if (!token) {
      token = await handlePerbaruiAksesDrive();
      if (!token) return false;
    }
    if (!driveContents) await periksaDriveOtomatis(token);
    await handleTarikDariDrive(false);
    if (!sudahTarikLengkap()) return false;
    return handleKirimKeDrive({ tanpaKonfirmasi: true });
  };

  const handleSimpanProfilPelapor = useCallback((p: ProfilPelapor) => {
    setProfilPelapor(p);
    simpanProfilPelapor(p);
    jadwalkanAutoSync();
  }, [jadwalkanAutoSync]);

  const handleTambahKegiatan = useCallback(
    (kegiatan: DataKegiatan) => {
      setDaftarKegiatan((prev) => {
        const baru = [...prev.filter((k) => k.id !== kegiatan.id), kegiatan];
        simpanDaftarKegiatan(baru);
        return baru;
      });
      jadwalkanAutoSync();
      jadwalkanAutoSyncDocx([kegiatan.id]);
      jadwalkanAutoTimesheet(kegiatan);
    },
    [jadwalkanAutoSync, jadwalkanAutoSyncDocx, jadwalkanAutoTimesheet]
  );

  const handleUpdateKegiatan = useCallback(
    (kegiatan: DataKegiatan) => {
      setDaftarKegiatan((prev) => {
        const baru = prev.map((k) => (k.id === kegiatan.id ? kegiatan : k));
        simpanDaftarKegiatan(baru);
        return baru;
      });
      jadwalkanAutoSync();
      jadwalkanAutoSyncDocx([kegiatan.id]);
      if (!kegiatan.timesheetId) jadwalkanAutoTimesheet(kegiatan);
    },
    [jadwalkanAutoSync, jadwalkanAutoSyncDocx, jadwalkanAutoTimesheet]
  );

  // Transaction CRUD handlers dengan field diubah dan auto-sync
  // `hapusIds`: transaksi yang ikut dihapus pada penyimpanan yang sama, mis. pemasukan pribadi perdiem yang dilepas.
  const handleSimpanTransaksi = (t: Transaksi | Transaksi[], hapusIds: string[] = []) => {
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

    const dilepas = transaksi.filter((x) => hapusIds.includes(x.id));
    if (dilepas.length > 0) {
      dilepas.forEach((x) => tambahIdTerhapus(x.id));
      hasilTransaksi = hasilTransaksi.filter((x) => !hapusIds.includes(x.id));
    }

    perbaruiTransaksi(hasilTransaksi);
    setEditTransaksi(null);
    setCurrentView("riwayat");
    jadwalkanAutoSync();

    // Harga barang yang dipantau (Depresiasi Aset) mengikuti pengeluaran asalnya bila jumlahnya diubah.
    const daftarPantauan = pengaturanRef.current.penyusutan ?? [];
    const pantauanSelaras = daftarPantauan.map((p) => {
      const asal = daftarTerupdate.find((x) => x.id === p.transaksiId && x.jenis === "pengeluaran");
      return asal && asal.jumlah !== p.harga ? { ...p, harga: asal.jumlah, diubah: new Date().toISOString() } : p;
    });
    if (pantauanSelaras.some((p, i) => p !== daftarPantauan[i])) simpanDaftarPenyusutan(pantauanSelaras);

    const affectedKgIds = cariIdKegiatanTerdampak([...daftarTerupdate, ...dilepas]);
    if (affectedKgIds.length > 0) {
      jadwalkanAutoSyncDocx(affectedKgIds);
    }

    for (const item of daftarTerupdate) {
      void prosesUnggahBuktiTransaksi(item);
    }
  };

  // Konfirmasi dari banner Riwayat: catat semua jadwal rutin yang transaksinya untuk periode ini belum ada,
  // dengan tanggal, jumlah, kategori, dan dana sesuai jadwalnya.
  const handleTerapkanRutin = () => {
    const jatuhTempo = daftarBerulang.filter((d) => apakahJatuhTempo(d, transaksi));
    if (jatuhTempo.length === 0) return;
    handleSimpanTransaksi(jatuhTempo.map((d) => buatTransaksiDariBerulang(d, tanggalJadwalSaatIni(d))));
    const sekarangIso = formatTanggalIso(new Date());
    const daftarBaru = daftarBerulang.map((x) => (jatuhTempo.some((j) => j.id === x.id) ? { ...x, terakhirDiterapkan: sekarangIso } : x));
    setDaftarBerulang(daftarBaru);
    simpanTransaksiBerulang(daftarBaru);
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
    // Perdiem Dana Kegiatan dan pemasukan pribadi otomatisnya satu kesatuan: hapus salah satu, hapus keduanya.
    const pasanganPerdiem = target ? cariPasanganPerdiem(target, transaksi) : undefined;
    if (pasanganPerdiem && !idsToHapus.includes(pasanganPerdiem.id)) {
      idsToHapus.push(pasanganPerdiem.id);
    }

    const affectedKgIds = cariIdKegiatanTerdampak(
      transaksi.filter((t) => idsToHapus.includes(t.id))
    );

    idsToHapus.forEach((hId) => tambahIdTerhapus(hId));
    const baru = transaksi.filter((t) => !idsToHapus.includes(t.id));
    perbaruiTransaksi(baru);
    // Pantauan umur barang milik transaksi yang dihapus ikut dihapus.
    const penyusutanTersisa = (pengaturanRef.current.penyusutan ?? []).filter((x) => !x.transaksiId || !idsToHapus.includes(x.transaksiId));
    if (penyusutanTersisa.length !== (pengaturanRef.current.penyusutan ?? []).length) simpanDaftarPenyusutan(penyusutanTersisa);
    jadwalkanAutoSync();

    if (affectedKgIds.length > 0) {
      jadwalkanAutoSyncDocx(affectedKgIds);
    }
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

    const affectedKgIds = cariIdKegiatanTerdampak([target]);
    if (affectedKgIds.length > 0) {
      jadwalkanAutoSyncDocx(affectedKgIds);
    }
  };

  const handleMulaiEditTransaksi = (t: Transaksi) => {
    // Pemasukan pribadi otomatis tidak diubah sendiri: yang dibuka adalah perdiem Dana Kegiatan sumbernya.
    const sumberPerdiem = adalahPemasukanPerdiemOtomatis(t) ? cariPasanganPerdiem(t, transaksi) : undefined;
    setEditDialihkanDariPerdiem(Boolean(sumberPerdiem));
    setEditTransaksi(sumberPerdiem ?? t);
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

  // Pantauan penyusutan dan umur barang disimpan bersama pengaturan (ikut tersinkron ke Drive seperti utang dan target tabungan).
  const simpanDaftarPenyusutan = (baru: ItemPenyusutan[]) => {
    const pengaturanBaru: PengaturanKeuangan = {
      ...pengaturanRef.current,
      penyusutan: baru,
      diubah: new Date().toISOString(),
    };
    pengaturanRef.current = pengaturanBaru;
    setPengaturan(pengaturanBaru);
    simpanPengaturan(pengaturanBaru);
    jadwalkanAutoSync();
  };

  const handleSimpanPenyusutan = (item: ItemPenyusutan) => {
    const daftar = pengaturanRef.current.penyusutan ?? [];
    simpanDaftarPenyusutan(daftar.some((x) => x.id === item.id) ? daftar.map((x) => (x.id === item.id ? item : x)) : [item, ...daftar]);
  };

  const handleHapusPenyusutan = (id: string) => {
    simpanDaftarPenyusutan((pengaturanRef.current.penyusutan ?? []).filter((x) => x.id !== id));
  };

  const handleSimpanAppLockConfig = (cfg: AppLockConfig) => {
    // Authenticator hanyalah langkah kedua setelah PIN; tanpa kunci aplikasi tidak ada yang memintanya, jadi rahasianya dibuang.
    if (!cfg.enabled) hapusTotp();
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
      {tema === "jujutsu" && (
        <div
          className="wallpaper-tokoh"
          id="wallpaper-tokoh"
          key={karakter}
          aria-hidden="true"
          style={{ "--wp": `url("${TOKOH_TEMA[karakter].wallpaper}")` } as React.CSSProperties}
        >
          <div className="wp-kabur" />
          <div className="wp-gambar" />
        </div>
      )}
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
            lencanaSaya={jumlahPerhatianDepresiasi}
          />
        </aside>

        <div className="main-content-wrapper">
          <Topbar
            karakter={karakter}
            bulanTerpilih={bulanTerpilih}
            onPilihBulan={setBulanTerpilih}
            transaksi={transaksi}
          />

          <main className="container" data-geser={arahGeser ?? undefined}>
            {(currentView === "riwayat" || (currentView === "tambah" && lastActiveTab === "riwayat")) && (
              <div className={currentView === "tambah" ? "view-bg-pc-only" : undefined}>
                {currentView === "riwayat" && kelompokGanda.length > 0 && catatanMencurigakan.length === 0 && (
                  <KartuDataGanda
                    jumlahKelompok={kelompokGanda.length}
                    jumlahLebih={kelompokGanda.reduce((n, k) => n + k.anggota.length - 1, 0)}
                    onPeriksa={() => setModalGandaBuka(true)}
                    onAbaikan={abaikanDataGanda}
                  />
                )}
                {currentView === "riwayat" && catatanMencurigakan.length > 0 && (
                  <KartuCatatanMencurigakan
                    daftar={catatanMencurigakan}
                    onHapus={hapusCatatanMencurigakan}
                    onAbaikan={abaikanCatatanMencurigakan}
                  />
                )}
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
                  rutinBelumDicatat={rutinBelumDicatat}
                  onTerapkanRutin={handleTerapkanRutin}
                  daftarUtangPiutang={daftarUtangPiutang}
                  onSimpanUtangPiutang={handleSimpanUtangPiutang}
                  onHapusUtangPiutang={handleHapusUtangPiutang}
                  daftarTargetTabungan={daftarTargetTabungan}
                  onSimpanTargetTabungan={handleSimpanTargetTabungan}
                  onHapusTargetTabungan={handleHapusTargetTabungan}
                  daftarPenyusutan={pengaturan.penyusutan ?? []}
                  onBukaUmurBarang={() => {
                    setArahGeser(null);
                    setBukaDepresiasiSaya(true);
                    setLastActiveTab("saya");
                    setCurrentView("saya");
                    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
                  }}
                  onBukaTambahTabungan={(targetId, targetNama) => {
                    setTargetTabunganAwalId(targetId);
                    setEditTransaksi(null);
                    setInitialScanMode(null);
                    setCurrentView("tambah");
                  }}
                  googleToken={googleAccessToken || undefined}
                  onPerbaruiAksesDrive={async () => {
                    await handlePerbaruiAksesDrive();
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
                  onKirimDrive={() => void handleKirimKeDrive()}
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
                  daftarAkunGoogle={daftarAkunGoogle}
                  onBeralihAkun={handleBeralihAkun}
                  onTambahAkun={handleTambahAkun}
                  onHapusAkun={handleHapusAkun}
                  onKirimSebelumKeluar={handleKirimSebelumKeluar}
                  onKeluarDanHapus={handleKeluarDanHapus}
                  driveContents={driveContents}
                  memuatDrive={memuatDrive}
                  onPeriksaDrive={async () => {
                    let token = await getAccessToken({ interactive: true });
                    if (!token) token = await handlePerbaruiAksesDrive();
                    if (token) await periksaDriveOtomatis(token);
                    else alert("Silakan masuk dengan Google terlebih dahulu.");
                  }}
                  onTarikDariDrive={handleTarikDariDrive}
                  onKirimKeDrive={async () => {
                    await handleKirimKeDrive();
                  }}
                  onSinkronkan={handleSinkronkanData}
                  onPerbaruiAksesDrive={handlePerbaruiAksesDrive}
                  transaksi={transaksi}
                  aset={aset}
                  syncStatusPesan={syncPesan}
                  onBukaTransaksiBerulang={() => setModalBerulangBuka(true)}
                  jumlahTransaksiBerulang={daftarBerulang.filter((d) => d.aktif).length}
                  appLockConfig={appLockConfig}
                  onSimpanAppLockConfig={handleSimpanAppLockConfig}
                  profilPelapor={profilPelapor}
                  onSimpanProfilPelapor={handleSimpanProfilPelapor}
                  daftarKegiatan={daftarKegiatan}
                  onUpdateKegiatan={handleUpdateKegiatan}
                  onTambahKegiatan={handleTambahKegiatan}
                  googleToken={googleAccessToken || undefined}
                  ambilToken={getAccessToken}
                  daftarPenyusutan={pengaturan.penyusutan ?? []}
                  onSimpanPenyusutan={handleSimpanPenyusutan}
                  onHapusPenyusutan={handleHapusPenyusutan}
                  bukaDepresiasi={bukaDepresiasiSaya}
                  onDepresiasiDibuka={() => setBukaDepresiasiSaya(false)}
                />
              </div>
            )}

            {currentView === "tambah" && (
              <TambahView
                editTransaksi={editTransaksi}
                dialihkanDariPerdiemPribadi={Boolean(editTransaksi) && editDialihkanDariPerdiem}
                onSimpan={(trx, hapusIds, opsi) => {
                  handleSimpanTransaksi(trx, hapusIds);
                  setTargetTabunganAwalId("");
                  setCurrentView(lastActiveTab);
                  // Pembelian baru yang tampak tahan lama: tawarkan untuk dihitung depresiasinya (hanya yang disetujui masuk daftar),
                  // kecuali pengguna sudah memutuskan lewat kotak centang di formulir.
                  if (!editTransaksi && !Array.isArray(trx) && !opsi?.sudahMemutuskanDepresiasi) {
                    const tawaran = nilaiTawaranDepresiasi(trx);
                    if (tawaran.tawar) setDialogDepresiasi({ jenis: "tawaran", transaksi: trx, preset: tawaran.preset, alasan: tawaran.alasan });
                  }
                }}
                onBatalEdit={() => {
                  setEditTransaksi(null);
                  setInitialScanMode(null);
                  setTargetTabunganAwalId("");
                  setCurrentView(lastActiveTab);
                }}
                initialScanMode={initialScanMode}
                onResetInitialScanMode={() => setInitialScanMode(null)}
                daftarTransaksi={transaksi}
                daftarTargetTabungan={daftarTargetTabungan}
                targetTabunganAwalId={targetTabunganAwalId}
                daftarKegiatan={daftarKegiatan}
                onTambahKegiatan={handleTambahKegiatan}
                daftarPenyusutan={pengaturan.penyusutan ?? []}
                onSimpanPenyusutan={handleSimpanPenyusutan}
                onHapusPenyusutan={handleHapusPenyusutan}
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
          setArahGeser(null);
          setCurrentView(v);
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        }}
        onBukaMenuTambah={() => setModalPilihanTambahBuka(true)}
        lencanaSaya={jumlahPerhatianDepresiasi}
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

      {modalGandaBuka && (
        <DataGandaModal kelompok={kelompokGanda} onHapus={hapusDataGanda} onTutup={() => setModalGandaBuka(false)} />
      )}
      {dialogDepresiasi && (
        <DialogDepresiasi
          mode={dialogDepresiasi}
          onSimpan={(item) => {
            handleSimpanPenyusutan(item);
            setDialogDepresiasi(null);
          }}
          onTutup={() => setDialogDepresiasi(null)}
        />
      )}
      <TransaksiBerulangModal
        isOpen={modalBerulangBuka}
        onClose={() => setModalBerulangBuka(false)}
        daftarBerulang={daftarBerulang}
        daftarTransaksi={transaksi}
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
