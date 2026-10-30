import React, { useEffect, useState } from "react";
import { BuktiItem } from "../types";
import { KotakPratinjauBelumTersedia, muatPratinjauBukti } from "../lib/driveBuktiLoader";

type StatusFoto = "memuat" | "ok" | "pdf" | "gagal";

interface GambarLampiranProps {
  bukti: BuktiItem;
  googleToken?: string;
  onStatus: (id: string, memuat: boolean) => void;
  onUkuran?: (id: string, lebar: number, tinggi: number) => void;
}

/**
 * Foto bukti di dokumen siap cetak, ditampilkan apa adanya: lebar dan tinggi dibiarkan `auto`, dibatasi `max-*` dari kotaknya
 * dan `object-fit: contain`. Rasio asli terjaga (tidak melar, tidak terpotong), dan nota kecil tidak diperbesar melebihi
 * ukuran aslinya, seperti struk yang ditempel di kertas HVS kosong. Foto dari Google Drive (termasuk yang hanya punya tautan)
 * dimuat lewat muatPratinjauBukti; selama memuat, onStatus memberi tahu supaya tombol cetak menunggu.
 */
export const GambarLampiran: React.FC<GambarLampiranProps> = ({ bukti, googleToken, onStatus, onUkuran }) => {
  const [status, setStatus] = useState<StatusFoto>("memuat");
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    let batal = false;
    onStatus(bukti.id, true);
    muatPratinjauBukti(bukti, googleToken)
      .then((hasil) => {
        if (batal) return;
        if (hasil.gagal || !hasil.url) setStatus("gagal");
        else if (hasil.isPdf) setStatus("pdf");
        else {
          setUrl(hasil.url);
          setStatus("ok");
        }
        if (hasil.gagal || !hasil.url || hasil.isPdf) onStatus(bukti.id, false);
      })
      .catch(() => {
        if (batal) return;
        setStatus("gagal");
        onStatus(bukti.id, false);
      });
    return () => {
      batal = true;
      onStatus(bukti.id, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bukti.id, bukti.dataUrl, bukti.driveId, bukti.driveLink, googleToken]);

  if (status === "memuat") return <div className="dsc-lampiran-status">Memuat bukti…</div>;
  if (status === "ok" && url) {
    return (
      <div className="dsc-foto-kotak">
        <img
          className="dsc-foto"
          src={url}
          alt={bukti.nama || "Bukti transaksi"}
          onLoad={(e) => {
            const target = e.currentTarget;
            if (target.naturalWidth > 0 && target.naturalHeight > 0) {
              onUkuran?.(bukti.id, target.naturalWidth, target.naturalHeight);
            }
            onStatus(bukti.id, false);
          }}
          onError={() => {
            setStatus("gagal");
            onStatus(bukti.id, false);
          }}
        />
      </div>
    );
  }
  if (status === "pdf") {
    return (
      <div className="dsc-lampiran-status">
        Lampiran berupa PDF ({bukti.nama}).{" "}
        {bukti.driveLink && (
          <a href={bukti.driveLink} target="_blank" rel="noopener noreferrer">
            Buka di Google Drive
          </a>
        )}
      </div>
    );
  }
  return <KotakPratinjauBelumTersedia linkDrive={bukti.driveLink} />;
};
