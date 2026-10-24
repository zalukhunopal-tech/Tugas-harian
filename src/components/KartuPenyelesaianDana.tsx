import React from "react";
import { formatRupiah } from "../lib/constants";
import { RingkasanPenyelesaian, StatusPenyelesaian } from "../lib/penyelesaianDana";

interface KartuPenyelesaianDanaProps {
  ringkasan: RingkasanPenyelesaian;
  /** Nama kegiatan bila dihitung untuk satu kegiatan; kosong bila dihitung dari saringan laporan. */
  namaKegiatan?: string;
  /** Rentang tanggal kegiatan yang dihitung, ditampilkan di samping nama kegiatan. */
  rentangKegiatan?: string;
  /** True bila tanggal selesai kegiatan belum lewat: angka masih bisa berubah. */
  sementara?: boolean;
  /** Versi ringkas tanpa penjelasan, untuk lembar dokumen. */
  ringkas?: boolean;
}

const IKON_STATUS: Record<StatusPenyelesaian, string> = {
  kembalikan: "↩️",
  reimbursement: "💸",
  nihil: "✅",
};

/**
 * Penyelesaian akhir dana operasional kegiatan (cash advance): dana awal dibandingkan dengan realisasi
 * pengeluaran kegiatan ditambah perdiem. Aturannya ada di lib/penyelesaianDana.ts.
 */
export const KartuPenyelesaianDana: React.FC<KartuPenyelesaianDanaProps> = ({
  ringkasan,
  namaKegiatan,
  rentangKegiatan,
  sementara = false,
  ringkas = false,
}) => {
  const baris: Array<{ label: string; nilai: string; tebal?: boolean }> = [
    { label: "Dana awal kegiatan (uang muka dari lembaga)", nilai: formatRupiah(ringkasan.danaAwal) },
    { label: "Realisasi pengeluaran kegiatan", nilai: formatRupiah(ringkasan.realisasiOperasional) },
    { label: "Total perdiem", nilai: formatRupiah(ringkasan.totalPerdiem) },
    { label: "Total pengeluaran yang diakui", nilai: formatRupiah(ringkasan.totalDiakui), tebal: true },
  ];

  return (
    <div className="kartu-penyelesaian" data-status={ringkasan.status}>
      <div className="kartu-penyelesaian__judul">
        <strong>Penyelesaian Dana Kegiatan</strong>
        {namaKegiatan && (
          <span className="kartu-penyelesaian__kegiatan">
            {" "}
            · {namaKegiatan}
            {rentangKegiatan ? ` (${rentangKegiatan})` : ""}
          </span>
        )}
        {sementara && <span className="kartu-penyelesaian__sementara">Perhitungan sementara: kegiatan belum selesai</span>}
      </div>

      <dl className="kartu-penyelesaian__baris">
        {baris.map((b) => (
          <div key={b.label} className={b.tebal ? "kartu-penyelesaian__baris-tebal" : undefined}>
            <dt>{b.label}</dt>
            <dd>{b.nilai}</dd>
          </div>
        ))}
      </dl>

      <div className="kartu-penyelesaian__status" role="status">
        <span aria-hidden="true">{IKON_STATUS[ringkasan.status]}</span>
        <div>
          <div className="kartu-penyelesaian__status-label">{ringkasan.labelStatus}</div>
          {ringkasan.status !== "nihil" && (
            <div className="kartu-penyelesaian__status-nilai">{formatRupiah(ringkasan.jumlahStatus)}</div>
          )}
        </div>
      </div>

      {!ringkas && (
        <p className="kartu-penyelesaian__catatan">
          Dihitung dari {ringkasan.jumlahTransaksi} transaksi Dana Kegiatan. Perdiem adalah pengeluaran berkategori
          &quot;Perdiem&quot;. Kebutuhan pribadi di luar operasional dan perdiem tidak ditanggung lembaga: catat di
          Dana Pribadi, bukan di Dana Kegiatan.
        </p>
      )}
    </div>
  );
};
