import React, { useState, useEffect } from "react";
import { AppLockConfig } from "../types";
import {
  generateSalt,
  hashPin,
  verifyPin,
  isWebAuthnSupported,
  registerBiometric,
  authenticateBiometric,
} from "../lib/appLock";

interface AppLockKelolaModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppLockConfig;
  onSimpanConfig: (config: AppLockConfig) => void;
}

export const AppLockKelolaModal: React.FC<AppLockKelolaModalProps> = ({
  isOpen,
  onClose,
  config,
  onSimpanConfig,
}) => {
  const [mode, setMode] = useState<"aktifkan" | "nonaktifkan" | "ubah_pin">("aktifkan");
  const [pinLama, setPinLama] = useState("");
  const [pinBaru, setPinBaru] = useState("");
  const [pinKonfirmasi, setPinKonfirmasi] = useState("");
  const [pakaiBiometrik, setPakaiBiometrik] = useState(false);
  const [biometrikTersedia, setBiometrikTersedia] = useState(false);
  const [pesanError, setPesanError] = useState("");
  const [memproses, setMemproses] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPesanError("");
      setPinLama("");
      setPinBaru("");
      setPinKonfirmasi("");
      setPakaiBiometrik(config.webAuthnEnabled);
      setMode(config.enabled ? "ubah_pin" : "aktifkan");

      void isWebAuthnSupported().then((supported) => {
        setBiometrikTersedia(supported);
      });
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleAktifkan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesanError("");

    if (!/^\d{4,6}$/.test(pinBaru)) {
      setPesanError("PIN harus berupa 4 hingga 6 digit angka.");
      return;
    }

    if (pinBaru !== pinKonfirmasi) {
      setPesanError("Konfirmasi PIN tidak cocok.");
      return;
    }

    setMemproses(true);
    try {
      let credentialId: string | undefined = undefined;
      let webAuthnAktif = false;

      if (pakaiBiometrik && biometrikTersedia) {
        const cred = await registerBiometric("Pengguna Catatan Keuangan");
        if (cred) {
          credentialId = cred;
          webAuthnAktif = true;
        } else {
          setPesanError("Biometrik gagal didaftarkan, namun PIN berhasil disimpan.");
        }
      }

      const salt = generateSalt();
      const pinHash = await hashPin(pinBaru, salt);

      const configBaru: AppLockConfig = {
        enabled: true,
        pinHash,
        salt,
        webAuthnEnabled: webAuthnAktif,
        credentialId,
        diubah: new Date().toISOString(),
      };

      onSimpanConfig(configBaru);
      onClose();
    } catch (err: any) {
      setPesanError(`Gagal mengaktifkan kunci: ${err.message}`);
    } finally {
      setMemproses(false);
    }
  };

  const handleNonaktifkan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesanError("");
    setMemproses(true);

    try {
      // Verifikasi PIN lama terlebih dahulu
      const cocok = await verifyPin(pinLama, config);
      if (!cocok) {
        setPesanError("PIN saat ini salah.");
        setMemproses(false);
        return;
      }

      const configBaru: AppLockConfig = {
        enabled: false,
        pinHash: "",
        salt: "",
        webAuthnEnabled: false,
        credentialId: undefined,
        diubah: new Date().toISOString(),
      };

      onSimpanConfig(configBaru);
      onClose();
    } catch (err: any) {
      setPesanError(`Gagal menonaktifkan kunci: ${err.message}`);
    } finally {
      setMemproses(false);
    }
  };

  const handleUbahPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesanError("");

    if (!/^\d{4,6}$/.test(pinBaru)) {
      setPesanError("PIN baru harus berupa 4 hingga 6 digit angka.");
      return;
    }

    if (pinBaru !== pinKonfirmasi) {
      setPesanError("Konfirmasi PIN baru tidak cocok.");
      return;
    }

    setMemproses(true);
    try {
      // Verifikasi PIN lama
      const cocok = await verifyPin(pinLama, config);
      if (!cocok) {
        setPesanError("PIN saat ini salah.");
        setMemproses(false);
        return;
      }

      let credentialId = config.credentialId;
      let webAuthnAktif = pakaiBiometrik;

      if (pakaiBiometrik && biometrikTersedia && !config.credentialId) {
        const cred = await registerBiometric("Pengguna Catatan Keuangan");
        if (cred) {
          credentialId = cred;
          webAuthnAktif = true;
        }
      } else if (!pakaiBiometrik) {
        webAuthnAktif = false;
        credentialId = undefined;
      }

      const salt = generateSalt();
      const pinHash = await hashPin(pinBaru, salt);

      const configBaru: AppLockConfig = {
        enabled: true,
        pinHash,
        salt,
        webAuthnEnabled: webAuthnAktif,
        credentialId,
        diubah: new Date().toISOString(),
      };

      onSimpanConfig(configBaru);
      onClose();
    } catch (err: any) {
      setPesanError(`Gagal mengubah PIN: ${err.message}`);
    } finally {
      setMemproses(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
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
        className="card"
        style={{
          maxWidth: "420px",
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🔒</span> Pengaturan Kunci Aplikasi
          </h3>
          <button type="button" className="btn-ikon" onClick={onClose} style={{ fontSize: "1.2rem" }}>
            ✕
          </button>
        </div>

        {/* Tab / Opsi Aksi */}
        {config.enabled && (
          <div className="filter-chips" style={{ marginBottom: "16px" }}>
            <button
              type="button"
              className="chip"
              aria-checked={mode === "ubah_pin"}
              onClick={() => setMode("ubah_pin")}
            >
              Ubah PIN &amp; Biometrik
            </button>
            <button
              type="button"
              className="chip"
              aria-checked={mode === "nonaktifkan"}
              onClick={() => setMode("nonaktifkan")}
            >
              Nonaktifkan Kunci
            </button>
          </div>
        )}

        {pesanError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#f87171",
              fontSize: "0.85rem",
              marginBottom: "14px",
            }}
          >
            {pesanError}
          </div>
        )}

        {/* Mode: Nonaktifkan Kunci */}
        {mode === "nonaktifkan" && (
          <form onSubmit={handleNonaktifkan}>
            <p className="help" style={{ margin: "0 0 14px", fontSize: "0.85rem" }}>
              Masukkan PIN Anda saat ini untuk menonaktifkan penguncian aplikasi:
            </p>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label htmlFor="input-pin-lama-hapus">PIN Saat Ini (4–6 angka)</label>
              <input
                id="input-pin-lama-hapus"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinLama}
                onChange={(e) => setPinLama(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                required
                autoFocus
                style={{ textAlign: "center", fontSize: "1.4rem", letterSpacing: "8px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={memproses || pinLama.length < 4}
                style={{ flex: 1, justifyContent: "center", background: "#ef4444" }}
              >
                {memproses ? "Memproses…" : "Nonaktifkan Kunci"}
              </button>
            </div>
          </form>
        )}

        {/* Mode: Aktifkan atau Ubah PIN */}
        {(mode === "aktifkan" || mode === "ubah_pin") && (
          <form onSubmit={mode === "aktifkan" ? handleAktifkan : handleUbahPin}>
            {mode === "ubah_pin" && (
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="input-pin-lama">PIN Saat Ini</label>
                <input
                  id="input-pin-lama"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinLama}
                  onChange={(e) => setPinLama(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  required
                  autoFocus
                  style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: "6px" }}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="input-pin-baru">{mode === "ubah_pin" ? "PIN Baru (4–6 angka)" : "Buat PIN (4–6 angka)"}</label>
              <input
                id="input-pin-baru"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinBaru}
                onChange={(e) => setPinBaru(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                required
                autoFocus={mode === "aktifkan"}
                style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: "6px" }}
              />
              <span className="help" style={{ fontSize: "0.75rem" }}>
                Hanya nilai hash SHA-256 yang disimpan demi keamanan privasi Anda.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label htmlFor="input-pin-konfirmasi">Konfirmasi PIN</label>
              <input
                id="input-pin-konfirmasi"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinKonfirmasi}
                onChange={(e) => setPinKonfirmasi(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                required
                style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: "6px" }}
              />
            </div>

            {/* Opsi Biometrik WebAuthn */}
            {biometrikTersedia && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  background: "var(--surface-hover, rgba(255, 255, 255, 0.04))",
                  border: "1px solid var(--border)",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <input
                  type="checkbox"
                  id="chk-biometrik"
                  checked={pakaiBiometrik}
                  onChange={(e) => setPakaiBiometrik(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <label htmlFor="chk-biometrik" style={{ cursor: "pointer", fontSize: "0.85rem", margin: 0 }}>
                  <strong>Aktifkan Sidik Jari / Face ID (WebAuthn)</strong>
                  <br />
                  <span className="help" style={{ fontSize: "0.75rem" }}>
                    Buka aplikasi lebih cepat menggunakan biometrik bawaan perangkat Anda.
                  </span>
                </label>
              </div>
            )}

            <div
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: "16px",
              }}
            >
              ⏱️ <strong>Kunci Otomatis:</strong> Aplikasi akan terkunci otomatis setelah ditinggal di latar belakang selama 1 menit.
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={memproses || pinBaru.length < 4 || pinBaru !== pinKonfirmasi}
                style={{ flex: 1, justifyContent: "center" }}
              >
                {memproses ? "Menyimpan…" : mode === "ubah_pin" ? "Simpan Perubahan" : "Aktifkan Kunci"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
