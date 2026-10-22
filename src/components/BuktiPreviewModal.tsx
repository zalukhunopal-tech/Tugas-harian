import React, { useState } from "react";
import { Transaksi, BuktiItem } from "../types";
import { formatRupiah, formatTanggalLengkap } from "../lib/constants";

interface BuktiPreviewModalProps {
  transaksi: Transaksi | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BuktiPreviewModal: React.FC<BuktiPreviewModalProps> = ({
  transaksi,
  isOpen,
  onClose,
}) => {
  const [activeItem, setActiveItem] = useState<BuktiItem | null>(null);

  if (!isOpen || !transaksi) return null;

  const buktiList = transaksi.bukti || [];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "20px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "1.2rem" }}>📎</span>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>Bukti Transaksi</h2>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              {transaksi.deskripsi} · {formatRupiah(transaksi.jumlah)}
            </p>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "2px" }}>
              {formatTanggalLengkap(transaksi.tanggal)} ({transaksi.dana})
            </div>
          </div>
          <button
            type="button"
            className="btn-ikon"
            onClick={onClose}
            aria-label="Tutup"
            style={{ fontSize: "1.4rem", padding: "4px" }}
          >
            ✕
          </button>
        </div>

        {buktiList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)" }}>
            Belum ada berkas bukti transaksi yang dilampirkan.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {buktiList.map((item, idx) => {
              const isPdf = item.tipe === "application/pdf" || item.nama.toLowerCase().endsWith(".pdf");
              const src = item.dataUrl || item.driveLink;

              return (
                <div
                  key={item.id || idx}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: "1px solid var(--border)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ fontWeight: 600, wordBreak: "break-all" }}>
                      {item.nama || `Bukti ${idx + 1}`}
                    </span>
                    {item.driveLink && (
                      <a
                        href={item.driveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-link"
                        style={{ fontSize: "0.78rem", flexShrink: 0, marginLeft: "8px" }}
                      >
                        Buka di Drive ↗
                      </a>
                    )}
                  </div>

                  <div style={{ padding: "12px", textAlign: "center", background: "rgba(0,0,0,0.15)" }}>
                    {isPdf ? (
                      <div style={{ padding: "20px" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>📄</div>
                        <p style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>Dokumen PDF Bukti</p>
                        {item.driveLink ? (
                          <a
                            href={item.driveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary"
                            style={{ padding: "6px 14px", fontSize: "0.8rem", textDecoration: "none" }}
                          >
                            Lihat Dokumen PDF di Drive ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                            PDF tersimpan lokal. Akan diunggah saat online.
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <img
                          src={src}
                          alt={item.nama}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "360px",
                            objectFit: "contain",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
                            cursor: "zoom-in",
                          }}
                          onClick={() => setActiveItem(item)}
                        />
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "6px" }}>
                          (Ketuk foto untuk melihat ukuran penuh)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>

      {/* Lightbox Fullscreen Gambar */}
      {activeItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.92)",
            zIndex: 1100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setActiveItem(null)}
        >
          <img
            src={activeItem.dataUrl || activeItem.driveLink}
            alt={activeItem.nama}
            style={{
              maxWidth: "100%",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: "4px",
            }}
          />
          <button
            type="button"
            style={{
              marginTop: "14px",
              padding: "8px 20px",
              borderRadius: "20px",
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={() => setActiveItem(null)}
          >
            Tutup Tampilan Penuh
          </button>
        </div>
      )}
    </div>
  );
};
