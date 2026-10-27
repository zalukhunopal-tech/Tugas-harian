import React, { useState } from "react";
import { TransaksiBerulang, FrekuensiBerulang, JenisTransaksi, NamaDana, Transaksi } from "../types";
import { KATEGORI, METODE_BAYAR, formatRupiah, hariIni, labelKategori } from "../lib/constants";
import { buatId } from "../lib/storage";
import { apakahJatuhTempo, buatTransaksiDariBerulang, hitungTanggalBerikutnya, formatTanggalIso, tanggalJadwalSaatIni } from "../lib/transaksiBerulang";

interface TransaksiBerulangModalProps {
  isOpen: boolean;
  onClose: () => void;
  daftarBerulang: TransaksiBerulang[];
  onSimpanDaftar: (daftar: TransaksiBerulang[]) => void;
  onTambahTransaksi: (t: Transaksi | Transaksi[]) => void;
  /** Transaksi yang sudah tercatat: jadwal yang transaksinya untuk periode ini sudah ada tidak dianggap jatuh tempo. */
  daftarTransaksi?: Transaksi[];
}

export const TransaksiBerulangModal: React.FC<TransaksiBerulangModalProps> = ({
  isOpen,
  onClose,
  daftarBerulang,
  onSimpanDaftar,
  onTambahTransaksi,
  daftarTransaksi,
}) => {
  const [modeForm, setModeForm] = useState<"daftar" | "tambah" | "edit">("daftar");
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<JenisTransaksi>("pengeluaran");
  const [dana, setDana] = useState<NamaDana>("Dana Pribadi");
  const [jumlah, setJumlah] = useState("");
  const [frekuensi, setFrekuensi] = useState<FrekuensiBerulang>("bulanan");
  const [hariDalamBulan, setHariDalamBulan] = useState(1);
  const [hariDalamMinggu, setHariDalamMinggu] = useState(1); // Senin
  const [tanggalMulai, setTanggalMulai] = useState(hariIni());
  const [kategori, setKategori] = useState("Tagihan & Sewa");
  const [metode, setMetode] = useState("Transfer");
  const [kaitan, setKaitan] = useState("");
  const [catatan, setCatatan] = useState("");

  const [pesanSukses, setPesanSukses] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setNama("");
    setJenis("pengeluaran");
    setDana("Dana Pribadi");
    setJumlah("");
    setFrekuensi("bulanan");
    setHariDalamBulan(new Date().getDate());
    setHariDalamMinggu(1);
    setTanggalMulai(hariIni());
    setKategori(KATEGORI["Dana Pribadi"].pengeluaran[0] || "Tagihan & Sewa");
    setMetode("Transfer");
    setKaitan("");
    setCatatan("");
    setEditId(null);
    setModeForm("daftar");
  };

  const handleMulaiTambah = () => {
    resetForm();
    setModeForm("tambah");
  };

  const handleMulaiEdit = (item: TransaksiBerulang) => {
    setEditId(item.id);
    setNama(item.nama);
    setJenis(item.jenis);
    setDana(item.dana);
    setJumlah(String(item.jumlah));
    setFrekuensi(item.frekuensi);
    setHariDalamBulan(item.hariDalamBulan || 1);
    setHariDalamMinggu(item.hariDalamMinggu ?? 1);
    setTanggalMulai(item.tanggalMulai || hariIni());
    setKategori(item.kategori);
    setMetode(item.metode || "Transfer");
    setKaitan(item.kaitan || "");
    setCatatan(item.catatan || "");
    setModeForm("edit");
  };

  const handleSimpanForm = (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = Number(jumlah);
    if (!nama.trim() || isNaN(nominal) || nominal <= 0) {
      alert("Mohon masukkan nama dan jumlah yang valid.");
      return;
    }

    if (editId) {
      // Edit
      const baru = daftarBerulang.map((item) =>
        item.id === editId
          ? {
              ...item,
              nama: nama.trim(),
              jenis,
              dana,
              jumlah: nominal,
              frekuensi,
              hariDalamBulan,
              hariDalamMinggu,
              tanggalMulai,
              kategori,
              metode,
              kaitan: kaitan.trim(),
              catatan: catatan.trim(),
            }
          : item
      );
      onSimpanDaftar(baru);
      setPesanSukses("Jadwal transaksi berulang berhasil diperbarui!");
    } else {
      // Tambah baru
      const baruItem: TransaksiBerulang = {
        id: buatId(),
        nama: nama.trim(),
        jenis,
        dana,
        jumlah: nominal,
        frekuensi,
        hariDalamBulan,
        hariDalamMinggu,
        tanggalMulai,
        kategori,
        metode,
        kaitan: kaitan.trim(),
        catatan: catatan.trim(),
        aktif: true,
      };
      onSimpanDaftar([baruItem, ...daftarBerulang]);
      setPesanSukses("Jadwal transaksi berulang baru berhasil disimpan!");
    }

    setTimeout(() => setPesanSukses(""), 3000);
    resetForm();
  };

  const handleHapus = (id: string) => {
    if (confirm("Hapus jadwal transaksi berulang ini?")) {
      const baru = daftarBerulang.filter((x) => x.id !== id);
      onSimpanDaftar(baru);
    }
  };

  const handleToggleAktif = (id: string) => {
    const baru = daftarBerulang.map((x) => (x.id === id ? { ...x, aktif: !x.aktif } : x));
    onSimpanDaftar(baru);
  };

  const handleTerapkanSatu = (item: TransaksiBerulang) => {
    const transaksiBaru = buatTransaksiDariBerulang(item);
    onTambahTransaksi(transaksiBaru);

    // Update tanggal terakhir diterapkan
    const sekarangIso = formatTanggalIso(new Date());
    const baru = daftarBerulang.map((x) =>
      x.id === item.id ? { ...x, terakhirDiterapkan: sekarangIso } : x
    );
    onSimpanDaftar(baru);

    setPesanSukses(`Transaksi "${item.nama}" sebesar ${formatRupiah(item.jumlah)} berhasil dicatat ke riwayat!`);
    setTimeout(() => setPesanSukses(""), 3500);
  };

  const itemJatuhTempo = daftarBerulang.filter((x) => apakahJatuhTempo(x, daftarTransaksi));

  const handleTerapkanSemuaJatuhTempo = () => {
    if (itemJatuhTempo.length === 0) return;
    const sekarangIso = formatTanggalIso(new Date());

    // Satu panggilan untuk semuanya: panggilan berturut-turut dalam satu giliran saling menimpa karena memakai daftar yang sama.
    onTambahTransaksi(itemJatuhTempo.map((item) => buatTransaksiDariBerulang(item, tanggalJadwalSaatIni(item))));

    const baru = daftarBerulang.map((x) =>
      itemJatuhTempo.some((j) => j.id === x.id) ? { ...x, terakhirDiterapkan: sekarangIso } : x
    );
    onSimpanDaftar(baru);

    setPesanSukses(`${itemJatuhTempo.length} transaksi berulang berhasil diterapkan ke riwayat!`);
    setTimeout(() => setPesanSukses(""), 3500);
  };

  // Preset Template Cepat
  const pasangTemplate = (
    tplNama: string,
    tplJenis: JenisTransaksi,
    tplKat: string,
    tplNominal: number,
    tplFrek: FrekuensiBerulang,
    tplHari: number
  ) => {
    setNama(tplNama);
    setJenis(tplJenis);
    setKategori(tplKat);
    setJumlah(String(tplNominal));
    setFrekuensi(tplFrek);
    setHariDalamBulan(tplHari);
    setDana("Dana Pribadi");
  };

  const daftarKategori = KATEGORI[dana]?.[jenis] || [];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "540px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
          position: "relative",
        }}
      >
        {/* Header Modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🔁</span> Transaksi Berulang
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
              Otomatisasi pengeluaran rutin, langganan &amp; pemasukan tetap
            </p>
          </div>
          <button
            type="button"
            className="btn-ikon"
            onClick={onClose}
            aria-label="Tutup"
            style={{ fontSize: "1.4rem", width: "36px", height: "36px", borderRadius: "50%" }}
          >
            ✕
          </button>
        </div>

        {/* Notifikasi Pesan Sukses */}
        {pesanSukses && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid #22c55e",
              color: "#22c55e",
              fontSize: "0.86rem",
              fontWeight: 600,
              marginBottom: "14px",
            }}
          >
            ✓ {pesanSukses}
          </div>
        )}

        {/* TAMPILAN DAFTAR TRANSAKSI BERULANG */}
        {modeForm === "daftar" && (
          <div>
            {/* Banner jika ada yang jatuh tempo */}
            {itemJatuhTempo.length > 0 && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                  border: "1.5px solid var(--accent)",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--accent-hover)" }}>
                    🔔 {itemJatuhTempo.length} Transaksi Jatuh Tempo Hari Ini!
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    Siap dicatat ke pembukuan riwayat keuangan Anda.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                  onClick={handleTerapkanSemuaJatuhTempo}
                >
                  ⚡ Catat Semua ({itemJatuhTempo.length})
                </button>
              </div>
            )}

            {/* Tombol Tambah Baru */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                Daftar Jadwal ({daftarBerulang.length})
              </span>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                onClick={handleMulaiTambah}
              >
                + Tambah Jadwal Baru
              </button>
            </div>

            {/* List Items */}
            {daftarBerulang.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--muted)",
                  background: "rgba(0, 0, 0, 0.2)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border)",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📅</div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Belum ada transaksi berulang</div>
                <p style={{ fontSize: "0.82rem", margin: "0 0 14px", maxWidth: "340px", display: "inline-block" }}>
                  Catat tagihan kos, cicilan, langganan Spotify/Netflix, atau gaji bulanan secara otomatis tanpa lupa.
                </p>
                <div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleMulaiTambah}
                    style={{ fontSize: "0.84rem" }}
                  >
                    + Buat Transaksi Berulang Pertama
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {daftarBerulang.map((item) => {
                  const jatuhTempo = apakahJatuhTempo(item, daftarTransaksi);
                  const tglBerikut = hitungTanggalBerikutnya(item);

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: jatuhTempo
                          ? "color-mix(in srgb, var(--accent) 8%, var(--surface))"
                          : "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${jatuhTempo ? "var(--accent)" : "var(--border)"}`,
                        opacity: item.aktif ? 1 : 0.6,
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                              {item.nama}
                            </span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                background: item.jenis === "pemasukan" ? "rgba(56, 189, 248, 0.15)" : "rgba(244, 63, 94, 0.15)",
                                color: item.jenis === "pemasukan" ? "var(--masuk)" : "var(--keluar)",
                                fontWeight: 600,
                              }}
                            >
                              {item.jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
                            </span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                background: "rgba(255, 255, 255, 0.08)",
                                color: "var(--muted)",
                              }}
                            >
                              {item.frekuensi === "bulanan"
                                ? `Tiap tgl ${item.hariDalamBulan || 1}`
                                : item.frekuensi === "mingguan"
                                ? "Tiap minggu"
                                : item.frekuensi === "harian"
                                ? "Tiap hari"
                                : "Tiap tahun"}
                            </span>
                          </div>

                          <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px" }}>
                            <span>Kategori: {labelKategori(item.kategori)}</span>
                            <span style={{ margin: "0 6px" }}>•</span>
                            <span>{item.dana}</span>
                          </div>

                          <div style={{ fontSize: "0.76rem", color: jatuhTempo ? "var(--accent-hover)" : "var(--muted)", marginTop: "3px" }}>
                            {jatuhTempo ? (
                              <strong style={{ color: "#eab308" }}>⚠️ Sudah jatuh tempo untuk dicatat!</strong>
                            ) : (
                              <span>Jadwal berikutnya: {tglBerikut}</span>
                            )}
                          </div>
                        </div>

                        {/* Nominal */}
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "1rem",
                              fontWeight: 800,
                              color: item.jenis === "pemasukan" ? "var(--masuk)" : "var(--keluar)",
                            }}
                          >
                            {item.jenis === "pemasukan" ? "+" : "-"}
                            {formatRupiah(item.jumlah)}
                          </span>
                        </div>
                      </div>

                      {/* Tombol Aksi */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "10px",
                          paddingTop: "8px",
                          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                          flexWrap: "wrap",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="btn-small"
                            style={{ fontSize: "0.76rem", padding: "3px 8px" }}
                            onClick={() => handleToggleAktif(item.id)}
                            title={item.aktif ? "Nonaktifkan jadwal ini" : "Aktifkan jadwal ini"}
                          >
                            {item.aktif ? "✓ Aktif" : "⏸ Jeda"}
                          </button>
                          <button
                            type="button"
                            className="btn-small"
                            style={{ fontSize: "0.76rem", padding: "3px 8px" }}
                            onClick={() => handleMulaiEdit(item)}
                          >
                            ✏️ Ubah
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-delete"
                            style={{ fontSize: "0.76rem", padding: "3px 8px" }}
                            onClick={() => handleHapus(item.id)}
                          >
                            🗑
                          </button>
                        </div>

                        <button
                          type="button"
                          className={jatuhTempo ? "btn-primary" : "btn-secondary"}
                          style={{ fontSize: "0.76rem", padding: "4px 10px", fontWeight: 700 }}
                          onClick={() => handleTerapkanSatu(item)}
                          title="Catat langsung transaksi ini ke pembukuan sekarang"
                        >
                          {jatuhTempo ? "⚡ Terapkan Sekarang" : "➕ Terapkan Transaksi"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FORM TAMBAH / UBAH TRANSAKSI BERULANG */}
        {(modeForm === "tambah" || modeForm === "edit") && (
          <form onSubmit={handleSimpanForm}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                {modeForm === "edit" ? "✏️ Ubah Jadwal Berulang" : "➕ Buat Jadwal Berulang Baru"}
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                onClick={() => setModeForm("daftar")}
              >
                ← Kembali ke Daftar
              </button>
            </div>

            {/* Template Cepat (Hanya saat tambah baru) */}
            {modeForm === "tambah" && (
              <div style={{ marginBottom: "14px" }}>
                <span className="help" style={{ display: "block", marginBottom: "6px" }}>
                  💡 Contoh Cepat:
                </span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => pasangTemplate("Gaji Bulanan", "pemasukan", "Pemasukan Gaji", 5000000, "bulanan", 25)}
                  >
                    💵 Gaji (Tgl 25)
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => pasangTemplate("Uang Kos / Sewa", "pengeluaran", "Tagihan & Sewa", 1500000, "bulanan", 1)}
                  >
                    🏠 Sewa Kos (Tgl 1)
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => pasangTemplate("WiFi & Internet", "pengeluaran", "Pulsa & Internet", 350000, "bulanan", 10)}
                  >
                    📶 WiFi (Tgl 10)
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => pasangTemplate("Langganan Streaming", "pengeluaran", "Hiburan", 186000, "bulanan", 15)}
                  >
                    🎬 Streaming (Tgl 15)
                  </button>
                </div>
              </div>
            )}

            {/* Jenis Transaksi */}
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label>Jenis Transaksi</label>
              <div className="segmented-options">
                <label>
                  <input
                    type="radio"
                    name="modal-jenis"
                    checked={jenis === "pengeluaran"}
                    onChange={() => setJenis("pengeluaran")}
                  />
                  <span>Pengeluaran</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="modal-jenis"
                    checked={jenis === "pemasukan"}
                    onChange={() => setJenis("pemasukan")}
                  />
                  <span>Pemasukan</span>
                </label>
              </div>
            </div>

            {/* Nama / Deskripsi */}
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="modal-nama">Nama Transaksi Rutin</label>
              <input
                type="text"
                id="modal-nama"
                placeholder="Contoh: Sewa Rumah, Gaji Pokok, Listrik PLN"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
              />
            </div>

            {/* Nominal */}
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="modal-jumlah">Nominal (Rp)</label>
              <input
                type="number"
                id="modal-jumlah"
                placeholder="0"
                min="1"
                required
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </div>

            {/* Frekuensi Pengulangan */}
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="modal-frekuensi">Frekuensi Pengulangan</label>
              <select
                id="modal-frekuensi"
                value={frekuensi}
                onChange={(e) => setFrekuensi(e.target.value as FrekuensiBerulang)}
              >
                <option value="bulanan">Bulanan (Setiap Bulan)</option>
                <option value="mingguan">Mingguan (Setiap Minggu)</option>
                <option value="harian">Harian (Setiap Hari)</option>
                <option value="tahunan">Tahunan (Setiap Tahun)</option>
              </select>
            </div>

            {/* Hari dalam bulan bila bulanan */}
            {frekuensi === "bulanan" && (
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="modal-hari-bulan">Jatuh Tempo Tiap Tanggal (1 - 31)</label>
                <input
                  type="number"
                  id="modal-hari-bulan"
                  min="1"
                  max="31"
                  value={hariDalamBulan}
                  onChange={(e) => setHariDalamBulan(Number(e.target.value) || 1)}
                />
              </div>
            )}

            {/* Hari dalam minggu bila mingguan */}
            {frekuensi === "mingguan" && (
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="modal-hari-minggu">Jatuh Tempo Tiap Hari</label>
                <select
                  id="modal-hari-minggu"
                  value={hariDalamMinggu}
                  onChange={(e) => setHariDalamMinggu(Number(e.target.value))}
                >
                  <option value={1}>Senin</option>
                  <option value={2}>Selasa</option>
                  <option value={3}>Rabu</option>
                  <option value={4}>Kamis</option>
                  <option value={5}>Jumat</option>
                  <option value={6}>Sabtu</option>
                  <option value={0}>Minggu</option>
                </select>
              </div>
            )}

            {/* Kategori & Metode */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div className="form-group">
                <label htmlFor="modal-kategori">Kategori</label>
                <select
                  id="modal-kategori"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                >
                  {daftarKategori.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="modal-metode">Metode Bayar</label>
                <select
                  id="modal-metode"
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
            </div>

            {/* Catatan */}
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label htmlFor="modal-catatan">Catatan / Keterangan (Opsional)</label>
              <input
                type="text"
                id="modal-catatan"
                placeholder="Contoh: No. Pelanggan 0812..., Jatuh tempo tgl 20"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </div>

            {/* Tombol Simpan */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setModeForm("daftar")}
              >
                Batal
              </button>
              <button type="submit" className="btn-primary">
                {modeForm === "edit" ? "Simpan Perubahan" : "Simpan Jadwal"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
