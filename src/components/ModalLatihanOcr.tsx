import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, CheckCircle2, RefreshCw, Layers } from "lucide-react";
import daftarLatihan from "../../public/latihan-ocr/daftar_latihan.json";

interface ModalLatihanOcrProps {
  onTutup: () => void;
  onPilihBerkas: (file: File) => void;
}

export const ModalLatihanOcr: React.FC<ModalLatihanOcrProps> = ({
  onTutup,
  onPilihBerkas,
}) => {
  const [filterTag, setFilterTag] = useState<string>("Semua");
  const [sedangMemuat, setSedangMemuat] = useState<number | null>(null);

  const daftarTags = [
    "Semua",
    "Minimarket",
    "Restoran",
    "BBM",
    "Transfer Bank",
    "E-Wallet GoPay",
    "Token Listrik",
    "Tagihan Air",
    "Rental Mobil",
    "Akomodasi Hotel",
    "Pengadaan ATK",
    "Tiket Bus",
  ];

  const filteredItems = daftarLatihan.filter((item) => {
    if (filterTag === "Semua") return true;
    return item.tag.toLowerCase().includes(filterTag.toLowerCase());
  });

  const handlePilihItem = async (item: typeof daftarLatihan[0]) => {
    try {
      setSedangMemuat(item.nomor);
      const baseUrl = import.meta.env.BASE_URL || "/";
      const cleanedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      const urlBerkas = `${cleanedBase}latihan-ocr/${item.berkas}`;

      const res = await fetch(urlBerkas);
      if (!res.ok) {
        throw new Error(`Gagal memuat berkas struk (${res.status})`);
      }
      const blob = await res.blob();
      const file = new File([blob], item.berkas, { type: "image/png" });

      onPilihBerkas(file);
      onTutup();
    } catch (err: any) {
      console.error("Gagal memuat berkas latihan OCR:", err);
      alert("Gagal memuat berkas struk latihan: " + (err.message || String(err)));
    } finally {
      setSedangMemuat(null);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onTutup}
    >
      <div
        className="modal-latihan-ocr"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "840px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.7), 0 0 30px rgba(139, 92, 246, 0.2)",
          color: "#f8fafc",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                🧪 Latihan Scan OCR (20 Struk Dummy)
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
                Pilih sampel struk untuk menguji keakuratan pembacaan OCR lokal tanpa internet
              </p>
            </div>
          </div>
          <button
            onClick={onTutup}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            padding: "10px 20px",
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
            background: "rgba(15, 23, 42, 0.2)",
          }}
        >
          {daftarTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(tag)}
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "0.78rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: filterTag === tag ? "#8b5cf6" : "rgba(255, 255, 255, 0.08)",
                color: filterTag === tag ? "#fff" : "#cbd5e1",
                transition: "all 0.15s ease",
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* List Struk Grid */}
        <div
          style={{
            padding: "16px 20px",
            overflowY: "auto",
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          {filteredItems.map((item) => {
            const baseUrl = import.meta.env.BASE_URL || "/";
            const cleanedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
            const urlGambar = `${cleanedBase}latihan-ocr/${item.berkas}`;
            const memuatIni = sedangMemuat === item.nomor;

            return (
              <div
                key={item.nomor}
                style={{
                  background: "rgba(30, 41, 59, 0.7)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: "12px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.15s, border-color 0.15s",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    height: "120px",
                    background: "#090d16",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <img
                    src={urlGambar}
                    alt={item.judul}
                    style={{
                      maxHeight: "100%",
                      maxWidth: "100%",
                      objectFit: "contain",
                      padding: "6px",
                    }}
                    loading="lazy"
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: "6px",
                      left: "6px",
                      background: "rgba(15, 23, 42, 0.8)",
                      backdropFilter: "blur(4px)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#a78bfa",
                    }}
                  >
                    #{item.nomor} {item.tag}
                  </span>
                </div>

                {/* Content */}
                <div
                  style={{
                    padding: "10px 12px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <h4
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "#f1f5f9",
                        lineHeight: 1.25,
                      }}
                    >
                      {item.judul}
                    </h4>
                    <span
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#34d399",
                      }}
                    >
                      {item.nominalTeks}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePilihItem(item)}
                    disabled={memuatIni || sedangMemuat !== null}
                    style={{
                      marginTop: "10px",
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                      color: "#fff",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    {memuatIni ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Memuat...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Pindai Struk Ini</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(148, 163, 184, 0.15)",
            background: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.78rem",
            color: "#94a3b8",
          }}
        >
          <span>Total 20 ragam bukti transaksi fisik dan digital</span>
          <button
            type="button"
            onClick={onTutup}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              background: "transparent",
              color: "#cbd5e1",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
