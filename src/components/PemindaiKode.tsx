import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { KodeAnggota, bacaKodeAnggota } from "../lib/berbagi";
import { dekodeQRDariBerkas, dekodeQRDariPiksel } from "../lib/qr";

interface PemindaiKodeProps {
  onKode: (kode: KodeAnggota) => void;
  onTutup: () => void;
}

/**
 * Pindai kode QR anggota. Tiga cara supaya selalu ada jalan: kamera belakang (bila diizinkan), foto/tangkapan layar kode,
 * atau tempel teks kodenya. Kamera diminta saat jendela dibuka dan selalu dimatikan saat ditutup.
 */
export const PemindaiKode: React.FC<PemindaiKodeProps> = ({ onKode, onTutup }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pesan, setPesan] = useState("Membuka kamera…");
  const [kameraMenyala, setKameraMenyala] = useState(false);
  const [tempel, setTempel] = useState("");
  const selesaiRef = useRef(false);

  const terima = (teks: string): boolean => {
    const kode = bacaKodeAnggota(teks);
    if (!kode) return false;
    selesaiRef.current = true;
    onKode(kode);
    return true;
  };

  useEffect(() => {
    let aliran: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let batal = false;
    const canvas = document.createElement("canvas");

    const baca = () => {
      const v = videoRef.current;
      if (batal || selesaiRef.current || !v) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        const skala = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * skala);
        canvas.height = Math.round(v.videoHeight * skala);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const teks = dekodeQRDariPiksel(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
          if (teks && !terima(teks)) setPesan("Kode itu bukan kode anggota aplikasi ini. Arahkan ke kode di menu Keluarga.");
        }
      }
      timer = setTimeout(baca, 150);
    };

    const mulai = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPesan("Kamera tidak tersedia di sini. Pilih foto kode atau tempel kodenya di bawah.");
        return;
      }
      try {
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (batal) {
          aliran.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = aliran;
          await v.play().catch(() => undefined);
        }
        setKameraMenyala(true);
        setPesan("Arahkan kamera ke kode QR anggota.");
        baca();
      } catch {
        setPesan("Kamera tidak bisa dipakai (izin ditolak atau tidak tersedia). Pilih foto kode atau tempel kodenya di bawah.");
      }
    };
    void mulai();

    return () => {
      batal = true;
      if (timer) clearTimeout(timer);
      aliran?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dariFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const berkas = e.target.files?.[0];
    e.target.value = "";
    if (!berkas) return;
    setPesan("Membaca gambar…");
    try {
      const teks = await dekodeQRDariBerkas(berkas);
      if (!teks) setPesan("Tidak ada kode QR yang terbaca di gambar itu. Coba foto yang lebih jelas.");
      else if (!terima(teks)) setPesan("Kode itu bukan kode anggota aplikasi ini.");
    } catch (err: any) {
      setPesan(err?.message ?? "Gambar tidak bisa dibaca.");
    }
  };

  // Di body, bukan di dalam tab: tab membentuk lapisan tumpukan sendiri sehingga bilah navigasi akan menimpa jendela ini.
  return createPortal(
    <div className="pemindai-latar" role="dialog" aria-modal="true" aria-label="Pindai kode anggota" onClick={onTutup}>
      <div className="pemindai-kotak" onClick={(e) => e.stopPropagation()}>
        <div className="pemindai-kepala">
          <h3>Pindai kode anggota</h3>
          <button
            type="button"
            className="pemindai-tutup"
            onClick={onTutup}
            aria-label="Tutup"
            title="Tutup"
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
        </div>
        <div className="pemindai-video" hidden={!kameraMenyala}>
          <video ref={videoRef} playsInline muted />
          <span className="pemindai-bingkai" aria-hidden="true" />
        </div>
        <p className="pemindai-pesan" role="status">
          {pesan}
        </p>
        <label className="btn-secondary pemindai-foto">
          📷 Pilih foto kode
          <input type="file" accept="image/*" onChange={dariFoto} hidden />
        </label>
        <div className="pemindai-tempel">
          <label htmlFor="pemindai-tempel-isi">Atau tempel teks kodenya</label>
          <textarea id="pemindai-tempel-isi" rows={2} value={tempel} onChange={(e) => setTempel(e.target.value)} placeholder="CKH1:…" />
          <button
            type="button"
            className="btn-small"
            disabled={!tempel.trim()}
            onClick={() => {
              if (!terima(tempel)) setPesan("Teks itu bukan kode anggota yang sah.");
            }}
          >
            Pakai kode ini
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
