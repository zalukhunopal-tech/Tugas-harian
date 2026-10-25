import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Transaksi } from "../types";
import { formatRupiah, formatTanggalPanjang } from "../lib/constants";
import { KelompokGanda, waktuDariId } from "../lib/dataGanda";

interface KartuDataGandaProps {
  jumlahKelompok: number;
  jumlahLebih: number;
  onPeriksa: () => void;
  onAbaikan: () => void;
}

/** Kotak pilihan seukuran ikon; gaya `input` global (lebar penuh, bantalan) tidak boleh ikut menggembungkannya. */
const gayaKotakPilihan: React.CSSProperties = { width: "20px", height: "20px", minHeight: 0, padding: 0, margin: "2px 0 0", flex: "none" };

/** Peringatan di Riwayat: ada catatan yang tampak tercatat dua kali. Hanya tampil bila ada. */
export const KartuDataGanda: React.FC<KartuDataGandaProps> = ({ jumlahKelompok, jumlahLebih, onPeriksa, onAbaikan }) => (
  <div className="card kartu-mencurigakan" role="alert" data-testid="kartu-data-ganda">
    <strong>⚠️ {jumlahLebih} catatan kemungkinan tercatat dua kali</strong>
    <p>
      Ada {jumlahKelompok} kelompok catatan dengan tanggal, jumlah, dan uraian yang sama. Biasanya satu transaksi yang diketik dua kali
      atau terbaca ulang dari Drive. Periksa, lalu hapus salinan yang tidak perlu.
    </p>
    <div className="kartu-mencurigakan__aksi">
      <button type="button" className="btn-primary" id="ganda-periksa" onClick={onPeriksa}>
        Periksa dan rapikan
      </button>
      <button type="button" className="btn-secondary" onClick={onAbaikan}>
        Biarkan
      </button>
    </div>
  </div>
);

interface DataGandaModalProps {
  kelompok: KelompokGanda[];
  onHapus: (ids: string[]) => void;
  onTutup: () => void;
}

const tanggalDibuat = (id: string): string => {
  const waktu = waktuDariId(id);
  return waktu > 0 ? new Date(waktu).toISOString().slice(0, 10) : "";
};

const ringkasan = (t: Transaksi): string[] => {
  const bagian = [t.metode, t.kategori];
  if (t.kaitan) bagian.push(`kaitan: ${t.kaitan}`);
  if (t.catatan) bagian.push(t.catatan.length > 60 ? `${t.catatan.slice(0, 57)}…` : t.catatan);
  if (t.bukti?.length) bagian.push(`${t.bukti.length} bukti`);
  const dibuat = tanggalDibuat(t.id);
  if (dibuat) bagian.push(`dicatat ${formatTanggalPanjang(dibuat)}`);
  return bagian;
};

/**
 * Daftar kelompok catatan kembar. Yang disarankan dihapus sudah dicentang (yang berketerangan paling banyak, lalu yang
 * paling baru dicatat, dipertahankan), tetapi pengguna bebas mengubah. Satu kelompok tidak bisa dihapus seluruhnya.
 */
export const DataGandaModal: React.FC<DataGandaModalProps> = ({ kelompok, onHapus, onTutup }) => {
  const awal = useMemo(() => new Set(kelompok.flatMap((k) => k.anggota.slice(1).map((t) => t.id))), [kelompok]);
  const [hapus, setHapus] = useState<Set<string>>(awal);
  const [yakin, setYakin] = useState(false);

  const alihkan = (k: KelompokGanda, id: string) => {
    setYakin(false);
    setHapus((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else if (k.anggota.some((t) => t.id !== id && !baru.has(t.id))) baru.add(id);
      return baru;
    });
  };

  return createPortal(
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Periksa data ganda"
      data-testid="data-ganda-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onTutup}
    >
      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          maxHeight: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Periksa data ganda</h3>
          <button type="button" className="btn-ikon" onClick={onTutup} aria-label="Tutup" style={{ fontSize: "1.2rem" }}>
            ✕
          </button>
        </div>
        <p className="help" style={{ marginTop: 0 }}>
          Centang catatan yang mau dihapus. Satu catatan di tiap kelompok selalu dipertahankan. Penghapusan ikut berlaku di
          spreadsheet Drive pada sinkron berikutnya.
        </p>

        {kelompok.length === 0 && <p data-testid="data-ganda-kosong">Tidak ada lagi catatan ganda.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {kelompok.map((k) => {
            const contoh = k.anggota[0];
            return (
              <section
                key={k.kunci}
                data-testid="kelompok-ganda"
                style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "10px 12px" }}
              >
                <strong style={{ display: "block", overflowWrap: "anywhere" }}>{contoh.deskripsi}</strong>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {formatTanggalPanjang(contoh.tanggal)} · {formatRupiah(contoh.jumlah)} · {contoh.dana} ·{" "}
                  {contoh.jenis === "pemasukan" ? "pemasukan" : "pengeluaran"}
                </span>
                <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                  {k.anggota.map((t) => {
                    const dicentang = hapus.has(t.id);
                    const satuSisa = !dicentang && k.anggota.filter((x) => !hapus.has(x.id)).length === 1;
                    return (
                      <li key={t.id}>
                        <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: satuSisa ? "not-allowed" : "pointer" }}>
                          <input
                            type="checkbox"
                            className="ganda-hapus"
                            data-id={t.id}
                            checked={dicentang}
                            disabled={satuSisa}
                            onChange={() => alihkan(k, t.id)}
                            style={gayaKotakPilihan}
                          />
                          <span style={{ fontSize: "0.85rem", minWidth: 0, overflowWrap: "anywhere" }}>
                            <strong>{dicentang ? "Hapus" : "Pertahankan"}</strong> · {ringkasan(t).join(" · ")}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px", alignItems: "center" }}>
          {!yakin ? (
            <button type="button" className="btn-primary" id="ganda-hapus" disabled={hapus.size === 0} onClick={() => setYakin(true)}>
              Hapus {hapus.size} catatan terpilih
            </button>
          ) : (
            <>
              <span style={{ fontSize: "0.85rem" }}>Hapus {hapus.size} catatan? Ini tidak bisa dibatalkan.</span>
              <button type="button" className="btn-primary" id="ganda-yakin" onClick={() => onHapus([...hapus])}>
                Ya, hapus
              </button>
              <button type="button" className="btn-secondary" onClick={() => setYakin(false)}>
                Batal
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={onTutup}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
