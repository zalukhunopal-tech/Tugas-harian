import React, { useState } from "react";
import { KarakterId, TemaId, Transaksi } from "../types";
import { KARAKTER } from "../lib/constants";

interface SayaViewProps {
  tema: TemaId;
  karakter: KarakterId;
  onGantiTema: (tema: TemaId) => void;
  onGantiKarakter: (karakter: KarakterId) => void;
  syncUrl: string;
  syncKunci: string;
  onSimpanSync: (url: string, kunci: string) => Promise<void>;
  onTarikDariSheet: () => Promise<void>;
  onKirimSemuaKeSheet: () => Promise<void>;
  onPutusSync: () => void;
  transaksi: Transaksi[];
  syncStatusPesan: string;
}

export const SayaView: React.FC<SayaViewProps> = ({
  tema,
  karakter,
  onGantiTema,
  onGantiKarakter,
  syncUrl,
  syncKunci,
  onSimpanSync,
  onTarikDariSheet,
  onKirimSemuaKeSheet,
  onPutusSync,
  transaksi,
  syncStatusPesan,
}) => {
  const [urlInput, setUrlInput] = useState(syncUrl);
  const [kunciInput, setKunciInput] = useState(syncKunci);
  const [infoSalin, setInfoSalin] = useState("");
  const [sedangUji, setSedangUji] = useState(false);

  const handleSimpanSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setSedangUji(true);
    try {
      await onSimpanSync(urlInput.trim(), kunciInput.trim());
    } finally {
      setSedangUji(false);
    }
  };

  const handleSalinKode = async () => {
    try {
      const res = await fetch("/apps-script/Code.gs");
      const text = res.ok ? await res.text() : "";
      if (text) {
        await navigator.clipboard.writeText(text);
        setInfoSalin("Kode Apps Script berhasil disalin ke papan klip!");
      } else {
        setInfoSalin("Gagal memuat file Code.gs untuk disalin.");
      }
    } catch (err: any) {
      setInfoSalin(`Gagal menyalin: ${err.message}`);
    }
    setTimeout(() => setInfoSalin(""), 4000);
  };

  const handleExportCSV = () => {
    if (transaksi.length === 0) {
      alert("Belum ada transaksi untuk diunduh.");
      return;
    }
    const header = [
      "Tanggal",
      "Jenis",
      "Dana",
      "Uraian",
      "Kategori",
      "Jumlah",
      "Metode Bayar",
      "Sumber / Tujuan",
      "Catatan",
      "ID",
    ];
    const rows = transaksi.map((t) => [
      t.tanggal,
      t.jenis,
      t.dana,
      `"${(t.deskripsi || "").replace(/"/g, '""')}"`,
      `"${(t.kategori || "").replace(/"/g, '""')}"`,
      t.jumlah,
      `"${(t.metode || "").replace(/"/g, '""')}"`,
      `"${(t.kaitan || "").replace(/"/g, '""')}"`,
      `"${(t.catatan || "").replace(/"/g, '""')}"`,
      t.id,
    ]);
    const csvContent = "\uFEFF" + [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="view" id="view-saya" data-view="saya">
      {/* ===== Folder 1: Sinkronisasi Google Sheets ===== */}
      <details className="folder" id="folder-sync" open>
        <summary>
          <span className="folder-icon" aria-hidden="true"></span>
          <span className="folder-title">Sinkronisasi Google Sheets</span>
          <span className="folder-hint" id="hint-sync">
            {syncUrl ? "terhubung" : "belum terhubung"}
          </span>
        </summary>
        <div className="folder-body">
          <p className="help">
            Setiap transaksi dan daftar aset yang disimpan di sini otomatis ditulis ke folder Drive{" "}
            <em>Keuangan</em> (sheet <strong>Keuangan Pribadi 2026</strong> /{" "}
            <strong>Keuangan Kegiatan 2026</strong> dan file <strong>Aset.json</strong>), dan ditarik
            kembali saat halaman dibuka. Perantaranya adalah Google Apps Script yang dipasang sekali
            dari akun Google Anda.
          </p>

          <div className="salin-kode">
            <p className="help">
              <strong>Kode Apps Script.</strong> Salin dengan tombol di bawah, lalu di editor Apps
              Script tempel ke file <code>Code.gs</code>.
            </p>
            <div className="sync-buttons">
              <button
                type="button"
                id="btn-salin-kode"
                className="btn-secondary"
                onClick={handleSalinKode}
              >
                Salin kode Apps Script
              </button>
              <a
                className="btn-secondary btn-link"
                href="/apps-script/Code.gs"
                download="Code.gs"
              >
                Unduh Code.gs
              </a>
            </div>
            {infoSalin && (
              <p id="info-salin" className="help info-salin-teks" role="status">
                {infoSalin}
              </p>
            )}
          </div>

          <form id="form-sync" className="sync-form" onSubmit={handleSimpanSync}>
            <label htmlFor="sync-url">URL Web App Apps Script</label>
            <input
              type="url"
              id="sync-url"
              placeholder="https://script.google.com/macros/s/.../exec"
              autoComplete="off"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <label htmlFor="sync-kunci">
              Kunci sinkron (opsional, sama dengan KUNCI_SINKRON di Apps Script)
            </label>
            <input
              type="password"
              id="sync-kunci"
              placeholder="kosongkan bila tidak dipakai"
              autoComplete="off"
              value={kunciInput}
              onChange={(e) => setKunciInput(e.target.value)}
            />
            <div className="sync-buttons">
              <button type="submit" className="btn-primary" disabled={sedangUji}>
                {sedangUji ? "Menguji koneksi…" : "Simpan & uji koneksi"}
              </button>
              <button
                type="button"
                id="btn-tarik"
                className="btn-secondary"
                disabled={!syncUrl}
                onClick={() => void onTarikDariSheet()}
              >
                Tarik dari Sheet
              </button>
              <button
                type="button"
                id="btn-kirim-semua"
                className="btn-secondary"
                disabled={!syncUrl}
                onClick={() => void onKirimSemuaKeSheet()}
              >
                Kirim semua data lokal
              </button>
              {syncUrl && (
                <button
                  type="button"
                  id="btn-putus"
                  className="btn-secondary btn-delete"
                  onClick={onPutusSync}
                >
                  Putuskan
                </button>
              )}
            </div>
          </form>

          {syncStatusPesan && (
            <p id="sync-detail" className="help">
              {syncStatusPesan}
            </p>
          )}
        </div>
      </details>

      {/* ===== Folder 2: Tema & Karakter ===== */}
      <details className="folder" id="folder-tema" open>
        <summary>
          <span className="folder-icon" aria-hidden="true"></span>
          <span className="folder-title">Tema &amp; Karakter</span>
          <span className="folder-hint" id="hint-tema">
            {tema === "jujutsu" ? KARAKTER[karakter].nama : "Standar"}
          </span>
        </summary>
        <div className="folder-body">
          <div className="theme-row">
            <button
              type="button"
              id="btn-tema"
              className="btn-small"
              onClick={() => onGantiTema(tema === "jujutsu" ? "standar" : "jujutsu")}
            >
              {tema === "jujutsu" ? "Ganti ke Tema standar" : "Ganti ke Tema Jujutsu"}
            </button>
            <span className="help">Pilihan tema dan karakter tersimpan di browser ini.</span>
          </div>

          {tema === "jujutsu" && (
            <div
              className="karakter-grid"
              id="karakter-grid"
              role="radiogroup"
              aria-label="Pilih karakter"
            >
              {(Object.keys(KARAKTER) as KarakterId[]).map((kId) => {
                const k = KARAKTER[kId];
                const aktif = karakter === kId;
                return (
                  <button
                    key={kId}
                    type="button"
                    className={`karakter ${aktif ? "aktif" : ""}`}
                    data-karakter={kId}
                    role="radio"
                    aria-checked={aktif}
                    onClick={() => onGantiKarakter(kId)}
                  >
                    <span className="karakter-lambang">{k.lambang}</span>
                    <span className="karakter-nama">{k.nama}</span>
                    <span className="karakter-teknik">{k.teknik}</span>
                    <span className="karakter-domain">{k.domain}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </details>

      {/* ===== Folder 3: Data & Keamanan ===== */}
      <details className="folder" id="folder-data" open>
        <summary>
          <span className="folder-icon" aria-hidden="true"></span>
          <span className="folder-title">Data &amp; keamanan</span>
        </summary>
        <div className="folder-body">
          <div className="sync-buttons">
            <button
              type="button"
              id="btn-export"
              className="btn-secondary"
              onClick={handleExportCSV}
            >
              Unduh CSV transaksi ({transaksi.length} entri)
            </button>
          </div>
          <ul className="help daftar-sumber">
            <li>
              Aplikasi ini <strong>tidak pernah</strong> meminta atau menyimpan kata sandi Google.
              Yang tersimpan di browser ini hanya transaksi, aset, harga terakhir, URL Web App, dan
              kunci sinkron.
            </li>
            <li>
              URL Web App dan kunci sinkron berlaku seperti kunci pintu: jangan dibagikan, jangan
              ditempel di GitHub, chat, atau tangkapan layar publik.
            </li>
            <li>
              Kalau bocor: di Apps Script buka <em>Deploy → Manage deployments</em>, arsipkan
              deployment lama, buat yang baru, lalu perbarui <code>KUNCI_SINKRON</code>.
            </li>
          </ul>
        </div>
      </details>
    </section>
  );
};
