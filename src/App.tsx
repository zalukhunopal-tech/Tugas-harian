import React, { useState, useEffect, useCallback } from "react";
import {
  Transaksi,
  AsetItem,
  DataHarga,
  KarakterId,
  TemaId,
  ViewTab,
  SyncOp,
} from "./types";
import {
  BUDGET_KEY,
  TEMA_KEY,
  KARAKTER_KEY,
  SYNC_URL_KEY,
  SYNC_KUNCI_KEY,
  SYNC_TIME_KEY,
  hariIni,
} from "./lib/constants";
import {
  muatTransaksi,
  simpanTransaksi,
  muatAset,
  simpanAset,
  muatHarga,
  simpanHarga,
  bacaStorage,
  tulisStorage,
} from "./lib/storage";
import {
  koinDipakai,
  ambilHargaCoinGecko,
  hargaBasi,
} from "./lib/aset";
import { Topbar } from "./components/Topbar";
import { Navbar } from "./components/Navbar";
import { RiwayatView } from "./components/RiwayatView";
import { AsetView } from "./components/AsetView";
import { TambahView } from "./components/TambahView";
import { GrafikView } from "./components/GrafikView";
import { SayaView } from "./components/SayaView";

export default function App() {
  const [transaksi, setTransaksi] = useState<Transaksi[]>(() => muatTransaksi());
  const [aset, setAset] = useState<AsetItem[]>(() => muatAset());
  const [harga, setHarga] = useState<DataHarga>(() => muatHarga());
  const [anggaran, setAnggaran] = useState<number>(() => Number(bacaStorage(BUDGET_KEY, "0")) || 0);

  const [tema, setTema] = useState<TemaId>(() => (bacaStorage(TEMA_KEY, "jujutsu") as TemaId) || "jujutsu");
  const [karakter, setKarakter] = useState<KarakterId>(
    () => (bacaStorage(KARAKTER_KEY, "gojo") as KarakterId) || "gojo"
  );

  const [currentView, setCurrentView] = useState<ViewTab>("riwayat");
  const [bulanTerpilih, setBulanTerpilih] = useState<string>(() => hariIni().slice(0, 7));
  const [editTransaksi, setEditTransaksi] = useState<Transaksi | null>(null);

  // Sync states
  const [syncUrl, setSyncUrl] = useState<string>(() => bacaStorage(SYNC_URL_KEY, ""));
  const [syncKunci, setSyncKunci] = useState<string>(() => bacaStorage(SYNC_KUNCI_KEY, ""));
  const [syncPesan, setSyncPesan] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<{
    pesan: string;
    status: "kerja" | "sukses" | "gagal" | "idle";
  }>({ pesan: "", status: "idle" });

  const [memuatHarga, setMemuatHarga] = useState(false);

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

  // Update market prices (CoinGecko for crypto)
  const perbaruiHargaPasar = useCallback(async () => {
    setMemuatHarga(true);
    try {
      const koinList = koinDipakai(aset);
      const dataCrypto = await ambilHargaCoinGecko(koinList);
      const hargaBaru: DataHarga = {
        ...harga,
        crypto: {
          ...(harga.crypto || {}),
          ...dataCrypto,
        },
        waktu: new Date().toISOString(),
      };
      perbaruiHargaState(hargaBaru);
    } catch (e: any) {
      console.warn("Gagal memperbarui harga dari CoinGecko:", e.message);
    } finally {
      setMemuatHarga(false);
    }
  }, [aset, harga, perbaruiHargaState]);

  // Check on mount or view change if price is stale
  useEffect(() => {
    if (currentView === "aset" && hargaBasi(harga)) {
      void perbaruiHargaPasar();
    }
  }, [currentView, harga, perbaruiHargaPasar]);

  // Google Sheets integration via Apps Script Web App
  const kirimOpKeSheet = useCallback(
    async (op: SyncOp) => {
      if (!syncUrl) return;
      try {
        setSyncStatus({ pesan: "Menyinkronkan ke Google Sheets…", status: "kerja" });
        const res = await fetch(syncUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ ...op, kunci: syncKunci }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Gagal sinkron");
        tulisStorage(SYNC_TIME_KEY, new Date().toISOString());
        setSyncStatus({ pesan: "Tersinkron dengan Google Sheets", status: "sukses" });
        setTimeout(() => setSyncStatus({ pesan: "", status: "idle" }), 3000);
      } catch (err: any) {
        setSyncStatus({ pesan: `Sinkron gagal: ${err.message}`, status: "gagal" });
      }
    },
    [syncUrl, syncKunci]
  );

  const tarikDariSheet = useCallback(async () => {
    if (!syncUrl) return;
    setSyncStatus({ pesan: "Menarik data dari Google Sheets…", status: "kerja" });
    try {
      const url = `${syncUrl}?action=baca&kunci=${encodeURIComponent(syncKunci)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gagal menarik data");

      if (Array.isArray(data.transaksi)) {
        perbaruiTransaksi(data.transaksi);
      }
      if (Array.isArray(data.aset)) {
        perbaruiAset(data.aset);
      }
      if (data.harga) {
        perbaruiHargaState({ ...harga, ...data.harga });
      }
      setSyncPesan(
        `Berhasil ditarik: ${data.transaksi?.length || 0} transaksi, ${data.aset?.length || 0} aset.`
      );
      setSyncStatus({ pesan: "Data diperbarui dari Sheet", status: "sukses" });
      setTimeout(() => setSyncStatus({ pesan: "", status: "idle" }), 3500);
    } catch (err: any) {
      setSyncPesan(`Gagal menarik dari Sheet: ${err.message}`);
      setSyncStatus({ pesan: `Gagal menarik: ${err.message}`, status: "gagal" });
    }
  }, [syncUrl, syncKunci, harga, perbaruiTransaksi, perbaruiAset, perbaruiHargaState]);

  const kirimSemuaKeSheet = useCallback(async () => {
    if (!syncUrl) return;
    setSyncStatus({ pesan: "Mengirim semua data lokal ke Sheet…", status: "kerja" });
    try {
      const res = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "kirim_semua",
          kunci: syncKunci,
          transaksi,
          aset,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Gagal mengirim semua");
      setSyncPesan("Semua transaksi dan aset lokal berhasil dikirim ke Google Sheets.");
      setSyncStatus({ pesan: "Semua data terkirim ke Sheet", status: "sukses" });
      setTimeout(() => setSyncStatus({ pesan: "", status: "idle" }), 3500);
    } catch (err: any) {
      setSyncPesan(`Gagal mengirim data: ${err.message}`);
      setSyncStatus({ pesan: `Gagal mengirim: ${err.message}`, status: "gagal" });
    }
  }, [syncUrl, syncKunci, transaksi, aset]);

  const handleSimpanSync = async (url: string, kunci: string) => {
    setSyncUrl(url);
    setSyncKunci(kunci);
    tulisStorage(SYNC_URL_KEY, url);
    tulisStorage(SYNC_KUNCI_KEY, kunci);
    try {
      const testUrl = `${url}?action=ping&kunci=${encodeURIComponent(kunci)}`;
      const res = await fetch(testUrl);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Uji koneksi gagal");
      setSyncPesan(`Terhubung. Sheet: ${(data.sheets || []).join(" dan ")}`);
      await tarikDariSheet();
    } catch (err: any) {
      setSyncPesan(`Koneksi gagal: ${err.message}`);
    }
  };

  const handlePutusSync = () => {
    if (confirm("Putuskan sinkronisasi? Data di browser tetap tersimpan.")) {
      setSyncUrl("");
      setSyncKunci("");
      tulisStorage(SYNC_URL_KEY, null);
      tulisStorage(SYNC_KUNCI_KEY, null);
      tulisStorage(SYNC_TIME_KEY, null);
      setSyncPesan("Sinkronisasi diputuskan.");
      setSyncStatus({ pesan: "", status: "idle" });
    }
  };

  // Transaction CRUD handlers
  const handleSimpanTransaksi = (t: Transaksi) => {
    const ada = transaksi.some((x) => x.id === t.id);
    const baru = ada ? transaksi.map((x) => (x.id === t.id ? t : x)) : [t, ...transaksi];
    perbaruiTransaksi(baru);
    setEditTransaksi(null);
    setCurrentView("riwayat");
    void kirimOpKeSheet({ action: "upsert", transaksi: t });
  };

  const handleHapusTransaksi = (id: string) => {
    const baru = transaksi.filter((t) => t.id !== id);
    perbaruiTransaksi(baru);
    void kirimOpKeSheet({ action: "delete", id });
  };

  const handleMulaiEditTransaksi = (t: Transaksi) => {
    setEditTransaksi(t);
    setCurrentView("tambah");
  };

  // Asset CRUD handlers
  const handleTambahAset = (item: AsetItem) => {
    const baru = [...aset, item];
    perbaruiAset(baru);
    void kirimOpKeSheet({ action: "aset", aset: baru });
  };

  const handleUbahAset = (item: AsetItem) => {
    const baru = aset.map((a) => (a.id === item.id ? item : a));
    perbaruiAset(baru);
    void kirimOpKeSheet({ action: "aset", aset: baru });
  };

  const handleHapusAset = (id: string) => {
    const baru = aset.filter((a) => a.id !== id);
    perbaruiAset(baru);
    void kirimOpKeSheet({ action: "aset", aset: baru });
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
              setCurrentView("riwayat");
            }}
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
            syncUrl={syncUrl}
            syncKunci={syncKunci}
            onSimpanSync={handleSimpanSync}
            onTarikDariSheet={tarikDariSheet}
            onKirimSemuaKeSheet={kirimSemuaKeSheet}
            onPutusSync={handlePutusSync}
            transaksi={transaksi}
            syncStatusPesan={syncPesan}
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
      />
    </>
  );
}
