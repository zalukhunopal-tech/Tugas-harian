import React, { useMemo } from "react";
import { Transaksi } from "../types";
import { formatRupiah } from "../lib/constants";
import {
  PerdiemRentang,
  hariSingkat,
  hitungRentangPerdiem,
  tanggalPendek,
  tanggalSudahAdaPerdiem,
} from "../lib/perdiemOtomatis";

interface PerdiemSekaligusProps {
  rentang: PerdiemRentang;
  onUpdateRentang: (r: PerdiemRentang) => void;
  tarifPerHari: number;
  /** Tanggal yang sedang tampil di form: dipakai sebagai isian awal rentang. */
  tanggalForm: string;
  daftarTransaksi: Transaksi[];
  kegiatanId: string;
  /** Apakah pemasukan pribadi ikut dibuat (hanya untuk menghitung jumlah transaksi pada ringkasan). */
  catatPribadi: boolean;
}

const kotak: React.CSSProperties = {
  background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "10px 12px",
  marginBottom: "10px",
};

// Ukuran dan warna eksplisit: gaya input global membuat centang dan radio terlalu besar.
export const kontrolPilihan: React.CSSProperties = {
  width: "18px",
  height: "18px",
  minWidth: "18px",
  padding: 0,
  marginTop: "2px",
  accentColor: "var(--accent)",
  cursor: "pointer",
  flexShrink: 0,
};

const labelCentang: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
};

/**
 * Pengisian perdiem untuk banyak hari sekaligus (mis. 20 Sep - 28 Okt). Komponen ini hanya mengelola isian
 * dan ringkasannya; transaksi disusun oleh rencanakanPerdiemRentang saat form disimpan.
 */
export const PerdiemSekaligus: React.FC<PerdiemSekaligusProps> = ({
  rentang,
  onUpdateRentang,
  tarifPerHari,
  tanggalForm,
  daftarTransaksi,
  kegiatanId,
  catatPribadi,
}) => {
  const hitung = useMemo(() => hitungRentangPerdiem(rentang, tarifPerHari), [rentang, tarifPerHari]);
  const sudahAda = useMemo(
    () => (rentang.aktif ? tanggalSudahAdaPerdiem(daftarTransaksi, kegiatanId, hitung.dipakai) : new Set<string>()),
    [rentang.aktif, daftarTransaksi, kegiatanId, hitung.dipakai]
  );

  const ubah = (berubah: Partial<PerdiemRentang>) => onUpdateRentang({ ...rentang, ...berubah });

  const nyalakan = (aktif: boolean) => {
    if (!aktif) return ubah({ aktif: false });
    ubah({ aktif: true, mulai: rentang.mulai || tanggalForm, selesai: rentang.selesai || tanggalForm });
  };

  const kecuali = new Set(rentang.kecuali);
  const gantiPengecualian = (tanggal: string) =>
    ubah({ kecuali: kecuali.has(tanggal) ? rentang.kecuali.filter((t) => t !== tanggal) : [...rentang.kecuali, tanggal] });
  const lewatiAkhirPekan = () =>
    ubah({
      kecuali: hitung.semua.filter((t) => {
        const h = hariSingkat(t);
        return h === "Sab" || h === "Min";
      }),
    });

  const dilewati = rentang.satuPerHari ? hitung.dipakai.filter((t) => sudahAda.has(t)) : [];
  const dibuat = rentang.satuPerHari ? hitung.hari - dilewati.length : hitung.hari > 0 ? 1 : 0;
  // Hari dan total yang benar-benar dicatat: tanggal yang dilewati tidak dihitung.
  const hariDicatat = rentang.satuPerHari ? dibuat : hitung.hari;
  const totalDicatat = rentang.satuPerHari ? dibuat * Math.round(tarifPerHari) : hitung.total;

  return (
    <div style={kotak}>
      <label style={labelCentang} htmlFor="perdiem-rentang">
        <input
          id="perdiem-rentang"
          type="checkbox"
          checked={rentang.aktif}
          onChange={(e) => nyalakan(e.target.checked)}
          style={kontrolPilihan}
        />
        <span>
          Isi perdiem sekaligus untuk rentang tanggal
          <span style={{ display: "block", fontWeight: 400, fontSize: "0.75rem", color: "var(--muted)" }}>
            Contoh: 20 September sampai 28 Oktober, tidak perlu mengisi satu per satu.
          </span>
        </span>
      </label>

      {rentang.aktif && (
        <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
            <div>
              <label htmlFor="perdiem-mulai" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Dari tanggal</label>
              <input
                id="perdiem-mulai"
                type="date"
                value={rentang.mulai}
                onChange={(e) => ubah({ mulai: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label htmlFor="perdiem-selesai" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Sampai tanggal</label>
              <input
                id="perdiem-selesai"
                type="date"
                value={rentang.selesai}
                min={rentang.mulai || undefined}
                onChange={(e) => ubah({ selesai: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>

          <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
            <legend style={{ fontSize: "0.75rem", fontWeight: 600, padding: 0, marginBottom: "4px" }}>Cara mencatat</legend>
            <label style={{ ...labelCentang, fontWeight: 500 }} htmlFor="perdiem-mode-hari">
              <input
                id="perdiem-mode-hari"
                type="radio"
                name="perdiem-mode"
                checked={rentang.satuPerHari}
                onChange={() => ubah({ satuPerHari: true })}
                style={kontrolPilihan}
              />
              <span>
                Satu transaksi per hari
                <span style={{ display: "block", fontWeight: 400, fontSize: "0.75rem", color: "var(--muted)" }}>
                  Disarankan: tiap hari terlihat sendiri di riwayat dan laporan, mudah diubah atau dihapus per hari.
                </span>
              </span>
            </label>
            <label style={{ ...labelCentang, fontWeight: 500 }} htmlFor="perdiem-mode-gabung">
              <input
                id="perdiem-mode-gabung"
                type="radio"
                name="perdiem-mode"
                checked={!rentang.satuPerHari}
                onChange={() => ubah({ satuPerHari: false })}
                style={kontrolPilihan}
              />
              <span>
                Satu transaksi gabungan
                <span style={{ display: "block", fontWeight: 400, fontSize: "0.75rem", color: "var(--muted)" }}>
                  Seluruh hari dijumlahkan menjadi satu baris, tanggalnya hari pertama.
                </span>
              </span>
            </label>
          </fieldset>

          {hitung.semua.length > 0 && (
            <details>
              <summary style={{ fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
                Kecualikan tanggal tertentu{rentang.kecuali.length > 0 ? ` (${hitung.semua.filter((t) => kecuali.has(t)).length} dikecualikan)` : ""}
              </summary>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0" }}>
                <button type="button" className="btn-small" id="perdiem-lewati-akhir-pekan" onClick={lewatiAkhirPekan}
                  style={{ fontSize: "0.74rem", padding: "3px 10px" }}>
                  Lewati Sabtu &amp; Minggu
                </button>
                <button type="button" className="btn-small" id="perdiem-pakai-semua" onClick={() => ubah({ kecuali: [] })}
                  style={{ fontSize: "0.74rem", padding: "3px 10px" }}>
                  Pakai semua hari
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {hitung.semua.map((t) => {
                  const dikecualikan = kecuali.has(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      data-tanggal={t}
                      aria-pressed={dikecualikan}
                      title={dikecualikan ? "Dikecualikan: klik untuk dihitung lagi" : "Klik untuk dikecualikan"}
                      onClick={() => gantiPengecualian(t)}
                      style={{
                        fontSize: "0.72rem",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: dikecualikan ? "var(--surface)" : "var(--accent)",
                        color: dikecualikan ? "var(--muted)" : "#fff",
                        textDecoration: dikecualikan ? "line-through" : "none",
                      }}
                    >
                      {hariSingkat(t)} {tanggalPendek(t).replace(/ \d{4}$/, "")}
                    </button>
                  );
                })}
              </div>
            </details>
          )}

          <div id="perdiem-ringkasan" role="status" aria-live="polite" style={{ fontSize: "0.82rem", display: "grid", gap: "4px" }}>
            {hitung.galat ? (
              <span style={{ color: "var(--keluar)" }}>{hitung.galat}</span>
            ) : tarifPerHari > 0 ? (
              <>
                <span>
                  {hariDicatat} hari × {formatRupiah(tarifPerHari)} = <strong>{formatRupiah(totalDicatat)}</strong>
                  <span style={{ color: "var(--muted)" }}> ({tanggalPendek(rentang.mulai)} – {tanggalPendek(rentang.selesai)})</span>
                </span>
                <span style={{ color: "var(--muted)" }}>
                  Akan dibuat {dibuat} transaksi Dana Kegiatan
                  {catatPribadi ? ` dan ${dibuat} pemasukan Dana Pribadi` : ""}.
                </span>
              </>
            ) : (
              <span style={{ color: "var(--muted)" }}>Isi tarif per hari di atas untuk melihat total.</span>
            )}
            {dilewati.length > 0 && (
              <span style={{ color: "var(--keluar)" }}>
                {dilewati.length} tanggal sudah punya perdiem untuk kegiatan ini dan dilewati agar tidak ganda:{" "}
                {dilewati.slice(0, 4).map((t) => tanggalPendek(t)).join(", ")}
                {dilewati.length > 4 ? ", …" : ""}.
              </span>
            )}
            {!rentang.satuPerHari && sudahAda.size > 0 && (
              <span style={{ color: "var(--keluar)" }}>
                Di rentang ini sudah ada perdiem pada {sudahAda.size} tanggal. Periksa agar tidak tercatat dua kali.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
