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
} from "./lib/googleAuth";
import {
  cariFolderKeuangan,
  ambilIsiFolderKeuangan,
  buatFolderKeuangan,
  bacaTransaksiDariSpreadsheet,
  bacaAsetDariDrive,
  bacaHargaDariDrive,
  simpanTransaksiKeSpreadsheet,
  simpanAsetKeDrive,
  KeuanganDriveContents,
} from "./lib/gdriveSync";
import { Topbar } from "./components/Topbar";
import { Navbar } from "./components/Navbar";
import { RiwayatView } from "./components/RiwayatView";
import { AsetView } from "./components/AsetView";
import { TambahView } from "./components/TambahView";
import { GrafikView } from "./components/GrafikView";
import { SayaView } from "./components/SayaView";
import { TransaksiBerulangModal } from "./components/TransaksiBerulangModal";

export default function App() {
  const [transaksi, setTransaksi] = useState<Transaksi[]>(() => muatTransaksi());
  const [aset, setAset] = useState<AsetItem[]>(() => muatAset());
  const [harga, setHarga] = useState<DataHarga>(() => muatHarga());
  const [anggaran, setAnggaran] = useState<number>(() => Number(bacaStorage(BUDGET_KEY, "0")) || 0);

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
    status: "kerja" | "sukses" | "gagal" | "idle";
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

  // Firebase Google Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, _token) => {
        setGoogleUser(user);
      },
      () => {
        setGoogleUser(null);
        setDriveContents(null);
      }
    );
    return () => unsubscribe();
  }, []);

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

  // ===== Google Drive Direct Synchronization =====

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

  const handleGoogleLogin = async (): Promise<string | null> => {
    setGoogleLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setSyncStatus({ pesan: "Terhubung ke Google Drive", status: "sukses" });
        await periksaDriveOtomatis(res.accessToken);
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

  const handleTarikDariDrive = async () => {
    let token = await getAccessToken();
    if (!token) {
      // Jika belum login, picu login Google terlebih dahulu
      token = await handleGoogleLogin();
      if (!token) return;
    }

    setMemuatDrive(true);
    setSyncStatus({ pesan: "Menarik data dari folder Keuangan Google Drive…", status: "kerja" });

    try {
      let folder = await cariFolderKeuangan(token);
      if (!folder) {
        throw new Error("Folder 'Keuangan' tidak ditemukan di Google Drive Anda.");
      }

      const contents = await ambilIsiFolderKeuangan(token, folder.id);
      setDriveContents(contents);

      let totalTrxDitarik = 0;
      const trxMap = new Map<string, Transaksi>();

      // Muat data lokal lama terlebih dahulu
      for (const t of transaksi) {
        trxMap.set(t.id, t);
      }

      // 1. Tarik dari Keuangan Pribadi (file terpisah atau dari daftar spreadsheet)
      const sheetPribadiTarget = contents.sheetPribadi || contents.spreadsheets[0];
      if (sheetPribadiTarget) {
        try {
          const trxPribadi = await bacaTransaksiDariSpreadsheet(
            token,
            sheetPribadiTarget.id,
            "Dana Pribadi"
          );
          for (const t of trxPribadi) {
            trxMap.set(t.id, t);
          }
          totalTrxDitarik += trxPribadi.length;
        } catch (e: any) {
          console.warn("Gagal membaca Keuangan Pribadi:", e.message);
        }
      }

      // 2. Tarik dari Keuangan Kegiatan (file terpisah atau spreadsheet kedua atau spreadsheet yang sama)
      const sheetKegiatanTarget =
        contents.sheetKegiatan ||
        (contents.spreadsheets.length > 1 ? contents.spreadsheets[1] : contents.spreadsheets[0]);

      if (sheetKegiatanTarget && sheetKegiatanTarget !== sheetPribadiTarget) {
        try {
          const trxKegiatan = await bacaTransaksiDariSpreadsheet(
            token,
            sheetKegiatanTarget.id,
            "Dana Kegiatan"
          );
          for (const t of trxKegiatan) {
            trxMap.set(t.id, t);
          }
          totalTrxDitarik += trxKegiatan.length;
        } catch (e: any) {
          console.warn("Gagal membaca Keuangan Kegiatan:", e.message);
        }
      } else if (sheetPribadiTarget) {
        // Coba baca tab kegiatan dari spreadsheet yang sama
        try {
          const trxKegiatan = await bacaTransaksiDariSpreadsheet(
            token,
            sheetPribadiTarget.id,
            "Dana Kegiatan"
          );
          for (const t of trxKegiatan) {
            trxMap.set(t.id, t);
          }
          totalTrxDitarik += trxKegiatan.length;
        } catch (e: any) {
          // tab kegiatan mungkin tidak ada di file ini
        }
      }

      const listTrxGabungan = Array.from(trxMap.values()).sort((a, b) =>
        b.tanggal.localeCompare(a.tanggal)
      );

      perbaruiTransaksi(listTrxGabungan);

      // 3. Tarik dari Aset.json
      let totalAsetDitarik = 0;
      if (contents.fileAset) {
        try {
          const asetDrive = await bacaAsetDariDrive(token, contents.fileAset.id);
          if (Array.isArray(asetDrive) && asetDrive.length > 0) {
            perbaruiAset(asetDrive);
            totalAsetDitarik = asetDrive.length;
          }
        } catch (e: any) {
          console.warn("Gagal membaca Aset.json:", e.message);
        }
      }

      // 4. Tarik dari Harga Pasar.json jika ada
      if (contents.fileHarga) {
        try {
          const hargaDrive = await bacaHargaDariDrive(token, contents.fileHarga.id);
          if (hargaDrive) {
            perbaruiHargaState({ ...harga, ...hargaDrive });
          }
        } catch (e: any) {
          console.warn("Gagal membaca Harga Pasar.json:", e.message);
        }
      }

      // Jika bulan terpilih belum ada transaksi, otomatis geser ke bulan transaksi terbaru
      if (listTrxGabungan.length > 0) {
        const blnTerbaru = listTrxGabungan[0].tanggal.slice(0, 7);
        const adaDiBulanIni = listTrxGabungan.some((t) => t.tanggal.startsWith(bulanTerpilih));
        if (!adaDiBulanIni && blnTerbaru) {
          setBulanTerpilih(blnTerbaru);
        }
      }

      const pesanSukses = `Sinkronisasi berhasil: ${totalTrxDitarik} transaksi dan ${totalAsetDitarik} aset ditarik dari folder 'Keuangan' Google Drive.`;
      setSyncPesan(pesanSukses);
      setSyncStatus({ pesan: "Data tersinkron dari Google Drive", status: "sukses" });
      setTimeout(() => setSyncStatus({ pesan: "", status: "idle" }), 4500);
    } catch (err: any) {
      setSyncPesan(`Gagal menarik dari Drive: ${err.message}`);
      setSyncStatus({ pesan: `Sinkron Drive gagal: ${err.message}`, status: "gagal" });
    } finally {
      setMemuatDrive(false);
    }
  };

  const handleKirimKeDrive = async () => {
    let token = await getAccessToken();
    if (!token) {
      token = await handleGoogleLogin();
      if (!token) return;
    }

    // Konfirmasi eksplisit wajib (Workspace Integration User Confirmation for Destructive Operations)
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menyinkronkan data lokal ke folder 'Keuangan' di Google Drive?\n\nTindakan ini akan memperbarui:\n- ${transaksi.length} transaksi ke spreadsheet\n- ${aset.length} aset ke file Aset.json\n\nLanjutkan pembaruan?`
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

      const contents = await ambilIsiFolderKeuangan(token, folder.id);
      setDriveContents(contents);

      let jumlahTrxPribadi = 0;
      let jumlahTrxKegiatan = 0;

      if (contents.sheetPribadi) {
        jumlahTrxPribadi = await simpanTransaksiKeSpreadsheet(
          token,
          contents.sheetPribadi.id,
          transaksi,
          "Dana Pribadi"
        );
      }

      if (contents.sheetKegiatan) {
        jumlahTrxKegiatan = await simpanTransaksiKeSpreadsheet(
          token,
          contents.sheetKegiatan.id,
          transaksi,
          "Dana Kegiatan"
        );
      }

      // Simpan Aset.json
      await simpanAsetKeDrive(
        token,
        folder.id,
        contents.fileAset ? contents.fileAset.id : null,
        aset
      );

      const totalTrxTersimpan = jumlahTrxPribadi + jumlahTrxKegiatan;
      setSyncPesan(
        `Berhasil disimpan ke Google Drive: ${totalTrxTersimpan} transaksi diperbarui di spreadsheet dan ${aset.length} aset disimpan di Aset.json.`
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

  // Transaction CRUD handlers
  const handleSimpanTransaksi = (t: Transaksi) => {
    const ada = transaksi.some((x) => x.id === t.id);
    const baru = ada ? transaksi.map((x) => (x.id === t.id ? t : x)) : [t, ...transaksi];
    perbaruiTransaksi(baru);
    setEditTransaksi(null);
    setCurrentView("riwayat");
  };

  const handleHapusTransaksi = (id: string) => {
    const baru = transaksi.filter((t) => t.id !== id);
    perbaruiTransaksi(baru);
  };

  const handleMulaiEditTransaksi = (t: Transaksi) => {
    setEditTransaksi(t);
    setCurrentView("tambah");
  };

  // Asset CRUD handlers
  const handleTambahAset = (item: AsetItem) => {
    const baru = [...aset, item];
    perbaruiAset(baru);
    if (item.jenis === "crypto" || item.jenis === "emas") {
      setTimeout(() => {
        void perbaruiHargaPasar();
      }, 50);
    }
  };

  const handleUbahAset = (item: AsetItem) => {
    const baru = aset.map((a) => (a.id === item.id ? item : a));
    perbaruiAset(baru);
    if (item.jenis === "crypto" || item.jenis === "emas") {
      setTimeout(() => {
        void perbaruiHargaPasar();
      }, 50);
    }
  };

  const handleHapusAset = (id: string) => {
    const baru = aset.filter((a) => a.id !== id);
    perbaruiAset(baru);
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
  };

  return (
    <>
      <div className="energi" id="energi" aria-hidden="true" />
      <div className="pulsa" id="pulsa" aria-hidden="true" />

      <Topbar
        karakter={karakter}
        bulanTerpilih={bulanTerpilih}
        onPilihBulan={setBulanTerpilih}
        transaksi={transaksi}
        onTarikDrive={handleTarikDariDrive}
        memuatDrive={memuatDrive}
      />

      <main className="container">
        {currentView === "riwayat" && (
          <RiwayatView
            transaksi={transaksi}
            bulanTerpilih={bulanTerpilih}
            anggaran={anggaran}
            syncStatus={syncStatus}
            onEdit={handleMulaiEditTransaksi}
            onDelete={handleHapusTransaksi}
            onGeserBulan={(delta) => {
              const [th, bl] = bulanTerpilih.split("-").map(Number);
              const d = new Date(th, bl - 1 + delta, 1);
              setBulanTerpilih(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
              );
            }}
            onBukaTransaksiBerulang={() => setModalBerulangBuka(true)}
            jumlahJatuhTempo={jumlahJatuhTempo}
          />
        )}

        {currentView === "aset" && (
          <AsetView
            aset={aset}
            harga={harga}
            onTambahAset={handleTambahAset}
            onUbahAset={handleUbahAset}
            onHapusAset={handleHapusAset}
            onPerbaruiHarga={perbaruiHargaPasar}
            onSimpanHargaManual={handleSimpanHargaManual}
            memuatHarga={memuatHarga}
          />
        )}

        {currentView === "tambah" && (
          <TambahView
            editTransaksi={editTransaksi}
            onSimpan={handleSimpanTransaksi}
            onBatalEdit={() => {
              setEditTransaksi(null);
              setInitialScanMode(null);
              setCurrentView("riwayat");
            }}
            initialScanMode={initialScanMode}
            onResetInitialScanMode={() => setInitialScanMode(null)}
          />
        )}

        {currentView === "grafik" && (
          <GrafikView
            transaksi={transaksi}
            bulanTerpilih={bulanTerpilih}
            anggaran={anggaran}
            onSetAnggaran={handleSetAnggaran}
          />
        )}

        {currentView === "saya" && (
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
          />
        )}
      </main>

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
    </>
  );
}
