import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw,
  Zap,
  Image as ImageIcon,
  Check,
  RotateCcw,
} from "lucide-react";

interface KameraStrukModalProps {
  onTutup: () => void;
  onFotoTerambil: (file: File) => void;
}

export const KameraStrukModal: React.FC<KameraStrukModalProps> = ({
  onTutup,
  onFotoTerambil,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [kameraMenyala, setKameraMenyala] = useState(false);
  const [kameraError, setKameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [sedangMenjepret, setSedangMenjepret] = useState(false);

  // Titik fokus saat layar diketuk
  const [titikFokus, setTitikFokus] = useState<{ x: number; y: number } | null>(null);

  // Preview hasil foto sebelum dikirim ke formulir & OCR
  const [fotoPratinjau, setFotoPratinjau] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);

  // Inisialisasi Aliran Kamera Berkualitas Tinggi (HD / 4K)
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let batal = false;

    const startCamera = async () => {
      setKameraError(null);
      setKameraMenyala(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setKameraError(
          "Kamera langsung tidak didukung di peramban ini. Anda dapat memilih foto dari galeri atau kamera bawaan ponsel."
        );
        return;
      }

      try {
        // Minta resolusi tertinggi yang didukung sensor perangkat (ideal 4K/2160p atau Full HD 1080p)
        // Hindari pembatasan 'min' ketat yang sering memicu fallback ke VGA/720p pada HP portrait
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
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

        // Terapkan pengaturan perangkat keras kamera untuk ketajaman teks maksimal
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities?.() as any) || {};

          // Cek dukungan senter / flash
          if (capabilities.torch) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }

          // Aktifkan continuous autofocus & auto exposure agar teks nota sangat tajam
          const advancedConstraints: any = {};
          if (capabilities.focusMode?.includes("continuous")) {
            advancedConstraints.focusMode = "continuous";
          }
          if (capabilities.exposureMode?.includes("continuous")) {
            advancedConstraints.exposureMode = "continuous";
          }
          if (capabilities.whiteBalanceMode?.includes("continuous")) {
            advancedConstraints.whiteBalanceMode = "continuous";
          }

          if (Object.keys(advancedConstraints).length > 0) {
            await videoTrack.applyConstraints({ advanced: [advancedConstraints] }).catch(() => {});
          }
        }

        setKameraMenyala(true);
      } catch (err: any) {
        console.warn("Gagal membuka kamera:", err);
        setKameraError(
          "Izin kamera belum diberikan atau kamera sedang digunakan aplikasi lain. Anda dapat memilih foto dari galeri atau kamera bawaan HP di bawah."
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

  // Tap-to-focus interaktif saat layar disentuh
  const handleTapToFocus = useCallback(
    async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!containerRef.current || !stream) return;
      const rect = containerRef.current.getBoundingClientRect();

      let clientX = 0;
      let clientY = 0;
      if ("touches" in e) {
        if (!e.touches[0]) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      setTitikFokus({ x, y });

      // Hilangkan cincin fokus setelah 1.2 detik
      setTimeout(() => {
        setTitikFokus((prev) => (prev?.x === x && prev?.y === y ? null : prev));
      }, 1200);

      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities?.() as any) || {};
          if (capabilities.focusMode?.includes("continuous")) {
            await (track as any).applyConstraints({
              advanced: [{ focusMode: "continuous" }],
            });
          }
        } catch {
          // ignore
        }
      }
    },
    [stream]
  );

  // Jepret foto berkualitas tinggi (ImageCapture native sensor atau Kanvas HD tanpa pemotongan)
  const handleJepret = async () => {
    if (sedangMenjepret || !stream || !videoRef.current) return;
    setSedangMenjepret(true);

    try {
      const videoTrack = stream.getVideoTracks()[0];

      // METODE 1 (TERBAIK): ImageCapture API hardware sensor bawaan ponsel
      // Mengambil foto asli dari sensor kamera HP (12MP–50MP+) dengan ISP autofocus perangkat
      if (typeof window !== "undefined" && "ImageCapture" in window && videoTrack) {
        try {
          const imageCapture = new (window as any).ImageCapture(videoTrack);
          const photoCapabilities = await imageCapture.getPhotoCapabilities().catch(() => null);
          const photoSettings: any = {};

          if (photoCapabilities?.imageWidth?.max) {
            photoSettings.imageWidth = photoCapabilities.imageWidth.max;
          }
          if (photoCapabilities?.imageHeight?.max) {
            photoSettings.imageHeight = photoCapabilities.imageHeight.max;
          }
          if (torchOn && photoCapabilities?.fillLightMode?.includes("flash")) {
            photoSettings.fillLightMode = "flash";
          }

          const photoBlob = await imageCapture.takePhoto(photoSettings);
          if (photoBlob && photoBlob.size > 0) {
            const file = new File([photoBlob], `struk_hd_${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            const dataUrl = URL.createObjectURL(photoBlob);
            setFotoPratinjau({ file, dataUrl });
            setSedangMenjepret(false);
            return;
          }
        } catch (errImageCapture) {
          console.warn("ImageCapture tidak berhasil, beralih ke perekaman Kanvas HD:", errImageCapture);
        }
      }

      // METODE 2 (FALLBACK): Kanvas resolusi penuh langsung dari video element tanpa pemotongan/downscale
      const video = videoRef.current;
      const vWidth = video.videoWidth || 1920;
      const vHeight = video.videoHeight || 1080;

      const canvas = document.createElement("canvas");
      canvas.width = vWidth;
      canvas.height = vHeight;
      const ctx = canvas.getContext("2d", { alpha: false });

      if (!ctx) throw new Error("Gagal membuat konteks kanvas");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, 0, 0, vWidth, vHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setSedangMenjepret(false);
            return;
          }
          const file = new File([blob], `struk_hd_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          const dataUrl = URL.createObjectURL(blob);
          setFotoPratinjau({ file, dataUrl });
          setSedangMenjepret(false);
        },
        "image/jpeg",
        0.95
      );
    } catch (err) {
      console.error("Gagal menjepret foto kamera HD:", err);
      setSedangMenjepret(false);
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
    if (fotoPratinjau?.dataUrl && fotoPratinjau.dataUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(fotoPratinjau.dataUrl);
      } catch {}
    }
    setFotoPratinjau(null);
  };

  // Fallback: dari file picker / galeri / kamera bawaan
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
      aria-label="Kamera Pemindai Struk HD"
      style={{
        zIndex: 10002,
        padding: 0,
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        position: "fixed",
        inset: 0,
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

      {/* HEADER BAR MINIMALIS */}
      <header
        style={{
          width: "100%",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#ffffff",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
          zIndex: 10,
          boxSizing: "border-box",
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
            <h3
              style={{
                margin: 0,
                fontSize: "0.96rem",
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Kamera Struk HD
            </h3>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "0.74rem",
                color: "rgba(255, 255, 255, 0.8)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Ketuk layar untuk memfokuskan teks nota
            </p>
          </div>
        </div>

        {/* Tombol Kontrol: Senter & Switch Kamera */}
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
                color: torchOn ? "#000000" : "#ffffff",
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

      {/* VIEWPORT KAMERA PENUH (TANPA BINGKAI & TANPA PEMOTONGAN) */}
      <div
        ref={containerRef}
        onClick={handleTapToFocus}
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          cursor: "crosshair",
        }}
      >
        {/* Live Video Kamera */}
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

        {/* Indikator Animasi Titik Fokus (Tap to Focus) */}
        {titikFokus && !fotoPratinjau && (
          <div
            style={{
              position: "absolute",
              left: `${titikFokus.x}px`,
              top: `${titikFokus.y}px`,
              transform: "translate(-50%, -50%)",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              border: "2px solid #00e5ff",
              boxShadow: "0 0 12px rgba(0, 229, 255, 0.8)",
              pointerEvents: "none",
              animation: "focusRing 0.35s ease-out forwards",
              zIndex: 9,
            }}
          />
        )}

        {/* Tampilan Galat Izin Kamera */}
        {kameraError && !fotoPratinjau && (
          <div
            style={{
              position: "relative",
              zIndex: 5,
              padding: "24px 20px",
              textAlign: "center",
              maxWidth: "340px",
              color: "#ffffff",
              background: "rgba(30, 30, 40, 0.92)",
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

        {/* Pratinjau Foto Hasil Jepretan HD */}
        {fotoPratinjau && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000000",
              padding: "12px",
              boxSizing: "border-box",
            }}
          >
            <img
              src={fotoPratinjau.dataUrl}
              alt="Hasil Tangkapan Kamera HD"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "10px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                border: "2px solid var(--accent, #00d2ff)",
              }}
            />
          </div>
        )}
      </div>

      {/* FOOTER KONTROL SHUTTER & OPSI */}
      <footer
        style={{
          width: "100%",
          padding: "16px 20px 24px",
          background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0) 100%)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          zIndex: 10,
          boxSizing: "border-box",
        }}
      >
        {/* MODE PREVIEW: KONFIRMASI FOTO */}
        {fotoPratinjau ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
            <div style={{ color: "#ffffff", fontSize: "0.86rem", fontWeight: 600, textAlign: "center" }}>
              Foto struk berhasil diambil dalam kualitas HD. Lanjutkan analisis OCR?
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
          /* MODE KAMERA AKTIF: TAMPILAN BERSIH SEPERTI KAMERA BAWAAN */
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
                width: "100%",
                maxWidth: "360px",
                margin: "0 auto",
                boxSizing: "border-box",
              }}
            >
              {/* Tombol Akses Galeri */}
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                style={{
                  width: "50px",
                  height: "50px",
                  minWidth: "50px",
                  minHeight: "50px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.18)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Pilih dari Galeri"
                title="Pilih dari Galeri"
              >
                <ImageIcon size={22} />
              </button>

              {/* Tombol Shutter Besar HD */}
              <button
                type="button"
                onClick={handleJepret}
                disabled={!kameraMenyala || sedangMenjepret}
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
                  cursor: kameraMenyala && !sedangMenjepret ? "pointer" : "not-allowed",
                  opacity: sedangMenjepret ? 0.6 : 1,
                  padding: "4px",
                  boxSizing: "border-box",
                  transform: sedangMenjepret ? "scale(0.92)" : "scale(1)",
                  transition: "transform 0.15s ease",
                }}
                aria-label="Jepret Foto Struk HD"
                title="Jepret Foto Struk HD"
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: sedangMenjepret ? "var(--accent, #00e5ff)" : "#ffffff",
                    transition: "background 0.2s ease",
                  }}
                />
              </button>

              {/* Tombol Balik Kamera (Depan / Belakang) */}
              <button
                type="button"
                onClick={handleSwitchCamera}
                style={{
                  width: "50px",
                  height: "50px",
                  minWidth: "50px",
                  minHeight: "50px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.18)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Putar Kamera"
                title="Putar Kamera Depan/Belakang"
              >
                <RefreshCw size={21} />
              </button>
            </div>

            <div
              style={{
                textAlign: "center",
                fontSize: "0.74rem",
                color: "rgba(255, 255, 255, 0.7)",
                marginTop: "2px",
              }}
            >
              📸 Kualitas HD Maksimal · Layar Penuh Tanpa Bingkai
            </div>
          </>
        ) : null}
      </footer>
    </div>,
    document.body
  );
};
