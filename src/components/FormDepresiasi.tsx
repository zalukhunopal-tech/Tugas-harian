import React, { useMemo } from "react";
import { hariIni } from "../lib/constants";
import { PresetBarang, cariPreset, presetPerKelompok } from "../lib/basisDataUmur";
import { FormPenyusutan, LABEL_METODE, hitungPenyusutan, itemDariForm, terapkanPreset } from "../lib/penyusutan";
import { PratinjauUmur } from "./UmurBarangUI";

interface FormDepresiasiProps {
  nilai: FormPenyusutan;
  onUbah: (f: FormPenyusutan) => void;
  /** Harga beli (C). */
  harga: number;
  /** Bila diberikan, harga bisa diisi atau diubah di sini (aset yang dimasukkan manual). */
  hargaTeks?: string;
  onUbahHarga?: (nilai: string) => void;
  /** Tanggal beli bawaan bila kolom tanggal dikosongkan (tanggal transaksi). */
  tanggalBawaan: string;
  /** Uraian pembelian, dipakai sebagai petunjuk nama barang. */
  uraian: string;
  /** Preset yang dikenali dari uraian; ditampilkan paling atas sebagai saran. */
  saran?: PresetBarang;
}

const METODE_URUT = ["garis-lurus", "saldo-menurun-ganda", "jumlah-angka-tahun"] as const;
const KETERANGAN_METODE: Record<(typeof METODE_URUT)[number], string> = {
  "garis-lurus": "Susut sama besar tiap periode: D = (C − S) / n. Cocok untuk perabot dan peralatan; untuk km atau jam ini metode unit produksi.",
  "saldo-menurun-ganda": "Susut lebih besar di awal, tarif 2 / n dari nilai buku. Cocok untuk elektronik dan kendaraan.",
  "jumlah-angka-tahun": "Susut menurun bertahap: tahun ke-k = (C − S) × (n − k + 1) / (n(n + 1)/2). Jalan tengah antara dua metode lain.",
};

const Chip: React.FC<{ preset: PresetBarang; nilai: FormPenyusutan; onPilih: (p: PresetBarang) => void }> = ({ preset, nilai, onPilih }) => (
  <button type="button" data-preset={preset.id} aria-pressed={nilai.presetId === preset.id} title={preset.catatan} onClick={() => onPilih(preset)}>
    <span aria-hidden="true">{preset.ikon}</span> {preset.nama}
  </button>
);

/**
 * Isian depresiasi satu barang: pilih dari daftar umur standar (atau isi sendiri), lalu lihat hitungan dan peringatan langsung.
 * Basis umur bisa waktu kalender (hari, bulan, tahun) atau pemakaian (kilometer, jam) dengan batas waktu kedua yang opsional.
 */
export const FormDepresiasi: React.FC<FormDepresiasiProps> = ({ nilai, onUbah, harga, hargaTeks, onUbahHarga, tanggalBawaan, uraian, saran }) => {
  const ubah = (b: Partial<FormPenyusutan>) => onUbah({ ...nilai, ...b });
  const sekarang = hariIni();
  const pilih = (p: PresetBarang) => onUbah(terapkanPreset(nilai, p));

  const item = useMemo(
    () => itemDariForm(nilai, { id: "pratinjau", harga, tanggalTransaksi: tanggalBawaan || sekarang, namaCadangan: uraian }),
    [nilai, harga, tanggalBawaan, uraian, sekarang]
  );
  const hasil = item ? hitungPenyusutan(item, sekarang) : null;
  const satuanPemakaian = nilai.satuanPemakaian === "jam" ? "jam" : "km";
  const pakaiPemakaian = nilai.basis === "pemakaian";
  const terpilih = cariPreset(nilai.presetId);
  const kelompok = useMemo(() => presetPerKelompok(), []);

  return (
    <div className="penyusutan-isi" data-testid="penyusutan-form">
      {saran && (
        <div className="penyusutan-saran" data-testid="saran-preset">
          <span className="penyusutan-subjudul">Dikenali dari uraian</span>
          <div className="penyusutan-chips" role="group" aria-label="Saran barang">
            <Chip preset={saran} nilai={nilai} onPilih={pilih} />
          </div>
        </div>
      )}

      <details className="penyusutan-katalog" open={!saran && !nilai.presetId}>
        <summary>Pilih dari daftar umur standar</summary>
        {kelompok.map((g) => (
          <div className="penyusutan-preset" key={g.kelompok}>
            <span className="penyusutan-subjudul">{g.kelompok}</span>
            <div className="penyusutan-chips" role="group" aria-label={g.kelompok}>
              {g.daftar.map((p) => (
                <Chip key={p.id} preset={p} nilai={nilai} onPilih={pilih} />
              ))}
            </div>
          </div>
        ))}
      </details>

      {terpilih && (
        <p className="penyusutan-catatan" data-testid="catatan-preset">
          <strong>{terpilih.nama}:</strong> {terpilih.rentang}.{" "}
          <span className={`penyusutan-keyakinan penyusutan-keyakinan--${terpilih.keyakinan}`}>{terpilih.keyakinan === "sumber" ? `Sumber: ${terpilih.sumber}` : "Perkiraan umum, ikuti buku manual"}</span>
          {terpilih.kelompokPajak ? ` Kelompok ${terpilih.kelompokPajak} PMK 72/2023.` : ""} Sesuaikan bila perlu.
        </p>
      )}

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

        <div className="penyusutan-kolom">
          <label htmlFor="penyusutan-harga">Harga beli (Rp)</label>
          <input
            id="penyusutan-harga"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="0"
            value={onUbahHarga ? hargaTeks ?? "" : String(harga)}
            readOnly={!onUbahHarga}
            aria-readonly={!onUbahHarga}
            title={onUbahHarga ? undefined : "Mengikuti jumlah pada transaksi"}
            onChange={(e) => onUbahHarga?.(e.target.value)}
          />
        </div>

        <div className="penyusutan-kolom">
          <label htmlFor="penyusutan-tanggal">Tanggal beli / ganti</label>
          <input id="penyusutan-tanggal" type="date" value={nilai.tanggalMulai || tanggalBawaan} onChange={(e) => ubah({ tanggalMulai: e.target.value })} />
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
          <label htmlFor="penyusutan-residu">Nilai residu (Rp)</label>
          <input id="penyusutan-residu" type="number" inputMode="numeric" min="0" placeholder="0" value={nilai.nilaiResidu} onChange={(e) => ubah({ nilaiResidu: e.target.value })} />
        </div>

        {pakaiPemakaian && (
          <>
            <div className="penyusutan-kolom">
              <label htmlFor="penyusutan-batas-waktu">Batas waktu (bulan), opsional</label>
              <input id="penyusutan-batas-waktu" type="number" inputMode="decimal" min="0" step="any" placeholder="Mis. 2 untuk oli motor" value={nilai.batasWaktuBulan} onChange={(e) => ubah({ batasWaktuBulan: e.target.value })} />
            </div>
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

        {nilai.jenisBarang === "aset" && (
          <div className="penyusutan-kolom penyusutan-kolom--penuh">
            <span className="penyusutan-subjudul">Metode depresiasi</span>
            <div className="penyusutan-segmen" role="group" aria-label="Metode depresiasi">
              {METODE_URUT.map((m) => (
                <button key={m} type="button" aria-pressed={nilai.metode === m} data-metode={m} onClick={() => ubah({ metode: m })}>
                  {LABEL_METODE[m]}
                </button>
              ))}
            </div>
            <span className="penyusutan-catatan">{KETERANGAN_METODE[nilai.metode]}</span>
          </div>
        )}
      </div>

      {item && hasil ? (
        <PratinjauUmur item={item} hasil={hasil} />
      ) : (
        <p className="penyusutan-catatan" data-testid="penyusutan-belum-lengkap">
          {harga > 0 ? "Isi total umur pakai atau pilih dari daftar umur standar untuk melihat hitungan." : "Isi harga beli untuk melihat hitungan."}
        </p>
      )}
    </div>
  );
};
