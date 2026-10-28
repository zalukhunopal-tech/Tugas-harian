import React, { useState } from "react";
import { ItemPenyusutan } from "../types";
import { formatRupiah, hariIni } from "../lib/constants";
import { tanggalPendek } from "../lib/perdiemOtomatis";
import {
  AMBANG_PERINGATAN,
  HasilPenyusutan,
  LABEL_METODE,
  LABEL_SATUAN_PEMAKAIAN,
  LABEL_SATUAN_WAKTU,
  TingkatUmur,
  formatBeban,
  formatPersen,
  hitungPenyusutan,
  itemPerluPeringatan,
  mulaiSiklusBaru,
  perbaruiPemakaian,
  pesanPeringatan,
  teksSisaUmur,
  teksUmurTotal,
} from "../lib/penyusutan";

/** Bilah kemajuan sisa umur/nilai: hijau saat aman, merah menyala pada 30% ke bawah. */
export const BilahUmur: React.FC<{ persen: number; tingkat: TingkatUmur; label: string }> = ({ persen, tingkat, label }) => {
  const lebar = Math.max(0, Math.min(100, persen));
  return (
    <div
      className="umur-bilah"
      data-tingkat={tingkat}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(lebar)}
    >
      <span style={{ width: `${lebar}%` }} />
    </div>
  );
};

const TEKS_LENCANA: Record<TingkatUmur, string> = {
  aman: "Aman",
  mendekati: "Mendekati batas",
  kritis: "Segera ganti",
  habis: "Melewati umur",
};

/** Lencana kecil bernyala (merah/kuning) untuk barang yang sisanya ≤ 30%. */
export const LencanaUmur: React.FC<{ hasil: HasilPenyusutan }> = ({ hasil }) => {
  if (!hasil.perluPeringatan) return null;
  return (
    <span className="umur-lencana" data-tingkat={hasil.tingkat} data-testid="lencana-umur" title={`Sisa ${formatPersen(hasil.persenTerendah)}: ${TEKS_LENCANA[hasil.tingkat]}`}>
      ⚠ {formatPersen(hasil.persenTerendah)} · {TEKS_LENCANA[hasil.tingkat]}
    </span>
  );
};

function satuanItem(item: ItemPenyusutan): string {
  return item.basis === "pemakaian" ? LABEL_SATUAN_PEMAKAIAN[item.satuanPemakaian ?? "km"] : LABEL_SATUAN_WAKTU[item.satuanWaktu ?? "tahun"];
}

/** Angka-angka hasil hitungan: harga, beban per satuan, nilai buku, sisa nilai, sisa umur. */
export const RingkasanUmur: React.FC<{ item: ItemPenyusutan; hasil: HasilPenyusutan }> = ({ item, hasil }) => (
  <dl className="umur-metrik">
    <div>
      <dt>Harga beli</dt>
      <dd>{formatRupiah(item.harga)}</dd>
    </div>
    <div>
      <dt>Penyusutan per {satuanItem(item)}</dt>
      <dd>{formatBeban(hasil.bebanPerSatuan)}</dd>
    </div>
    <div>
      <dt>Nilai buku saat ini</dt>
      <dd>{formatRupiah(hasil.nilaiBuku)}</dd>
    </div>
    <div>
      <dt>Sisa nilai</dt>
      <dd data-testid="persen-sisa-nilai">{formatPersen(hasil.persenSisaNilai)}</dd>
    </div>
    <div>
      <dt>Sisa umur pakai</dt>
      <dd data-testid="sisa-umur">
        {teksSisaUmur(item, hasil)} <span className="umur-metrik__persen">({formatPersen(hasil.persenSisaUmur)})</span>
      </dd>
    </div>
  </dl>
);

/** Pratinjau lengkap (angka, bilah, dan peringatan) untuk satu item. */
export const PratinjauUmur: React.FC<{ item: ItemPenyusutan; hasil: HasilPenyusutan }> = ({ item, hasil }) => (
  <div className="umur-pratinjau" data-tingkat={hasil.tingkat} data-testid="pratinjau-umur">
    <RingkasanUmur item={item} hasil={hasil} />
    <BilahUmur persen={hasil.persenTerendah} tingkat={hasil.tingkat} label="Sisa umur atau nilai terendah" />
    <div className="umur-bilah-keterangan">
      <span>Sisa terendah: {formatPersen(hasil.persenTerendah)}</span>
      <span>
        {LABEL_METODE[item.metode]} · umur {teksUmurTotal(item)}
      </span>
    </div>
    {hasil.perluPeringatan && (
      <p className="umur-peringatan" role="alert" data-testid="peringatan-umur">
        ⚠️ {pesanPeringatan(item, hasil)}
      </p>
    )}
  </div>
);

interface BannerUmurBarangProps {
  daftar: ItemPenyusutan[];
  /** Membuka daftar lengkap (tab Aset). */
  onBuka?: () => void;
  /** Maksimal barang yang ditulis di banner; sisanya diringkas. */
  maks?: number;
}

/** Banner di dashboard bila ada barang yang sisa umur atau nilainya ≤ 30%. */
export const BannerUmurBarang: React.FC<BannerUmurBarangProps> = ({ daftar, onBuka, maks = 3 }) => {
  const peringatan = itemPerluPeringatan(daftar, hariIni());
  if (peringatan.length === 0) return null;
  const terparah = peringatan[0].hasil.tingkat;
  return (
    <section className="umur-banner no-print" role="alert" data-testid="banner-umur" data-tingkat={terparah} aria-label="Peringatan depresiasi aset">
      <div className="umur-banner__kepala">
        <strong>
          ⚠️ {peringatan.length} barang mendekati batas umur pakai (≤ {AMBANG_PERINGATAN}%)
        </strong>
        {onBuka && (
          <button type="button" className="btn-small" onClick={onBuka}>
            Buka Depresiasi
          </button>
        )}
      </div>
      <ul className="umur-banner__daftar">
        {peringatan.slice(0, maks).map(({ item, hasil }) => (
          <li key={item.id} data-testid="banner-umur-item">
            <div className="umur-banner__baris">
              <span className="umur-banner__nama">{item.nama}</span>
              <LencanaUmur hasil={hasil} />
            </div>
            <BilahUmur persen={hasil.persenTerendah} tingkat={hasil.tingkat} label={`Sisa ${item.nama}`} />
          </li>
        ))}
      </ul>
      {peringatan.length > maks && <p className="umur-banner__lain">+{peringatan.length - maks} barang lain</p>}
      <p className="umur-banner__catatan">Segera ganti atau servis sebelum umur pakainya habis. Peringatan menyala saat sisa nilai atau umur {AMBANG_PERINGATAN}% ke bawah.</p>
    </section>
  );
};

interface KartuUmurProps {
  item: ItemPenyusutan;
  onSimpan: (item: ItemPenyusutan) => void;
  onHapus: (id: string) => void;
  /** Membuka formulir untuk mengubah data barang. */
  onUbah?: (item: ItemPenyusutan) => void;
}

/** Kartu satu barang di layar Depresiasi Aset: angka hitungan, bilah sisa, peringatan, dan aksi. */
export const KartuUmur: React.FC<KartuUmurProps> = ({ item, onSimpan, onHapus, onUbah }) => {
  const hasil = hitungPenyusutan(item, hariIni());
  const [angkaPemakaian, setAngkaPemakaian] = useState(String(item.pemakaianSekarang ?? item.pemakaianAwal ?? 0));
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  if (!hasil) return null;
  return (
    <article className="umur-kartu" data-testid="kartu-umur" data-tingkat={hasil.tingkat} data-id={item.id}>
      <header className="umur-kartu__kepala">
        <div>
          <h4 className="umur-kartu__nama">{item.nama}</h4>
          <span className="umur-kartu__sub">
            {item.jenisBarang === "habis-pakai" ? "Habis pakai / servis berkala" : "Aset"} · {LABEL_METODE[item.metode]} · umur {teksUmurTotal(item)} · sejak {tanggalPendek(item.tanggalMulai)}
          </span>
        </div>
        <LencanaUmur hasil={hasil} />
      </header>
      <RingkasanUmur item={item} hasil={hasil} />
      <BilahUmur persen={hasil.persenTerendah} tingkat={hasil.tingkat} label={`Sisa ${item.nama}`} />
      {hasil.perluPeringatan && (
        <p className="umur-peringatan" role="alert">
          ⚠️ {pesanPeringatan(item, hasil)}
        </p>
      )}
      <div className="umur-kartu__aksi">
        {item.basis === "pemakaian" && (
          <form
            className="umur-kartu__pemakaian"
            onSubmit={(e) => {
              e.preventDefault();
              onSimpan(perbaruiPemakaian(item, Number(angkaPemakaian), hariIni()));
            }}
          >
            <label>
              <span>
                {LABEL_SATUAN_PEMAKAIAN[item.satuanPemakaian ?? "km"].toUpperCase()} saat ini
                <small> (saat ganti: {Number(item.pemakaianAwal ?? 0).toLocaleString("id-ID")})</small>
              </span>
              <input type="number" inputMode="numeric" min={item.pemakaianAwal ?? 0} value={angkaPemakaian} onChange={(e) => setAngkaPemakaian(e.target.value)} />
            </label>
            <button type="submit" className="btn-secondary">
              Perbarui
            </button>
          </form>
        )}
        <div className="umur-kartu__tombol">
          <button type="button" className="btn-secondary" data-aksi="ganti" onClick={() => onSimpan(mulaiSiklusBaru(item, hariIni()))} title="Mulai hitungan baru dari hari ini (catat pembeliannya lewat Tambah transaksi)">
            Sudah diganti / diservis
          </button>
          {onUbah && (
            <button type="button" className="btn-link umur-kartu__ubah" data-aksi="ubah" onClick={() => onUbah(item)}>
              Ubah data
            </button>
          )}
          {konfirmasiHapus ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => onHapus(item.id)} data-aksi="hapus-pasti">
                Ya, hapus
              </button>
              <button type="button" className="btn-link" onClick={() => setKonfirmasiHapus(false)}>
                Batal
              </button>
            </>
          ) : (
            <button type="button" className="btn-link umur-kartu__hapus" onClick={() => setKonfirmasiHapus(true)} data-aksi="hapus">
              Hapus pantauan
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
