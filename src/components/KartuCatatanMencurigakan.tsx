import React from "react";
import { Transaksi } from "../types";
import { formatRupiah, labelKategori } from "../lib/constants";

interface KartuCatatanMencurigakanProps {
  daftar: Transaksi[];
  onHapus: () => void;
  onAbaikan: () => void;
}

/**
 * Peringatan di Riwayat untuk pemasukan Dana Kegiatan yang tidak sesuai aturan aplikasi (lihat cariCatatanMencurigakan),
 * dengan satu tombol untuk menghapus semuanya. Hanya tampil bila ada, jadi tidak mengubah tata letak yang biasa.
 */
export const KartuCatatanMencurigakan: React.FC<KartuCatatanMencurigakanProps> = ({ daftar, onHapus, onAbaikan }) => {
  const total = daftar.reduce((s, t) => s + t.jumlah, 0);
  const contoh = daftar.slice(0, 3);
  return (
    <div className="card kartu-mencurigakan" role="alert" data-testid="kartu-mencurigakan">
      <strong>⚠️ {daftar.length} catatan yang kemungkinan bukan buatan Anda</strong>
      <p>
        Pemasukan Dana Kegiatan dengan kategori bukan "Penerimaan Dana" (total {formatRupiah(total)}). Biasanya ini sisa baris
        file timesheet yang salah terbaca sebagai transaksi.
      </p>
      <ul>
        {contoh.map((t) => (
          <li key={t.id}>
            {t.deskripsi || "(tanpa uraian)"} · {labelKategori(t.kategori)} · {formatRupiah(t.jumlah)}
          </li>
        ))}
        {daftar.length > contoh.length && <li>dan {daftar.length - contoh.length} lainnya</li>}
      </ul>
      <div className="kartu-mencurigakan__aksi">
        <button type="button" className="btn-primary" onClick={onHapus}>
          Hapus {daftar.length} catatan ini
        </button>
        <button type="button" className="btn-secondary" onClick={onAbaikan}>
          Biarkan
        </button>
      </div>
    </div>
  );
};
