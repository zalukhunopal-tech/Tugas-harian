import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ItemPenyusutan, Transaksi } from "../types";
import { formatRupiah, hariIni } from "../lib/constants";
import { buatId } from "../lib/storage";
import { PresetBarang } from "../lib/basisDataUmur";
import { FORM_PENYUSUTAN_AWAL, FormPenyusutan, formDariItem, galatForm, itemDariForm, terapkanPreset } from "../lib/penyusutan";
import { FormDepresiasi } from "./FormDepresiasi";

/** Tiga cara dialog dibuka: tawaran otomatis setelah pembelian dicatat, tambah manual, atau ubah barang yang sudah dipantau. */
export type ModeDialogDepresiasi =
  | { jenis: "tawaran"; transaksi: Transaksi; preset?: PresetBarang; alasan: string }
  | { jenis: "manual"; preset?: PresetBarang }
  | { jenis: "ubah"; item: ItemPenyusutan };

interface DialogDepresiasiProps {
  mode: ModeDialogDepresiasi;
  /** Pengeluaran yang sudah tercatat, untuk memilih barang yang dibeli sebelumnya (mode manual). */
  daftarTransaksi?: Transaksi[];
  /** Id transaksi yang sudah punya pantauan; tidak ditawarkan lagi di pilihan. */
  idTerpantau?: string[];
  onSimpan: (item: ItemPenyusutan) => void;
  onTutup: () => void;
}

function formAwal(mode: ModeDialogDepresiasi): FormPenyusutan {
  if (mode.jenis === "ubah") return formDariItem(mode.item);
  if (mode.jenis === "tawaran") {
    const dasar: FormPenyusutan = { ...FORM_PENYUSUTAN_AWAL, aktif: true, nama: mode.transaksi.deskripsi.trim().slice(0, 80) };
    return mode.preset ? terapkanPreset(dasar, mode.preset) : dasar;
  }
  const dasar: FormPenyusutan = { ...FORM_PENYUSUTAN_AWAL, aktif: true };
  return mode.preset ? terapkanPreset(dasar, mode.preset) : dasar;
}

/**
 * Dialog Depresiasi Aset. Pada tawaran otomatis pengguna lebih dulu ditanya "hitung depresiasi atau tidak"; hanya bila setuju,
 * isian (sudah terisi dari daftar umur standar) tampil dan barangnya masuk daftar. Mode manual dan ubah langsung ke isian.
 */
export const DialogDepresiasi: React.FC<DialogDepresiasiProps> = ({ mode, daftarTransaksi = [], idTerpantau = [], onSimpan, onTutup }) => {
  const [langkah, setLangkah] = useState<"tanya" | "isi">(mode.jenis === "tawaran" ? "tanya" : "isi");
  const [form, setForm] = useState<FormPenyusutan>(() => formAwal(mode));
  const [hargaTeks, setHargaTeks] = useState(() => (mode.jenis === "ubah" ? String(mode.item.harga) : ""));
  const [transaksiDipilih, setTransaksiDipilih] = useState<Transaksi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    const tutupDenganEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", tutupDenganEsc);
    return () => document.removeEventListener("keydown", tutupDenganEsc);
  }, [onTutup]);

  const transaksiAsal = mode.jenis === "tawaran" ? mode.transaksi : transaksiDipilih;
  const harga = mode.jenis === "tawaran" ? mode.transaksi.jumlah : mode.jenis === "ubah" ? Number(hargaTeks) || 0 : transaksiDipilih ? transaksiDipilih.jumlah : Number(hargaTeks) || 0;
  const tanggalBawaan = mode.jenis === "ubah" ? mode.item.tanggalMulai : transaksiAsal?.tanggal ?? hariIni();

  const pengeluaranTerbaru = useMemo(
    () =>
      mode.jenis === "manual"
        ? daftarTransaksi
            .filter((t) => t.jenis === "pengeluaran" && t.kategori !== "Perdiem" && !idTerpantau.includes(t.id))
            .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
            .slice(0, 40)
        : [],
    [mode.jenis, daftarTransaksi, idTerpantau]
  );

  const pilihTransaksi = (id: string) => {
    const t = pengeluaranTerbaru.find((x) => x.id === id) ?? null;
    setTransaksiDipilih(t);
    if (t) {
      setHargaTeks(String(t.jumlah));
      setForm((f) => ({ ...f, nama: f.nama.trim() ? f.nama : t.deskripsi.trim().slice(0, 80), tanggalMulai: t.tanggal }));
    }
  };

  const simpan = () => {
    const pesan = galatForm(form, harga);
    if (pesan) {
      setGalat(pesan.replace(/^Penyusutan: /, "").replace("jumlah pembelian", "harga beli"));
      return;
    }
    const item = itemDariForm(form, {
      id: mode.jenis === "ubah" ? mode.item.id : "pny_" + buatId(),
      transaksiId: mode.jenis === "ubah" ? mode.item.transaksiId : transaksiAsal?.id,
      harga,
      tanggalTransaksi: tanggalBawaan,
      namaCadangan: transaksiAsal?.deskripsi ?? "",
      lama: mode.jenis === "ubah" ? mode.item : undefined,
    });
    if (item) onSimpan(item);
  };

  const judul = mode.jenis === "tawaran" ? "Hitung depresiasi barang ini?" : mode.jenis === "ubah" ? "Ubah data depresiasi" : "Tambah ke Depresiasi Aset";

  return createPortal(
    <div className="dep-latar" role="dialog" aria-modal="true" aria-label={judul} data-testid="dialog-depresiasi" onClick={onTutup}>
      <div className="dep-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="dep-dialog__kepala">
          <span className="dep-dialog__ikon" aria-hidden="true">
            {mode.jenis === "tawaran" ? "💡" : "📉"}
          </span>
          <div>
            <h3 className="dep-dialog__judul">{judul}</h3>
            {mode.jenis === "tawaran" && <p className="dep-dialog__sub">Aplikasi mengenali pembelian ini sebagai barang yang tidak habis sekali pakai.</p>}
          </div>
          <button type="button" className="dep-dialog__tutup" onClick={onTutup} aria-label="Tutup">
            ×
          </button>
        </header>

        {langkah === "tanya" && mode.jenis === "tawaran" ? (
          <>
            <div className="dep-dialog__isi">
              <div className="dep-tawaran" data-testid="tawaran-depresiasi">
                <strong className="dep-tawaran__nama">{mode.transaksi.deskripsi || "Pembelian barang"}</strong>
                <span className="dep-tawaran__harga">{formatRupiah(mode.transaksi.jumlah)}</span>
                <p className="dep-tawaran__alasan">{mode.alasan}</p>
                {mode.preset && (
                  <p className="dep-tawaran__preset">
                    <span aria-hidden="true">{mode.preset.ikon}</span> Umur standar: {mode.preset.catatan}
                  </p>
                )}
              </div>
              <p className="help">
                Bila dihitung, barang masuk daftar <strong>Depresiasi Aset</strong> di tab Saya. Nilai buku dan sisa umurnya dipantau, dan Anda
                diingatkan otomatis saat sisanya tinggal 30% atau kurang.
              </p>
            </div>
            <footer className="dep-dialog__aksi">
              <button type="button" className="btn-secondary" data-aksi="tolak" onClick={onTutup}>
                Tidak perlu
              </button>
              <button type="button" className="btn-primary" data-aksi="setuju" onClick={() => setLangkah("isi")}>
                Ya, hitung depresiasi
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="dep-dialog__isi">
              {mode.jenis === "manual" && (
                <div className="penyusutan-kolom penyusutan-kolom--penuh dep-ambil">
                  <label htmlFor="dep-ambil-transaksi">Ambil dari pengeluaran yang sudah dicatat (opsional)</label>
                  <select id="dep-ambil-transaksi" value={transaksiDipilih?.id ?? ""} onChange={(e) => pilihTransaksi(e.target.value)}>
                    <option value="">Isi sendiri</option>
                    {pengeluaranTerbaru.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tanggal} · {t.deskripsi || t.kategori} · {formatRupiah(t.jumlah)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <FormDepresiasi
                nilai={form}
                onUbah={(f) => {
                  setForm(f);
                  setGalat(null);
                }}
                harga={harga}
                hargaTeks={mode.jenis === "tawaran" || transaksiDipilih ? undefined : hargaTeks}
                onUbahHarga={mode.jenis === "tawaran" || transaksiDipilih ? undefined : (v) => setHargaTeks(v)}
                tanggalBawaan={tanggalBawaan}
                uraian={transaksiAsal?.deskripsi ?? ""}
                saran={mode.jenis === "tawaran" ? mode.preset : undefined}
              />
              {galat && (
                <p className="dep-galat" role="alert" data-testid="galat-depresiasi">
                  {galat}
                </p>
              )}
            </div>
            <footer className="dep-dialog__aksi">
              <button type="button" className="btn-secondary" data-aksi="batal" onClick={onTutup}>
                Batal
              </button>
              <button type="button" className="btn-primary" data-aksi="simpan" onClick={simpan}>
                {mode.jenis === "ubah" ? "Simpan perubahan" : "Simpan ke Depresiasi Aset"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
