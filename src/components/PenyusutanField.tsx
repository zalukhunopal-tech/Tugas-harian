import React, { useMemo } from "react";
import { hariIni } from "../lib/constants";
import {
  AMBANG_PERINGATAN,
  FORM_PENYUSUTAN_AWAL,
  FormPenyusutan,
  LABEL_METODE,
  PRESET_ASET,
  PRESET_HABIS_PAKAI,
  PresetBarang,
  cariPreset,
  hitungPenyusutan,
  itemDariForm,
  terapkanPreset,
} from "../lib/penyusutan";
import { PratinjauUmur } from "./UmurBarangUI";

interface PenyusutanFieldProps {
  nilai: FormPenyusutan;
  onUbah: (f: FormPenyusutan) => void;
  /** Harga beli (C): jumlah pengeluaran yang sedang diisi. */
  harga: number;
  tanggalTransaksi: string;
  /** Uraian transaksi, dipakai sebagai nama barang bila nama belum diisi. */
  uraian: string;
}

const PilihanPreset: React.FC<{ judul: string; daftar: PresetBarang[]; nilai: FormPenyusutan; onPilih: (p: PresetBarang) => void }> = ({ judul, daftar, nilai, onPilih }) => (
  <div className="penyusutan-preset">
    <span className="penyusutan-subjudul">{judul}</span>
    <div className="penyusutan-chips" role="group" aria-label={judul}>
      {daftar.map((p) => (
        <button key={p.id} type="button" data-preset={p.id} aria-pressed={nilai.presetId === p.id} title={p.catatan} onClick={() => onPilih(p)}>
          <span aria-hidden="true">{p.ikon}</span> {p.nama}
        </button>
      ))}
    </div>
  </div>
);

/**
 * Bagian formulir pembelian barang (opsional): hitung penyusutan nilai dan prediksi sisa umur pakai. Basis umur bisa waktu kalender
 * (hari, bulan, tahun) atau pemakaian (kilometer, jam). Hasil dan peringatan ≤ 30% langsung tampil sebagai pratinjau.
 */
export const PenyusutanField: React.FC<PenyusutanFieldProps> = ({ nilai, onUbah, harga, tanggalTransaksi, uraian }) => {
  const ubah = (b: Partial<FormPenyusutan>) => onUbah({ ...nilai, ...b });
  const sekarang = hariIni();

  const item = useMemo(
    () => (nilai.aktif ? itemDariForm(nilai, { id: "pratinjau", harga, tanggalTransaksi: tanggalTransaksi || sekarang, namaCadangan: uraian }) : null),
    [nilai, harga, tanggalTransaksi, uraian, sekarang]
  );
  const hasil = item ? hitungPenyusutan(item, sekarang) : null;
  const satuanPemakaian = nilai.satuanPemakaian === "jam" ? "jam" : "km";
  const pakaiPemakaian = nilai.basis === "pemakaian";

  return (
    <div className="penyusutan-kartu field wide" data-testid="penyusutan-form">
      <label className="penyusutan-toggle" htmlFor="penyusutan-aktif">
        <input
          id="penyusutan-aktif"
          type="checkbox"
          checked={nilai.aktif}
          onChange={(e) => ubah({ aktif: e.target.checked })}
        />
        <span>
          <strong>Hitung Penyusutan &amp; Umur Barang</strong>
          <small>Opsional. Pantau nilai buku dan sisa umur pakai (oli, aki, ban, elektronik, kendaraan); diperingatkan saat sisanya {AMBANG_PERINGATAN}% atau kurang.</small>
        </span>
      </label>

      {nilai.aktif && (
        <div className="penyusutan-isi">
          <PilihanPreset judul="Preset barang habis pakai / servis berkala" daftar={PRESET_HABIS_PAKAI} nilai={nilai} onPilih={(p) => onUbah(terapkanPreset(nilai, p))} />
          <PilihanPreset judul="Preset aset / inventaris" daftar={PRESET_ASET} nilai={nilai} onPilih={(p) => onUbah(terapkanPreset(nilai, p))} />
          {cariPreset(nilai.presetId)?.catatan && <p className="penyusutan-catatan">Patokan umum: {cariPreset(nilai.presetId)?.catatan}. Sesuaikan bila perlu.</p>}

          <div className="penyusutan-kisi">
            <div className="penyusutan-kolom penyusutan-kolom--penuh">
              <label htmlFor="penyusutan-nama">Nama barang</label>
              <input
                id="penyusutan-nama"
                type="text"
                maxLength={80}
                placeholder={uraian ? `Mis. ${uraian}` : "Mis. Oli mesin motor, Laptop kantor"}
                value={nilai.nama}
                onChange={(e) => ubah({ nama: e.target.value })}
              />
            </div>

            <div className="penyusutan-kolom penyusutan-kolom--penuh">
              <span className="penyusutan-subjudul">Jenis barang</span>
              <div className="penyusutan-segmen" role="group" aria-label="Jenis barang">
                <button type="button" aria-pressed={nilai.jenisBarang === "habis-pakai"} data-jenis="habis-pakai" onClick={() => ubah({ jenisBarang: "habis-pakai", metode: "garis-lurus", nilaiResidu: nilai.jenisBarang === "habis-pakai" ? nilai.nilaiResidu : "0" })}>
                  Habis pakai / servis berkala
                </button>
                <button type="button" aria-pressed={nilai.jenisBarang === "aset"} data-jenis="aset" onClick={() => ubah({ jenisBarang: "aset" })}>
                  Aset / inventaris
                </button>
              </div>
            </div>

            <div className="penyusutan-kolom penyusutan-kolom--penuh">
              <span className="penyusutan-subjudul">Umur dihitung berdasarkan</span>
              <div className="penyusutan-segmen" role="group" aria-label="Basis umur">
                <button type="button" aria-pressed={!pakaiPemakaian} data-basis="waktu" onClick={() => ubah({ basis: "waktu" })}>
                  Waktu kalender
                </button>
                <button type="button" aria-pressed={pakaiPemakaian} data-basis="pemakaian" onClick={() => ubah({ basis: "pemakaian" })}>
                  Pemakaian (km / jam)
                </button>
              </div>
            </div>

            <div className="penyusutan-kolom">
              <label htmlFor="penyusutan-umur">Total umur pakai</label>
              <div className="penyusutan-gabung">
                <input id="penyusutan-umur" type="number" inputMode="decimal" min="0" step="any" placeholder={pakaiPemakaian ? "2000" : "24"} value={nilai.umurTotal} onChange={(e) => ubah({ umurTotal: e.target.value })} />
                {pakaiPemakaian ? (
                  <select aria-label="Satuan pemakaian" value={satuanPemakaian} onChange={(e) => ubah({ satuanPemakaian: e.target.value as "km" | "jam" })}>
                    <option value="km">kilometer</option>
                    <option value="jam">jam pakai</option>
                  </select>
                ) : (
                  <select aria-label="Satuan waktu" value={nilai.satuanWaktu} onChange={(e) => ubah({ satuanWaktu: e.target.value as FormPenyusutan["satuanWaktu"] })}>
                    <option value="hari">hari</option>
                    <option value="bulan">bulan</option>
                    <option value="tahun">tahun</option>
                  </select>
                )}
              </div>
            </div>

            <div className="penyusutan-kolom">
              <label htmlFor="penyusutan-tanggal">Tanggal beli / ganti</label>
              <input id="penyusutan-tanggal" type="date" value={nilai.tanggalMulai || tanggalTransaksi} onChange={(e) => ubah({ tanggalMulai: e.target.value })} />
            </div>

            {pakaiPemakaian && (
              <>
                <div className="penyusutan-kolom">
                  <label htmlFor="penyusutan-awal">{satuanPemakaian.toUpperCase()} saat beli / ganti</label>
                  <input id="penyusutan-awal" type="number" inputMode="numeric" min="0" placeholder="45000" value={nilai.pemakaianAwal} onChange={(e) => ubah({ pemakaianAwal: e.target.value })} />
                </div>
                <div className="penyusutan-kolom">
                  <label htmlFor="penyusutan-kini">{satuanPemakaian.toUpperCase()} saat ini</label>
                  <input id="penyusutan-kini" type="number" inputMode="numeric" min="0" placeholder="Sama dengan saat ganti" value={nilai.pemakaianSekarang} onChange={(e) => ubah({ pemakaianSekarang: e.target.value })} />
                </div>
              </>
            )}

            <div className="penyusutan-kolom">
              <label htmlFor="penyusutan-residu">Nilai residu (Rp)</label>
              <input id="penyusutan-residu" type="number" inputMode="numeric" min="0" placeholder="0" value={nilai.nilaiResidu} onChange={(e) => ubah({ nilaiResidu: e.target.value })} />
            </div>

            {nilai.jenisBarang === "aset" && (
              <div className="penyusutan-kolom penyusutan-kolom--penuh">
                <span className="penyusutan-subjudul">Metode penyusutan</span>
                <div className="penyusutan-segmen" role="group" aria-label="Metode penyusutan">
                  <button type="button" aria-pressed={nilai.metode === "garis-lurus"} data-metode="garis-lurus" onClick={() => ubah({ metode: "garis-lurus" })}>
                    {LABEL_METODE["garis-lurus"]}
                  </button>
                  <button type="button" aria-pressed={nilai.metode === "saldo-menurun-ganda"} data-metode="saldo-menurun-ganda" onClick={() => ubah({ metode: "saldo-menurun-ganda" })}>
                    {LABEL_METODE["saldo-menurun-ganda"]}
                  </button>
                </div>
                <span className="penyusutan-catatan">
                  {nilai.metode === "garis-lurus" ? "Susut sama besar tiap periode: D = (C − S) / n." : "Susut lebih besar di awal (cocok untuk elektronik dan kendaraan): tarif 2 / n."}
                </span>
              </div>
            )}
          </div>

          {item && hasil ? (
            <PratinjauUmur item={item} hasil={hasil} />
          ) : (
            <p className="penyusutan-catatan" data-testid="penyusutan-belum-lengkap">
              {harga > 0 ? "Isi total umur pakai atau pilih preset untuk melihat hitungan." : "Isi jumlah pembelian di atas untuk melihat hitungan."}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export { FORM_PENYUSUTAN_AWAL };
