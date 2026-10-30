import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Zap, Key, Check, ExternalLink } from "lucide-react";
import {
  GeminiModelTier,
  ambilPengaturanGemini,
  simpanPengaturanGemini,
} from "../lib/geminiStruk";
import { ambilAkunAktif } from "../lib/multiAkun";

interface PengaturanGeminiModalProps {
  onTutup: () => void;
  onSimpan?: () => void;
}

export const PengaturanGeminiModal: React.FC<PengaturanGeminiModalProps> = ({
  onTutup,
  onSimpan,
}) => {
  const [tier, setTier] = useState<GeminiModelTier>("flash");
  const [apiKey, setApiKey] = useState("");
  const [lihatKunci, setLihatKunci] = useState(false);
  const [pesanSukses, setPesanSukses] = useState(false);
  const [emailPengguna, setEmailPengguna] = useState<string | null>(null);

  useEffect(() => {
    const config = ambilPengaturanGemini();
    setTier(config.tier);
    setApiKey(config.apiKey);

    try {
      const akun = ambilAkunAktif();
      if (akun?.email) {
        setEmailPengguna(akun.email);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSimpan = (e: React.FormEvent) => {
    e.preventDefault();
    simpanPengaturanGemini({
      tier,
      apiKey: apiKey.trim(),
    });
    setPesanSukses(true);
    if (onSimpan) onSimpan();
    setTimeout(() => {
      onTutup();
    }, 450);
  };

  const handleResetBawaan = () => {
    setApiKey("");
    setTier("flash");
    simpanPengaturanGemini({
      tier: "flash",
      apiKey: "",
    });
    setPesanSukses(true);
    if (onSimpan) onSimpan();
    setTimeout(() => {
      onTutup();
    }, 450);
  };

  return createPortal(
    <div
      className="pemindai-latar"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-pengaturan-gemini"
      onClick={onTutup}
      style={{
        zIndex: 10005,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        className="pemindai-kotak"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          maxHeight: "min(90dvh, 680px)",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: "16px",
          boxShadow: "0 18px 48px rgba(0, 0, 0, 0.45)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        {/* Header Tetap di Atas */}
        <div
          className="pemindai-kepala"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            background: "color-mix(in srgb, var(--surface) 92%, var(--track))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                border: "1px solid var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.15rem",
                flexShrink: 0,
              }}
            >
              ⚙️
            </div>
            <div>
              <h3
                id="judul-pengaturan-gemini"
                style={{
                  margin: 0,
                  fontSize: "1.02rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  lineHeight: 1.25,
                }}
              >
                Pengaturan Gemini AI &amp; Kuota
              </h3>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: "0.76rem",
                  color: "var(--muted)",
                  lineHeight: 1.3,
                }}
              >
                Pilih model &amp; sesuaikan dengan akun/langganan Google Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pemindai-tutup"
            onClick={onTutup}
            aria-label="Tutup"
            title="Tutup"
            style={{
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Konten Scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Info Akun Google */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "0.84rem",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#4285F4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.85rem",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(66, 133, 244, 0.35)",
              }}
            >
              G
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Akun Google Terhubung
              </div>
              <div
                style={{
                  fontWeight: 600,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: "1px",
                }}
              >
                {emailPengguna || "Tersambung ke Google Drive"}
              </div>
            </div>
          </div>

          <form id="form-pengaturan-gemini" onSubmit={handleSimpan} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Pilihan Model */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  marginBottom: "10px",
                  color: "var(--text)",
                }}
              >
                Pilihan Model Analisis Bukti:
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }} role="radiogroup" aria-label="Pilihan Model Gemini">
                {/* Opsi 1: Flash */}
                <div
                  role="radio"
                  aria-checked={tier === "flash"}
                  tabIndex={0}
                  onClick={() => setTier("flash")}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setTier("flash");
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "14px 14px",
                    borderRadius: "12px",
                    border: tier === "flash" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background:
                      tier === "flash"
                        ? "color-mix(in srgb, var(--accent) 14%, var(--surface))"
                        : "rgba(255, 255, 255, 0.02)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    boxShadow: tier === "flash" ? "0 0 12px color-mix(in srgb, var(--accent) 25%, transparent)" : "none",
                  }}
                >
                  {/* Lingkaran Radio Kustom - Presisi 100% Center */}
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      minWidth: "22px",
                      minHeight: "22px",
                      borderRadius: "50%",
                      border: `2px solid ${tier === "flash" ? "var(--accent)" : "rgba(255, 255, 255, 0.35)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: "2px",
                      backgroundColor: tier === "flash" ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "transparent",
                      flexShrink: 0,
                      boxSizing: "border-box",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tier === "flash" && (
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          minWidth: "10px",
                          minHeight: "10px",
                          borderRadius: "50%",
                          backgroundColor: "var(--accent)",
                          boxShadow: "0 0 6px var(--accent)",
                        }}
                      />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          color: "var(--text)",
                        }}
                      >
                        <Zap size={15} style={{ color: "#FBBF24", flexShrink: 0 }} />
                        <span>Gemini 3.8 Flash (Hemat Kuota)</span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 8px",
                          borderRadius: "8px",
                          background: "rgba(16, 185, 129, 0.22)",
                          color: "#10B981",
                          fontWeight: 700,
                          letterSpacing: "0.3px",
                          flexShrink: 0,
                        }}
                      >
                        Cepat
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.77rem",
                        color: "var(--muted)",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      Konsumsi token sangat hemat. Sangat cocok untuk pengguna paket gratis (Free) atau
                      analisis struk minimarket, SPBU, makan siang harian.
                    </div>
                  </div>
                </div>

                {/* Opsi 2: Pro */}
                <div
                  role="radio"
                  aria-checked={tier === "pro"}
                  tabIndex={0}
                  onClick={() => setTier("pro")}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setTier("pro");
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "14px 14px",
                    borderRadius: "12px",
                    border: tier === "pro" ? "2px solid #A855F7" : "1px solid var(--border)",
                    background:
                      tier === "pro"
                        ? "color-mix(in srgb, #A855F7 14%, var(--surface))"
                        : "rgba(255, 255, 255, 0.02)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    boxShadow: tier === "pro" ? "0 0 12px rgba(168, 85, 247, 0.3)" : "none",
                  }}
                >
                  {/* Lingkaran Radio Kustom - Presisi 100% Center */}
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      minWidth: "22px",
                      minHeight: "22px",
                      borderRadius: "50%",
                      border: `2px solid ${tier === "pro" ? "#A855F7" : "rgba(255, 255, 255, 0.35)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: "2px",
                      backgroundColor: tier === "pro" ? "rgba(168, 85, 247, 0.22)" : "transparent",
                      flexShrink: 0,
                      boxSizing: "border-box",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tier === "pro" && (
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          minWidth: "10px",
                          minHeight: "10px",
                          borderRadius: "50%",
                          backgroundColor: "#A855F7",
                          boxShadow: "0 0 6px #A855F7",
                        }}
                      />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          color: "var(--text)",
                        }}
                      >
                        <Sparkles size={15} style={{ color: "#C084FC", flexShrink: 0 }} />
                        <span>Gemini 4 Argon (Google AI Pro / Plus)</span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 8px",
                          borderRadius: "8px",
                          background: "rgba(168, 85, 247, 0.28)",
                          color: "#C084FC",
                          fontWeight: 700,
                          letterSpacing: "0.3px",
                          flexShrink: 0,
                        }}
                      >
                        Pro
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.77rem",
                        color: "var(--muted)",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      Penalaran multimodal tingkat tinggi. Cocok untuk Anda yang memiliki langganan Google AI
                      Pro / Google AI Plus guna membaca nota tulisan tangan atau dokumen rumit.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pengaturan API Key Pribadi (Opsional) */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.22)",
                border: "1px dashed var(--border)",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <Key size={16} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                  API Key Gemini Pribadi (Opsional)
                </strong>
              </div>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "0.76rem",
                  color: "var(--muted)",
                  lineHeight: 1.48,
                }}
              >
                Jika Anda sering kehabisan token (Error 429), Anda dapat memasukkan Gemini API Key pribadi dari akun
                Google Anda agar aplikasi menggunakan kuota khusus langganan Anda secara penuh.
              </p>

              <div style={{ position: "relative" }}>
                <input
                  type={lihatKunci ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy... (kosongkan jika pakai kuota bawaan)"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 84px 10px 12px",
                    fontSize: "0.82rem",
                    background: "var(--surface)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setLihatKunci(!lihatKunci)}
                  style={{
                    position: "absolute",
                    right: "6px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: "0.74rem",
                    cursor: "pointer",
                    padding: "6px 8px",
                    fontWeight: 600,
                  }}
                >
                  {lihatKunci ? "Sembunyikan" : "Lihat"}
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  fontSize: "0.74rem",
                  color: "var(--muted)",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                <span>🔒 Disimpan aman di browser Anda</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Ambil API Key <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Feedback simpan */}
            {pesanSukses && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--masuk)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  justifyContent: "center",
                  padding: "6px 12px",
                  background: "color-mix(in srgb, var(--masuk) 12%, transparent)",
                  borderRadius: "8px",
                }}
              >
                <Check size={16} /> Pengaturan Gemini berhasil disimpan!
              </div>
            )}
          </form>
        </div>

        {/* Footer Tombol Aksi - Sticky Selalu Terlihat di Bawah */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--surface) 90%, var(--track))",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          {apiKey && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResetBawaan}
              style={{
                fontSize: "0.82rem",
                padding: "8px 14px",
                minHeight: "40px",
                marginRight: "auto",
              }}
            >
              Reset Bawaan
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={onTutup}
            style={{
              fontSize: "0.82rem",
              padding: "8px 16px",
              minHeight: "40px",
            }}
          >
            Batal
          </button>
          <button
            type="submit"
            form="form-pengaturan-gemini"
            className="btn-primary"
            style={{
              fontSize: "0.82rem",
              padding: "8px 20px",
              minHeight: "40px",
              fontWeight: 700,
            }}
          >
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
