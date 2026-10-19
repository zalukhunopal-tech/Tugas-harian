import React from "react";
import { ViewTab } from "../types";

interface NavbarProps {
  currentView: ViewTab;
  onSelectView: (view: ViewTab) => void;
  onBukaMenuTambah?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  onBukaMenuTambah,
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
          ☰
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
          ◈
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
          ◔
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
          ⚙
        </span>
        <span>Saya</span>
      </button>
    </nav>
  );
};
