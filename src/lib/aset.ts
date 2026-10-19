import { AsetItem, DataHarga, HasilHitungAset, RingkasanAset, HargaEmas, HargaKoin } from "../types";
import { formatRupiah, formatGram, formatKoin } from "./constants";

export const JENIS_ASET = ["emas", "crypto", "jmo", "investasi"] as const;
export const KOIN_DEFAULT = ["bitcoin", "ethereum"];
export const HARGA_BASI_MS = 30 * 60 * 1000; // 30 menit (interval otomatis update harga aset)

export function waktuMs(w?: string): number {
  if (!w) return 0;
  const t = Date.parse(w);
  return Number.isNaN(t) ? 0 : t;
}

export function bulanAntara(iso?: string, kini: Date = new Date()): number {
  if (!iso) return 0;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const th = Number(m[1]);
  const bl = Number(m[2]) - 1;
  const tg = Number(m[3]);
  let n = (kini.getFullYear() - th) * 12 + (kini.getMonth() - bl);
  if (kini.getDate() < tg) n -= 1;
  return Math.max(0, n);
}

export function hargaEmasEfektif(harga?: DataHarga): (HargaEmas & { sumber?: string }) | null {
  const otomatis = harga?.emas && harga.emas.jual > 0 ? harga.emas : null;
  const manual = harga?.manual?.emas && harga.manual.emas.jual > 0 ? harga.manual.emas : null;
  if (otomatis && manual) {
    return waktuMs(manual.waktu) >= waktuMs(otomatis.waktu)
      ? { ...manual, sumber: "manual" }
      : otomatis;
  }
  return manual ? { ...manual, sumber: "manual" } : otomatis;
}

export function hargaKoin(harga?: DataHarga, koin?: string): HargaKoin | null {
  if (!harga?.crypto || !koin) return null;
  const k = harga.crypto[koin.toLowerCase()];
  return k && k.idr > 0 ? k : null;
}

export function proyeksiJmo(a: AsetItem, kini: Date = new Date()) {
  const bulan = bulanAntara(a.tanggalSaldo, kini);
  const iuran = (Number(a.gaji) || 0) * ((Number(a.iuranPersen) || 0) / 100) + (Number(a.iuranTambahan) || 0);
  const r = (Number(a.hasilPersen) || 0) / 100 / 12;
  let saldo = Number(a.saldoAwal) || 0;
  for (let i = 0; i < bulan; i++) {
    saldo = saldo * (1 + r) + iuran;
  }
  const modal = (Number(a.saldoAwal) || 0) + iuran * bulan;
  return {
    nilai: Math.round(saldo),
    modal: Math.round(modal),
    bulan,
    iuranBulanan: Math.round(iuran),
  };
}

export function nilaiInvestasi(a: AsetItem, kini: Date = new Date()) {
  const bulan = bulanAntara(a.tanggalMulai, kini);
  const modal = Number(a.modal) || 0;
  const r = (Number(a.bungaPersen) || 0) / 100;
  let nilai: number;
  if (a.skema === "sederhana") {
    nilai = modal * (1 + (r * bulan) / 12);
  } else if (a.skema === "majemuk-tahunan") {
    nilai = modal * Math.pow(1 + r, bulan / 12);
  } else {
    // majemuk-bulanan
    nilai = modal * Math.pow(1 + r / 12, bulan);
  }
  return { nilai: Math.round(nilai), modal: Math.round(modal), bulan };
}

export function hitungAset(a: AsetItem, harga?: DataHarga, kini: Date = new Date()): HasilHitungAset {
  const hasil: HasilHitungAset = {
    nilai: 0,
    modal: null,
    untung: null,
    persen: null,
    tersedia: true,
    keterangan: "",
  };

  if (a.jenis === "emas") {
    const h = hargaEmasEfektif(harga);
    const gram = Number(a.gram) || 0;
    if (!h) {
      hasil.tersedia = false;
      hasil.keterangan = "harga emas belum tersedia";
    } else {
      hasil.nilai = Math.round(gram * h.jual);
      hasil.keterangan = `${formatGram(gram)} gr × ${formatRupiah(h.jual)}/gr${
        h.buyback ? ` · buyback ${formatRupiah(h.buyback)}/gr` : ""
      }${h.sumber === "manual" ? " (manual)" : ""}`;
    }
    if (Number(a.hargaBeli) && Number(a.hargaBeli)! > 0) {
      hasil.modal = Math.round(gram * Number(a.hargaBeli));
    }
  } else if (a.jenis === "crypto") {
    const k = hargaKoin(harga, a.koin);
    const jumlah = Number(a.jumlah) || 0;
    if (!k) {
      hasil.tersedia = false;
      hasil.keterangan = `harga ${a.koin || "koin"} belum tersedia`;
    } else {
      hasil.nilai = Math.round(jumlah * k.idr);
      const ub =
        typeof k.perubahan24 === "number"
          ? ` · 24 jam ${k.perubahan24 >= 0 ? "+" : ""}${k.perubahan24.toFixed(2)}%`
          : "";
      hasil.keterangan = `${formatKoin(jumlah)} ${(a.simbol || a.koin || "").toUpperCase()} × ${formatRupiah(
        k.idr
      )}${ub}`;
    }
    if (Number(a.hargaBeli) && Number(a.hargaBeli)! > 0) {
      hasil.modal = Math.round(jumlah * Number(a.hargaBeli));
    }
  } else if (a.jenis === "jmo") {
    const p = proyeksiJmo(a, kini);
    hasil.nilai = p.nilai;
    hasil.modal = p.modal;
    hasil.keterangan = `saldo ${formatRupiah(a.saldoAwal || 0)} + iuran ${formatRupiah(
      p.iuranBulanan
    )}/bln × ${p.bulan} bln, hasil ${Number(a.hasilPersen) || 0}%/th`;
  } else if (a.jenis === "investasi") {
    const p = nilaiInvestasi(a, kini);
    hasil.nilai = p.nilai;
    hasil.modal = p.modal;
    const skemaLabel =
      a.skema === "sederhana"
        ? "bunga sederhana"
        : a.skema === "majemuk-tahunan"
        ? "majemuk tahunan"
        : "majemuk bulanan";
    hasil.keterangan = `modal ${formatRupiah(p.modal)}, ${
      Number(a.bungaPersen) || 0
    }%/th ${skemaLabel}, ${p.bulan} bln`;
  } else {
    hasil.tersedia = false;
    hasil.keterangan = "jenis aset tidak dikenal";
  }

  if (hasil.modal !== null && hasil.tersedia) {
    hasil.untung = hasil.nilai - hasil.modal;
    hasil.persen = hasil.modal > 0 ? (hasil.untung / hasil.modal) * 100 : 0;
  }

  return hasil;
}

export function ringkasAset(daftar: AsetItem[], harga?: DataHarga, kini: Date = new Date()): RingkasanAset {
  const item = (daftar || []).map((a) => ({ aset: a, ...hitungAset(a, harga, kini) }));
  const total = item.reduce((s, x) => s + (x.tersedia ? x.nilai : 0), 0);
  const denganModal = item.filter((x) => x.tersedia && x.modal !== null);
  const modal = denganModal.reduce((s, x) => s + (x.modal || 0), 0);
  const nilaiBermodal = denganModal.reduce((s, x) => s + x.nilai, 0);

  return {
    item,
    total,
    modal,
    untung: denganModal.length ? nilaiBermodal - modal : null,
    persen: modal > 0 ? ((nilaiBermodal - modal) / modal) * 100 : null,
    belumTersedia: item.filter((x) => !x.tersedia).length,
  };
}

export function koinDipakai(daftar: AsetItem[]): string[] {
  const s = new Set<string>(KOIN_DEFAULT);
  for (const a of daftar || []) {
    if (a.jenis === "crypto" && a.koin) {
      s.add(String(a.koin).toLowerCase());
    }
  }
  return Array.from(s);
}

export async function ambilHargaCoinGecko(koinList: string[]): Promise<Record<string, HargaKoin>> {
  if (koinList.length === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    koinList.join(",")
  )}&vs_currencies=idr&include_24hr_change=true`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, { idr?: number; idr_24h_change?: number }>;

  const hasil: Record<string, HargaKoin> = {};
  for (const [id, v] of Object.entries(data)) {
    if (v && typeof v.idr === "number") {
      hasil[id.toLowerCase()] = {
        idr: v.idr,
        perubahan24: typeof v.idr_24h_change === "number" ? v.idr_24h_change : null,
      };
    }
  }
  return hasil;
}

export async function ambilHargaPasarLengkap(koinList: string[]): Promise<{
  crypto: Record<string, HargaKoin>;
  emas?: HargaEmas;
}> {
  // Selalu sertakan pax-gold untuk update otomatis harga emas pasar spot
  const idsToFetch = Array.from(new Set([...koinList, "pax-gold"]));
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    idsToFetch.join(",")
  )}&vs_currencies=idr&include_24hr_change=true`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, { idr?: number; idr_24h_change?: number }>;

  const cryptoHasil: Record<string, HargaKoin> = {};
  for (const [id, v] of Object.entries(data)) {
    if (id !== "pax-gold" && v && typeof v.idr === "number") {
      cryptoHasil[id.toLowerCase()] = {
        idr: v.idr,
        perubahan24: typeof v.idr_24h_change === "number" ? v.idr_24h_change : null,
      };
    }
  }

  let emasHasil: HargaEmas | undefined;
  if (data["pax-gold"] && typeof data["pax-gold"].idr === "number" && data["pax-gold"].idr > 0) {
    // 1 Troy Ounce = 31.1034768 gram
    const gramIdr = Math.round(data["pax-gold"].idr / 31.1034768);
    const buyback = Math.round(gramIdr * 0.91);
    emasHasil = {
      jual: gramIdr,
      buyback,
      waktu: new Date().toISOString(),
      sumber: "otomatis (spot gold)",
    };
  }

  return { crypto: cryptoHasil, emas: emasHasil };
}

export function hargaBasi(harga?: DataHarga, kini: number = Date.now()): boolean {
  const t = waktuMs(harga?.waktu);
  return !t || kini - t > HARGA_BASI_MS;
}
