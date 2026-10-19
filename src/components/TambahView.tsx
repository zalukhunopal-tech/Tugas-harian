import React, { useState, useEffect } from "react";
import { Transaksi, JenisTransaksi, NamaDana } from "../types";
import { KATEGORI, KAITAN, METODE_BAYAR, hariIni } from "../lib/constants";
import { buatId } from "../lib/storage";

interface TambahViewProps {
  editTransaksi: Transaksi | null;
  onSimpan: (t: Transaksi) => void;
  onBatalEdit: () => void;
}

export const TambahView: React.FC<TambahViewProps> = ({
  editTransaksi,
  onSimpan,
  onBatalEdit,
}) => {
  const [jenis, setJenis] = useState<JenisTransaksi>("pengeluaran");
  const [dana, setDana] = useState<NamaDana>("Dana Pribadi");
  const [tanggal, setTanggal] = useState<string>(hariIni());
  const [deskripsi, setDeskripsi] = useState<string>("");
  const [kategori, setKategori] = useState<string>("");
  const [jumlah, setJumlah] = useState<string>("");
  const [metode, setMetode] = useState<string>("Tunai");
  const [kaitan, setKaitan] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");

  // Sync state when editing
  useEffect(() => {
    if (editTransaksi) {
      setJenis(editTransaksi.jenis);
      setDana(editTransaksi.dana);
      setTanggal(editTransaksi.tanggal);
      setDeskripsi(editTransaksi.deskripsi);
      setKategori(editTransaksi.kategori);
      setJumlah(String(editTransaksi.jumlah));
      setMetode(editTransaksi.metode || "Tunai");
      setKaitan(editTransaksi.kaitan || "");
      setCatatan(editTransaksi.catatan || "");
    } else {
      setJenis("pengeluaran");
      setDana("Dana Pribadi");
      setTanggal(hariIni());
      setDeskripsi("");
      setJumlah("");
      setMetode("Tunai");
      setKaitan("");
      setCatatan("");
      const defaultKategori = KATEGORI["Dana Pribadi"].pengeluaran[0];
      setKategori(defaultKategori);
    }
  }, [editTransaksi]);

  // Update default kategori when dana or jenis changes
  useEffect(() => {
    const list = KATEGORI[dana]?.[jenis] || [];
    if (!list.includes(kategori)) {
      setKategori(list[0] || "Lain-lain");
    }
  }, [dana, jenis, kategori]);

  const daftarKategori = KATEGORI[dana]?.[jenis] || [];
  const kaitanMeta = KAITAN[dana] || KAITAN["Dana Pribadi"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const jml = Number(jumlah);
    if (!deskripsi.trim() || !jml || jml <= 0) return;

    const trx: Transaksi = {
      id: editTransaksi ? editTransaksi.id : buatId(),
      jenis,
      dana,
      tanggal,
      deskripsi: deskripsi.trim(),
      kategori: kategori || daftarKategori[0] || "Lain-lain",
      jumlah: jml,
      metode,
      kaitan: kaitan.trim(),
      catatan: catatan.trim(),
    };

    onSimpan(trx);
    if (!editTransaksi) {
      setDeskripsi("");
      setJumlah("");
      setKaitan("");
      setCatatan("");
    }
  };

  return (
    <section className="view" id="view-tambah" data-view="tambah">
      <section className="card" id="kartu-form">
        <h2 id="judul-form">{editTransaksi ? "Ubah Transaksi" : "Tambah Transaksi"}</h2>
        <form id="form-transaksi" onSubmit={handleSubmit}>
          <fieldset className="field segmented">
            <legend>Jenis</legend>
            <div className="segmented-options">
              <label>
                <input
                  type="radio"
                  name="jenis"
                  value="pengeluaran"
                  checked={jenis === "pengeluaran"}
                  onChange={() => setJenis("pengeluaran")}
                />
                <span>Pengeluaran</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="jenis"
                  value="pemasukan"
                  checked={jenis === "pemasukan"}
                  onChange={() => setJenis("pemasukan")}
                />
                <span>Pemasukan</span>
              </label>
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="dana">Dana</label>
            <select
              id="dana"
              value={dana}
              onChange={(e) => setDana(e.target.value as NamaDana)}
            >
              <option value="Dana Pribadi">Dana Pribadi</option>
              <option value="Dana Kegiatan">Dana Kegiatan</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="tanggal">Tanggal</label>
            <input
              type="date"
              id="tanggal"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="deskripsi">Uraian</label>
            <input
              type="text"
              id="deskripsi"
              placeholder="Contoh: Pembelian makan siang"
              maxLength={150}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="kategori">Kategori</label>
            <select
              id="kategori"
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
            >
              {daftarKategori.map((kat) => (
                <option key={kat} value={kat}>
                  {kat}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="jumlah">Jumlah (Rp)</label>
            <input
              type="number"
              id="jumlah"
              min="1"
              step="1"
              placeholder="25000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="metode">Metode bayar</label>
            <select
              id="metode"
              value={metode}
              onChange={(e) => setMetode(e.target.value)}
            >
              {METODE_BAYAR.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="kaitan" id="label-kaitan">
              {kaitanMeta.label}
            </label>
            <input
              type="text"
              id="kaitan"
              placeholder={kaitanMeta.placeholder}
              maxLength={150}
              value={kaitan}
              onChange={(e) => setKaitan(e.target.value)}
            />
          </div>

          <div className="field wide">
            <label htmlFor="catatan">Catatan (opsional)</label>
            <input
              type="text"
              id="catatan"
              placeholder="Contoh: Struk 0042, bersama tim"
              maxLength={300}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>

          <div className="form-actions">
            {editTransaksi && (
              <button
                type="button"
                id="btn-batal"
                className="btn-secondary"
                onClick={onBatalEdit}
              >
                Batal
              </button>
            )}
            <button type="submit" id="btn-simpan" className="btn-primary">
              {editTransaksi ? "Simpan Perubahan" : "Simpan"}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
};
