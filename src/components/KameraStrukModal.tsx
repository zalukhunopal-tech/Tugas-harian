import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw,
  Zap,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Sparkles,
  Smartphone,
} from "lucide-react";

interface KameraStrukModalProps {
  onTutup: () => void;
  onFotoTerambil: (file: File) => void;
}

type ModeFilterDokumen = "asli" | "tajam" | "hitamputih";

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
  const [efekFlash, setEfekFlash] = useState(false);

  // Zoom hardware
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);

  // Titik fokus saat layar diketuk
  const [titikFokus, setTitikFokus] = useState<{ x: number; y: number; terkunci?: boolean } | null>(null);

  // Preview hasil foto sebelum dikirim ke formulir & OCR
  const [fotoAsli, setFotoAsli] = useState<{ file: File; dataUrl: string } | null>(null);
  const [fotoPratinjau, setFotoPratinjau] = useState<{ file: File; dataUrl: string } | null>(null);
  const [modeFilter, setModeFilter] = useState<ModeFilterDokumen>("tajam");
  const [sedangMemprosesFilter, setSedangMemprosesFilter] = useState(false);

  // Inisialisasi Aliran Kamera Resolusi Tinggi
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let batal = false;

    const startCamera = async () => {
      setKameraError(null);
      setKameraMenyala(false);
      setZoomRange(null);
      setZoomLevel(1);

      if (!navigator.mediaDevices?.getUserMedia) {
        setKameraError(
          "Kamera langsung tidak didukung di peramban ini. Anda dapat menggunakan kamera bawaan ponsel atau memilih dari galeri."
        );
        return;
      }

      try {
        // Minta resolusi sensor tertinggi (ideal 4K / Full HD) tanpa batasan minimum kaku
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
            aspectRatio: { ideal: 16 / 9 },
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

        // Terapkan konfigurasi hardware kamera untuk hasil paling tajam
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities?.() as any) || {};

          // Cek dukungan senter / flash
          if (capabilities.torch) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }

          // Cek dukungan Zoom hardware
          if (capabilities.zoom) {
            setZoomRange({
              min: capabilities.zoom.min || 1,
              max: capabilities.zoom.max || 5,
              step: capabilities.zoom.step || 0.1,
            });
          }

          // Aktifkan continuous autofocus, auto exposure & auto white-balance
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

  // Toggle senter / torch
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

  // Terapkan Zoom kamera (Optical/Digital Zoom bawaan HP)
  const handleUbahZoom = async (level: number) => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && zoomRange) {
      const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, level));
      try {
        await (track as any).applyConstraints({
          advanced: [{ zoom: clamped }],
        });
        setZoomLevel(clamped);
      } catch (err) {
        console.warn("Gagal mengatur zoom:", err);
      }
    }
  };

  // Tap-to-focus: memicu siklus autofokus aktif ke objek nota/struk
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
      setTitikFokus({ x, y, terkunci: false });

      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities?.() as any) || {};

          // Pemicu siklus pemfokusan ulang (trigger single-shot lalu kembali ke continuous)
          if (capabilities.focusMode?.includes("single-shot")) {
            await (track as any).applyConstraints({
              advanced: [{ focusMode: "single-shot" }],
            });
            setTimeout(async () => {
              await (track as any)
                .applyConstraints({ advanced: [{ focusMode: "continuous" }] })
                .catch(() => {});
            }, 600);
          } else if (capabilities.focusMode?.includes("continuous")) {
            await (track as any).applyConstraints({
              advanced: [{ focusMode: "continuous" }],
            });
          }

          // Tandai fokus terkunci secara visual
          setTimeout(() => {
            setTitikFokus((prev) => (prev?.x === x && prev?.y === y ? { ...prev, terkunci: true } : prev));
          }, 400);
        } catch {
          // ignore
        }
      }

      // Hilangkan cincin fokus setelah 1.5 detik
      setTimeout(() => {
        setTitikFokus((prev) => (prev?.x === x && prev?.y === y ? null : prev));
      }, 1500);
    },
    [stream]
  );

  // Filter pengoptimal teks dokumen (memperjelas struk thermal pudar & menggelapkan teks nota)
  const prosesFilterDokumen = (
    fileInput: File,
    targetMode: ModeFilterDokumen
  ): Promise<{ file: File; dataUrl: string }> => {
    if (targetMode === "asli") {
      const dataUrl = URL.createObjectURL(fileInput);
      return Promise.resolve({ file: fileInput, dataUrl });
    }

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(fileInput);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          const fallbackUrl = URL.createObjectURL(fileInput);
          resolve({ file: fileInput, dataUrl: fallbackUrl });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const len = d.length;

        if (targetMode === "tajam") {
          // Hitung distribusi kecerahan
          let minLum = 255;
          let maxLum = 0;
          for (let i = 0; i < len; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }
          const range = Math.max(30, maxLum - minLum);

          for (let i = 0; i < len; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            let stretched = ((lum - minLum) / range) * 255;

            // Kurva S: pertegas teks tinta hitam, terangkan latar kertas putih
            if (stretched < 125) {
              stretched = Math.max(0, stretched * 0.72); // Pergelap teks tinta
            } else if (stretched > 145) {
              stretched = Math.min(255, 255 - (255 - stretched) * 0.45); // Putihkan kertas
            }

            const diff = stretched - lum;
            d[i] = Math.min(255, Math.max(0, Math.round(r + diff)));
            d[i + 1] = Math.min(255, Math.max(0, Math.round(g + diff)));
            d[i + 2] = Math.min(255, Math.max(0, Math.round(b + diff)));
          }
          ctx.putImageData(imgData, 0, 0);
        } else if (targetMode === "hitamputih") {
          // Binarisasi kontras dokumen hitam putih
          for (let i = 0; i < len; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = lum < 142 ? 0 : 255;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              const fallbackUrl = URL.createObjectURL(fileInput);
              resolve({ file: fileInput, dataUrl: fallbackUrl });
              return;
            }
            const enhancedFile = new File([blob], fileInput.name || `struk_${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            const enhancedUrl = URL.createObjectURL(blob);
            resolve({ file: enhancedFile, dataUrl: enhancedUrl });
          },
          "image/jpeg",
          0.95
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const fallbackUrl = URL.createObjectURL(fileInput);
        resolve({ file: fileInput, dataUrl: fallbackUrl });
      };
      img.src = url;
    });
  };

  // Jepret foto berkualitas tinggi (ImageCapture native sensor atau Kanvas HD)
  const handleJepret = async () => {
    if (sedangMenjepret || !stream || !videoRef.current) return;
    setSedangMenjepret(true);

    // Animasi kilatan rana (visual shutter feedback)
    setEfekFlash(true);
    setTimeout(() => setEfekFlash(false), 120);

    try {
      const videoTrack = stream.getVideoTracks()[0];
      let hasilFile: File | null = null;

      // METODE 1: ImageCapture API hardware sensor asli ponsel (12MP–50MP+)
      if (typeof window !== "undefined" && "ImageCapture" in window && videoTrack) {
        try {
          const imageCapture = new (window as any).ImageCapture(videoTrack);
          let photoBlob: Blob | null = null;

          // Ambil foto dengan flash jika senter aktif
          try {
            photoBlob = await imageCapture.takePhoto(torchOn ? { fillLightMode: "flash" } : {});
          } catch {
            photoBlob = await imageCapture.takePhoto().catch(() => null);
          }

          if (photoBlob && photoBlob.size > 0) {
            hasilFile = new File([photoBlob], `struk_hd_${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
          }
        } catch (errImageCapture) {
          console.warn("Perekaman ImageCapture beralih ke Kanvas HD:", errImageCapture);
        }
      }

      // METODE 2: Kanvas resolusi penuh langsung dari video element tanpa pemotongan
      if (!hasilFile) {
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

        hasilFile = await new Promise<File | null>((resolve) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(null);
              resolve(new File([blob], `struk_hd_${Date.now()}.jpg`, { type: "image/jpeg" }));
            },
            "image/jpeg",
            0.95
          );
        });
      }

      if (hasilFile) {
        const rawUrl = URL.createObjectURL(hasilFile);
        setFotoAsli({ file: hasilFile, dataUrl: rawUrl });

        // Terapkan penajam teks dokumen default (mode tajam)
        setSedangMemprosesFilter(true);
        const filtered = await prosesFilterDokumen(hasilFile, "tajam");
        setFotoPratinjau(filtered);
        setModeFilter("tajam");
        setSedangMemprosesFilter(false);
      }
    } catch (err) {
      console.error("Gagal menjepret foto:", err);
    } finally {
      setSedangMenjepret(false);
    }
  };

  // Ganti filter penajam dokumen pada layar preview
  const handlePilihFilter = async (targetMode: ModeFilterDokumen) => {
    if (!fotoAsli || sedangMemprosesFilter) return;
    setSedangMemprosesFilter(true);
    setModeFilter(targetMode);

    if (fotoPratinjau?.dataUrl && fotoPratinjau.dataUrl !== fotoAsli.dataUrl && fotoPratinjau.dataUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(fotoPratinjau.dataUrl);
      } catch {}
    }

    const filtered = await prosesFilterDokumen(fotoAsli.file, targetMode);
    setFotoPratinjau(filtered);
    setSedangMemprosesFilter(false);
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
    if (fotoAsli?.dataUrl && fotoAsli.dataUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(fotoAsli.dataUrl);
      } catch {}
    }
    setFotoPratinjau(null);
    setFotoAsli(null);
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
      {/* Input Fallback untuk Kamera Sistem HP & Galeri */}
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
          background: "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
          zIndex: 10,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
          <button
            type="button"
            className="pemindai-tutup"
            onClick={onTutup}
            aria-label="Tutup kamera"
            title="Tutup kamera"
            style={{
              width: "36px",
              height: "36px",
              minWidth: "36px",
              minHeight: "36px",
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
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: "0.94rem",
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Kamera Dokumen HD
            </h3>
            <p
              style={{
                margin: "1px 0 0",
                fontSize: "0.72rem",
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

        {/* Tombol Kontrol: Shortcut Kamera Bawaan HP, Senter, & Putar Kamera */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {/* Tombol Buka Kamera Asli Sistem HP Langsung */}
          {!fotoPratinjau && (
            <button
              type="button"
              onClick={() => fallbackInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 10px",
                borderRadius: "20px",
                background: "rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="Gunakan aplikasi kamera sistem bawaan HP (Resolusi Penuh 50MP+)"
              aria-label="Kamera Asli HP"
            >
              <Smartphone size={14} />
              <span>Kamera Asli HP</span>
            </button>
          )}

          {hasTorch && kameraMenyala && !fotoPratinjau && (
            <button
              type="button"
              onClick={handleToggleTorch}
              style={{
                width: "36px",
                height: "36px",
                minWidth: "36px",
                minHeight: "36px",
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
              <Zap size={17} />
            </button>
          )}

          {kameraMenyala && !fotoPratinjau && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              style={{
                width: "36px",
                height: "36px",
                minWidth: "36px",
                minHeight: "36px",
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
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </header>

      {/* VIEWPORT KAMERA */}
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

        {/* Efek Rana Kilatan Putih saat menjepret */}
        {efekFlash && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#ffffff",
              zIndex: 15,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Indikator Animasi Titik Fokus (Tap to Focus) */}
        {titikFokus && !fotoPratinjau && (
          <div
            style={{
              position: "absolute",
              left: `${titikFokus.x}px`,
              top: `${titikFokus.y}px`,
              transform: "translate(-50%, -50%)",
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: titikFokus.terkunci ? "2.5px solid #10b981" : "2px solid #00e5ff",
              boxShadow: titikFokus.terkunci
                ? "0 0 14px rgba(16, 185, 129, 0.9)"
                : "0 0 14px rgba(0, 229, 255, 0.8)",
              pointerEvents: "none",
              animation: "focusRing 0.35s ease-out forwards",
              zIndex: 9,
              transition: "border 0.2s ease, box-shadow 0.2s ease",
            }}
          />
        )}

        {/* Tombol Kontrol Zoom Cepat (1x, 1.5x, 2x) */}
        {kameraMenyala && !fotoPratinjau && zoomRange && zoomRange.max > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(8px)",
              padding: "4px 8px",
              borderRadius: "20px",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              zIndex: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[1, 1.5, 2].map((lvl) => {
              if (lvl > (zoomRange?.max || 5)) return null;
              const isActive = Math.abs(zoomLevel - lvl) < 0.2;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleUbahZoom(lvl)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "14px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    border: "none",
                    background: isActive ? "var(--accent, #00e5ff)" : "transparent",
                    color: isActive ? "#000000" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {lvl}x
                </button>
              );
            })}
          </div>
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
              background: "rgba(30, 30, 40, 0.94)",
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
                📱 Buka Kamera Bawaan HP
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
              padding: "10px",
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
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.85)",
                border: "2px solid var(--accent, #00e5ff)",
                opacity: sedangMemprosesFilter ? 0.5 : 1,
                transition: "opacity 0.2s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* FOOTER KONTROL SHUTTER & PREVIEW */}
      <footer
        style={{
          width: "100%",
          padding: "14px 18px 22px",
          background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0) 100%)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          zIndex: 10,
          boxSizing: "border-box",
        }}
      >
        {/* MODE PREVIEW: PILIHAN FILTER PENAJAM TEKS & KONFIRMASI */}
        {fotoPratinjau ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
            {/* Pilihan Filter Penajam Dokumen */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.1)",
                padding: "4px 8px",
                borderRadius: "20px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              <button
                type="button"
                onClick={() => handlePilihFilter("tajam")}
                disabled={sedangMemprosesFilter}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 12px",
                  borderRadius: "16px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  background: modeFilter === "tajam" ? "var(--accent, #00e5ff)" : "transparent",
                  color: modeFilter === "tajam" ? "#000000" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Sparkles size={13} />
                <span>Teks Tajam HD</span>
              </button>

              <button
                type="button"
                onClick={() => handlePilihFilter("asli")}
                disabled={sedangMemprosesFilter}
                style={{
                  padding: "5px 12px",
                  borderRadius: "16px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  background: modeFilter === "asli" ? "rgba(255, 255, 255, 0.35)" : "transparent",
                  color: "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Warna Asli
              </button>

              <button
                type="button"
                onClick={() => handlePilihFilter("hitamputih")}
                disabled={sedangMemprosesFilter}
                style={{
                  padding: "5px 12px",
                  borderRadius: "16px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  background: modeFilter === "hitamputih" ? "rgba(255, 255, 255, 0.35)" : "transparent",
                  color: "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Hitam Putih
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "360px" }}>
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
          /* MODE KAMERA AKTIF: LAYAR PENUH & SHUTTER BESAR */
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
                fontSize: "0.72rem",
                color: "rgba(255, 255, 255, 0.7)",
                marginTop: "2px",
              }}
            >
              💡 Tips: Ketuk layar untuk fokus · Gunakan tombol 1.5x / 2x agar tulisan nota makin besar &amp; jelas
            </div>
          </>
        ) : null}
      </footer>
    </div>,
    document.body
  );
};
