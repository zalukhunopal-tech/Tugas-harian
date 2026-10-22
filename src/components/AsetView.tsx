import React, { useState } from "react";
import { AsetItem, DataHarga, JenisAset, SkemaInvestasi } from "../types";
import { DAFTAR_KOIN, formatRupiah, formatPersen } from "../lib/constants";
import { ringkasAset, JENIS_ASET } from "../lib/aset";

interface AsetViewProps {
  aset: AsetItem[];
  harga: DataHarga;
  onTambahAset: (item: AsetItem) => void;
  onUbahAset: (item: AsetItem) => void;
  onHapusAset: (id: string) => void;
  onPerbaruiHarga: () => Promise<void>;
  onSimpanHargaManual: (jual: number, buyback?: number) => void;
  memuatHarga: boolean;
  googleUser?: any;
  onTarikDrive?: () => void;
  onKirimDrive?: () => void;
  memuatDrive?: boolean;
}

const IKON_ASET: Record<JenisAset, string> = {
  emas: "Au",
  crypto: "₿",
  jmo: "JHT",
  investasi: "%",
};

const NAMA_JENIS_ASET: Record<JenisAset, string> = {
  emas: "Emas",
  crypto: "Kripto",
  jmo: "JMO · JHT",
  investasi: "Investasi",
};

export const AsetView: React.FC<AsetViewProps> = ({
  aset,
  harga,
  onTambahAset,
  onUbahAset,
  onHapusAset,
  onPerbaruiHarga,
  onSimpanHargaManual,
  memuatHarga,
  googleUser,
  onTarikDrive,
  onKirimDrive,
  memuatDrive = false,
}) => {
  const [formBuka, setFormBuka] = useState(false);
  const [editAset, setEditAset] = useState<AsetItem | null>(null);

  // Form states
  const [jenis, setJenis] = useState<JenisAset>("emas");
  const [nama, setNama] = useState("");
  const [catatan, setCatatan] = useState("");

  // Emas
  const [gram, setGram] = useState("");
  const [hargaBeliEmas, setHargaBeliEmas] = useState("");

  // Crypto
  const [koin, setKoin] = useState("bitcoin");
  const [jumlahKoin, setJumlahKoin] = useState("");
  const [hargaBeliKoin, setHargaBeliKoin] = useState("");

  // JMO
  const [saldoJmo, setSaldoJmo] = useState("");
  const [tanggalJmo, setTanggalJmo] = useState("");
  const [gajiJmo, setGajiJmo] = useState("");
  const [iuranJmo, setIuranJmo] = useState("5.7");
  const [hasilJmo, setHasilJmo] = useState("5.5");
  const [iuranTambahanJmo, setIuranTambahanJmo] = useState("0");

  // Investasi
  const [modalInvestasi, setModalInvestasi] = useState("");
  const [mulaiInvestasi, setMulaiInvestasi] = useState("");
  const [bungaInvestasi, setBungaInvestasi] = useState("");
  const [skemaInvestasi, setSkemaInvestasi] = useState<SkemaInvestasi>("majemuk-bulanan");

  // Manual Gold form state
  const [emasJualManual, setEmasJualManual] = useState(
    harga.manual?.emas?.jual ? String(harga.manual.emas.jual) : ""
  );
  const [emasBuybackManual, setEmasBuybackManual] = useState(
    harga.manual?.emas?.buyback ? String(harga.manual.emas.buyback) : ""
  );

  const ringkasan = ringkasAset(aset, harga);

  const kelompokMap = new Map<JenisAset, typeof ringkasan.item>();
  for (const x of ringkasan.item) {
    const list = kelompokMap.get(x.aset.jenis) || [];
    list.push(x);
    kelompokMap.set(x.aset.jenis, list);
  }

  const bukaFormTambah = () => {
    setEditAset(null);
    setJenis("emas");
    setNama("");
    setCatatan("");
    setGram("");
    setHargaBeliEmas("");
    setKoin("bitcoin");
    setJumlahKoin("");
    setHargaBeliKoin("");
    setSaldoJmo("");
    setTanggalJmo(new Date().toISOString().slice(0, 10));
    setGajiJmo("");
    setIuranJmo("5.7");
    setHasilJmo("5.5");
    setIuranTambahanJmo("0");
    setModalInvestasi("");
    setMulaiInvestasi(new Date().toISOString().slice(0, 10));
    setBungaInvestasi("6");
    setSkemaInvestasi("majemuk-bulanan");
    setFormBuka(true);
  };

  const bukaFormUbah = (item: AsetItem) => {
    setEditAset(item);
    setJenis(item.jenis);
    setNama(item.nama);
    setCatatan(item.catatan || "");

    if (item.jenis === "emas") {
      setGram(item.gram ? String(item.gram) : "");
      setHargaBeliEmas(item.hargaBeli ? String(item.hargaBeli) : "");
    } else if (item.jenis === "crypto") {
      setKoin(item.koin || "bitcoin");
      setJumlahKoin(item.jumlah ? String(item.jumlah) : "");
      setHargaBeliKoin(item.hargaBeli ? String(item.hargaBeli) : "");
    } else if (item.jenis === "jmo") {
      setSaldoJmo(item.saldoAwal ? String(item.saldoAwal) : "");
      setTanggalJmo(item.tanggalSaldo || "");
      setGajiJmo(item.gaji ? String(item.gaji) : "");
      setIuranJmo(item.iuranPersen ? String(item.iuranPersen) : "5.7");
      setHasilJmo(item.hasilPersen ? String(item.hasilPersen) : "5.5");
      setIuranTambahanJmo(item.iuranTambahan ? String(item.iuranTambahan) : "0");
    } else if (item.jenis === "investasi") {
      setModalInvestasi(item.modal ? String(item.modal) : "");
      setMulaiInvestasi(item.tanggalMulai || "");
      setBungaInvestasi(item.bungaPersen ? String(item.bungaPersen) : "");
      setSkemaInvestasi(item.skema || "majemuk-bulanan");
    }

    setFormBuka(true);
  };

  const simpanForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;

    const id = editAset ? editAset.id : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const itemDasar: AsetItem = {
      id,
      jenis,
      nama: nama.trim(),
      catatan: catatan.trim(),
      dibuat: editAset?.dibuat || new Date().toISOString(),
    };

    if (jenis === "emas") {
      itemDasar.gram = Number(gram) || 0;
      if (Number(hargaBeliEmas) > 0) itemDasar.hargaBeli = Number(hargaBeliEmas);
    } else if (jenis === "crypto") {
      const koinMeta = DAFTAR_KOIN.find((k) => k.id === koin.toLowerCase());
      itemDasar.koin = koin.toLowerCase().trim();
      itemDasar.simbol = koinMeta ? koinMeta.simbol : koin.toUpperCase().slice(0, 5);
      itemDasar.jumlah = Number(jumlahKoin) || 0;
      if (Number(hargaBeliKoin) > 0) itemDasar.hargaBeli = Number(hargaBeliKoin);
    } else if (jenis === "jmo") {
      itemDasar.saldoAwal = Number(saldoJmo) || 0;
      itemDasar.tanggalSaldo = tanggalJmo;
      itemDasar.gaji = Number(gajiJmo) || 0;
      itemDasar.iuranPersen = Number(iuranJmo) || 5.7;
      itemDasar.hasilPersen = Number(hasilJmo) || 5.5;
      itemDasar.iuranTambahan = Number(iuranTambahanJmo) || 0;
    } else if (jenis === "investasi") {
      itemDasar.modal = Number(modalInvestasi) || 0;
      itemDasar.tanggalMulai = mulaiInvestasi;
      itemDasar.bungaPersen = Number(bungaInvestasi) || 0;
      itemDasar.skema = skemaInvestasi;
    }

    if (editAset) {
      onUbahAset(itemDasar);
    } else {
      onTambahAset(itemDasar);
    }
    setFormBuka(false);
  };

  const submitHargaManual = (e: React.FormEvent) => {
    e.preventDefault();
    const jual = Number(emasJualManual);
    if (!jual || jual <= 0) return;
    const buyback = Number(emasBuybackManual) || undefined;
    onSimpanHargaManual(jual, buyback);
  };

  const infoWaktuHarga = harga.waktu
    ? `Pukul ${new Date(harga.waktu).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })} WIB`
    : "Belum dimuat";

  return (
    <section className="view" id="view-aset" data-view="aset">
      <div className="card aset-total">
        <div className="aset-total-header">
          <span className="stat-label">Total nilai aset</span>
          <div className="aset-badges">
            {googleUser && (
              <span
                className="aset-badge-drive"
                title="Aset tersinkron otomatis ke folder Keuangan di Google Drive (Aset.json)"
              >
                <span>☁️</span> Drive Tersinkron
              </span>
            )}
            <span className="aset-badge-pasar">
              <span
                className="dot-indikator"
                style={{
                  background: memuatHarga ? "#eab308" : "#22c55e",
                }}
              />
              {memuatHarga ? "Memperbarui pasar…" : "Pasar 30m"}
            </span>
          </div>
        </div>

        <span className="aset-total-nilai" id="aset-total">
          {formatRupiah(ringkasan.total)}
        </span>

        {ringkasan.untung !== null ? (
          <span
            className={`aset-total-untung ${ringkasan.untung >= 0 ? "untung" : "rugi"}`}
            id="aset-untung"
          >
            {ringkasan.untung >= 0 ? "▲" : "▼"} {formatRupiah(Math.abs(ringkasan.untung))} (
            {formatPersen(ringkasan.persen || 0)}) dari modal {formatRupiah(ringkasan.modal)}
          </span>
        ) : (
          <span className="aset-total-untung" id="aset-untung">
            {aset.length ? "Isi harga beli untuk melihat untung/rugi." : ""}
          </span>
        )}

        <p className="help" id="aset-harga-info" style={{ margin: "6px 0 10px", fontSize: "0.76rem" }}>
          Harga pasar: <strong>{infoWaktuHarga}</strong> · {googleUser ? "Aset tersinkron otomatis ke Google Drive (Aset.json)." : "Hubungkan Google di tab Saya untuk sinkronisasi cloud."}
        </p>

        <div className="sync-buttons" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            id="btn-perbarui-harga"
            className="btn-secondary"
            disabled={memuatHarga}
            onClick={() => void onPerbaruiHarga()}
            style={{ flex: "1 1 auto" }}
          >
            {memuatHarga ? "Memperbarui…" : "⟳ Cek Harga"}
          </button>
          {onTarikDrive && (
            <button
              type="button"
              className="btn-secondary"
              disabled={memuatDrive}
              onClick={onTarikDrive}
              style={{ flex: "1 1 auto" }}
              title="Sinkronkan data aset dan transaksi dengan Google Drive"
            >
              {memuatDrive ? "Sinkron…" : "☁️ Sinkron Drive"}
            </button>
          )}
          <button
            type="button"
            id="btn-tambah-aset"
            className="btn-primary"
            onClick={bukaFormTambah}
            style={{ flex: "1 1 auto" }}
          >
            + Tambah aset
          </button>
        </div>
      </div>

      <div id="daftar-aset" className="daftar-aset">
        {JENIS_ASET.filter((j) => kelompokMap.has(j)).map((jns) => {
          const list = kelompokMap.get(jns) || [];
          const subtotal = list.reduce((s, x) => s + (x.tersedia ? x.nilai : 0), 0);

          return (
            <section key={jns} className="hari">
              <div className="hari-kepala">
                <strong>{NAMA_JENIS_ASET[jns]}</strong>
                <span className="hari-total">{formatRupiah(subtotal)}</span>
              </div>
              <ul className="expense-list">
                {list.map((x) => (
                  <li key={x.aset.id} className="expense-item">
                    <span className={`ikon-kategori aset-${jns}`}>
                      {IKON_ASET[jns]}
                    </span>
                    <div className="expense-info">
                      <div className="expense-desc">{x.aset.nama}</div>
                      <div className="expense-meta">{x.keterangan}</div>
                      {x.aset.catatan && (
                        <div className="expense-note">{x.aset.catatan}</div>
                      )}
                      {x.untung !== null && (
                        <div
                          className={`aset-untung ${x.untung >= 0 ? "untung" : "rugi"}`}
                        >
                          {x.untung >= 0 ? "▲" : "▼"} {formatRupiah(Math.abs(x.untung))} (
                          {formatPersen(x.persen || 0)})
                        </div>
                      )}
                    </div>
                    <div className="expense-kanan">
                      <span className="expense-amount">
                        {x.tersedia ? formatRupiah(x.nilai) : "—"}
                      </span>
                      <div className="expense-buttons">
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => bukaFormUbah(x.aset)}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn-small btn-delete"
                          onClick={() => {
                            if (confirm(`Hapus aset "${x.aset.nama}"?`)) {
                              onHapusAset(x.aset.id);
                            }
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {aset.length === 0 && (
        <p id="aset-kosong" className="empty">
          Belum ada aset. Tambahkan emas, kripto, saldo JHT (JMO), atau investasi lain.
        </p>
      )}

      {formBuka && (
        <div
          className="aset-form-dialog-wrapper"
          onClick={() => setFormBuka(false)}
        >
          <div
            className="card"
            id="kartu-form-aset"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aset-dialog-topbar">
              <h2 id="judul-form-aset">{editAset ? "Ubah Aset" : "Tambah Aset"}</h2>
              <button
                type="button"
                className="btn-ikon aset-dialog-close"
                onClick={() => setFormBuka(false)}
                aria-label="Tutup form aset"
                title="Tutup form aset"
              >
                ✕
              </button>
            </div>
            <form id="form-aset" onSubmit={simpanForm}>
            <fieldset className="field segmented wide">
              <legend>Jenis aset</legend>
              <div className="segmented-options empat">
                <label>
                  <input
                    type="radio"
                    name="jenis-aset"
                    value="emas"
                    checked={jenis === "emas"}
                    onChange={() => setJenis("emas")}
                  />
                  <span>Emas</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="jenis-aset"
                    value="crypto"
                    checked={jenis === "crypto"}
                    onChange={() => setJenis("crypto")}
                  />
                  <span>Kripto</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="jenis-aset"
                    value="jmo"
                    checked={jenis === "jmo"}
                    onChange={() => setJenis("jmo")}
                  />
                  <span>JMO/JHT</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="jenis-aset"
                    value="investasi"
                    checked={jenis === "investasi"}
                    onChange={() => setJenis("investasi")}
                  />
                  <span>Investasi</span>
                </label>
              </div>
            </fieldset>

            <div className="field wide">
              <label htmlFor="aset-nama">Nama</label>
              <input
                type="text"
                id="aset-nama"
                maxLength={80}
                placeholder={
                  jenis === "emas"
                    ? "Contoh: Emas Antam 5 gr"
                    : jenis === "crypto"
                    ? "Contoh: Bitcoin di Indodax"
                    : jenis === "jmo"
                    ? "Contoh: JHT BPJS Ketenagakerjaan"
                    : "Contoh: Deposito BRI 12 bulan"
                }
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
              />
            </div>

            {jenis === "emas" && (
              <>
                <div className="field">
                  <label htmlFor="aset-gram">Berat (gram)</label>
                  <input
                    type="number"
                    id="aset-gram"
                    min="0.001"
                    step="0.001"
                    placeholder="5"
                    value={gram}
                    onChange={(e) => setGram(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-emas-beli">Harga beli per gram (Rp, opsional)</label>
                  <input
                    type="number"
                    id="aset-emas-beli"
                    min="0"
                    step="1"
                    placeholder="1250000"
                    value={hargaBeliEmas}
                    onChange={(e) => setHargaBeliEmas(e.target.value)}
                  />
                </div>
              </>
            )}

            {jenis === "crypto" && (
              <>
                <div className="field">
                  <label htmlFor="aset-koin">Koin (id CoinGecko)</label>
                  <input
                    type="text"
                    id="aset-koin"
                    list="daftar-koin"
                    placeholder="bitcoin"
                    value={koin}
                    onChange={(e) => setKoin(e.target.value)}
                    required
                  />
                  <datalist id="daftar-koin">
                    {DAFTAR_KOIN.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.simbol} - {k.nama}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label htmlFor="aset-jumlah-koin">Jumlah koin</label>
                  <input
                    type="number"
                    id="aset-jumlah-koin"
                    min="0"
                    step="any"
                    placeholder="0.01"
                    value={jumlahKoin}
                    onChange={(e) => setJumlahKoin(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-koin-beli">Harga beli per koin (Rp, opsional)</label>
                  <input
                    type="number"
                    id="aset-koin-beli"
                    min="0"
                    step="1"
                    placeholder="900000000"
                    value={hargaBeliKoin}
                    onChange={(e) => setHargaBeliKoin(e.target.value)}
                  />
                </div>
              </>
            )}

            {jenis === "jmo" && (
              <>
                <div className="field">
                  <label htmlFor="aset-jmo-saldo">Saldo JHT di JMO (Rp)</label>
                  <input
                    type="number"
                    id="aset-jmo-saldo"
                    min="0"
                    step="1"
                    placeholder="12500000"
                    value={saldoJmo}
                    onChange={(e) => setSaldoJmo(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-jmo-tanggal">Tanggal saldo itu</label>
                  <input
                    type="date"
                    id="aset-jmo-tanggal"
                    value={tanggalJmo}
                    onChange={(e) => setTanggalJmo(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-jmo-gaji">Upah bulanan dasar iuran (Rp)</label>
                  <input
                    type="number"
                    id="aset-jmo-gaji"
                    min="0"
                    step="1"
                    placeholder="5000000"
                    value={gajiJmo}
                    onChange={(e) => setGajiJmo(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-jmo-iuran">Iuran JHT (% upah)</label>
                  <input
                    type="number"
                    id="aset-jmo-iuran"
                    min="0"
                    max="100"
                    step="0.1"
                    value={iuranJmo}
                    onChange={(e) => setIuranJmo(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-jmo-hasil">Hasil pengembangan (% per tahun)</label>
                  <input
                    type="number"
                    id="aset-jmo-hasil"
                    min="0"
                    max="100"
                    step="0.01"
                    value={hasilJmo}
                    onChange={(e) => setHasilJmo(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-jmo-tambahan">Iuran tambahan per bulan (Rp, opsional)</label>
                  <input
                    type="number"
                    id="aset-jmo-tambahan"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={iuranTambahanJmo}
                    onChange={(e) => setIuranTambahanJmo(e.target.value)}
                  />
                </div>
              </>
            )}

            {jenis === "investasi" && (
              <>
                <div className="field">
                  <label htmlFor="aset-modal">Modal (Rp)</label>
                  <input
                    type="number"
                    id="aset-modal"
                    min="0"
                    step="1"
                    placeholder="10000000"
                    value={modalInvestasi}
                    onChange={(e) => setModalInvestasi(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-mulai">Tanggal mulai</label>
                  <input
                    type="date"
                    id="aset-mulai"
                    value={mulaiInvestasi}
                    onChange={(e) => setMulaiInvestasi(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-bunga">Bunga / imbal hasil rata-rata (% per tahun)</label>
                  <input
                    type="number"
                    id="aset-bunga"
                    min="0"
                    max="1000"
                    step="0.01"
                    placeholder="6"
                    value={bungaInvestasi}
                    onChange={(e) => setBungaInvestasi(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="aset-skema">Skema bunga</label>
                  <select
                    id="aset-skema"
                    value={skemaInvestasi}
                    onChange={(e) => setSkemaInvestasi(e.target.value as SkemaInvestasi)}
                  >
                    <option value="majemuk-bulanan">Majemuk bulanan (reksa dana, tabungan)</option>
                    <option value="majemuk-tahunan">Majemuk tahunan</option>
                    <option value="sederhana">Sederhana (deposito, obligasi kupon)</option>
                  </select>
                </div>
              </>
            )}

            <div className="field wide">
              <label htmlFor="aset-catatan">Catatan (opsional)</label>
              <input
                type="text"
                id="aset-catatan"
                maxLength={200}
                placeholder="Contoh: disimpan di brankas"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                id="btn-batal-aset"
                className="btn-secondary"
                onClick={() => setFormBuka(false)}
              >
                Batal
              </button>
              <button type="submit" id="btn-simpan-aset" className="btn-primary">
                {editAset ? "Perbarui aset" : "Simpan aset"}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      <details className="folder" id="folder-harga">
        <summary>
          <span className="folder-icon" aria-hidden="true"></span>
          <span className="folder-title">Harga pasar &amp; sumber</span>
        </summary>
        <div className="folder-body">
          <ul className="help daftar-sumber">
            <li>
              <strong>Emas:</strong> harga jual Antam 1 gram dari Logam Mulia (nilai memakai harga jual, buyback ditampilkan sebagai info).
            </li>
            <li>
              <strong>Kripto:</strong> harga IDR dari CoinGecko (real-time dari browser).
            </li>
            <li>
              <strong>JMO / JHT:</strong> tidak ada API publik. Nilai dihitung dari saldo terakhir di aplikasi JMO + iuran 5,7% upah per bulan + hasil pengembangan tahunan BPJS Ketenagakerjaan.
            </li>
            <li>
              <strong>Investasi lain:</strong> modal tumbuh sesuai bunga rata-rata dan skema yang dipilih.
            </li>
          </ul>
          <form id="form-harga-manual" className="sync-form" onSubmit={submitHargaManual}>
            <label htmlFor="emas-manual">
              Harga jual emas 1 gr hari ini (Rp), isi manual bila otomatis gagal
            </label>
            <input
              type="number"
              id="emas-manual"
              min="0"
              step="1"
              placeholder="1250000"
              value={emasJualManual}
              onChange={(e) => setEmasJualManual(e.target.value)}
              required
            />
            <label htmlFor="emas-buyback-manual">Harga buyback 1 gr (Rp, opsional)</label>
            <input
              type="number"
              id="emas-buyback-manual"
              min="0"
              step="1"
              placeholder="1150000"
              value={emasBuybackManual}
              onChange={(e) => setEmasBuybackManual(e.target.value)}
            />
            <div className="sync-buttons">
              <button type="submit" className="btn-secondary">
                Simpan harga manual
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>
  );
};
