import React from "react";
import { ViewTab } from "../types";

interface NavbarProps {
  currentView: ViewTab;
  onSelectView: (view: ViewTab) => void;
  onBukaMenuTambah?: () => void;
  /** Jumlah barang yang sisa nilai atau umurnya ≤ 30% (Depresiasi Aset); tampil sebagai titik merah di tab Saya. */
  lencanaSaya?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  onBukaMenuTambah,
  lencanaSaya = 0,
}) => {
  return (
    <nav className="navbar" aria-label="Navigasi utama">
      <button
        type="button"
        className="nav-item"
        data-view="riwayat"
        aria-current={currentView === "riwayat" ? "page" : undefined}
        onClick={() => onSelectView("riwayat")}
      >
        <span className="nav-ikon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </span>
        <span>Riwayat</span>
      </button>

      <button
        type="button"
        className="nav-item"
        data-view="aset"
        aria-current={currentView === "aset" ? "page" : undefined}
        onClick={() => onSelectView("aset")}
      >
        <span className="nav-ikon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
            <path d="M2 9h20" />
            <path d="M12 21L7.5 9 10 3" />
            <path d="M16.5 9L14 3" />
          </svg>
        </span>
        <span>Aset</span>
      </button>

      <button
        type="button"
        className="nav-item nav-tambah"
        data-view="tambah"
        aria-label="Tambah transaksi"
        onClick={() => {
          if (onBukaMenuTambah) {
            onBukaMenuTambah();
          } else {
            onSelectView("tambah");
          }
        }}
      >
        <span className="nav-plus" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "block" }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>

      <button
        type="button"
        className="nav-item"
        data-view="grafik"
        aria-current={currentView === "grafik" ? "page" : undefined}
        onClick={() => onSelectView("grafik")}
      >
        <span className="nav-ikon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="12" width="4" height="8" rx="1" fill="currentColor" fillOpacity="0.3" />
            <rect x="10" y="4" width="4" height="16" rx="1" fill="currentColor" fillOpacity="0.3" />
            <rect x="16.5" y="8" width="4" height="12" rx="1" fill="currentColor" fillOpacity="0.3" />
            <line x1="1.5" y1="20" x2="22.5" y2="20" />
          </svg>
        </span>
        <span>Grafik</span>
      </button>

      <button
        type="button"
        className="nav-item"
        data-view="saya"
        aria-current={currentView === "saya" ? "page" : undefined}
        onClick={() => onSelectView("saya")}
      >
        <span className="nav-ikon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {lencanaSaya > 0 && (
            <span className="nav-lencana" data-testid="lencana-saya" role="status" aria-label={`${lencanaSaya} barang perlu diganti`}>
              {lencanaSaya}
            </span>
          )}
        </span>
        <span>Saya</span>
      </button>
    </nav>
  );
};
