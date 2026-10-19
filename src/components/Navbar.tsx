import React from "react";
import { ViewTab } from "../types";

interface NavbarProps {
  currentView: ViewTab;
  onSelectView: (view: ViewTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onSelectView }) => {
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
        onClick={() => onSelectView("tambah")}
      >
        <span className="nav-plus" aria-hidden="true">
          +
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
