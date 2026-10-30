import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  RefreshCw,
  Zap,
  Sliders,
  Image as ImageIcon,
  Check,
  RotateCcw,
} from "lucide-react";

interface KameraStrukModalProps {
  onTutup: () => void;
  onFotoTerambil: (file: File) => void;
}

type RasioPreset = "struk" | "nota" | "faktur" | "kustom";

export const KameraStrukModal: React.FC<KameraStrukModalProps> = ({
  onTutup,
  onFotoTerambil,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const guideBoxRef = useRef<HTMLDivElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [kameraMenyala, setKameraMenyala] = useState(false);
  const [kameraError, setKameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Preset dan ukuran kotak panduan
  const [preset, setPreset] = useState<RasioPreset>("struk");
  const [customWidthPct, setCustomWidthPct] = useState(72);
  const [customHeightPct, setCustomHeightPct] = useState(70);
  const [potongOtomatis, setPotongOtomatis] = useState(true);

  // Preview hasil foto sebelum dikirim
  const [fotoPratinjau, setFotoPratinjau] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);

  // Inisialisasi Aliran Kamera
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let batal = false;

    const startCamera = async () => {
      setKameraError(null);
      setKameraMenyala(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setKameraError("Kamera langsung tidak didukung di peramban ini. Anda dapat memilih foto dari galeri atau kamera bawaan.");
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        });

        if (batal) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => undefined);
        }

        // Cek dukungan senter / torch
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities?.() as any) || {};
          if (capabilities.torch) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }
        }

        setKameraMenyala(true);
      } catch (err: any) {
        console.warn("Gagal membuka kamera:", err);
        setKameraError(
          "Izin kamera belum diberikan atau kamera sedang digunakan aplikasi lain. Anda dapat memilih foto atau menggunakan kamera bawaan di bawah."
        );
      }
    };

    void startCamera();

    return () => {
      batal = true;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  // Toggle senter
  const handleToggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn("Gagal mengubah senter:", err);
      }
    }
  };

  // Switch kamera depan/belakang
  const handleSwitchCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setTorchOn(false);
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Menentukan dimensi kotak panduan berdasarkan preset
  const getKotakStyle = () => {
    switch (preset) {
      case "struk":
        // Format potret ramping struk kasir thermal (e.g. 1 : 2.2)
        return {
          width: "65%",
          maxWidth: "320px",
          aspectRatio: "1 / 2.1",
          maxHeight: "78%",
        };
      case "nota":
        // Format nota kontan / kuitansi proporsional (3 : 4)
        return {
          width: "78%",
          maxWidth: "360px",
          aspectRatio: "3 / 4",
          maxHeight: "75%",
        };
      case "faktur":
        // Format lebar faktur / kwitansi dinas / A4 (1 : 1.4)
        return {
          width: "86%",
          maxWidth: "400px",
          aspectRatio: "1 / 1.35",
          maxHeight: "75%",
        };
      case "kustom":
        return {
          width: `${customWidthPct}%`,
          height: `${customHeightPct}%`,
          maxWidth: "92%",
          maxHeight: "85%",
        };
    }
  };

  // Jepret dan potong gambar sesuai kotak panduan
  const handleJepret = () => {
    const video = videoRef.current;
    const container = containerRef.current;
    const guideBox = guideBoxRef.current;

    if (!video || !container || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      const containerRect = container.getBoundingClientRect();
      const cWidth = containerRect.width;
      const cHeight = containerRect.height;

      // Hitung scaling video di container (object-fit: cover)
      const scale = Math.max(cWidth / vWidth, cHeight / vHeight);
      const renderedWidth = vWidth * scale;
      const renderedHeight = vHeight * scale;
      const offsetX = (renderedWidth - cWidth) / 2;
      const offsetY = (renderedHeight - cHeight) / 2;

      let cropX = 0;
      let cropY = 0;
      let cropW = vWidth;
      let cropH = vHeight;

      if (potongOtomatis && guideBox) {
        const boxRect = guideBox.getBoundingClientRect();
        const boxX = boxRect.left - containerRect.left;
        const boxY = boxRect.top - containerRect.top;
        const boxW = boxRect.width;
        const boxH = boxRect.height;

        // Konversi koordinat DOM ke piksel asli video
        const rawX = (boxX + offsetX) / scale;
        const rawY = (boxY + offsetY) / scale;
        const rawW = boxW / scale;
        const rawH = boxH / scale;

        // Beri sedikit margin padding 2% agar teks di pinggir nota tidak terpotong
        const padX = rawW * 0.02;
        const padY = rawH * 0.02;

        cropX = Math.max(0, Math.floor(rawX - padX));
        cropY = Math.max(0, Math.floor(rawY - padY));
        cropW = Math.min(vWidth - cropX, Math.floor(rawW + padX * 2));
        cropH = Math.min(vHeight - cropY, Math.floor(rawH + padY * 2));
      }

      // Canvas target: batasi ukuran maksimal ke 1080px untuk menjaga efisiensi token
      const MAX_TARGET = 1080;
      let targetW = cropW;
      let targetH = cropH;

      if (targetW > MAX_TARGET || targetH > MAX_TARGET) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_TARGET) / targetW);
          targetW = MAX_TARGET;
        } else {
          targetW = Math.round((targetW * MAX_TARGET) / targetH);
          targetH = MAX_TARGET;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Gagal membuat konteks canvas 2D");
      }

      // Gambar frame potongan
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      // Konversi ke File
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const file = new File([blob], `struk_kamera_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          setFotoPratinjau({ file, dataUrl });
        },
        "image/jpeg",
        0.85
      );
    } catch (err) {
      console.error("Gagal menjepret foto:", err);
    }
  };

  // Konfirmasi foto yang sudah diambil
  const handleGunakanFoto = () => {
    if (!fotoPratinjau) return;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    onFotoTerambil(fotoPratinjau.file);
    onTutup();
  };

  // Ambil ulang foto
  const handleFotoUlang = () => {
    setFotoPratinjau(null);
  };

  // Fallback: dari file picker / kamera bawaan
  const handlePilihFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      onFotoTerambil(file);
      onTutup();
    }
  };

  return createPortal(
    <div
      className="pemindai-latar"
      role="dialog"
      aria-modal="true"
      aria-label="Kamera Pemindai Struk dengan Kotak Panduan"
      style={{
        zIndex: 10002,
        padding: 0,
        background: "rgba(0, 0, 0, 0.95)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Input Fallback Tersembunyi */}
      <input
        type="file"
        ref={fallbackInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handlePilihFileFallback}
      />

      {/* HEADER BAR */}
      <header
        style={{
          width: "100%",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#ffffff",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
          <button
            type="button"
            className="pemindai-tutup"
            onClick={onTutup}
            aria-label="Tutup kamera"
            title="Tutup kamera"
            style={{
              width: "38px",
              height: "38px",
              minWidth: "38px",
              minHeight: "38px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
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
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#fff", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Kotak Panduan Kamera
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "rgba(255, 255, 255, 0.8)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Sesuaikan kotak dengan nota/struk
            </p>
          </div>
        </div>

        {/* Tombol Kontrol Cepat: Senter & Switch Kamera */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {hasTorch && kameraMenyala && !fotoPratinjau && (
            <button
              type="button"
              onClick={handleToggleTorch}
              style={{
                width: "38px",
                height: "38px",
                minWidth: "38px",
                minHeight: "38px",
                borderRadius: "50%",
                background: torchOn ? "#FBBF24" : "rgba(255, 255, 255, 0.2)",
                color: torchOn ? "#000" : "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
              aria-label="Lampu kilat"
              title="Lampu kilat"
            >
              <Zap size={18} />
            </button>
          )}

          {kameraMenyala && !fotoPratinjau && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              style={{
                width: "38px",
                height: "38px",
                minWidth: "38px",
                minHeight: "38px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
              aria-label="Ganti kamera"
              title="Ganti kamera"
            >
              <RefreshCw size={17} />
            </button>
          )}
        </div>
      </header>

      {/* VIEWPORT & KOTAK PANDUAN */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        {/* Live Video */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: fotoPratinjau ? "none" : "block",
          }}
        />

        {/* Jika terjadi error izin kamera */}
        {kameraError && !fotoPratinjau && (
          <div
            style={{
              position: "relative",
              zIndex: 5,
              padding: "24px 20px",
              textAlign: "center",
              maxWidth: "340px",
              color: "#fff",
              background: "rgba(30, 30, 40, 0.9)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📷</div>
            <h4 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Akses Kamera Terkendala</h4>
            <p style={{ margin: "0 0 16px", fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.4 }}>
              {kameraError}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => fallbackInputRef.current?.click()}
                style={{ fontSize: "0.85rem", padding: "10px 16px" }}
              >
                📸 Ambil dengan Kamera Bawaan HP
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fallbackInputRef.current?.click()}
                style={{ fontSize: "0.85rem", padding: "8px 16px" }}
              >
                🖼️ Pilih Foto dari Galeri
              </button>
            </div>
          </div>
        )}

        {/* Tampilan Preview Foto yang baru saja dijepret */}
        {fotoPratinjau && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000",
            }}
          >
            <img
              src={fotoPratinjau.dataUrl}
              alt="Hasil Tangkapan Kotak Panduan"
              style={{
                maxWidth: "92%",
                maxHeight: "82%",
                objectFit: "contain",
                borderRadius: "10px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                border: "2px solid var(--accent, #00d2ff)",
              }}
            />
          </div>
        )}

        {/* OVERLAY KOTAK PANDUAN (HANYA AKTIF SAAT KAMERA MENYALA & BELUM SNAP) */}
        {kameraMenyala && !fotoPratinjau && (
          <div
            ref={guideBoxRef}
            style={{
              position: "relative",
              ...getKotakStyle(),
              // Efek bayangan gelap di sekeliling kotak panduan (cutout mask)
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.52)",
              borderRadius: "12px",
              border: "1.5px solid rgba(255, 255, 255, 0.4)",
              transition: "width 0.2s ease, height 0.2s ease, aspect-ratio 0.2s ease",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            {/* Sudut-Sudut Pembidik (Reticle Brackets) */}
            {/* Kiri Atas */}
            <div
              style={{
                position: "absolute",
                top: "-3px",
                left: "-3px",
                width: "22px",
                height: "22px",
                borderTop: "3.5px solid var(--accent, #00e5ff)",
                borderLeft: "3.5px solid var(--accent, #00e5ff)",
                borderTopLeftRadius: "10px",
              }}
            />
            {/* Kanan Atas */}
            <div
              style={{
                position: "absolute",
                top: "-3px",
                right: "-3px",
                width: "22px",
                height: "22px",
                borderTop: "3.5px solid var(--accent, #00e5ff)",
                borderRight: "3.5px solid var(--accent, #00e5ff)",
                borderTopRightRadius: "10px",
              }}
            />
            {/* Kiri Bawah */}
            <div
              style={{
                position: "absolute",
                bottom: "-3px",
                left: "-3px",
                width: "22px",
                height: "22px",
                borderBottom: "3.5px solid var(--accent, #00e5ff)",
                borderLeft: "3.5px solid var(--accent, #00e5ff)",
                borderBottomLeftRadius: "10px",
              }}
            />
            {/* Kanan Bawah */}
            <div
              style={{
                position: "absolute",
                bottom: "-3px",
                right: "-3px",
                width: "22px",
                height: "22px",
                borderBottom: "3.5px solid var(--accent, #00e5ff)",
                borderRight: "3.5px solid var(--accent, #00e5ff)",
                borderBottomRightRadius: "10px",
              }}
            />

            {/* Garis Bantu Perataan (Subtle Grid) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gridTemplateRows: "1fr 1fr 1fr",
                opacity: 0.18,
              }}
            >
              <div style={{ borderRight: "1px dashed #fff", borderBottom: "1px dashed #fff" }} />
              <div style={{ borderRight: "1px dashed #fff", borderBottom: "1px dashed #fff" }} />
              <div style={{ borderBottom: "1px dashed #fff" }} />
              <div style={{ borderRight: "1px dashed #fff", borderBottom: "1px dashed #fff" }} />
              <div style={{ borderRight: "1px dashed #fff", borderBottom: "1px dashed #fff" }} />
              <div style={{ borderBottom: "1px dashed #fff" }} />
              <div style={{ borderRight: "1px dashed #fff" }} />
              <div style={{ borderRight: "1px dashed #fff" }} />
              <div />
            </div>

            {/* Label Petunjuk di Tengah Kotak */}
            <div
              style={{
                position: "absolute",
                bottom: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0, 0, 0, 0.65)",
                color: "#fff",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "0.68rem",
                whiteSpace: "nowrap",
                fontWeight: 600,
                letterSpacing: "0.3px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              {preset === "struk" && "🧾 Struk Kasir / SPBU"}
              {preset === "nota" && "📝 Nota / Kuitansi"}
              {preset === "faktur" && "📄 Faktur / A4"}
              {preset === "kustom" && "↔️ Ukuran Kustom"}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER KONTROL */}
      <footer
        style={{
          width: "100%",
          padding: "12px 16px 20px",
          background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0) 100%)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          zIndex: 10,
        }}
      >
        {/* MODE PREVIEW: KONFIRMASI FOTO */}
        {fotoPratinjau ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
            <div style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 600, textAlign: "center" }}>
              Foto terpotong pas sesuai kotak panduan. Kirim ke Gemini AI?
            </div>
            <div style={{ display: "flex", gap: "12px", width: "100%", maxWidth: "360px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleFotoUlang}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "0.85rem",
                  padding: "10px",
                  borderRadius: "12px",
                }}
              >
                <RotateCcw size={16} /> Foto Ulang
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleGunakanFoto}
                style={{
                  flex: 1.3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "0.85rem",
                  padding: "10px",
                  borderRadius: "12px",
                }}
              >
                <Check size={18} /> Analisis Struk
              </button>
            </div>
          </div>
        ) : kameraMenyala && !kameraError ? (
          /* MODE KAMERA AKTIF */
          <>
            {/* Pilihan Rasio Preset Kotak Panduan */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "8px",
                width: "100%",
                maxWidth: "420px",
                margin: "0 auto",
              }}
            >
              <button
                type="button"
                onClick={() => setPreset("struk")}
                style={{
                  padding: "8px 4px",
                  borderRadius: "14px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: preset === "struk" ? "1.5px solid var(--accent, #00d2ff)" : "1px solid rgba(255,255,255,0.2)",
                  background: preset === "struk" ? "rgba(0, 210, 255, 0.25)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                🧾 Struk
              </button>
              <button
                type="button"
                onClick={() => setPreset("nota")}
                style={{
                  padding: "8px 4px",
                  borderRadius: "14px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: preset === "nota" ? "1.5px solid var(--accent, #00d2ff)" : "1px solid rgba(255,255,255,0.2)",
                  background: preset === "nota" ? "rgba(0, 210, 255, 0.25)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                📝 Nota/Bon
              </button>
              <button
                type="button"
                onClick={() => setPreset("faktur")}
                style={{
                  padding: "8px 4px",
                  borderRadius: "14px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: preset === "faktur" ? "1.5px solid var(--accent, #00d2ff)" : "1px solid rgba(255,255,255,0.2)",
                  background: preset === "faktur" ? "rgba(0, 210, 255, 0.25)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                📄 Faktur
              </button>
              <button
                type="button"
                onClick={() => setPreset("kustom")}
                style={{
                  padding: "8px 4px",
                  borderRadius: "14px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: preset === "kustom" ? "1.5px solid var(--accent, #00d2ff)" : "1px solid rgba(255,255,255,0.2)",
                  background: preset === "kustom" ? "rgba(0, 210, 255, 0.25)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                ↔️ Kustom
              </button>
            </div>

            {/* Slider Pengaturan Kotak Jika Mode Kustom */}
            {preset === "kustom" && (
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "6px 12px",
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.74rem", color: "#ccc" }}>
                  <span>Lebar:</span>
                  <input
                    type="range"
                    min="40"
                    max="92"
                    value={customWidthPct}
                    onChange={(e) => setCustomWidthPct(Number(e.target.value))}
                    style={{ width: "80px", accentColor: "var(--accent, #00d2ff)" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.74rem", color: "#ccc" }}>
                  <span>Tinggi:</span>
                  <input
                    type="range"
                    min="35"
                    max="85"
                    value={customHeightPct}
                    onChange={(e) => setCustomHeightPct(Number(e.target.value))}
                    style={{ width: "80px", accentColor: "var(--accent, #00d2ff)" }}
                  />
                </div>
              </div>
            )}

            {/* BAR TOMBOL SHUTTER, GALERI & OPSI */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
                padding: "8px 16px 4px",
                width: "100%",
                maxWidth: "380px",
                margin: "0 auto",
                boxSizing: "border-box",
              }}
            >
              {/* Tombol Galeri Foto */}
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                style={{
                  width: "50px",
                  height: "50px",
                  minWidth: "50px",
                  minHeight: "50px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.16)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  transition: "transform 0.1s ease",
                }}
                aria-label="Pilih dari Galeri"
                title="Pilih dari Galeri"
              >
                <ImageIcon size={22} />
              </button>

              {/* Tombol Shutter Besar */}
              <button
                type="button"
                onClick={handleJepret}
                disabled={!kameraMenyala}
                style={{
                  width: "74px",
                  height: "74px",
                  minWidth: "74px",
                  minHeight: "74px",
                  borderRadius: "50%",
                  border: "4px solid #ffffff",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: kameraMenyala ? "pointer" : "not-allowed",
                  opacity: kameraMenyala ? 1 : 0.5,
                  padding: "4px",
                  boxSizing: "border-box",
                  transition: "transform 0.12s ease",
                }}
                aria-label="Ambil Foto Struk"
                title="Ambil Foto Struk"
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "#ffffff",
                  }}
                />
              </button>

              {/* Tombol Opsi Potong Otomatis */}
              <button
                type="button"
                onClick={() => setPotongOtomatis(!potongOtomatis)}
                style={{
                  width: "50px",
                  height: "50px",
                  minWidth: "50px",
                  minHeight: "50px",
                  borderRadius: "50%",
                  background: potongOtomatis ? "rgba(0, 210, 255, 0.28)" : "rgba(255, 255, 255, 0.16)",
                  color: potongOtomatis ? "var(--accent, #00d2ff)" : "rgba(255, 255, 255, 0.65)",
                  border: potongOtomatis ? "1.5px solid var(--accent, #00d2ff)" : "1px solid rgba(255, 255, 255, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  transition: "transform 0.1s ease",
                }}
                aria-label="Toggle Potong Otomatis"
                title={potongOtomatis ? "Potong Otomatis Kotak Aktif" : "Ambil Foto Utuh (Tanpa Potong)"}
              >
                <Sliders size={20} />
              </button>
            </div>

            {/* Teks Penjelasan Singkat */}
            <div
              style={{
                textAlign: "center",
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.65)",
                marginTop: "2px",
              }}
            >
              {potongOtomatis
                ? "💡 Foto otomatis dipotong rapi sesuai kotak panduan (hemat token AI)"
                : "💡 Foto diambil satu layar penuh"}
            </div>
          </>
        ) : null}
      </footer>
    </div>,
    document.body
  );
};
