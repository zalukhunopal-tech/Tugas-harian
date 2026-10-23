import React from "react";
import {
  Utensils,
  Bus,
  ShoppingBasket,
  Wifi,
  Receipt,
  Users,
  PiggyBank,
  Gamepad2,
  Shapes,
  Wallet,
  HandCoins,
  CarFront,
  Coffee,
  BedDouble,
  UserCheck,
  Backpack,
  Printer,
  Smartphone,
  Stamp,
  Banknote,
  KeyRound,
  Fuel,
  Package,
  CalendarDays,
  ArrowLeftRight,
  CircleDollarSign,
  LucideIcon,
} from "lucide-react";

export interface InfoKategori {
  icon: LucideIcon;
  ikon: LucideIcon;
  warna: string;
  warnaGelap: string;
}

/**
 * Menghitung warna hex 20% lebih gelap untuk gradien ubin 135°
 */
export function gelapkanWarnaHex(hex: string, persen = 0.2): string {
  const bersih = hex.replace("#", "");
  if (bersih.length !== 6) return hex;
  const num = parseInt(bersih, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  r = Math.max(0, Math.min(255, Math.round(r * (1 - persen))));
  g = Math.max(0, Math.min(255, Math.round(g * (1 - persen))));
  b = Math.max(0, Math.min(255, Math.round(b * (1 - persen))));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Peta Kategori resmi sesuai spesifikasi
 */
export const PETA_KATEGORI: Record<string, { icon: LucideIcon; warna: string }> = {
  "Makan & Minum": { icon: Utensils, warna: "#F97316" },
  Transportasi: { icon: Bus, warna: "#3B82F6" },
  "Belanja Harian": { icon: ShoppingBasket, warna: "#14B8A6" },
  "Pulsa & Internet": { icon: Wifi, warna: "#06B6D4" },
  "Tagihan & Sewa": { icon: Receipt, warna: "#8B5CF6" },
  Keluarga: { icon: Users, warna: "#EC4899" },
  Tabungan: { icon: PiggyBank, warna: "#10B981" },
  Hiburan: { icon: Gamepad2, warna: "#F43F5E" },
  "Lain-lain": { icon: Shapes, warna: "#64748B" },
  "Pemasukan Gaji": { icon: Wallet, warna: "#22C55E" },
  "Pemasukan Lain": { icon: HandCoins, warna: "#84CC16" },
  "Transportasi & BBM": { icon: CarFront, warna: "#3B82F6" },
  Konsumsi: { icon: Coffee, warna: "#F97316" },
  Akomodasi: { icon: BedDouble, warna: "#6366F1" },
  "Honor & Upah Lokal": { icon: UserCheck, warna: "#0EA5E9" },
  "Logistik & Perlengkapan": { icon: Backpack, warna: "#D97706" },
  "ATK & Cetak": { icon: Printer, warna: "#78716C" },
  "Komunikasi & Pulsa": { icon: Smartphone, warna: "#06B6D4" },
  "Perizinan & Administrasi": { icon: Stamp, warna: "#A855F7" },
  "Penerimaan Dana": { icon: Banknote, warna: "#22C55E" },
  "Rental Kendaraan": { icon: KeyRound, warna: "#2563EB" },
  BBM: { icon: Fuel, warna: "#EF4444" },
  "Pengadaan Barang & Perlengkapan": { icon: Package, warna: "#D97706" },
  "Honorarium & Ganti Hari": { icon: UserCheck, warna: "#0EA5E9" },
  "Komunikasi, Listrik & Kurir": { icon: Smartphone, warna: "#06B6D4" },
  Perdiem: { icon: CalendarDays, warna: "#EAB308" },
  "Pindah Dana": { icon: ArrowLeftRight, warna: "#64748B" },
};

const DEFAULT_INFO: { icon: LucideIcon; warna: string } = {
  icon: CircleDollarSign,
  warna: "#64748B",
};

/**
 * Mengambil info ikon dan warna untuk kategori tertentu dengan fallback yang aman
 */
export function dapatkanInfoKategori(kategori?: string): InfoKategori {
  if (!kategori) {
    return {
      icon: DEFAULT_INFO.icon,
      ikon: DEFAULT_INFO.icon,
      warna: DEFAULT_INFO.warna,
      warnaGelap: gelapkanWarnaHex(DEFAULT_INFO.warna, 0.2),
    };
  }

  const trimmed = kategori.trim();
  const info = PETA_KATEGORI[trimmed];
  if (info) {
    return {
      icon: info.icon,
      ikon: info.icon,
      warna: info.warna,
      warnaGelap: gelapkanWarnaHex(info.warna, 0.2),
    };
  }

  // Fallback pencocokan parsial jika ada variasi nama
  for (const [key, val] of Object.entries(PETA_KATEGORI)) {
    if (trimmed.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(trimmed.toLowerCase())) {
      return {
        icon: val.icon,
        ikon: val.icon,
        warna: val.warna,
        warnaGelap: gelapkanWarnaHex(val.warna, 0.2),
      };
    }
  }

  return {
    icon: DEFAULT_INFO.icon,
    ikon: DEFAULT_INFO.icon,
    warna: DEFAULT_INFO.warna,
    warnaGelap: gelapkanWarnaHex(DEFAULT_INFO.warna, 0.2),
  };
}

interface UbinKategoriProps {
  kategori?: string;
  ukuran?: number; // default 44 px
  sudut?: number; // default 14 px
  ukuranIkon?: number; // default 22 px
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Ubin Ikon Kategori 44×44 px, sudut 14 px, latar gradien 135° ke warna 20% lebih gelap,
 * ikon putih 22 px stroke 2, bayangan halus.
 */
export const UbinKategori: React.FC<UbinKategoriProps> = ({
  kategori,
  ukuran = 44,
  sudut = 14,
  ukuranIkon = 22,
  className,
  style,
}) => {
  const { icon: Icon, warna, warnaGelap } = dapatkanInfoKategori(kategori);

  return (
    <div
      className={className}
      style={{
        width: `${ukuran}px`,
        height: `${ukuran}px`,
        minWidth: `${ukuran}px`,
        minHeight: `${ukuran}px`,
        borderRadius: `${sudut}px`,
        background: `linear-gradient(135deg, ${warna}, ${warnaGelap})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 3px 8px rgba(0, 0, 0, 0.18)",
        flexShrink: 0,
        color: "#ffffff",
        ...style,
      }}
      title={kategori || "Kategori"}
    >
      <Icon size={ukuranIkon} strokeWidth={2} color="#ffffff" aria-hidden="true" />
    </div>
  );
};

interface ChipKategoriProps {
  kategori: string;
  ukuranIkon?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Chip kategori: ikon kecil + nama, latar warna kategori 15%, teks warna kategori
 */
export const ChipKategori: React.FC<ChipKategoriProps> = ({
  kategori,
  ukuranIkon = 13,
  className,
  style,
}) => {
  const { icon: Icon, warna } = dapatkanInfoKategori(kategori);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 7px",
        borderRadius: "6px",
        fontSize: "0.76rem",
        fontWeight: 600,
        backgroundColor: `${warna}26`, // 15% opacity hex
        color: warna,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <Icon size={ukuranIkon} strokeWidth={2.2} color={warna} aria-hidden="true" />
      <span>{kategori}</span>
    </span>
  );
};
