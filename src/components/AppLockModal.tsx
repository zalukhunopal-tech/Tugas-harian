import React, { useState, useEffect, useCallback } from "react";
import { AppLockConfig, KarakterId } from "../types";
import { verifyPin, authenticateBiometric } from "../lib/appLock";
import { KarakterAnimasi } from "./KarakterAnimasi";

interface AppLockModalProps {
  config: AppLockConfig;
  karakter: KarakterId;
  onUnlock: () => void;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({
  config,
  karakter,
  onUnlock,
}) => {
  const [pin, setPin] = useState<string>("");
  const [errorPesan, setErrorPesan] = useState<string>("");
  const [memverifikasi, setMemverifikasi] = useState<boolean>(false);
  const [goyang, setGoyang] = useState<boolean>(false);

  const handleCobaBiometrik = useCallback(async () => {
    if (!config.webAuthnEnabled) return;
    setMemverifikasi(true);
    setErrorPesan("");
    try {
      const berhasil = await authenticateBiometric(config.credentialId);
      if (berhasil) {
        onUnlock();
      } else {
        setErrorPesan("Verifikasi biometrik tidak berhasil. Silakan gunakan PIN.");
      }
    } catch {
      setErrorPesan("Verifikasi biometrik gagal.");
    } finally {
      setMemverifikasi(false);
    }
  }, [config.credentialId, config.webAuthnEnabled, onUnlock]);

  // Otomatis buka prompt biometrik saat lock screen pertama kali muncul jika diaktifkan
  useEffect(() => {
    if (config.webAuthnEnabled) {
      const timer = setTimeout(() => {
        void handleCobaBiometrik();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [config.webAuthnEnabled, handleCobaBiometrik]);

  const prosesVerifikasiPin = useCallback(
    async (pinInput: string) => {
      setMemverifikasi(true);
      setErrorPesan("");
      try {
        const cocok = await verifyPin(pinInput, config);
        if (cocok) {
          onUnlock();
        } else {
          setGoyang(true);
          setErrorPesan("PIN salah. Silakan coba lagi.");
          setPin("");
          setTimeout(() => setGoyang(false), 500);
        }
      } catch {
        setErrorPesan("Terjadi kesalahan saat memeriksa PIN.");
      } finally {
        setMemverifikasi(false);
      }
    },
    [config, onUnlock]
  );

  const handleTekanAngka = (angka: string) => {
    if (pin.length >= 6 || memverifikasi) return;
    const pinBaru = pin + angka;
    setPin(pinBaru);
    setErrorPesan("");
    // Jika sudah mencapai minimal 4 digit dan panjangnya cocok, periksa langsung bila 6 digit
    if (pinBaru.length === 6) {
      void prosesVerifikasiPin(pinBaru);
    }
  };

  const handleHapusSatu = () => {
    if (pin.length > 0 && !memverifikasi) {
      setPin((prev) => prev.slice(0, -1));
      setErrorPesan("");
    }
  };

  const handleResetPin = () => {
    if (!memverifikasi) {
      setPin("");
      setErrorPesan("");
    }
  };

  const handleKirimPin = () => {
    if (pin.length < 4) {
      setErrorPesan("PIN minimal 4 angka.");
      return;
    }
    void prosesVerifikasiPin(pin);
  };

  // Dengarkan input keyboard fisik
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (memverifikasi) return;
      if (e.key >= "0" && e.key <= "9") {
        handleTekanAngka(e.key);
      } else if (e.key === "Backspace") {
        handleHapusSatu();
      } else if (e.key === "Enter") {
        if (pin.length >= 4) {
          void prosesVerifikasiPin(pin);
        }
      } else if (e.key === "Escape") {
        handleResetPin();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, memverifikasi, prosesVerifikasiPin]);

  return (
    <div
      className="modal-backdrop app-lock-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(10, 10, 15, 0.96)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className={`card app-lock-card ${goyang ? "shake-anim" : ""}`}
        style={{
          maxWidth: "380px",
          width: "100%",
          padding: "28px 24px",
          borderRadius: "24px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 24px var(--aura)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
          <KarakterAnimasi karakter={karakter} ukuran={56} showAura interaktif />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "1.4rem" }}>🔒</span>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>Aplikasi Terkunci</h2>
        </div>
        <p className="help" style={{ margin: "0 0 20px", fontSize: "0.85rem" }}>
          Masukkan PIN 4–6 angka Anda untuk membuka
        </p>

        {/* Indikator Titik PIN */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            marginBottom: "16px",
            height: "28px",
            alignItems: "center",
          }}
        >
          {Array.from({ length: 6 }).map((_, idx) => {
            const terisi = idx < pin.length;
            return (
              <span
                key={idx}
                style={{
                  width: terisi ? "14px" : "12px",
                  height: terisi ? "14px" : "12px",
                  borderRadius: "50%",
                  backgroundColor: terisi ? "var(--primary)" : "var(--border)",
                  boxShadow: terisi ? "0 0 10px var(--primary)" : "none",
                  transition: "all 0.15s ease",
                  border: "1px solid var(--border)",
                }}
              />
            );
          })}
        </div>

        {errorPesan && (
          <div
            style={{
              color: "#ef4444",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "12px",
              minHeight: "20px",
            }}
          >
            {errorPesan}
          </div>
        )}

        {/* Keypad Angka */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
            maxWidth: "280px",
            margin: "0 auto 16px",
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              className="btn-keypad"
              disabled={memverifikasi}
              onClick={() => handleTekanAngka(n)}
              style={{
                height: "54px",
                fontSize: "1.35rem",
                fontWeight: 700,
                borderRadius: "14px",
                border: "1px solid var(--border)",
                background: "var(--surface-hover, rgba(255, 255, 255, 0.05))",
                color: "var(--text)",
                cursor: "pointer",
                transition: "all 0.1s ease",
              }}
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            className="btn-keypad"
            disabled={memverifikasi || pin.length === 0}
            onClick={handleResetPin}
            style={{
              height: "54px",
              fontSize: "0.95rem",
              fontWeight: 600,
              borderRadius: "14px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Hapus
          </button>

          <button
            type="button"
            className="btn-keypad"
            disabled={memverifikasi}
            onClick={() => handleTekanAngka("0")}
            style={{
              height: "54px",
              fontSize: "1.35rem",
              fontWeight: 700,
              borderRadius: "14px",
              border: "1px solid var(--border)",
              background: "var(--surface-hover, rgba(255, 255, 255, 0.05))",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            0
          </button>

          <button
            type="button"
            className="btn-keypad"
            disabled={memverifikasi || pin.length === 0}
            onClick={handleHapusSatu}
            style={{
              height: "54px",
              fontSize: "1.1rem",
              fontWeight: 600,
              borderRadius: "14px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
            }}
            aria-label="Hapus satu angka"
          >
            ⌫
          </button>
        </div>

        {/* Tombol OK jika 4 atau 5 angka */}
        {pin.length >= 4 && pin.length < 6 && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleKirimPin}
            disabled={memverifikasi}
            style={{ width: "100%", marginBottom: "12px", justifyContent: "center" }}
          >
            {memverifikasi ? "Memeriksa…" : "Buka Kunci (Enter)"}
          </button>
        )}

        {/* Tombol Biometrik WebAuthn */}
        {config.webAuthnEnabled && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void handleCobaBiometrik()}
            disabled={memverifikasi}
            style={{
              width: "100%",
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>👆</span>
            <span>Gunakan Sidik Jari / Face ID</span>
          </button>
        )}
      </div>
    </div>
  );
};
