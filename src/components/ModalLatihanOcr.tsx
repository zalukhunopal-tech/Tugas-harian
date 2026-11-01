import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, CheckCircle2, RefreshCw, Search } from "lucide-react";
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
  const [kataKunciCari, setKataKunciCari] = useState<string>("");
  const [sedangMemuat, setSedangMemuat] = useState<number | null>(null);

  const daftarKategori = [
    { label: "Semua", filter: "Semua" },
    { label: "Minimarket", filter: "Minimarket" },
    { label: "BBM & SPBU", filter: "BBM" },
    { label: "Kafe & Kopi", filter: "Kafe" },
    { label: "Restoran & Makan", filter: "Restoran" },
    { label: "Rental Kendaraan", filter: "Rental" },
    { label: "Hotel & Wisma", filter: "Hotel" },
    { label: "Tiket & Karcis", filter: "Tiket" },
    { label: "Transfer Bank", filter: "Transfer" },
    { label: "E-Wallet & Paket Data", filter: "Digital" },
    { label: "Tagihan, ATK & Honor", filter: "Tagihan" },
  ];

  const filteredItems = useMemo(() => {
    return daftarLatihan.filter((item) => {
      // Filter Kategori
      if (filterTag !== "Semua") {
        const itemTag = (item.tag || "").toLowerCase();
        const itemJudul = (item.judul || "").toLowerCase();
        const filterL = filterTag.toLowerCase();

        let cocokKategori = false;
        if (filterL === "bbm") {
          cocokKategori = itemTag.includes("bbm") || itemTag.includes("spbu") || itemJudul.includes("spbu") || itemJudul.includes("shell") || itemJudul.includes("bp");
        } else if (filterL === "kafe") {
          cocokKategori = itemTag.includes("kafe") || itemTag.includes("kopi") || itemTag.includes("minuman");
        } else if (filterL === "restoran") {
          cocokKategori = itemTag.includes("restoran") || itemTag.includes("makan");
        } else if (filterL === "rental") {
          cocokKategori = itemTag.includes("rental") || itemTag.includes("sewa");
        } else if (filterL === "hotel") {
          cocokKategori = itemTag.includes("hotel") || itemTag.includes("penginapan") || itemTag.includes("wisma");
        } else if (filterL === "tiket") {
          cocokKategori = itemTag.includes("tiket") || itemTag.includes("karcis") || itemTag.includes("boarding");
        } else if (filterL === "transfer") {
          cocokKategori = itemTag.includes("transfer") || itemTag.includes("bank");
        } else if (filterL === "digital") {
          cocokKategori = itemTag.includes("e-wallet") || itemTag.includes("paket data") || itemTag.includes("pulsa") || itemJudul.includes("gofood") || itemJudul.includes("grab") || itemJudul.includes("im3") || itemJudul.includes("telkomsel") || itemJudul.includes("xl") || itemJudul.includes("dana");
        } else if (filterL === "tagihan") {
          cocokKategori = itemTag.includes("tagihan") || itemTag.includes("listrik") || itemTag.includes("air") || itemTag.includes("atk") || itemTag.includes("kuitansi") || itemTag.includes("bangunan") || itemTag.includes("apotek");
        } else {
          cocokKategori = itemTag.includes(filterL);
        }

        if (!cocokKategori) return false;
      }

      // Filter Pencarian
      if (kataKunciCari.trim()) {
        const q = kataKunciCari.toLowerCase().trim();
        const matchJudul = item.judul.toLowerCase().includes(q);
        const matchTag = item.tag.toLowerCase().includes(q);
        const matchNominal = item.nominalTeks.toLowerCase().includes(q);
        const matchNomor = String(item.nomor).includes(q);
        return matchJudul || matchTag || matchNominal || matchNomor;
      }

      return true;
    });
  }, [filterTag, kataKunciCari]);

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
        backgroundColor: "rgba(0, 0, 0, 0.78)",
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
          border: "1px solid rgba(139, 92, 246, 0.35)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "880px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 45px -10px rgba(0,0,0,0.8), 0 0 35px rgba(139, 92, 246, 0.25)",
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
            background: "rgba(15, 23, 42, 0.5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.4)",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                🧪 Latihan Scan OCR (100 Bukti Transaksi Nyata & Dummy)
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
                Koleksi 100 sampel struk belanja, tiket, BBM, kwitansi, paket data & bank transfer
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

        {/* Search Bar & Stats */}
        <div
          style={{
            padding: "12px 20px",
            background: "rgba(15, 23, 42, 0.3)",
            borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Cari toko, merchant, paket, atau nominal (mis. Indomaret, IM3, 125.000)..."
              value={kataKunciCari}
              onChange={(e) => setKataKunciCari(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "10px",
                border: "1px solid rgba(148, 163, 184, 0.25)",
                background: "rgba(30, 41, 59, 0.6)",
                color: "#f8fafc",
                fontSize: "0.84rem",
                outline: "none",
              }}
            />
            {kataKunciCari && (
              <button
                type="button"
                onClick={() => setKataKunciCari("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#a78bfa", fontWeight: 600, whiteSpace: "nowrap" }}>
            {filteredItems.length} dari 100 Struk
          </span>
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
          {daftarKategori.map((kategori) => (
            <button
              key={kategori.filter}
              type="button"
              onClick={() => setFilterTag(kategori.filter)}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                fontSize: "0.78rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: filterTag === kategori.filter ? "#8b5cf6" : "rgba(255, 255, 255, 0.08)",
                color: filterTag === kategori.filter ? "#fff" : "#cbd5e1",
                transition: "all 0.15s ease",
              }}
            >
              {kategori.label}
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
                    height: "125px",
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
                      background: "rgba(15, 23, 42, 0.85)",
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
          <span>Menampilkan {filteredItems.length} dari 100 ragam bukti transaksi fisik dan digital</span>
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
