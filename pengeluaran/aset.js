// Perhitungan nilai aset dan pengambilan harga pasar. Tidak menyentuh DOM, supaya bisa diuji di Node.
// Dipakai app.js (browser) dan uji/uji-aset.js (Node).
(function (root) {
  const JENIS_ASET = ["emas", "crypto", "jmo", "investasi"];
  const KOIN_DEFAULT = ["bitcoin", "ethereum"];
  const HARGA_BASI_MS = 6 * 60 * 60 * 1000; // harga lebih tua dari ini ditandai "lama"

  // Jumlah bulan penuh dari tanggal ISO (YYYY-MM-DD) sampai `kini`.
  function bulanAntara(iso, kini) {
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

  // Harga emas per gram yang dipakai: otomatis atau manual, mana yang lebih baru.
  function hargaEmasEfektif(harga) {
    const otomatis = harga && harga.emas && harga.emas.jual > 0 ? harga.emas : null;
    const manual = harga && harga.manual && harga.manual.emas && harga.manual.emas.jual > 0 ? harga.manual.emas : null;
    if (otomatis && manual) return waktuMs(manual.waktu) >= waktuMs(otomatis.waktu) ? { ...manual, sumber: "manual" } : otomatis;
    return manual ? { ...manual, sumber: "manual" } : otomatis;
  }

  function hargaKoin(harga, koin) {
    const k = harga && harga.crypto && harga.crypto[String(koin || "").toLowerCase()];
    return k && k.idr > 0 ? k : null;
  }

  function waktuMs(w) {
    const t = Date.parse(w || "");
    return Number.isNaN(t) ? 0 : t;
  }

  // JHT BPJS Ketenagakerjaan: saldo bertambah iuran tiap bulan (5,7% upah: 3,7% pemberi kerja +
  // 2% pekerja) dan berkembang dengan hasil pengembangan tahunan yang diumumkan BPJS TK.
  // Hasil pengembangan dibagi rata per bulan (majemuk bulanan) sebagai pendekatan.
  function proyeksiJmo(a, kini) {
    const bulan = bulanAntara(a.tanggalSaldo, kini);
    const iuran = (Number(a.gaji) || 0) * ((Number(a.iuranPersen) || 0) / 100) + (Number(a.iuranTambahan) || 0);
    const r = (Number(a.hasilPersen) || 0) / 100 / 12;
    let saldo = Number(a.saldoAwal) || 0;
    for (let i = 0; i < bulan; i++) saldo = saldo * (1 + r) + iuran;
    const modal = (Number(a.saldoAwal) || 0) + iuran * bulan;
    return { nilai: Math.round(saldo), modal: Math.round(modal), bulan, iuranBulanan: Math.round(iuran) };
  }

  function nilaiInvestasi(a, kini) {
    const bulan = bulanAntara(a.tanggalMulai, kini);
    const modal = Number(a.modal) || 0;
    const r = (Number(a.bungaPersen) || 0) / 100;
    let nilai;
    if (a.skema === "sederhana") nilai = modal * (1 + (r * bulan) / 12);
    else if (a.skema === "majemuk-tahunan") nilai = modal * Math.pow(1 + r, bulan / 12);
    else nilai = modal * Math.pow(1 + r / 12, bulan);
    return { nilai: Math.round(nilai), modal: Math.round(modal), bulan };
  }

  // Menghasilkan {nilai, modal, untung, persen, tersedia, keterangan} untuk satu aset.
  function hitungAset(a, harga, kini) {
    kini = kini || new Date();
    const hasil = { nilai: 0, modal: null, tersedia: true, keterangan: "" };
    if (a.jenis === "emas") {
      const h = hargaEmasEfektif(harga);
      const gram = Number(a.gram) || 0;
      if (!h) {
        hasil.tersedia = false;
        hasil.keterangan = "harga emas belum tersedia";
      } else {
        hasil.nilai = Math.round(gram * h.jual);
        hasil.keterangan = `${formatGram(gram)} gr × ${rupiah(h.jual)}/gr${h.buyback ? ` · buyback ${rupiah(h.buyback)}/gr` : ""}${h.sumber === "manual" ? " (manual)" : ""}`;
      }
      if (Number(a.hargaBeli) > 0) hasil.modal = Math.round(gram * Number(a.hargaBeli));
    } else if (a.jenis === "crypto") {
      const k = hargaKoin(harga, a.koin);
      const jumlah = Number(a.jumlah) || 0;
      if (!k) {
        hasil.tersedia = false;
        hasil.keterangan = `harga ${a.koin || "koin"} belum tersedia`;
      } else {
        hasil.nilai = Math.round(jumlah * k.idr);
        const ub = typeof k.perubahan24 === "number" ? ` · 24 jam ${k.perubahan24 >= 0 ? "+" : ""}${k.perubahan24.toFixed(2)}%` : "";
        hasil.keterangan = `${formatKoin(jumlah)} ${(a.simbol || a.koin || "").toUpperCase()} × ${rupiah(k.idr)}${ub}`;
      }
      if (Number(a.hargaBeli) > 0) hasil.modal = Math.round(jumlah * Number(a.hargaBeli));
    } else if (a.jenis === "jmo") {
      const p = proyeksiJmo(a, kini);
      hasil.nilai = p.nilai;
      hasil.modal = p.modal;
      hasil.keterangan = `saldo ${rupiah(a.saldoAwal || 0)} + iuran ${rupiah(p.iuranBulanan)}/bln × ${p.bulan} bln, hasil ${Number(a.hasilPersen) || 0}%/th`;
    } else if (a.jenis === "investasi") {
      const p = nilaiInvestasi(a, kini);
      hasil.nilai = p.nilai;
      hasil.modal = p.modal;
      const skema = { sederhana: "bunga sederhana", "majemuk-tahunan": "majemuk tahunan" }[a.skema] || "majemuk bulanan";
      hasil.keterangan = `modal ${rupiah(p.modal)}, ${Number(a.bungaPersen) || 0}%/th ${skema}, ${p.bulan} bln`;
    } else {
      hasil.tersedia = false;
      hasil.keterangan = "jenis aset tidak dikenal";
    }
    if (hasil.modal !== null && hasil.tersedia) {
      hasil.untung = hasil.nilai - hasil.modal;
      hasil.persen = hasil.modal > 0 ? (hasil.untung / hasil.modal) * 100 : 0;
    } else {
      hasil.untung = null;
      hasil.persen = null;
    }
    return hasil;
  }

  function ringkasAset(daftar, harga, kini) {
    kini = kini || new Date();
    const item = (daftar || []).map((a) => ({ aset: a, ...hitungAset(a, harga, kini) }));
    const total = item.reduce((s, x) => s + (x.tersedia ? x.nilai : 0), 0);
    const denganModal = item.filter((x) => x.tersedia && x.modal !== null);
    const modal = denganModal.reduce((s, x) => s + x.modal, 0);
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

  function koinDipakai(daftar) {
    const s = new Set(KOIN_DEFAULT);
    for (const a of daftar || []) if (a.jenis === "crypto" && a.koin) s.add(String(a.koin).toLowerCase());
    return [...s];
  }

  // CoinGecko: {bitcoin: {idr: 1.6e9, idr_24h_change: 1.2}} -> {bitcoin: {idr, perubahan24}}
  function petakanCoinGecko(json) {
    const hasil = {};
    for (const [id, v] of Object.entries(json || {})) {
      if (v && typeof v.idr === "number") {
        hasil[id] = { idr: v.idr, perubahan24: typeof v.idr_24h_change === "number" ? v.idr_24h_change : null };
      }
    }
    return hasil;
  }

  function urlCoinGecko(ids) {
    return `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=idr&include_24hr_change=true`;
  }

  // Menggabungkan harga lama dengan yang baru; bagian yang gagal diambil tetap memakai nilai lama.
  function gabungHarga(lama, baru) {
    lama = lama || {};
    baru = baru || {};
    return {
      ...lama,
      ...baru,
      emas: baru.emas && baru.emas.jual > 0 ? baru.emas : lama.emas,
      crypto: { ...(lama.crypto || {}), ...(baru.crypto || {}) },
      manual: baru.manual || lama.manual,
      waktu: baru.waktu || lama.waktu,
    };
  }

  function hargaBasi(harga, kini) {
    const t = waktuMs(harga && harga.waktu);
    return !t || (kini || Date.now()) - t > HARGA_BASI_MS;
  }

  // Validasi ringan sebelum aset disimpan/disinkronkan.
  function rapikanAset(a) {
    if (!a || typeof a !== "object" || !JENIS_ASET.includes(a.jenis)) return null;
    const angka = (v, min) => (Number.isFinite(Number(v)) && Number(v) >= (min || 0) ? Number(v) : 0);
    const teks = (v, n) => String(v || "").trim().slice(0, n || 200);
    const dasar = { id: teks(a.id, 40), jenis: a.jenis, nama: teks(a.nama, 80), catatan: teks(a.catatan, 200), dibuat: teks(a.dibuat, 40) };
    if (!dasar.nama) return null;
    if (a.jenis === "emas") return { ...dasar, gram: angka(a.gram), hargaBeli: angka(a.hargaBeli) };
    if (a.jenis === "crypto") {
      return { ...dasar, koin: teks(a.koin, 60).toLowerCase(), simbol: teks(a.simbol, 12).toUpperCase(), jumlah: angka(a.jumlah), hargaBeli: angka(a.hargaBeli) };
    }
    if (a.jenis === "jmo") {
      return {
        ...dasar,
        saldoAwal: angka(a.saldoAwal),
        tanggalSaldo: teks(a.tanggalSaldo, 10),
        gaji: angka(a.gaji),
        iuranPersen: angka(a.iuranPersen),
        hasilPersen: angka(a.hasilPersen),
        iuranTambahan: angka(a.iuranTambahan),
      };
    }
    return {
      ...dasar,
      modal: angka(a.modal),
      tanggalMulai: teks(a.tanggalMulai, 10),
      bungaPersen: angka(a.bungaPersen),
      skema: ["majemuk-bulanan", "majemuk-tahunan", "sederhana"].includes(a.skema) ? a.skema : "majemuk-bulanan",
    };
  }

  const fmtRupiah = typeof Intl !== "undefined" ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }) : null;
  function rupiah(n) {
    return fmtRupiah ? fmtRupiah.format(Math.round(Number(n) || 0)) : `Rp${Math.round(Number(n) || 0)}`;
  }
  function formatGram(g) {
    return Number(g).toLocaleString("id-ID", { maximumFractionDigits: 3 });
  }
  function formatKoin(j) {
    return Number(j).toLocaleString("id-ID", { maximumFractionDigits: 8 });
  }

  const Aset = {
    JENIS_ASET,
    KOIN_DEFAULT,
    HARGA_BASI_MS,
    bulanAntara,
    hargaEmasEfektif,
    hargaKoin,
    proyeksiJmo,
    nilaiInvestasi,
    hitungAset,
    ringkasAset,
    koinDipakai,
    petakanCoinGecko,
    urlCoinGecko,
    gabungHarga,
    hargaBasi,
    rapikanAset,
    rupiah,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Aset;
  else root.Aset = Aset;
})(typeof window !== "undefined" ? window : globalThis);
