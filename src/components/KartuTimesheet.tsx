import React, { useMemo, useState } from "react";
import { DataKegiatan, ProfilPelapor, Transaksi } from "../types";
import { cariFolderKeuangan, ambilIsiFolderKeuangan, GDriveFileInfo, KeuanganDriveContents } from "../lib/gdriveSync";
import { getAccessToken } from "../lib/googleAuth";
import { transaksiKegiatan } from "../lib/penyelesaianDana";
import {
  barisPerdiemKegiatan,
  batchKegiatan,
  sarankanBatch,
  tahunKegiatan,
  tanggalBelumAdaDiTimesheet,
} from "../lib/timesheet";
import {
  perbaruiFileTimesheetKegiatan,
  siapkanTimesheetKegiatan,
  tarikTimesheetKegiatan,
  tautanTimesheet,
  HasilTimesheet,
} from "../lib/timesheetDrive";

interface KartuTimesheetProps {
  kegiatan: DataKegiatan;
  daftarKegiatan: DataKegiatan[];
  transaksi: Transaksi[];
  profilPelapor: ProfilPelapor;
  googleToken?: string;
  isLoggedInGoogle?: boolean;
  onUpdateKegiatan?: (kegiatan: DataKegiatan) => void;
  onSimpanProfilPelapor?: (profil: ProfilPelapor) => void;
}

type Kerja = "tarik" | "buat" | "perbarui" | "hubungkan" | null;

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const labelTanggal = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN_PENDEK[Number(iso.slice(5, 7)) - 1] ?? ""}`;

/**
 * Timesheet perdiem kegiatan: file Google Sheets di folder Keuangan yang berisi Keterangan kegiatan lapangan dan
 * Lokasi tiap hari. Aplikasi menariknya (hanya baca) dan memakainya pada daftar perdiem di dokumen laporan.
 * Aturan pemilihan file ada di lib/timesheet.ts, pembacaan dan pembuatan file di lib/timesheetDrive.ts.
 */
export const KartuTimesheet: React.FC<KartuTimesheetProps> = ({
  kegiatan,
  daftarKegiatan,
  transaksi,
  profilPelapor,
  googleToken,
  isLoggedInGoogle,
  onUpdateKegiatan,
  onSimpanProfilPelapor,
}) => {
  const [kerja, setKerja] = useState<Kerja>(null);
  const [pesan, setPesan] = useState<{ teks: string; tipe: "sukses" | "galat" | "info" } | null>(null);
  const [berkas, setBerkas] = useState<GDriveFileInfo[]>([]);
  const [draftBatch, setDraftBatch] = useState<string>("");
  const [draftDilaporkan, setDraftDilaporkan] = useState<string | null>(null);
  const [draftPenyetuju, setDraftPenyetuju] = useState<string | null>(null);

  const nilaiDilaporkan = kegiatan.penandatangan?.dilaporkanOleh !== undefined ? kegiatan.penandatangan.dilaporkanOleh : (profilPelapor.nama || "");
  const nilaiDisetujui = kegiatan.penandatangan?.disetujuiOleh !== undefined ? kegiatan.penandatangan.disetujuiOleh : (profilPelapor.penyetuju || "");

  const batch = batchKegiatan(kegiatan);
  const saran = useMemo(
    () =>
      sarankanBatch(
        tahunKegiatan(kegiatan),
        daftarKegiatan.filter((k) => k.id !== kegiatan.id),
        berkas.map((f) => ({ nama: f.name }))
      ),
    [kegiatan, daftarKegiatan, berkas]
  );

  const barisPerdiem = useMemo(
    () => barisPerdiemKegiatan(transaksiKegiatan(transaksi, kegiatan, daftarKegiatan), kegiatan.timesheetBaris),
    [transaksi, kegiatan, daftarKegiatan]
  );
  const belumIsi = tanggalBelumAdaDiTimesheet(barisPerdiem);
  const sudahIsi = barisPerdiem.length - belumIsi.length;
  const adaFile = Boolean(kegiatan.timesheetId);
  const siap = Boolean(isLoggedInGoogle || googleToken);

  const jalankan = async (
    jenis: Exclude<Kerja, null>,
    kerjaan: (token: string, contents: KeuanganDriveContents) => Promise<HasilTimesheet | null>
  ) => {
    setKerja(jenis);
    setPesan(null);
    try {
      const { token, contents } = await ambilKonteks();
      setBerkas(contents.timesheets);
      const h = await kerjaan(token, contents);
      if (!h) return;
      if (h.status === "belum-ada-file") {
        setPesan({
          teks: batch
            ? `Belum ada file timesheet Batch ${batch} tahun ${tahunKegiatan(kegiatan)} di folder Keuangan. Tekan "Buat file timesheet" untuk membuatnya dari file timesheet terbaru.`
            : "Isi nomor batch dulu supaya aplikasi tahu file timesheet yang dipakai.",
          tipe: "info",
        });
        return;
      }
      if (h.kegiatan !== kegiatan && onUpdateKegiatan) onUpdateKegiatan(h.kegiatan);
      const jumlahHari = h.kegiatan.timesheetBaris?.length ?? 0;
      setPesan({
        teks:
          h.status === "dibuat"
            ? `File "${h.kegiatan.timesheetNama}" dibuat di folder Keuangan. Isi Keterangan dan Lokasi tiap hari di file itu, lalu tekan "Tarik dari Drive".`
            : h.status === "tetap"
              ? `Timesheet sudah yang terbaru (${jumlahHari} hari berisi keterangan).`
              : `Timesheet ditarik: ${jumlahHari} hari berisi keterangan.`,
        tipe: "sukses",
      });
    } catch (err: any) {
      setPesan({ teks: err?.message ?? String(err), tipe: "galat" });
    } finally {
      setKerja(null);
    }
  };

  async function ambilKonteks() {
    const token = googleToken || (await getAccessToken());
    if (!token) throw new Error("Masuk ke akun Google dulu di tab Saya.");
    const folder = await cariFolderKeuangan(token);
    if (!folder) throw new Error("Folder 'Keuangan' tidak ditemukan di Google Drive.");
    const contents = await ambilIsiFolderKeuangan(token, folder.id);
    return { token, contents };
  }

  const tarik = () => jalankan("tarik", (token, contents) => tarikTimesheetKegiatan(token, contents, kegiatan, { paksa: true }));
  const buat = () =>
    jalankan("buat", (token, contents) =>
      siapkanTimesheetKegiatan(token, contents, kegiatan, profilPelapor, transaksi, daftarKegiatan)
    );
  const perbarui = () =>
    jalankan("perbarui", (token) => perbaruiFileTimesheetKegiatan(token, kegiatan, profilPelapor, transaksi, daftarKegiatan));
  const hubungkan = (berkasId: string) =>
    jalankan("hubungkan", (token, contents) => tarikTimesheetKegiatan(token, contents, kegiatan, { berkasId, paksa: true }));

  const simpanBatch = () => {
    const n = Math.floor(Number(draftBatch));
    setDraftBatch("");
    if (!onUpdateKegiatan || !(n > 0) || n === kegiatan.batch) return;
    onUpdateKegiatan({ ...kegiatan, batch: n });
  };

  const simpanPenandatangan = (bidang: "dilaporkanOleh" | "disetujuiOleh", nilai: string) => {
    if (bidang === "dilaporkanOleh") setDraftDilaporkan(null);
    else setDraftPenyetuju(null);
    if (!onUpdateKegiatan) return;
    const penandatangan = {
      ...(kegiatan.penandatangan ?? {}),
      [bidang]: nilai,
    };
    onUpdateKegiatan({
      ...kegiatan,
      penandatangan,
      diubah: new Date().toISOString(),
    });
  };

  const saranKopDilaporkan =
    kegiatan.timesheetKop?.nama && kegiatan.timesheetKop.nama !== (draftDilaporkan ?? nilaiDilaporkan)
      ? kegiatan.timesheetKop.nama
      : null;
  const saranKopDisetujui =
    kegiatan.timesheetKop?.penyetuju && kegiatan.timesheetKop.penyetuju !== (draftPenyetuju ?? nilaiDisetujui)
      ? kegiatan.timesheetKop.penyetuju
      : null;

  const sibuk = kerja !== null;

  return (
    <div className="card no-print kartu-timesheet" data-testid="kartu-timesheet">
      <div className="kartu-timesheet__judul">
        <h3>🗓️ Timesheet Uang Harian</h3>
        <p>
          Keterangan kegiatan lapangan dan lokasi tiap hari diambil dari file timesheet di folder Keuangan, lalu dipakai pada daftar
          uang harian di dokumen laporan.
        </p>
      </div>

      <div className="kartu-timesheet__isian">
        <label className="kartu-timesheet__field">
          <span>Batch kegiatan ({tahunKegiatan(kegiatan)})</span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%", minWidth: 0 }}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={draftBatch !== "" ? draftBatch : batch ?? ""}
              placeholder={`Saran: ${saran}`}
              onChange={(e) => setDraftBatch(e.target.value)}
              onBlur={simpanBatch}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              style={{ flex: 1, minWidth: 0 }}
            />
            {!batch && (
              <button
                type="button"
                className="btn-small"
                style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => onUpdateKegiatan?.({ ...kegiatan, batch: saran })}
              >
                Pakai Batch {saran}
              </button>
            )}
          </div>
        </label>
        <label className="kartu-timesheet__field">
          <span>Dilaporkan oleh</span>
          <input
            type="text"
            value={draftDilaporkan !== null ? draftDilaporkan : nilaiDilaporkan}
            placeholder="Nama pelapor di timesheet"
            onChange={(e) => setDraftDilaporkan(e.target.value)}
            onBlur={() => simpanPenandatangan("dilaporkanOleh", draftDilaporkan ?? nilaiDilaporkan)}
          />
          {saranKopDilaporkan && (
            <div className="kartu-timesheet__saran-kop" style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px" }}>
              Di file Drive tertulis: <em>{saranKopDilaporkan}</em>{" "}
              <button
                type="button"
                className="btn-small"
                onClick={() => simpanPenandatangan("dilaporkanOleh", saranKopDilaporkan)}
              >
                Pakai
              </button>
            </div>
          )}
        </label>
        <label className="kartu-timesheet__field">
          <span>Disetujui oleh</span>
          <input
            type="text"
            value={draftPenyetuju !== null ? draftPenyetuju : nilaiDisetujui}
            placeholder="Nama penyetuju di timesheet"
            onChange={(e) => setDraftPenyetuju(e.target.value)}
            onBlur={() => simpanPenandatangan("disetujuiOleh", draftPenyetuju ?? nilaiDisetujui)}
          />
          {saranKopDisetujui && (
            <div className="kartu-timesheet__saran-kop" style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px" }}>
              Di file Drive tertulis: <em>{saranKopDisetujui}</em>{" "}
              <button
                type="button"
                className="btn-small"
                onClick={() => simpanPenandatangan("disetujuiOleh", saranKopDisetujui)}
              >
                Pakai
              </button>
            </div>
          )}
        </label>
      </div>

      {adaFile ? (
        <div className="kartu-timesheet__file">
          <a href={tautanTimesheet(kegiatan.timesheetId!)} target="_blank" rel="noreferrer">
            {kegiatan.timesheetNama || "Buka file timesheet"}
          </a>
          {kegiatan.timesheetSinkron && (
            <span>
              Ditarik{" "}
              {new Date(kegiatan.timesheetSinkron).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      ) : (
        <div className="kartu-timesheet__file kartu-timesheet__file--kosong">Belum terhubung ke file timesheet.</div>
      )}

      {barisPerdiem.length > 0 && (
        <div className="kartu-timesheet__ringkas">
          <strong>
            {sudahIsi} dari {barisPerdiem.length} hari uang harian
          </strong>{" "}
          sudah ada keterangan di timesheet.
          {belumIsi.length > 0 && (
            <div className="kartu-timesheet__kurang">
              Belum ada keterangan: {belumIsi.slice(0, 8).map(labelTanggal).join(", ")}
              {belumIsi.length > 8 ? ` dan ${belumIsi.length - 8} hari lainnya` : ""}
            </div>
          )}
        </div>
      )}

      <div className="kartu-timesheet__aksi">
        <button type="button" className="btn-primary" disabled={!siap || sibuk} onClick={tarik}>
          {kerja === "tarik" ? "⏳ Menarik…" : "⬇️ Tarik dari Drive"}
        </button>
        {!adaFile && (
          <button type="button" className="btn-secondary" disabled={!siap || sibuk || !batch} onClick={buat} title={batch ? undefined : "Isi nomor batch dulu"}>
            {kerja === "buat" ? "⏳ Membuat…" : `➕ Buat file timesheet${batch ? ` Batch ${batch}` : ""}`}
          </button>
        )}
        {adaFile && kegiatan.timesheetDibuatApp && (
          <button
            type="button"
            className="btn-secondary"
            disabled={!siap || sibuk}
            onClick={perbarui}
            title="Samakan tanggal dan jumlah di file dengan uang harian yang tercatat. Keterangan dan lokasi yang sudah Anda isi tidak diubah."
          >
            {kerja === "perbarui" ? "⏳ Memperbarui…" : "🔄 Perbarui tanggal & jumlah ke file"}
          </button>
        )}
      </div>

      {berkas.length > 0 && (
        <label className="kartu-timesheet__field kartu-timesheet__pilih">
          <span>Pakai file lain</span>
          <select
            value={kegiatan.timesheetId ?? ""}
            disabled={sibuk}
            onChange={(e) => e.target.value && hubungkan(e.target.value)}
          >
            <option value="">{adaFile ? "Ganti file timesheet…" : "Pilih file timesheet…"}</option>
            {berkas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!siap && <p className="kartu-timesheet__catatan">Masuk ke akun Google di tab Saya untuk menarik atau membuat file timesheet.</p>}
      {pesan && (
        <p className={`kartu-timesheet__pesan kartu-timesheet__pesan--${pesan.tipe}`} role="status">
          {pesan.teks}
        </p>
      )}
    </div>
  );
};
