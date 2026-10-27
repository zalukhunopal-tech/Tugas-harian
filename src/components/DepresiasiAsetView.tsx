import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ItemPenyusutan, Transaksi } from "../types";
import { formatRupiah, hariIni } from "../lib/constants";
import { PresetBarang } from "../lib/basisDataUmur";
import { AMBANG_PERINGATAN, hitungPenyusutan } from "../lib/penyusutan";
import { BannerUmurBarang, KartuUmur } from "./UmurBarangUI";
import { DialogDepresiasi, ModeDialogDepresiasi } from "./DialogDepresiasi";
import { PedomanDepresiasi } from "./PedomanDepresiasi";

interface DepresiasiAsetViewProps {
  daftar: ItemPenyusutan[];
  transaksi: Transaksi[];
  onSimpan: (item: ItemPenyusutan) => void;
  onHapus: (id: string) => void;
}

type Saringan = "semua" | "perhatian" | "habis-pakai" | "aset";

const SARINGAN: Array<{ id: Saringan; label: string }> = [
  { id: "semua", label: "Semua" },
  { id: "perhatian", label: `Perlu perhatian` },
  { id: "habis-pakai", label: "Habis pakai" },
  { id: "aset", label: "Aset" },
];

/**
 * Layar Depresiasi Aset (tab Saya): ringkasan nilai, peringatan sisa ≤ 30%, daftar barang yang dipantau, dan pedoman rumus.
 * Barang masuk daftar lewat tawaran otomatis setelah pembelian dicatat, atau lewat tombol Tambah di sini.
 */
export const DepresiasiAsetView: React.FC<DepresiasiAsetViewProps> = ({ daftar, transaksi, onSimpan, onHapus }) => {
  const [dialog, setDialog] = useState<ModeDialogDepresiasi | null>(null);
  const [saringan, setSaringan] = useState<Saringan>("semua");

  const sekarang = hariIni();
  const baris = useMemo(
    () =>
      daftar
        .map((item) => ({ item, hasil: hitungPenyusutan(item, sekarang) }))
        .sort((a, b) => (a.hasil?.persenTerendah ?? 101) - (b.hasil?.persenTerendah ?? 101)),
    [daftar, sekarang]
  );

  const ringkasan = useMemo(() => {
    let perolehan = 0;
    let nilaiBuku = 0;
    let perhatian = 0;
    for (const { item, hasil } of baris) {
      perolehan += Number(item.harga) || 0;
      nilaiBuku += hasil ? hasil.nilaiBuku : Number(item.harga) || 0;
      if (hasil?.perluPeringatan) perhatian++;
    }
    return { perolehan, nilaiBuku, susut: Math.max(0, perolehan - nilaiBuku), perhatian };
  }, [baris]);

  const tampil = baris.filter(({ item, hasil }) => {
    if (saringan === "perhatian") return Boolean(hasil?.perluPeringatan);
    if (saringan === "habis-pakai") return item.jenisBarang === "habis-pakai";
    if (saringan === "aset") return item.jenisBarang === "aset";
    return true;
  });

  const simpan = (item: ItemPenyusutan) => {
    onSimpan(item);
    setDialog(null);
  };

  const pakaiPreset = (preset: PresetBarang) => {
    setDialog({ jenis: "manual", preset });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="dep-layar" data-testid="layar-depresiasi">
      <section className="dep-ringkasan" aria-label="Ringkasan depresiasi aset" data-testid="ringkasan-depresiasi">
        <div className="dep-stat">
          <span className="dep-stat__label">Barang dipantau</span>
          <strong className="dep-stat__nilai" data-testid="dep-jumlah">
            {daftar.length}
          </strong>
        </div>
        <div className="dep-stat">
          <span className="dep-stat__label">Harga perolehan</span>
          <strong className="dep-stat__nilai">{formatRupiah(ringkasan.perolehan)}</strong>
        </div>
        <div className="dep-stat">
          <span className="dep-stat__label">Nilai buku kini</span>
          <strong className="dep-stat__nilai" data-testid="dep-nilai-buku">
            {formatRupiah(Math.round(ringkasan.nilaiBuku))}
          </strong>
          <small className="dep-stat__sub">Susut {formatRupiah(Math.round(ringkasan.susut))}</small>
        </div>
        <div className="dep-stat" data-peringatan={ringkasan.perhatian > 0 ? "ya" : "tidak"}>
          <span className="dep-stat__label">Perlu perhatian</span>
          <strong className="dep-stat__nilai" data-testid="dep-perhatian">
            {ringkasan.perhatian}
          </strong>
          <small className="dep-stat__sub">sisa ≤ {AMBANG_PERINGATAN}%</small>
        </div>
      </section>

      <BannerUmurBarang daftar={daftar} maks={5} />

      <div className="dep-bar">
        <div className="dep-saringan" role="group" aria-label="Saring daftar">
          {SARINGAN.map((s) => (
            <button key={s.id} type="button" data-saringan={s.id} aria-pressed={saringan === s.id} onClick={() => setSaringan(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary dep-tambah" data-aksi="tambah-aset" onClick={() => setDialog({ jenis: "manual" })}>
          <Plus size={16} strokeWidth={2.6} aria-hidden="true" /> Tambah aset
        </button>
      </div>

      {tampil.length === 0 ? (
        <div className="dep-kosong card" data-testid="dep-kosong">
          <span className="dep-kosong__ikon" aria-hidden="true">
            📉
          </span>
          {daftar.length === 0 ? (
            <>
              <strong>Belum ada barang yang dipantau</strong>
              <p>
                Saat Anda mencatat pembelian barang yang tidak habis sekali pakai (laptop, ponsel, ban, aki, oli, dan sejenisnya), aplikasi
                otomatis menawarkan <em>hitung depresiasi</em>. Bila Anda setuju, barangnya masuk ke sini dan Anda diingatkan saat nilai atau umurnya
                tinggal {AMBANG_PERINGATAN}%.
              </p>
              <p>Barang yang dibeli sebelumnya bisa ditambahkan lewat tombol Tambah aset.</p>
            </>
          ) : (
            <>
              <strong>Tidak ada barang pada saringan ini</strong>
              <p>Pilih saringan lain untuk melihat barang yang dipantau.</p>
            </>
          )}
        </div>
      ) : (
        <div className="dep-daftar" data-testid="dep-daftar">
          {tampil.map(({ item }) => (
            <KartuUmur key={item.id} item={item} onSimpan={onSimpan} onHapus={onHapus} onUbah={(x) => setDialog({ jenis: "ubah", item: x })} />
          ))}
        </div>
      )}

      <PedomanDepresiasi onPakaiPreset={pakaiPreset} />

      {dialog && (
        <DialogDepresiasi
          mode={dialog}
          daftarTransaksi={transaksi}
          idTerpantau={daftar.map((x) => x.transaksiId).filter((x): x is string => Boolean(x))}
          onSimpan={simpan}
          onTutup={() => setDialog(null)}
        />
      )}
    </div>
  );
};
