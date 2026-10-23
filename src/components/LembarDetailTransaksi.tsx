import React, { useState, useEffect, useRef } from "react";
import { Transaksi, BuktiItem } from "../types";
import { formatRupiah, formatAngka, formatTanggalLengkap } from "../lib/constants";
import { UbinKategori, ChipKategori } from "../lib/kategoriIcon";
import {
  muatPratinjauBukti,
  GambarPengganti,
  KotakPratinjauBelumTersedia,
  ekstrakDriveFileId,
} from "../lib/driveBuktiLoader";
import {
  FileText,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface LembarDetailTransaksiProps {
  transaksi: Transaksi | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (t: Transaksi) => void;
  onDelete: (id: string) => void;
  onToggleStatusTalangan?: (id: string) => void;
  googleToken?: string;
}

export const LembarDetailTransaksi: React.FC<LembarDetailTransaksiProps> = ({
  transaksi,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onToggleStatusTalangan,
  googleToken,
}) => {
  const [activeBuktiPenuh, setActiveBuktiPenuh] = useState<{
    item: BuktiItem;
    url?: string;
    isPdf?: boolean;
    gagal?: boolean;
  } | null>(null);

  if (!isOpen || !transaksi) return null;

  const buktiList = transaksi.bukti || [];
  const isPemasukan = transaksi.jenis === "pemasukan";
  const tanda = isPemasukan ? "+" : "−";
  const warnaNominal = isPemasukan ? "var(--masuk)" : "var(--keluar)";

  const handleKonfirmasiHapus = () => {
    const konfirm = window.confirm(
      `Apakah Anda yakin ingin menghapus transaksi:\n"${transaksi.deskripsi}" (${tanda}Rp${formatAngka(
        transaksi.jumlah
      )})?`
    );
    if (konfirm) {
      onDelete(transaksi.id);
      onClose();
    }
  };

  return (
    <>
      <div
        className="lembar-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="lembar-detail-card">
          {/* Handle drag bar di HP */}
          <div
            className="lembar-drag-handle"
            onClick={onClose}
          >
            <div
              style={{
                width: "40px",
                height: "5px",
                borderRadius: "999px",
                backgroundColor: "var(--border)",
              }}
            />
          </div>

          {/* Header Lembar Detail */}
          <div
            style={{
              padding: "12px 20px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", minWidth: 0, flex: 1 }}>
              <UbinKategori kategori={transaksi.kategori} ukuran={52} sudut={16} ukuranIkon={26} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.15rem",
                    fontWeight: 800,
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}
                >
                  {transaksi.deskripsi}
                </h2>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "3px" }}>
                  {formatTanggalLengkap(transaksi.tanggal)}
                </div>
                <div
                  style={{
                    fontSize: "1.35rem",
                    fontWeight: 900,
                    color: warnaNominal,
                    marginTop: "6px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {tanda}Rp{formatAngka(transaksi.jumlah)}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-ikon"
              onClick={onClose}
              aria-label="Tutup"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "color-mix(in srgb, var(--border) 40%, transparent)",
                border: "none",
                cursor: "pointer",
                color: "var(--text)",
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Konten Scrollable */}
          <div
            style={{
              padding: "16px 20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              flex: 1,
            }}
          >
            {/* Metadata Rincian Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                padding: "14px",
                borderRadius: "14px",
                background: "color-mix(in srgb, var(--border) 18%, transparent)",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Kategori
                </span>
                <div style={{ marginTop: "4px" }}>
                  <ChipKategori kategori={transaksi.kategori} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Dana &amp; Metode
                </span>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, marginTop: "4px" }}>
                  {transaksi.dana} · {transaksi.metode || "Tunai"}
                </div>
              </div>

              {transaksi.kaitan && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                    {transaksi.dana === "Dana Kegiatan" ? "Kaitan Kegiatan" : "Sumber / Tujuan"}
                  </span>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, marginTop: "4px" }}>
                    {transaksi.kaitan}
                  </div>
                </div>
              )}

              {transaksi.isTalangan && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                    Status Dana Talangan
                  </span>
                  <div style={{ marginTop: "4px" }}>
                    <button
                      type="button"
                      className="btn-small"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 8px",
                        borderRadius: "8px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        background:
                          transaksi.statusTalangan === "sudah_diganti"
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(239,68,68,0.15)",
                        color:
                          transaksi.statusTalangan === "sudah_diganti"
                            ? "var(--masuk)"
                            : "var(--keluar)",
                        border: `1px solid ${
                          transaksi.statusTalangan === "sudah_diganti"
                            ? "var(--masuk)"
                            : "var(--keluar)"
                        }`,
                        cursor: onToggleStatusTalangan ? "pointer" : "default",
                      }}
                      onClick={() => onToggleStatusTalangan && onToggleStatusTalangan(transaksi.id)}
                      title="Klik untuk mengubah status talangan"
                    >
                      {transaksi.statusTalangan === "sudah_diganti" ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Talangan Sudah Diganti</span>
                        </>
                      ) : (
                        <>
                          <Clock size={13} />
                          <span>Talangan Belum Diganti</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Catatan Lengkap */}
            {transaksi.catatan && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                }}
              >
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>
                  Catatan Transaksi:
                </div>
                <div style={{ fontSize: "0.88rem", marginTop: "4px", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                  {transaksi.catatan}
                </div>
              </div>
            )}

            {/* BAGIAN BUKTI TRANSAKSI (GALERI 72×72 px) */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 800 }}>
                  📎 Bukti Transaksi ({buktiList.length})
                </span>
                {buktiList.length > 0 && (
                  <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
                    Ketuk foto untuk melihat pratinjau penuh
                  </span>
                )}
              </div>

              {buktiList.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    border: "1.5px dashed var(--border)",
                    borderRadius: "12px",
                    color: "var(--muted)",
                    fontSize: "0.82rem",
                  }}
                >
                  Belum ada berkas bukti transaksi yang dilampirkan.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  {buktiList.map((item, idx) => (
                    <ThumbnailBuktiItem
                      key={item.id || idx}
                      item={item}
                      googleToken={googleToken}
                      onBukaPenuh={(hasil) => setActiveBuktiPenuh({ item, ...hasil })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Bar Bawah (Ubah & Hapus) */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onEdit(transaksi);
                onClose();
              }}
              style={{
                flex: 1,
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "0.92rem",
                fontWeight: 700,
                borderRadius: "12px",
              }}
            >
              <Edit2 size={16} />
              <span>Ubah Transaksi</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleKonfirmasiHapus}
              style={{
                minHeight: "44px",
                padding: "0 18px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.88rem",
                color: "var(--keluar)",
                borderColor: "color-mix(in srgb, var(--keluar) 30%, transparent)",
                borderRadius: "12px",
              }}
            >
              <Trash2 size={16} />
              <span>Hapus</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tampilan Penuh Bukti dengan Zoom Cubit */}
      {activeBuktiPenuh && (
        <ModalPratinjauPenuhBukti
          data={activeBuktiPenuh}
          onClose={() => setActiveBuktiPenuh(null)}
        />
      )}
    </>
  );
};

/**
 * Thumbnail Bukti ukuran 72×72 px dengan skeleton saat memuat
 */
const ThumbnailBuktiItem: React.FC<{
  item: BuktiItem;
  googleToken?: string;
  onBukaPenuh: (hasil: { url?: string; isPdf?: boolean; gagal?: boolean }) => void;
}> = ({ item, googleToken, onBukaPenuh }) => {
  const [status, setStatus] = useState<{
    sedangMemuat: boolean;
    url?: string;
    isPdf?: boolean;
    gagal?: boolean;
  }>({
    sedangMemuat: true,
  });

  useEffect(() => {
    let aktif = true;
    void (async () => {
      setStatus({ sedangMemuat: true });
      const hasil = await muatPratinjauBukti(item, googleToken);
      if (aktif) {
        setStatus({
          sedangMemuat: false,
          url: hasil.url,
          isPdf: hasil.isPdf,
          gagal: hasil.gagal,
        });
      }
    })();

    return () => {
      aktif = false;
    };
  }, [item, googleToken]);

  const rawLink = item.driveLink || "";

  // 1. Dokumen PDF
  if (status.isPdf) {
    return (
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "12px",
          border: "1.5px solid var(--border)",
          background: "color-mix(in srgb, var(--keluar) 12%, var(--surface))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          gap: "2px",
          padding: "4px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
        onClick={() => onBukaPenuh(status)}
        title={item.nama || "Dokumen PDF"}
      >
        <FileText size={26} color="var(--keluar)" />
        <span
          style={{
            fontSize: "0.62rem",
            fontWeight: 700,
            color: "var(--keluar)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "64px",
          }}
        >
          PDF
        </span>
      </div>
    );
  }

  // 2. Sedang memuat (Skeleton)
  if (status.sedangMemuat) {
    return (
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          background: "linear-gradient(90deg, var(--surface) 25%, var(--border) 50%, var(--surface) 75%)",
          backgroundSize: "200% 100%",
          animation: "skeletonShimmer 1.5s infinite",
          flexShrink: 0,
        }}
      />
    );
  }

  // 3. Gambar berhasil dimuat
  if (status.url && !status.gagal) {
    return (
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          overflow: "hidden",
          cursor: "pointer",
          background: "var(--surface)",
          boxShadow: "0 2px 5px rgba(0,0,0,0.12)",
          flexShrink: 0,
          position: "relative",
        }}
        onClick={() => onBukaPenuh(status)}
        title={item.nama || "Lihat bukti"}
      >
        <img
          src={status.url}
          alt={item.nama || "Bukti"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={() => setStatus((p) => ({ ...p, gagal: true }))}
        />
      </div>
    );
  }

  // 4. Gagal / Drive link belum bisa diunduh -> GambarPengganti
  return (
    <div
      style={{
        width: "72px",
        height: "72px",
        borderRadius: "12px",
        border: "1.5px dashed var(--border)",
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: "6px",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
      onClick={() => onBukaPenuh(status)}
      title="Pratinjau belum tersedia. Ketuk untuk membuka di Google Drive."
    >
      <GambarPengganti style={{ width: "42px", height: "42px" }} />
    </div>
  );
};

/**
 * Modal Pratinjau Tampilan Penuh dengan Zoom Cubit / Pinch Zoom di HP
 */
const ModalPratinjauPenuhBukti: React.FC<{
  data: {
    item: BuktiItem;
    url?: string;
    isPdf?: boolean;
    gagal?: boolean;
  };
  onClose: () => void;
}> = ({ data, onClose }) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const touchStartPanRef = useRef<{ x: number; y: number } | null>(null);

  const rawLink = data.item.driveLink || "";
  const namaFile = data.item.nama || "Bukti Transaksi";

  // Pinch-zoom event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      touchStartPanRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDistRef.current;
      const nextScale = Math.min(4, Math.max(1, initialScaleRef.current * ratio));
      setScale(nextScale);
      if (nextScale === 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && touchStartPanRef.current && scale > 1) {
      setPan({
        x: e.touches[0].clientX - touchStartPanRef.current.x,
        y: e.touches[0].clientY - touchStartPanRef.current.y,
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    touchStartPanRef.current = null;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.92)",
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header bar pratinjau penuh */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#ffffff",
          background: "rgba(0, 0, 0, 0.6)",
          zIndex: 10,
        }}
      >
        <div style={{ minWidth: 0, flex: 1, marginRight: "12px" }}>
          <div
            style={{
              fontSize: "0.92rem",
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {namaFile}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
            Zoom: {Math.round(scale * 100)}%
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Zoom controls */}
          <button
            type="button"
            className="btn-ikon"
            onClick={() => setScale((s) => Math.max(1, s - 0.3))}
            style={{ color: "#ffffff", background: "rgba(255,255,255,0.15)", borderRadius: "6px", padding: "6px" }}
            title="Perkecil"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            className="btn-ikon"
            onClick={() => setScale((s) => Math.min(4, s + 0.3))}
            style={{ color: "#ffffff", background: "rgba(255,255,255,0.15)", borderRadius: "6px", padding: "6px" }}
            title="Perbesar"
          >
            <ZoomIn size={16} />
          </button>
          {scale !== 1 && (
            <button
              type="button"
              className="btn-ikon"
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
              style={{ color: "#ffffff", background: "rgba(255,255,255,0.15)", borderRadius: "6px", padding: "6px" }}
              title="Reset Zoom"
            >
              <RotateCcw size={16} />
            </button>
          )}

          {rawLink && (
            <a
              href={rawLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-small"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                color: "#ffffff",
                background: "#2563eb",
                padding: "6px 12px",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              <ExternalLink size={13} />
              <span>Buka di Drive</span>
            </a>
          )}

          <button
            type="button"
            className="btn-ikon"
            onClick={onClose}
            style={{
              color: "#ffffff",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "50%",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Area Gambar / Fallback Viewer */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          touchAction: "none",
          padding: "16px",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {data.isPdf ? (
          <div
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              padding: "30px 24px",
              borderRadius: "16px",
              textAlign: "center",
              maxWidth: "400px",
            }}
          >
            <FileText size={56} color="var(--keluar)" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>{namaFile}</h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--muted)" }}>
              Dokumen ini bertipe PDF. Silakan buka langsung di Google Drive untuk membaca seluruh halaman.
            </p>
            {rawLink && (
              <a
                href={rawLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                }}
              >
                <ExternalLink size={16} />
                <span>Buka Dokumen di Google Drive</span>
              </a>
            )}
          </div>
        ) : data.url && !data.gagal ? (
          <img
            src={data.url}
            alt={namaFile}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
              transition: scale === 1 ? "transform 0.2s ease" : "none",
              userSelect: "none",
            }}
          />
        ) : (
          <div style={{ maxWidth: "420px", width: "100%" }}>
            <KotakPratinjauBelumTersedia linkDrive={rawLink} />
          </div>
        )}
      </div>
    </div>
  );
};
