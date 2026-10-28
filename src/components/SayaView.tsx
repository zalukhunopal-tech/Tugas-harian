import React, { useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, Cloud, FileText, Fingerprint, IdCard, Minus, Palette, Plus, TrendingDown, Users, type LucideIcon } from "lucide-react";
import { KarakterId, TemaId, Transaksi, AsetItem, AppLockConfig, ProfilPelapor, DataKegiatan, ItemPenyusutan } from "../types";
import { KARAKTER, PROFIL_PELAPOR_DEFAULT, hariIni, labelKategori } from "../lib/constants";
import { TOKOH_TEMA, rgbTriplet } from "../lib/tokohTema";
import { KarakterAnimasi } from "./KarakterAnimasi";
import { User } from "firebase/auth";
import { KeuanganDriveContents } from "../lib/gdriveSync";
import { AppLockKelolaModal } from "./AppLockKelolaModal";
import { TotpKelolaModal } from "./TotpKelolaModal";
import { LABEL_INTERVAL, muatTotp } from "../lib/totp";
import { LaporanView } from "./LaporanView";
import { PanelDrive } from "./PanelDrive";
import { DepresiasiAsetView } from "./DepresiasiAsetView";
import { itemPerluPeringatan } from "../lib/penyusutan";
import { KeluargaView } from "./KeluargaView";
import { HasilKirim, KeluarDriveModal } from "./KeluarDriveModal";
import { adaDataDiPerangkat } from "../lib/bersihkanPerangkat";

interface SayaViewProps {
  tema: TemaId;
  karakter: KarakterId;
  onGantiTema: (tema: TemaId) => void;
  onGantiKarakter: (karakter: KarakterId) => void;

  // Google Drive Direct Sync
  googleUser: User | null;
  googleLoading: boolean;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  /** Kirim data ke Drive sebelum dihapus dari perangkat saat keluar. */
  onKirimSebelumKeluar?: () => Promise<HasilKirim>;
  /** Putus akun, hapus data keuangan dari perangkat ini, lalu muat ulang aplikasi. */
  onKeluarDanHapus?: () => Promise<void>;
  driveContents: KeuanganDriveContents | null;
  memuatDrive: boolean;
  onPeriksaDrive: () => Promise<void>;
  onTarikDariDrive: () => Promise<void>;
  onKirimKeDrive: () => Promise<void>;
  onPerbaruiAksesDrive?: () => Promise<any>;
  /** Sinkronisasi satu langkah untuk lingkaran "tahan 3 detik": tarik, gabung, lalu kirim; true bila berhasil. */
  onSinkronkan?: () => Promise<boolean>;

  // Multi-Akun Google
  daftarAkunGoogle?: import("../lib/googleAuth").AkunGoogleTersimpan[];
  onBeralihAkun?: (emailOrUid: string) => Promise<void>;
  onTambahAkun?: () => Promise<string | null>;
  onHapusAkun?: (emailOrUid: string) => Promise<void>;

  transaksi: Transaksi[];
  aset: AsetItem[];
  syncStatusPesan: string;
  onBukaTransaksiBerulang?: () => void;
  jumlahTransaksiBerulang?: number;

  appLockConfig?: AppLockConfig;
  onSimpanAppLockConfig?: (config: AppLockConfig) => void;

  profilPelapor?: ProfilPelapor;
  onSimpanProfilPelapor?: (profil: ProfilPelapor) => void;

  // Laporan Dana Kegiatan
  daftarKegiatan?: DataKegiatan[];
  onUpdateKegiatan?: (kegiatan: DataKegiatan) => void;
  onTambahKegiatan?: (kegiatan: DataKegiatan) => void;
  googleToken?: string;
  /** Token Google saat ini; dipakai Keluarga & Komunitas untuk membagikan dan membaca berkas di Drive. */
  ambilToken?: () => Promise<string | null>;

  // Depresiasi Aset
  daftarPenyusutan?: ItemPenyusutan[];
  onSimpanPenyusutan?: (item: ItemPenyusutan) => void;
  onHapusPenyusutan?: (id: string) => void;
  /** True bila layar Depresiasi Aset diminta terbuka dari luar (mis. banner di Riwayat); dibalas lewat onDepresiasiDibuka. */
  bukaDepresiasi?: boolean;
  onDepresiasiDibuka?: () => void;
}

/** Aplikasi-aplikasi di tab Saya: tiap pilihan tampil sebagai ikon di layar utama, lalu membuka isinya satu per satu. */
type IdAplikasi = "drive" | "laporan" | "depresiasi" | "keluarga" | "tema" | "rutin" | "kunci";

interface AplikasiSaya {
  id: IdAplikasi;
  nama: string;
  /** Teks status kecil di bawah nama (bekas "petunjuk" di baris folder). */
  status: string;
  ikon: LucideIcon;
  /** Dua warna gradasi ikon. */
  warna: [string, string];
  /** Bulatan kecil di sudut ikon: hijau = aktif/terhubung, kuning = perlu perhatian. */
  titik?: "ok" | "perhatian";
  /** Angka di sudut ikon (mis. jumlah jadwal aktif). */
  angka?: number;
}

export const SayaView: React.FC<SayaViewProps> = ({
  tema,
  karakter,
  onGantiTema,
  onGantiKarakter,
  googleUser,
  googleLoading,
  onGoogleLogin,
  onGoogleLogout,
  onKirimSebelumKeluar,
  onKeluarDanHapus,
  driveContents,
  memuatDrive,
  onPeriksaDrive,
  onTarikDariDrive,
  onKirimKeDrive,
  onPerbaruiAksesDrive,
  onSinkronkan,
  transaksi,
  aset,
  syncStatusPesan,
  onBukaTransaksiBerulang,
  jumlahTransaksiBerulang = 0,
  appLockConfig = { enabled: false, pinHash: "", salt: "", webAuthnEnabled: false },
  onSimpanAppLockConfig,
  profilPelapor,
  onSimpanProfilPelapor,
  daftarKegiatan = [],
  onUpdateKegiatan,
  onTambahKegiatan,
  googleToken,
  ambilToken,
  daftarAkunGoogle = [],
  onBeralihAkun,
  onTambahAkun,
  onHapusAkun,
  daftarPenyusutan = [],
  onSimpanPenyusutan,
  onHapusPenyusutan,
  bukaDepresiasi = false,
  onDepresiasiDibuka,
}) => {
  const [appAktif, setAppAktif] = useState<IdAplikasi | null>(null);
  useEffect(() => {
    if (!bukaDepresiasi) return;
    setAppAktif("depresiasi");
    window.scrollTo({ top: 0 });
    onDepresiasiDibuka?.();
  }, [bukaDepresiasi, onDepresiasiDibuka]);
  const [modalAppLockBuka, setModalAppLockBuka] = useState(false);
  const [modalTotpBuka, setModalTotpBuka] = useState(false);
  const [modalKeluarBuka, setModalKeluarBuka] = useState(false);
  const [totp, setTotp] = useState(() => muatTotp());
  const [ukuranIkonPx, setUkuranIkonPx] = useState<number>(() => {
    try {
      const u = localStorage.getItem("keuangan-ukuran-ikon-px");
      if (u) {
        const val = Number(u);
        if (!isNaN(val) && val >= 52 && val <= 92) return val;
      }
    } catch (_) {}
    return 70; // Standar default: 4 kolom
  });

  const handleGantiUkuran = (val: number) => {
    const clamped = Math.max(52, Math.min(92, val));
    setUkuranIkonPx(clamped);
    try {
      localStorage.setItem("keuangan-ukuran-ikon-px", String(clamped));
    } catch (_) {}
  };

  // Menentukan jumlah kolom dan label berdasarkan ukuran ikon sehingga pilihan berpindah posisi saat ukuran dinaik-turunkan
  const infoUkuran = React.useMemo(() => {
    if (ukuranIkonPx < 58) {
      return { kolom: 6, label: "Sangat Kecil", gapX: 4, gapY: 14 };
    }
    if (ukuranIkonPx < 66) {
      return { kolom: 5, label: "Kecil", gapX: 6, gapY: 18 };
    }
    if (ukuranIkonPx <= 76) {
      return { kolom: 4, label: "Standar", gapX: 8, gapY: 24 };
    }
    if (ukuranIkonPx <= 84) {
      return { kolom: 3, label: "Besar", gapX: 14, gapY: 28 };
    }
    return { kolom: 2, label: "Sangat Besar", gapX: 20, gapY: 32 };
  }, [ukuranIkonPx]);

  const [profilForm, setProfilForm] = useState<ProfilPelapor>(() => {
    return profilPelapor || PROFIL_PELAPOR_DEFAULT;
  });
  const [statusSimpanProfil, setStatusSimpanProfil] = useState<string>("");
  // Profil Pelapor kini bagian dari Laporan Kegiatan: terbuka sendiri selama belum diisi, terlipat bila sudah.
  const [profilTerbuka, setProfilTerbuka] = useState<boolean>(() => !profilPelapor?.nama);

  React.useEffect(() => {
    if (profilPelapor) {
      setProfilForm(profilPelapor);
    }
  }, [profilPelapor]);

  const handleSimpanProfil = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSimpanProfilPelapor) {
      onSimpanProfilPelapor({
        ...profilForm,
        diubah: new Date().toISOString(),
      });
      setStatusSimpanProfil("Profil pelapor tersimpan");
      setTimeout(() => setStatusSimpanProfil(""), 3000);
    }
  };

  const isiProfil = (
    <>
          <p className="help">
            Profil pelapor digunakan sebagai identitas resmi penyusun Laporan Pertanggungjawaban (SPJ) Dana Kegiatan.
            Data ini tersimpan aman di berkas <code>Laporan Kegiatan.json</code> di folder Keuangan dan tersinkronisasi otomatis.
          </p>

          <form
            onSubmit={handleSimpanProfil}
            className="profil-pelapor-form md:grid-cols-2"
          >
            {/* Baris 1 kiri di PC: Nama Lengkap Pelapor */}
            <div className="input-field profil-field-nama">
              <label htmlFor="profil-nama" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Nama Lengkap Pelapor
              </label>
              <input
                id="profil-nama"
                type="text"
                value={profilForm.nama}
                onChange={(e) => setProfilForm({ ...profilForm, nama: e.target.value })}
                placeholder="Nama pelapor"
                required
              />
            </div>

            {/* Baris 1 kanan di PC: Jabatan */}
            <div className="input-field profil-field-jabatan">
              <label htmlFor="profil-jabatan" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Jabatan
              </label>
              <input
                id="profil-jabatan"
                type="text"
                value={profilForm.jabatan}
                onChange={(e) => setProfilForm({ ...profilForm, jabatan: e.target.value })}
                placeholder="Contoh: Surveyor"
                required
              />
            </div>

            {/* Baris 2 kiri di PC: Lembaga / Organisasi */}
            <div className="input-field profil-field-lembaga">
              <label htmlFor="profil-lembaga" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Lembaga / Organisasi
              </label>
              <input
                id="profil-lembaga"
                type="text"
                value={profilForm.lembaga}
                onChange={(e) => setProfilForm({ ...profilForm, lembaga: e.target.value })}
                placeholder="Contoh: Nama lembaga atau organisasi"
                required
              />
            </div>

            {/* Baris 2 kanan di PC: Nama Proyek / Lanskap */}
            <div className="input-field profil-field-proyek">
              <label htmlFor="profil-proyek" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Nama Proyek / Lanskap
              </label>
              <input
                id="profil-proyek"
                type="text"
                value={profilForm.proyek}
                onChange={(e) => setProfilForm({ ...profilForm, proyek: e.target.value })}
                placeholder="Contoh: Nama proyek atau lanskap"
                required
              />
            </div>

            {/* Baris terpisah di bawah: Keterangan Awal & Tombol Simpan (md:col-span-2) */}
            <div className="profil-pelapor-footer md:col-span-2">
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Isi sekali; tersimpan di perangkat ini dan di Drive Anda.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {statusSimpanProfil && (
                  <span style={{ fontSize: "0.82rem", color: "#10b981", fontWeight: 700 }}>
                    ✓ {statusSimpanProfil}
                  </span>
                )}
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: "0.88rem", whiteSpace: "nowrap" }}
                >
                  Simpan Profil Pelapor
                </button>
              </div>
            </div>
          </form>
    </>
  );

  const isiTema = (
    <>
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
            <>
              {/* Kartu Pendamping Karakter Animasi Aktif */}
              <div className="karakter-mascot-card">
                <KarakterAnimasi
                  karakter={karakter}
                  ukuran={64}
                  showAura
                />
                <div className="karakter-mascot-info">
                  <span className="karakter-mascot-role">Pendamping Aktif</span>
                  <div className="karakter-mascot-nama">
                    {KARAKTER[karakter].nama}
                  </div>
                  <div className="karakter-mascot-quote">
                    "{KARAKTER[karakter].tagline}"
                  </div>
                </div>
              </div>

              <div
                className="karakter-grid"
                id="karakter-grid"
                role="radiogroup"
                aria-label="Pilih karakter"
              >
                {(Object.keys(KARAKTER) as KarakterId[]).map((kId) => {
                  const k = KARAKTER[kId];
                  const t = TOKOH_TEMA[kId];
                  const aktif = karakter === kId;
                  return (
                    <button
                      key={kId}
                      type="button"
                      className={`tokoh-kartu ${aktif ? "aktif" : ""}`}
                      data-karakter={kId}
                      role="radio"
                      aria-checked={aktif}
                      onClick={() => onGantiKarakter(kId)}
                      style={
                        {
                          "--tokoh": rgbTriplet(t.warna),
                          "--tokoh-2": rgbTriplet(t.warnaKedua),
                        } as React.CSSProperties
                      }
                    >
                      <span className="tokoh-avatar" aria-hidden="true">
                        <img src={t.avatar} alt="" width={156} height={156} decoding="async" />
                      </span>
                      <span className="tokoh-info">
                        <span className="tokoh-nama">{k.nama}</span>
                        <span className="tokoh-teknik">{k.teknik}</span>
                      </span>
                      <span className="tokoh-ilustrasi" aria-hidden="true">
                        <img src={t.banner} alt="" loading="lazy" decoding="async" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
    </>
  );

  const isiRutin = (
    <>
          <p className="help">
            Otomatisasi pencatatan keuangan rutin seperti gaji bulanan, uang sewa kos, tagihan listrik &amp; internet, cicilan, maupun langganan streaming bulanan.
          </p>
          {onBukaTransaksiBerulang && (
            <div className="sync-buttons">
              <button
                type="button"
                className="btn-primary"
                onClick={onBukaTransaksiBerulang}
                style={{ width: "100%", justifyContent: "center" }}
              >
                🔁 Buka &amp; Kelola Transaksi Berulang
              </button>
            </div>
          )}
    </>
  );

  const isiKunci = (
    <>
          <p className="help">
            Amankan privasi data keuangan Anda dengan PIN 4–6 digit angka dan autentikasi biometrik
            (Sidik Jari / Face ID melalui WebAuthn). Aplikasi otomatis terkunci setelah ditinggal di latar belakang selama 1 menit.
          </p>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: appLockConfig.enabled ? "rgba(16, 185, 129, 0.12)" : "var(--surface-hover, rgba(255, 255, 255, 0.04))",
              border: `1px solid ${appLockConfig.enabled ? "#10b981" : "var(--border)"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: appLockConfig.enabled ? "#10b981" : "var(--text)" }}>
                {appLockConfig.enabled ? "🔒 Kunci Aplikasi Aktif" : "🔓 Kunci Aplikasi Nonaktif"}
              </div>
              <span className="help" style={{ fontSize: "0.78rem" }}>
                {appLockConfig.enabled
                  ? `PIN tersimpan aman (SHA-256)${appLockConfig.webAuthnEnabled ? " • Biometrik aktif" : ""}`
                  : "Aplikasi dapat dibuka langsung tanpa verifikasi"}
              </span>
            </div>

            <button
              type="button"
              className={appLockConfig.enabled ? "btn-secondary" : "btn-primary"}
              onClick={() => setModalAppLockBuka(true)}
              style={{ fontSize: "0.85rem", padding: "8px 16px", fontWeight: 700 }}
            >
              {appLockConfig.enabled ? "Kelola Kunci / PIN" : "Aktifkan Kunci Aplikasi"}
            </button>
          </div>

          <div
            id="kartu-totp"
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: totp ? "rgba(16, 185, 129, 0.12)" : "var(--surface-hover, rgba(255, 255, 255, 0.04))",
              border: `1px solid ${totp ? "#10b981" : "var(--border)"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 200px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: totp ? "#10b981" : "var(--text)" }}>
                {totp ? "🔐 Google Authenticator Aktif" : "🔐 Google Authenticator"}
              </div>
              <span className="help" style={{ fontSize: "0.78rem", overflowWrap: "anywhere" }}>
                {totp
                  ? `Akun tertaut: ${totp.email || "—"} • ${LABEL_INTERVAL[totp.interval]}`
                  : appLockConfig.enabled
                    ? "Langkah kedua setelah PIN: kode 6 angka dari ponsel, terikat ke akun email Google Drive Anda."
                    : "Aktifkan Kunci Aplikasi (PIN) lebih dulu untuk memakai langkah kedua ini."}
              </span>
            </div>
            <button
              type="button"
              id="btn-totp"
              className={totp ? "btn-secondary" : "btn-primary"}
              disabled={!appLockConfig.enabled && !totp}
              onClick={() => setModalTotpBuka(true)}
              style={{ fontSize: "0.85rem", padding: "8px 16px", fontWeight: 700 }}
            >
              {totp ? "Kelola" : "Aktifkan"}
            </button>
          </div>
    </>
  );

  const jumlahPerhatian = itemPerluPeringatan(daftarPenyusutan, hariIni()).length;

  const aplikasi: AplikasiSaya[] = [
    {
      id: "drive",
      nama: "Sinkron",
      status: googleUser ? "terhubung" : "belum masuk",
      ikon: Cloud,
      warna: ["#3b82f6", "#06b6d4"],
      titik: googleUser ? "ok" : "perhatian",
    },
    {
      id: "laporan",
      nama: "Laporan",
      status: !profilForm.nama
        ? "profil pelapor belum diisi"
        : daftarKegiatan.length > 0
          ? `${daftarKegiatan.length} kegiatan`
          : "SPJ, timesheet & profil",
      ikon: FileText,
      warna: ["#f59e0b", "#f97316"],
      titik: profilForm.nama ? undefined : "perhatian",
    },
    {
      id: "depresiasi",
      nama: "Depresiasi",
      status:
        jumlahPerhatian > 0
          ? `${jumlahPerhatian} perlu perhatian`
          : daftarPenyusutan.length > 0
            ? `${daftarPenyusutan.length} barang dipantau`
            : "nilai & umur barang",
      ikon: TrendingDown,
      warna: ["#8b5cf6", "#6366f1"],
      titik: jumlahPerhatian > 0 ? "perhatian" : undefined,
      angka: jumlahPerhatian > 0 ? jumlahPerhatian : undefined,
    },
    {
      id: "keluarga",
      nama: "Keluarga",
      status: googleUser ? "hubungkan & bagikan" : "masuk Google dulu",
      ikon: Users,
      warna: ["#f43f5e", "#be123c"],
    },
    {
      id: "tema",
      nama: "Tampilan",
      status: tema === "jujutsu" ? KARAKTER[karakter].nama : "Standar",
      ikon: Palette,
      warna: tema === "jujutsu" ? [TOKOH_TEMA[karakter].warna, TOKOH_TEMA[karakter].warnaKedua] : ["#ec4899", "#f97316"],
    },
    {
      id: "rutin",
      nama: "Rutin",
      status: jumlahTransaksiBerulang > 0 ? `${jumlahTransaksiBerulang} jadwal aktif` : "transaksi berulang",
      ikon: CalendarClock,
      warna: ["#10b981", "#14b8a6"],
      angka: jumlahTransaksiBerulang > 0 ? jumlahTransaksiBerulang : undefined,
    },
    {
      id: "kunci",
      nama: "Keamanan",
      status: appLockConfig.enabled ? "aktif" : "nonaktif",
      ikon: Fingerprint,
      warna: ["#64748b", "#334155"],
      titik: appLockConfig.enabled ? "ok" : "perhatian",
    },
  ];

  const aplikasiAktif = aplikasi.find((a) => a.id === appAktif) ?? null;

  const bukaAplikasi = (id: IdAplikasi | null) => {
    setAppAktif(id);
    window.scrollTo({ top: 0 });
  };

  const gayaIkon = (a: AplikasiSaya) =>
    ({ "--ikon-1": a.warna[0], "--ikon-2": a.warna[1] }) as React.CSSProperties;

  return (
    <section className="view" id="view-saya" data-view="saya">
      {!aplikasiAktif ? (
        <>
          {/* Judul dan pengatur ukuran ikon dalam satu baris tipis: garis geser diapit − dan +, jumlah kolom sebagai teks redup. */}
          <div className="saya-peluncur-topbar no-print">
            <div className="saya-peluncur-judul">
              Layanan &amp; Fitur
              <span className="saya-peluncur-kolom" title={infoUkuran.label}>
                {infoUkuran.kolom} kolom
              </span>
            </div>
            <div className="saya-ukuran" role="group" aria-label="Ukuran ikon">
              <button
                type="button"
                className="saya-ukuran-btn"
                onClick={() => handleGantiUkuran(ukuranIkonPx - 6)}
                disabled={ukuranIkonPx <= 52}
                aria-label="Perkecil ikon"
                title="Perkecil ikon"
              >
                <Minus size={14} strokeWidth={2.4} />
              </button>
              <input
                type="range"
                className="saya-ukuran-geser"
                min="52"
                max="92"
                step="2"
                value={ukuranIkonPx}
                onChange={(e) => handleGantiUkuran(Number(e.target.value))}
                aria-label="Ukuran ikon"
                aria-valuetext={`${infoUkuran.kolom} kolom, ${infoUkuran.label}`}
                style={{ "--isi": `${((ukuranIkonPx - 52) / 40) * 100}%` } as React.CSSProperties}
              />
              <button
                type="button"
                className="saya-ukuran-btn"
                onClick={() => handleGantiUkuran(ukuranIkonPx + 6)}
                disabled={ukuranIkonPx >= 92}
                aria-label="Perbesar ikon"
                title="Perbesar ikon"
              >
                <Plus size={14} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <nav
            className="saya-peluncur"
            style={{
              "--saya-kolom": infoUkuran.kolom,
              "--saya-ukuran": `${ukuranIkonPx}px`,
              "--saya-skala": Number((ukuranIkonPx / 72).toFixed(3)),
              "--saya-gap-y": `${infoUkuran.gapY}px`,
              "--saya-gap-x": `${infoUkuran.gapX}px`,
            } as React.CSSProperties}
            aria-label="Aplikasi"
          >
            {aplikasi.map((a) => {
              const Ikon = a.ikon;
              const pakaiAvatar = a.id === "tema" && tema === "jujutsu";
              const svgUkuran = Math.round(ukuranIkonPx * 0.44);
              return (
                <button
                  key={a.id}
                  type="button"
                  className="saya-app"
                  data-app={a.id}
                  onClick={() => bukaAplikasi(a.id)}
                >
                  <span className="saya-app-ikon" style={gayaIkon(a)} aria-hidden="true">
                    {pakaiAvatar ? (
                      <img className="saya-app-avatar" src={TOKOH_TEMA[karakter].avatar} alt="" width={156} height={156} decoding="async" />
                    ) : (
                      <Ikon size={svgUkuran} strokeWidth={1.9} />
                    )}
                    {a.titik && <span className={`saya-app-titik ${a.titik}`} />}
                    {a.angka !== undefined && <span className="saya-app-angka">{a.angka}</span>}
                  </span>
                  <span className="saya-app-nama">{a.nama}</span>
                  <span className="saya-app-status">{a.status}</span>
                </button>
              );
            })}
          </nav>
        </>
      ) : (
        <>
          <div className="saya-appbar no-print">
            <button type="button" className="saya-kembali" onClick={() => bukaAplikasi(null)} aria-label="Kembali ke daftar aplikasi">
              <ArrowLeft size={22} strokeWidth={2.6} />
            </button>
            <span className="saya-appbar-ikon" style={gayaIkon(aplikasiAktif)} aria-hidden="true">
              {aplikasiAktif.id === "tema" && tema === "jujutsu" ? (
                <img className="saya-app-avatar" src={TOKOH_TEMA[karakter].avatar} alt="" width={156} height={156} decoding="async" />
              ) : (
                <aplikasiAktif.ikon size={18} strokeWidth={2} />
              )}
            </span>
            <h2 className="saya-appbar-judul">{aplikasiAktif.nama}</h2>
          </div>

          {aplikasiAktif.id === "laporan" ? (
            <>
              {/* Profil Pelapor (identitas penyusun SPJ) digabung ke Laporan Kegiatan; tidak ikut dicetak. */}
              <details
                className="folder saya-panel profil-lipat no-print"
                id="panel-profil"
                open={profilTerbuka}
                onToggle={(e) => setProfilTerbuka((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="profil-lipat__ringkas">
                  <span className="profil-lipat__ikon" aria-hidden="true">
                    <IdCard size={18} strokeWidth={2} />
                  </span>
                  <span className="profil-lipat__teks">
                    <strong>Profil Pelapor</strong>
                    <span>
                      {profilPelapor?.nama
                        ? [profilPelapor.nama, profilPelapor.jabatan, profilPelapor.lembaga].filter(Boolean).join(" · ")
                        : "Belum diisi. Isi supaya nama Anda tercantum di laporan."}
                    </span>
                  </span>
                </summary>
                <div className="folder-body">{isiProfil}</div>
              </details>
              <LaporanView
                transaksi={transaksi}
                profilPelapor={profilPelapor}
                daftarKegiatan={daftarKegiatan}
                onUpdateKegiatan={onUpdateKegiatan}
                onSimpanProfilPelapor={onSimpanProfilPelapor}
                onTambahKegiatan={onTambahKegiatan}
                googleToken={googleToken}
                isLoggedInGoogle={Boolean(googleUser)}
              />
            </>
          ) : aplikasiAktif.id === "depresiasi" ? (
            <DepresiasiAsetView
              daftar={daftarPenyusutan}
              transaksi={transaksi}
              onSimpan={onSimpanPenyusutan ?? (() => {})}
              onHapus={onHapusPenyusutan ?? (() => {})}
            />
          ) : (
            <div className="folder saya-panel" id={`panel-${aplikasiAktif.id}`}>
              <div className="folder-body">
                {aplikasiAktif.id === "drive" && (
                  <PanelDrive
                    googleUser={googleUser}
                    googleLoading={googleLoading}
                    onGoogleLogin={onGoogleLogin}
                    onBukaKeluar={() => setModalKeluarBuka(true)}
                    tampilHapusDariPerangkat={Boolean(onKeluarDanHapus) && (transaksi.length > 0 || aset.length > 0 || adaDataDiPerangkat())}
                    driveContents={driveContents}
                    memuatDrive={memuatDrive}
                    onPeriksaDrive={onPeriksaDrive}
                    onTarikDariDrive={onTarikDariDrive}
                    onKirimKeDrive={onKirimKeDrive}
                    onPerbaruiAksesDrive={onPerbaruiAksesDrive}
                    onSinkronkan={onSinkronkan}
                    daftarAkunGoogle={daftarAkunGoogle}
                    onBeralihAkun={onBeralihAkun}
                    onTambahAkun={onTambahAkun}
                    onHapusAkun={onHapusAkun}
                    syncStatusPesan={syncStatusPesan}
                    transaksi={transaksi}
                  />
                )}
                {aplikasiAktif.id === "keluarga" && (
                  <KeluargaView
                    googleUser={googleUser}
                    ambilToken={ambilToken ?? (async () => googleToken ?? null)}
                    driveContents={driveContents}
                    namaPelapor={profilPelapor?.nama}
                    onPeriksaDrive={onPeriksaDrive}
                  />
                )}
                {aplikasiAktif.id === "tema" && isiTema}
                {aplikasiAktif.id === "rutin" && isiRutin}
                {aplikasiAktif.id === "kunci" && isiKunci}
              </div>
            </div>
          )}
        </>
      )}

      {onSimpanAppLockConfig && (
        <AppLockKelolaModal
          isOpen={modalAppLockBuka}
          onClose={() => setModalAppLockBuka(false)}
          config={appLockConfig}
          onSimpanConfig={onSimpanAppLockConfig}
          totpAktif={Boolean(totp)}
        />
      )}
      <TotpKelolaModal
        isOpen={modalTotpBuka}
        onClose={() => setModalTotpBuka(false)}
        kunciAktif={appLockConfig.enabled}
        googleUser={googleUser}
        ambilToken={ambilToken}
        driveContents={driveContents}
        onBerubah={() => setTotp(muatTotp())}
      />
      {modalKeluarBuka && (
        <KeluarDriveModal
          akun={googleUser ? googleUser.email || googleUser.displayName || "Google" : null}
          jumlahTransaksi={transaksi.length}
          jumlahAset={aset.length}
          onKirimDulu={onKirimSebelumKeluar ?? (async () => ({ ok: true }))}
          onKeluarDanHapus={async () => {
            if (onKeluarDanHapus) await onKeluarDanHapus();
            else await onGoogleLogout();
          }}
          onKeluarSaja={onGoogleLogout}
          onTutup={() => setModalKeluarBuka(false)}
        />
      )}
    </section>
  );
};
