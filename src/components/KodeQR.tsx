import React, { useEffect, useRef } from "react";
import { gambarQRKeCanvas } from "../lib/qr";

interface KodeQRProps {
  teks: string;
  ukuran?: number;
  label?: string;
}

/** Kode QR di kanvas (selalu putih-hitam supaya terbaca pemindai di tema apa pun). */
export const KodeQR: React.FC<KodeQRProps> = ({ teks, ukuran = 240, label = "Kode QR" }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) gambarQRKeCanvas(ref.current, teks, ukuran * 2);
  }, [teks, ukuran]);
  return <canvas ref={ref} className="kode-qr" role="img" aria-label={label} style={{ width: ukuran, height: ukuran, maxWidth: "100%" }} />;
};
