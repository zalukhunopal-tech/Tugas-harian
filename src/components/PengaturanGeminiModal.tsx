import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Zap, Key, ShieldCheck, Check, Info, ExternalLink } from "lucide-react";
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
      style={{ zIndex: 10005 }}
    >
      <div
        className="pemindai-kotak"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "460px", padding: "20px" }}
      >
        <div className="pemindai-kepala" style={{ marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.25rem" }}>⚙️</span>
            <div>
              <h3 id="judul-pengaturan-gemini" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                Pengaturan Gemini AI &amp; Kuota
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.76rem", color: "var(--muted)" }}>
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
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Akun Google */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.82rem",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#4285F4",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.8rem",
              flexShrink: 0,
            }}
          >
            G
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Akun Google Terhubung</div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {emailPengguna || "Tersambung ke Google Drive"}
            </div>
          </div>
        </div>

        <form onSubmit={handleSimpan} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Pilihan Model */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--text)",
              }}
            >
              Pilihan Model Analisis Bukti:
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Opsi 1: Flash */}
              <div
                onClick={() => setTier("flash")}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: tier === "flash" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background:
                    tier === "flash"
                      ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                      : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ marginTop: "2px" }}>
                  <input
                    type="radio"
                    name="modelTier"
                    value="flash"
                    checked={tier === "flash"}
                    onChange={() => setTier("flash")}
                    style={{ accentColor: "var(--accent)" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      color: "var(--text)",
                    }}
                  >
                    <Zap size={15} style={{ color: "#FBBF24" }} />
                    <span>Gemini 3.8 Flash (Hemat Kuota)</span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "1px 6px",
                        borderRadius: "6px",
                        background: "rgba(16, 185, 129, 0.2)",
                        color: "#10B981",
                        fontWeight: 600,
                      }}
                    >
                      Cepat
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                    Konsumsi token sangat hemat. Sangat cocok untuk pengguna paket gratis (Free) atau
                    analisis struk minimarket, SPBU, makan siang harian.
                  </div>
                </div>
              </div>

              {/* Opsi 2: Pro */}
              <div
                onClick={() => setTier("pro")}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: tier === "pro" ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background:
                    tier === "pro"
                      ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                      : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ marginTop: "2px" }}>
                  <input
                    type="radio"
                    name="modelTier"
                    value="pro"
                    checked={tier === "pro"}
                    onChange={() => setTier("pro")}
                    style={{ accentColor: "var(--accent)" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      color: "var(--text)",
                    }}
                  >
                    <Sparkles size={15} style={{ color: "#A855F7" }} />
                    <span>Gemini 4 Argon (Google AI Pro / Plus)</span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "1px 6px",
                        borderRadius: "6px",
                        background: "rgba(168, 85, 247, 0.25)",
                        color: "#C084FC",
                        fontWeight: 600,
                      }}
                    >
                      Pro
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
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
              background: "rgba(0,0,0,0.2)",
              border: "1px dashed var(--border)",
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <Key size={15} style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: "0.82rem", color: "var(--text)" }}>
                API Key Gemini Pribadi (Opsional)
              </strong>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: "0.74rem", color: "var(--muted)", lineHeight: 1.4 }}>
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
                  padding: "8px 75px 8px 10px",
                  fontSize: "0.8rem",
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
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  padding: "4px 6px",
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
                marginTop: "6px",
                fontSize: "0.72rem",
                color: "var(--muted)",
              }}
            >
              <span>Disimpan aman di browser Anda</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  textDecoration: "none",
                }}
              >
                Ambil API Key <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Feedback simpan */}
          {pesanSukses && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--masuk)",
                fontSize: "0.8rem",
                fontWeight: 600,
                justifyContent: "center",
              }}
            >
              <Check size={16} /> Pengaturan Gemini berhasil disimpan!
            </div>
          )}

          {/* Tombol Aksi */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
            {apiKey && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetBawaan}
                style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              >
                Reset Bawaan
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={onTutup}
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ fontSize: "0.8rem", padding: "6px 16px" }}
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
