import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "firebase/auth";
import type { KeuanganDriveContents } from "../lib/gdriveSync";
import { adalahEmail } from "../lib/berbagi";
import { emailAkunDrive } from "../lib/berbagiDrive";
import {
  IntervalTotp,
  LABEL_INTERVAL,
  aktifkanTotp,
  buatRahasiaTotp,
  buatUriOtpauth,
  formatRahasia,
  muatTotp,
  nonaktifkanTotp,
  sisaDetikKunci,
  ubahIntervalTotp,
} from "../lib/totp";
import { KodeQR } from "./KodeQR";

interface TotpKelolaModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pembuka kunci hanya masuk akal bila PIN aktif: Authenticator adalah langkah kedua setelah PIN atau biometrik. */
  kunciAktif: boolean;
  googleUser: User | null;
  ambilToken?: () => Promise<string | null>;
  driveContents: KeuanganDriveContents | null;
  /** Dipanggil setelah Authenticator diaktifkan, diubah, atau dinonaktifkan. */
  onBerubah: () => void;
}

const bahasaTanggal = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export const TotpKelolaModal: React.FC<TotpKelolaModalProps> = ({ isOpen, onClose, kunciAktif, googleUser, ambilToken, driveContents, onBerubah }) => {
  const [tersimpan, setTersimpan] = useState(() => muatTotp());
  const [rahasia, setRahasia] = useState("");
  const [email, setEmail] = useState("");
  const [emailManual, setEmailManual] = useState("");
  const [mencariEmail, setMencariEmail] = useState(false);
  const [kode, setKode] = useState("");
  const [interval, setIntervalPilihan] = useState<IntervalTotp>("8jam");
  const [pesan, setPesan] = useState("");
  const [memproses, setMemproses] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const kini = muatTotp();
    setTersimpan(kini);
    setIntervalPilihan(kini?.interval ?? "8jam");
    setRahasia(kini ? "" : buatRahasiaTotp());
    setKode("");
    setPesan("");
    setTersalin(false);
  }, [isOpen]);

  // Akun tertaut = akun Google yang dipakai untuk Google Drive. Profil masuk biasa membawa emailnya; di mode artefak
  // profilnya hanya pengganti, jadi emailnya dibaca dari pemilik berkas keuangan di Drive.
  useEffect(() => {
    if (!isOpen) return;
    const dariProfil = googleUser?.email && adalahEmail(googleUser.email) ? googleUser.email.trim().toLowerCase() : "";
    if (dariProfil) {
      setEmail(dariProfil);
      return;
    }
    setEmail("");
    if (!googleUser || !ambilToken || !driveContents) return;
    let batal = false;
    setMencariEmail(true);
    void (async () => {
      try {
        const token = await ambilToken();
        const ditemukan = token ? await emailAkunDrive(token, driveContents) : null;
        if (!batal && ditemukan) setEmail(ditemukan);
      } finally {
        if (!batal) setMencariEmail(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [isOpen, googleUser, ambilToken, driveContents]);

  const emailPakai = email || (adalahEmail(emailManual) ? emailManual.trim() : "");
  const uri = useMemo(() => (rahasia && emailPakai ? buatUriOtpauth({ email: emailPakai, rahasia }) : ""), [rahasia, emailPakai]);

  if (!isOpen) return null;

  const salinKunci = async () => {
    try {
      await navigator.clipboard.writeText(rahasia);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2500);
    } catch {
      setPesan("Kunci tidak bisa disalin otomatis. Ketik dari tampilan di atas.");
    }
  };

  const handleAktifkan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesan("");
    if (!emailPakai) {
      setPesan("Akun email Google belum diketahui. Isi emailnya di atas.");
      return;
    }
    setMemproses(true);
    try {
      const ok = await aktifkanTotp(rahasia, emailPakai, kode, interval);
      if (!ok) {
        setPesan("Kode tidak cocok. Pastikan entri di Google Authenticator bernama Catatan Keuangan, lalu masukkan kode terbarunya.");
        return;
      }
      setTersimpan(muatTotp());
      setRahasia("");
      setKode("");
      onBerubah();
    } finally {
      setMemproses(false);
    }
  };

  const handleNonaktifkan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesan("");
    setMemproses(true);
    try {
      const hasil = await nonaktifkanTotp(kode);
      if (!hasil.berhasil) {
        setPesan(hasil.pesan);
        return;
      }
      setTersimpan(null);
      setRahasia(buatRahasiaTotp());
      setKode("");
      onBerubah();
    } finally {
      setMemproses(false);
    }
  };

  const ubahInterval = (nilai: IntervalTotp) => {
    setIntervalPilihan(nilai);
    if (tersimpan) {
      ubahIntervalTotp(nilai);
      setTersimpan(muatTotp());
      onBerubah();
    }
  };

  const sisaKunci = sisaDetikKunci(tersimpan, Date.now());

  // Di body, bukan di dalam tab: tab membentuk lapisan tumpukan sendiri sehingga bilah navigasi menimpa tombol di dasar modal.
  return createPortal(
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Google Authenticator"
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
      onClick={onClose}
    >
      <div
        id="totp-modal"
        style={{
          maxWidth: "440px",
          width: "100%",
          maxHeight: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem" }}>🔐 Google Authenticator</h3>
          <button type="button" className="btn-ikon" onClick={onClose} aria-label="Tutup" style={{ fontSize: "1.2rem" }}>
            ✕
          </button>
        </div>

        {!kunciAktif && (
          <p className="help" id="totp-butuh-kunci">
            Aktifkan <strong>Kunci Aplikasi</strong> (PIN) lebih dulu. Google Authenticator menjadi langkah kedua setelah PIN atau sidik jari.
          </p>
        )}

        {pesan && (
          <div
            role="alert"
            id="totp-pesan"
            style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", fontSize: "0.85rem", marginBottom: "14px" }}
          >
            {pesan}
          </div>
        )}

        {tersimpan ? (
          <form onSubmit={handleNonaktifkan}>
            <div
              id="totp-status"
              style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid #10b981", marginBottom: "14px" }}
            >
              <div style={{ fontWeight: 700, color: "#10b981" }}>✓ Aktif</div>
              <div style={{ fontSize: "0.85rem", overflowWrap: "anywhere" }}>
                Akun tertaut: <strong>{tersimpan.email || "—"}</strong>
              </div>
              {tersimpan.aktifSejak && <div className="help" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>Sejak {bahasaTanggal(tersimpan.aktifSejak)}</div>}
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label htmlFor="totp-interval">Minta kode</label>
              <select id="totp-interval" value={interval} onChange={(e) => ubahInterval(e.target.value as IntervalTotp)}>
                {(Object.keys(LABEL_INTERVAL) as IntervalTotp[]).map((k) => (
                  <option key={k} value={k}>
                    {LABEL_INTERVAL[k]}
                  </option>
                ))}
              </select>
              <span className="help" style={{ fontSize: "0.75rem" }}>
                Kode diminta setelah PIN atau sidik jari berhasil.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label htmlFor="totp-kode-nonaktif">Untuk menonaktifkan, masukkan kode saat ini</label>
              <input
                id="totp-kode-nonaktif"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={kode}
                onChange={(e) => setKode(e.target.value.replace(/[^\d ]/g, ""))}
                placeholder="000000"
                style={{ textAlign: "center", fontSize: "1.3rem", letterSpacing: "6px" }}
              />
              {sisaKunci > 0 && <span className="help" style={{ color: "#f87171" }}>Dikunci sementara: {sisaKunci} detik.</span>}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Tutup
              </button>
              <button
                type="submit"
                id="totp-nonaktifkan"
                className="btn-primary"
                disabled={memproses || kode.replace(/\s/g, "").length !== 6}
                style={{ flex: 1, justifyContent: "center", background: "#ef4444" }}
              >
                {memproses ? "Memeriksa…" : "Nonaktifkan"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAktifkan}>
            <p className="help" style={{ fontSize: "0.85rem" }}>
              Tambahkan langkah kedua: selain PIN, aplikasi meminta kode 6 angka dari <strong>Google Authenticator</strong> di ponsel Anda. Rahasianya
              hanya disimpan di perangkat ini dan tidak dikirim ke Google Drive.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Akun email Google yang tertaut</div>
              {email ? (
                <div id="totp-email" style={{ fontSize: "0.95rem", overflowWrap: "anywhere" }}>
                  {email}
                </div>
              ) : mencariEmail ? (
                <div className="help">Membaca akun Google Drive Anda…</div>
              ) : (
                <>
                  <input
                    id="totp-email-manual"
                    type="email"
                    inputMode="email"
                    value={emailManual}
                    placeholder="nama@example.com"
                    onChange={(e) => setEmailManual(e.target.value)}
                    aria-label="Email Google tertaut"
                  />
                  <span className="help" style={{ fontSize: "0.75rem" }}>
                    {googleUser ? "Email belum terbaca otomatis; isi email akun Google Drive Anda." : "Masuk dengan Google di Drive Keuangan agar email terisi otomatis, atau isi sendiri."}
                  </span>
                </>
              )}
            </div>

            {uri ? (
              <>
                <ol className="help" style={{ margin: "0 0 10px", paddingLeft: "18px", fontSize: "0.82rem", lineHeight: 1.5 }}>
                  <li>Buka Google Authenticator, ketuk <strong>+</strong>, pilih <strong>Pindai kode QR</strong>.</li>
                  <li>Pindai kode di bawah (atau pilih <strong>Masukkan kunci penyiapan</strong> dan ketik kuncinya).</li>
                  <li>Masukkan kode 6 angka yang muncul untuk memastikan berhasil.</li>
                </ol>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                  <KodeQR teks={uri} ukuran={200} label="Kode QR Google Authenticator" />
                </div>
                <div style={{ marginBottom: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Kunci penyiapan</div>
                  <code id="totp-kunci" style={{ fontSize: "1rem", letterSpacing: "1px", overflowWrap: "anywhere" }}>
                    {formatRahasia(rahasia)}
                  </code>
                  <div>
                    <button type="button" className="btn-small" onClick={() => void salinKunci()} style={{ marginTop: "6px" }}>
                      {tersalin ? "Tersalin ✓" : "Salin kunci"}
                    </button>
                  </div>
                  <div className="help" style={{ fontSize: "0.75rem", marginTop: "6px" }}>
                    Simpan kunci ini di tempat aman. Bila ponsel hilang atau aplikasi dipasang ulang, kunci ini dipakai untuk menyiapkan Authenticator lagi.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label htmlFor="totp-kode">Kode dari Google Authenticator</label>
                  <input
                    id="totp-kode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={7}
                    value={kode}
                    onChange={(e) => setKode(e.target.value.replace(/[^\d ]/g, ""))}
                    placeholder="000000"
                    style={{ textAlign: "center", fontSize: "1.3rem", letterSpacing: "6px" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label htmlFor="totp-interval-baru">Minta kode</label>
                  <select id="totp-interval-baru" value={interval} onChange={(e) => setIntervalPilihan(e.target.value as IntervalTotp)}>
                    {(Object.keys(LABEL_INTERVAL) as IntervalTotp[]).map((k) => (
                      <option key={k} value={k}>
                        {LABEL_INTERVAL[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="help">Kode QR muncul setelah akun email Google diketahui.</p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Batal
              </button>
              <button
                type="submit"
                id="totp-aktifkan"
                className="btn-primary"
                disabled={memproses || !kunciAktif || !uri || kode.replace(/\s/g, "").length !== 6}
                style={{ flex: 1, justifyContent: "center" }}
              >
                {memproses ? "Memeriksa…" : "Aktifkan"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
