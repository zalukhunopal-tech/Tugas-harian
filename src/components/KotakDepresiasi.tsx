import React, { useEffect, useMemo, useState } from "react";
import { cariPresetDariTeks } from "../lib/basisDataUmur";
import { FormPenyusutan, LABEL_METODE, teksUmurTotal, terapkanPreset } from "../lib/penyusutan";
import { nilaiTawaranDepresiasi } from "../lib/tawaranDepresiasi";
import { FormDepresiasi } from "./FormDepresiasi";

interface KotakDepresiasiProps {
  nilai: FormPenyusutan;
  onUbah: (f: FormPenyusutan) => void;
  /** Dipanggil saat pengguna sendiri mencentang atau melepas centang (bukan perubahan otomatis). */
  onDisentuh?: () => void;
  harga: number;
  tanggal: string;
  uraian: string;
  kategori: string;
}

/**
 * Kotak centang "Masukkan ke Depresiasi Aset" di formulir pengeluaran. Begitu dicentang, umur, satuan, dan metode terisi
 * otomatis dari basis data umur menurut uraian barang (oli, aki, ban, laptop, dan seterusnya); isian lengkap hanya dibuka bila
 * pengguna ingin mengubahnya. Barang masuk daftar Depresiasi Aset di tab Saya saat pengeluaran disimpan.
 */
export const KotakDepresiasi: React.FC<KotakDepresiasiProps> = ({ nilai, onUbah, onDisentuh, harga, tanggal, uraian, kategori }) => {
  const [rinciBuka, setRinciBuka] = useState(false);

  const saran = useMemo(() => nilaiTawaranDepresiasi({ jenis: "pengeluaran", deskripsi: uraian, kategori, jumlah: harga }), [uraian, kategori, harga]);

  const terapkanDariUraian = (dasar: FormPenyusutan): FormPenyusutan => {
    const cocok = cariPresetDariTeks(uraian);
    if (!cocok) return dasar;
    return terapkanPreset({ ...dasar, nama: dasar.nama.trim() ? dasar.nama : uraian.trim().slice(0, 80) }, cocok.preset);
  };

  // Uraian yang diketik setelah kotak dicentang tetap dikenali selama pengguna belum memilih barang sendiri.
  useEffect(() => {
    if (nilai.aktif && !nilai.presetId && !nilai.umurTotal) {
      const baru = terapkanDariUraian(nilai);
      if (baru !== nilai) onUbah(baru);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uraian, nilai.aktif]);

  const berubah = (aktif: boolean) => {
    onDisentuh?.();
    if (!aktif) {
      onUbah({ ...nilai, aktif: false });
      return;
    }
    const dasar: FormPenyusutan = { ...nilai, aktif: true };
    const hasil = nilai.presetId || nilai.umurTotal ? dasar : terapkanDariUraian(dasar);
    onUbah(hasil);
    setRinciBuka(!hasil.umurTotal);
  };

  const terisi = nilai.aktif && Number(nilai.umurTotal) > 0;
  const metodeTeks = nilai.jenisBarang === "aset" ? LABEL_METODE[nilai.metode] : nilai.basis === "pemakaian" ? "Unit produksi" : "Garis lurus";

  return (
    <div className={`dep-centang field wide${nilai.aktif ? " dep-centang--aktif" : ""}${!nilai.aktif && saran.tawar ? " dep-centang--saran" : ""}`} data-testid="kotak-depresiasi">
      <label className="dep-centang__baris" htmlFor="masuk-depresiasi">
        <input id="masuk-depresiasi" type="checkbox" checked={nilai.aktif} onChange={(e) => berubah(e.target.checked)} />
        <span className="dep-centang__teks">
          <strong>Masukkan ke Depresiasi Aset</strong>
          <small>
            {!nilai.aktif && saran.tawar && saran.preset
              ? `💡 Disarankan: ${saran.preset.nama} termasuk barang yang tidak habis sekali pakai.`
              : "Untuk barang yang bukan sekali pakai (oli, aki, ban, laptop, peralatan). Nilai dan umurnya dipantau di tab Saya."}
          </small>
        </span>
      </label>

      {nilai.aktif && (
        <div className="dep-centang__isi">
          {terisi ? (
            <p className="dep-centang__ringkas" data-testid="ringkas-depresiasi">
              <strong>{nilai.nama || uraian || "Barang"}</strong>
              <span>
                umur {teksUmurTotal({ basis: nilai.basis, umurTotal: Number(nilai.umurTotal), satuanWaktu: nilai.satuanWaktu, satuanPemakaian: nilai.satuanPemakaian, batasWaktuBulan: Number(nilai.batasWaktuBulan) || undefined })} · {metodeTeks}
              </span>
            </p>
          ) : (
            <p className="dep-centang__ringkas dep-centang__ringkas--kosong" data-testid="ringkas-depresiasi">
              Barang belum dikenali dari uraian. Pilih dari daftar umur standar atau isi umur pakainya di bawah.
            </p>
          )}
          <details className="dep-centang__atur" open={rinciBuka || !terisi} onToggle={(e) => setRinciBuka((e.currentTarget as HTMLDetailsElement).open)}>
            <summary>{terisi ? "Atur detail" : "Isi detail"}</summary>
            <FormDepresiasi nilai={nilai} onUbah={onUbah} harga={harga} tanggalBawaan={tanggal} uraian={uraian} saran={saran.tawar ? saran.preset : undefined} />
          </details>
        </div>
      )}
    </div>
  );
};
