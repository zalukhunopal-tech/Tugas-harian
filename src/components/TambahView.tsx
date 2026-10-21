import React, { useState, useEffect, useRef } from "react";
import { Transaksi, JenisTransaksi, NamaDana, TransaksiBerulang } from "../types";
import { KATEGORI, KAITAN, METODE_BAYAR, hariIni, formatRupiah } from "../lib/constants";
import { buatId } from "../lib/storage";
import {
  optimalkanGambarStruk,
  prosesStrukDenganGemini,
  HasilBacaStruk,
} from "../lib/geminiStruk";

interface TambahViewProps {
  editTransaksi: Transaksi | null;
  onSimpan: (t: Transaksi) => void;
  onBatalEdit: () => void;
  initialScanFile?: File | null;
  onResetInitialScan?: () => void;
  initialScanMode?: "kamera" | "galeri" | null;
  onResetInitialScanMode?: () => void;
  onBukaTransaksiBerulang?: () => void;
  jumlahJatuhTempo?: number;
  daftarBerulang?: TransaksiBerulang[];
}

export const TambahView: React.FC<TambahViewProps> = ({
  editTransaksi,
  onSimpan,
  onBatalEdit,
  initialScanFile = null,
  onResetInitialScan,
  initialScanMode = null,
  onResetInitialScanMode,
  onBukaTransaksiBerulang,
  jumlahJatuhTempo = 0,
  daftarBerulang = [],
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

  // Struk Scanner States
  const kameraInputRef = useRef<HTMLInputElement>(null);
  const galeriInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [memuatScan, setMemuatScan] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [hasilScan, setHasilScan] = useState<HasilBacaStruk | null>(null);
  const [errorScan, setErrorScan] = useState<string | null>(null);

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

  const handleProsesFileStruk = async (file: File) => {
    if (!file) return;
    try {
      setMemuatScan(true);
      setErrorScan(null);
      setHasilScan(null);

      const { base64, mimeType, previewUrl } = await optimalkanGambarStruk(file);
      setPreviewFoto(previewUrl);

      const hasil = await prosesStrukDenganGemini(base64, mimeType);

      if (hasil.sukses) {
        setHasilScan(hasil);
        // Otomatis isi data pengeluaran dari hasil pembacaan Gemini
        setJenis("pengeluaran");
        if (hasil.deskripsi) setDeskripsi(hasil.deskripsi);
        if (hasil.jumlah && hasil.jumlah > 0) setJumlah(String(hasil.jumlah));
        if (hasil.tanggal) setTanggal(hasil.tanggal);
        if (hasil.kategori) {
          const list = KATEGORI[dana]?.pengeluaran || [];
          const match = list.find(
            (k) => k.toLowerCase() === hasil.kategori?.toLowerCase()
          );
          setKategori(match || hasil.kategori);
        }
        if (hasil.metode) {
          const mList = ["Tunai", "Transfer", "QRIS", "Debit", "Kredit", "Lainnya"];
          const matchM = mList.find(
            (m) => m.toLowerCase() === hasil.metode?.toLowerCase()
          );
          if (matchM) setMetode(matchM);
        }
        if (hasil.catatan) {
          setCatatan(hasil.catatan);
        }

        // Scroll halus ke formulir yang sudah terisi otomatis
        setTimeout(() => {
          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      } else {
        setErrorScan(
          hasil.pesan ||
            "Struk belanja tidak terbaca dengan jelas. Silakan coba dengan pencahayaan lebih terang atau isi manual."
        );
      }
    } catch (err: any) {
      setErrorScan(
        err.message ||
          "Gagal memproses struk dengan Gemini. Pastikan perangkat terhubung ke internet."
      );
    } finally {
      setMemuatScan(false);
    }
  };

  const handleResetScan = () => {
    setPreviewFoto(null);
    setHasilScan(null);
    setErrorScan(null);
    if (kameraInputRef.current) kameraInputRef.current.value = "";
    if (galeriInputRef.current) galeriInputRef.current.value = "";
    if (onResetInitialScan) onResetInitialScan();
  };

  // Otomatis jalankan jika ada initialScanFile dari navigasi luar
  useEffect(() => {
    if (initialScanFile) {
      void handleProsesFileStruk(initialScanFile);
    }
  }, [initialScanFile]);

  // Otomatis picu kamera atau galeri jika pengguna memilih lewat tombol plus di Navbar
  useEffect(() => {
    if (initialScanMode === "kamera") {
      setTimeout(() => {
        kameraInputRef.current?.click();
      }, 150);
      if (onResetInitialScanMode) onResetInitialScanMode();
    } else if (initialScanMode === "galeri") {
      setTimeout(() => {
        galeriInputRef.current?.click();
      }, 150);
      if (onResetInitialScanMode) onResetInitialScanMode();
    }
  }, [initialScanMode]);

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
      handleResetScan();
    }
  };

  const handlePilihJadwal = (item: TransaksiBerulang) => {
    setJenis(item.jenis);
    setDana(item.dana);
    setDeskripsi(item.nama);
    setJumlah(String(item.jumlah));
    setKategori(item.kategori);
    if (item.metode) setMetode(item.metode);
    if (item.kaitan) setKaitan(item.kaitan);
    if (item.catatan) setCatatan(item.catatan);
  };

  return (
    <section className="view" id="view-tambah" data-view="tambah">
      {/* Input File Tersembunyi untuk Kamera & Galeri */}
      <input
        type="file"
        ref={kameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleProsesFileStruk(file);
        }}
      />
      <input
        type="file"
        ref={galeriInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleProsesFileStruk(file);
        }}
      />

      {/* Tool Transaksi Berulang */}
      {!editTransaksi && onBukaTransaksiBerulang && (
        <section
          className="card-berulang-tool"
          aria-label="Tool Transaksi Berulang"
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "12px",
            border: jumlahJatuhTempo > 0 ? "1.5px solid var(--accent)" : "1px solid var(--border)",
            background:
              jumlahJatuhTempo > 0
                ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                : "var(--surface)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.4rem" }}>🔁</span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  Transaksi Berulang (Jadwal Rutin)
                </h3>
                <span className="help" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                  Kelola jadwal gaji, sewa, tagihan listrik, WiFi, atau langganan rutin
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-sync-topbar"
              onClick={onBukaTransaksiBerulang}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                fontWeight: 700,
                borderRadius: "999px",
                borderColor: "var(--accent)",
              }}
            >
              <span>⚙️ Kelola Jadwal</span>
              {jumlahJatuhTempo > 0 && (
                <span
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                >
                  {jumlahJatuhTempo} Jatuh Tempo
                </span>
              )}
            </button>
          </div>

          {/* Quick Shortcuts jika ada transaksi berulang aktif */}
          {daftarBerulang && daftarBerulang.filter((d) => d.aktif).length > 0 && (
            <div
              style={{
                marginTop: "10px",
                borderTop: "1px dashed var(--border)",
                paddingTop: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "0.76rem",
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                ⚡ Isi cepat formulir dari jadwal rutin:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {daftarBerulang
                  .filter((d) => d.aktif)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="chip"
                      style={{
                        fontSize: "0.76rem",
                        padding: "5px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => handlePilihJadwal(item)}
                      title={`Klik untuk otomatis mengisi formulir dengan data ${item.nama} (${formatRupiah(item.jumlah)})`}
                    >
                      <span>{item.jenis === "pemasukan" ? "📈" : "📉"}</span>
                      <strong style={{ color: "var(--text)" }}>{item.nama}</strong>
                      <span style={{ opacity: 0.8, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        ({formatRupiah(item.jumlah)})
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Bagian Scan Struk Belanja dengan Gemini AI */}
      {!editTransaksi && (
        <section className="card-struk-scanner" aria-label="Scan Struk Belanja dengan Gemini AI">
          <div className="struk-scanner-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.4rem" }}>🧾</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "var(--accent)" }}>
                  Scan Struk Belanja Otomatis (Gemini AI)
                </h3>
                <span className="help" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                  Foto struk kasir atau unggah gambar untuk otomatis mengisi pengeluaran
                </span>
              </div>
            </div>
          </div>

          <div className="struk-scanner-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={memuatScan}
              onClick={() => kameraInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              <span>📸</span> Ambil Foto Kamera
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={memuatScan}
              onClick={() => galeriInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              <span>🖼️</span> Pilih dari Galeri
            </button>
          </div>

          {/* Animasi Preview & Laser Scanning */}
          {memuatScan && previewFoto && (
            <div className="struk-preview-box">
              <img src={previewFoto} alt="Preview Struk" className="struk-preview-img" />
              <div className="struk-scan-laser" />
            </div>
          )}

          {memuatScan && (
            <div className="struk-scan-loading-text">
              <span>⚡</span>
              <span>Gemini AI sedang membaca dan menganalisis struk belanja Anda…</span>
            </div>
          )}

          {/* Hasil Sukses */}
          {hasilScan && !memuatScan && (
            <div className="struk-hasil-sukses">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <strong style={{ color: "var(--masuk)", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>✓</span> Struk Berhasil Dibaca oleh Gemini AI!
                </strong>
                <button
                  type="button"
                  className="btn-small"
                  onClick={handleResetScan}
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                >
                  Ganti Foto
                </button>
              </div>
              {hasilScan.ringkasan && (
                <p style={{ margin: "6px 0 4px", fontSize: "0.84rem", color: "var(--text)" }}>
                  {hasilScan.ringkasan}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                <span>🏬 {hasilScan.deskripsi}</span>
                <span>·</span>
                <span style={{ fontWeight: 700, color: "var(--keluar)" }}>
                  💰 {formatRupiah(hasilScan.jumlah || 0)}
                </span>
                <span>·</span>
                <span>📅 {hasilScan.tanggal}</span>
                <span>·</span>
                <span>🏷️ {hasilScan.kategori}</span>
                <span>·</span>
                <span>💳 {hasilScan.metode}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--accent)" }}>
                ↓ Silakan periksa detail pada formulir di bawah sebelum menyimpan.
              </p>
            </div>
          )}

          {/* Notifikasi Error */}
          {errorScan && !memuatScan && (
            <div className="struk-hasil-error">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <strong style={{ color: "var(--keluar)", fontSize: "0.85rem" }}>
                  ⚠️ {errorScan}
                </strong>
                <button
                  type="button"
                  className="btn-small"
                  onClick={handleResetScan}
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                >
                  Tutup
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Anda tetap dapat memasukkan data secara manual melalui formulir di bawah.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="card" id="kartu-form">
        <h2 id="judul-form">{editTransaksi ? "Ubah Transaksi" : "Formulir Transaksi"}</h2>
        <form id="form-transaksi" ref={formRef} onSubmit={handleSubmit}>
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
