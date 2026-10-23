import React, { useState, useEffect } from "react";
import {
  DataKegiatan,
  JenisBukti,
  RincianBarangJasa,
  FotoPendukung,
  DetailTransportasi,
  DetailRentalKendaraan,
  DetailBBM,
  DetailAkomodasi,
  DetailKonsumsi,
  DetailHonorarium,
  DetailPerdiem,
  TimesheetRentalItem,
  DataKhususKegiatan,
  Transaksi,
} from "../types";
import { DAFTAR_JENIS_BUKTI, formatRupiah, hariIni } from "../lib/constants";
import { buatId } from "../lib/storage";
import { kompresBukti } from "../lib/buktiStorage";
import {
  hitungBatasLaporanFisik,
  cekKetentuanTransaksi,
  KetentuanPeringatan,
  KETENTUAN_DANA_KEGIATAN,
} from "../lib/ketentuanKegiatan";

interface DanaKegiatanFormFieldsProps {
  kategori: string;
  jumlah: string;
  onUpdateJumlah: (jml: string) => void;
  kaitan: string;
  onUpdateKaitan: (kaitan: string) => void;
  kegiatanId: string;
  onUpdateKegiatanId: (id: string) => void;
  daftarKegiatan: DataKegiatan[];
  onTambahKegiatan: (kegiatan: DataKegiatan) => void;

  // Data Khusus
  jenisBukti: JenisBukti;
  onUpdateJenisBukti: (jb: JenisBukti) => void;
  namaPenjualPenyedia: string;
  onUpdateNamaPenjualPenyedia: (nama: string) => void;

  rincianBanyaknya: string;
  onUpdateRincianBanyaknya: (b: string) => void;
  rincianSatuan: string;
  onUpdateRincianSatuan: (s: string) => void;
  rincianHargaSatuan: string;
  onUpdateRincianHargaSatuan: (h: string) => void;

  keteranganLaporan: string;
  onUpdateKeteranganLaporan: (ket: string) => void;
  perluSuratJustifikasi: boolean;
  onUpdatePerluSuratJustifikasi: (val: boolean) => void;
  alasanJustifikasi: string;
  onUpdateAlasanJustifikasi: (alasan: string) => void;

  fotoPendukung: FotoPendukung[];
  onUpdateFotoPendukung: (foto: FotoPendukung[]) => void;

  // Sub-kelompok
  transportasi: DetailTransportasi;
  onUpdateTransportasi: (t: DetailTransportasi) => void;
  rentalKendaraan: DetailRentalKendaraan;
  onUpdateRentalKendaraan: (r: DetailRentalKendaraan) => void;
  bbm: DetailBBM;
  onUpdateBBM: (b: DetailBBM) => void;
  akomodasi: DetailAkomodasi;
  onUpdateAkomodasi: (a: DetailAkomodasi) => void;
  konsumsi: DetailKonsumsi;
  onUpdateKonsumsi: (k: DetailKonsumsi) => void;
  honorarium: DetailHonorarium;
  onUpdateHonorarium: (h: DetailHonorarium) => void;
  perdiem: DetailPerdiem;
  onUpdatePerdiem: (p: DetailPerdiem) => void;
}

const KUNCI_TARIF_PERDIEM = "keuangan-tarif-perdiem";

function bacaTarifPerdiemTerakhir(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_TARIF_PERDIEM));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function simpanTarifPerdiemTerakhir(tarif: number): void {
  try {
    if (tarif > 0) localStorage.setItem(KUNCI_TARIF_PERDIEM, String(tarif));
  } catch {
    // penyimpanan tidak tersedia: tarif hanya tidak diingat
  }
}

export const DanaKegiatanFormFields: React.FC<DanaKegiatanFormFieldsProps> = ({
  kategori,
  jumlah,
  onUpdateJumlah,
  kaitan,
  onUpdateKaitan,
  kegiatanId,
  onUpdateKegiatanId,
  daftarKegiatan,
  onTambahKegiatan,

  jenisBukti,
  onUpdateJenisBukti,
  namaPenjualPenyedia,
  onUpdateNamaPenjualPenyedia,

  rincianBanyaknya,
  onUpdateRincianBanyaknya,
  rincianSatuan,
  onUpdateRincianSatuan,
  rincianHargaSatuan,
  onUpdateRincianHargaSatuan,

  keteranganLaporan,
  onUpdateKeteranganLaporan,
  perluSuratJustifikasi,
  onUpdatePerluSuratJustifikasi,
  alasanJustifikasi,
  onUpdateAlasanJustifikasi,

  fotoPendukung,
  onUpdateFotoPendukung,

  transportasi,
  onUpdateTransportasi,
  rentalKendaraan,
  onUpdateRentalKendaraan,
  bbm,
  onUpdateBBM,
  akomodasi,
  onUpdateAkomodasi,
  konsumsi,
  onUpdateKonsumsi,
  honorarium,
  onUpdateHonorarium,
  perdiem,
  onUpdatePerdiem,
}) => {
  // Modal Buat Kegiatan Baru
  const [modalKegiatanBaru, setModalKegiatanBaru] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const [lokasiBaru, setLokasiBaru] = useState("");
  const [tglMulaiBaru, setTglMulaiBaru] = useState(hariIni());
  const [tglSelesaiBaru, setTglSelesaiBaru] = useState(hariIni());

  // Timesheet Modal / Input
  const [bukaTimesheet, setBukaTimesheet] = useState(false);
  const [bukaKetentuanModal, setBukaKetentuanModal] = useState(false);

  // Kegiatan Terpilih
  const kegiatanTerpilih = daftarKegiatan.find((k) => k.id === kegiatanId);
  const batasFisik = kegiatanTerpilih
    ? hitungBatasLaporanFisik(kegiatanTerpilih.tanggalSelesai)
    : null;

  // Wajib surat justifikasi bila jenisBukti === "Bukti tidak lengkap"
  useEffect(() => {
    if (jenisBukti === "Bukti tidak lengkap" && !perluSuratJustifikasi) {
      onUpdatePerluSuratJustifikasi(true);
    }
  }, [jenisBukti]);

  // Hitung subtotal rincian otomatis
  const subtotalRincian =
    Number(rincianBanyaknya) > 0 && Number(rincianHargaSatuan) > 0
      ? Math.round(Number(rincianBanyaknya) * Number(rincianHargaSatuan))
      : 0;

  // Auto-update jumlah bila user mengisi rincian
  const handleTerapkanSubtotalRincian = () => {
    if (subtotalRincian > 0) {
      onUpdateJumlah(String(subtotalRincian));
    }
  };

  // Perdiem: hak uang harian = jumlah hari x tarif per hari. Jumlah transaksi diisi otomatis saat pengguna
  // mengubah hari atau tarif; mengubah jumlah langsung tidak menimpa apa pun.
  const ubahPerdiem = (berubah: Partial<DetailPerdiem>) => {
    const baru = { ...perdiem, ...berubah };
    onUpdatePerdiem(baru);
    const hari = Number(baru.jumlahHari) || 0;
    const tarif = Number(baru.tarifPerHari) || 0;
    if (tarif > 0 && berubah.tarifPerHari !== undefined) simpanTarifPerdiemTerakhir(tarif);
    if (hari > 0 && tarif > 0) onUpdateJumlah(String(Math.round(hari * tarif)));
  };

  // Perdiem baru: isi tarif dengan tarif terakhir yang dipakai (bukan saat mengubah perdiem yang sudah ada).
  useEffect(() => {
    if (kategori === "Perdiem" && !perdiem.tarifPerHari) {
      const terakhir = bacaTarifPerdiemTerakhir();
      if (terakhir > 0) onUpdatePerdiem({ ...perdiem, tarifPerHari: terakhir });
    }
  }, [kategori]);

  // Simpan Kegiatan Baru
  const handleSimpanKegiatanBaru = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBaru.trim()) return;

    const baru: DataKegiatan = {
      id: "kg_" + buatId(),
      nama: namaBaru.trim(),
      lokasi: lokasiBaru.trim(),
      tanggalMulai: tglMulaiBaru,
      tanggalSelesai: tglSelesaiBaru,
      dibuat: new Date().toISOString(),
    };

    onTambahKegiatan(baru);
    onUpdateKegiatanId(baru.id);
    onUpdateKaitan(baru.nama);
    setModalKegiatanBaru(false);
    setNamaBaru("");
    setLokasiBaru("");
  };

  // Hitung durasi hari rental otomatis
  useEffect(() => {
    if (kategori === "Rental Kendaraan" && rentalKendaraan.tanggalMulai && rentalKendaraan.tanggalSelesai) {
      const d1 = new Date(rentalKendaraan.tanggalMulai);
      const d2 = new Date(rentalKendaraan.tanggalSelesai);
      const diffMs = d2.getTime() - d1.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      if (rentalKendaraan.jumlahHari !== diffDays) {
        onUpdateRentalKendaraan({
          ...rentalKendaraan,
          jumlahHari: diffDays,
        });
      }
    }
  }, [kategori, rentalKendaraan.tanggalMulai, rentalKendaraan.tanggalSelesai]);

  // Hitung durasi malam akomodasi otomatis
  useEffect(() => {
    if (kategori === "Akomodasi" && akomodasi.tanggalMasuk && akomodasi.tanggalKeluar) {
      const d1 = new Date(akomodasi.tanggalMasuk);
      const d2 = new Date(akomodasi.tanggalKeluar);
      const diffMs = d2.getTime() - d1.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      if (akomodasi.jumlahMalam !== diffDays) {
        onUpdateAkomodasi({
          ...akomodasi,
          jumlahMalam: diffDays,
        });
      }
    }
  }, [kategori, akomodasi.tanggalMasuk, akomodasi.tanggalKeluar]);

  // Hitung pajak honorarium otomatis
  // Ketentuan:
  // - Bukan PNS dan di atas Rp450.000: (total ÷ 2) × 5% (NPWP) atau 6% (tanpa NPWP)
  // - PNS: seluruh honor × 5% (NPWP) atau 6% (tanpa NPWP)
  const hitungPajakHonor = () => {
    const bruto = Number(jumlah) || 0;
    const isPNS = Boolean(honorarium.isPNS);
    const hasNPWP = Boolean(honorarium.hasNPWP);
    const tarif = hasNPWP ? 0.05 : 0.06;

    let potongan = 0;
    if (isPNS) {
      potongan = Math.round(bruto * tarif);
    } else {
      if (bruto > 450000) {
        potongan = Math.round((bruto / 2) * tarif);
      }
    }

    const netto = Math.max(0, bruto - potongan);
    return { bruto, potongan, netto, tarifPersen: tarif * 100 };
  };

  const pajakHonor = hitungPajakHonor();

  // Foto Pendukung upload handler
  const handleTambahFotoPendukung = async (e: React.ChangeEvent<HTMLInputElement>, katFoto: FotoPendukung["kategoriFoto"]) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const kompres = await kompresBukti(f, f.name);
        const item: FotoPendukung = {
          id: buatId(),
          nama: kompres.namaFile,
          tipe: kompres.tipe,
          dataUrl: kompres.dataUrl,
          kategoriFoto: katFoto || "kegiatan",
          waktu: new Date().toISOString(),
        };
        onUpdateFotoPendukung([...fotoPendukung, item]);
      } catch (err: any) {
        console.warn("Gagal kompres foto pendukung:", err.message);
      }
    }
    e.target.value = "";
  };

  const handleHapusFotoPendukung = (id: string) => {
    onUpdateFotoPendukung(fotoPendukung.filter((f) => f.id !== id));
  };

  // Cek Ketentuan untuk menampilkan Peringatan Ramah (Bukan Larangan)
  const dataTransaksiDummy: Partial<Transaksi> = {
    dana: "Dana Kegiatan",
    jumlah: Number(jumlah) || 0,
    kategori,
    kaitan,
    detailKegiatan: {
      jenisBukti,
      namaPenjualPenyedia,
      rincian: subtotalRincian > 0 ? {
        banyaknya: Number(rincianBanyaknya),
        satuan: rincianSatuan,
        hargaSatuan: Number(rincianHargaSatuan),
      } : undefined,
      perluSuratJustifikasi,
      alasanJustifikasi,
      transportasi,
      rentalKendaraan,
      bbm,
      akomodasi,
      konsumsi,
      honorarium,
      perdiem: kategori === "Perdiem" ? perdiem : undefined,
    },
  };

  const daftarPeringatan = cekKetentuanTransaksi(dataTransaksiDummy, kegiatanTerpilih);

  return (
    <div
      style={{
        marginTop: "16px",
        marginBottom: "16px",
        padding: "16px",
        borderRadius: "14px",
        background: "color-mix(in srgb, var(--accent) 5%, var(--surface))",
        border: "1.5px solid var(--accent)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.2rem" }}>📋</span>
          <strong style={{ fontSize: "0.95rem", color: "var(--accent)" }}>
            Kelengkapan SPJ Dana Kegiatan &amp; Laporan
          </strong>
        </div>
        <button
          type="button"
          className="btn-link"
          style={{ fontSize: "0.78rem", color: "var(--accent)", textDecoration: "underline", cursor: "pointer" }}
          onClick={() => setBukaKetentuanModal(true)}
        >
          📖 Baca Ketentuan SPJ ({kategori || "Umum"})
        </button>
      </div>

      {/* 1. Kaitan Kegiatan (Pilih dari daftar atau buat baru) */}
      <div className="field wide" style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
          <label htmlFor="pilih-kegiatan-id" style={{ fontSize: "0.82rem", fontWeight: 700 }}>
            Kaitan Kegiatan Lapangan:
          </label>
          <button
            type="button"
            className="btn-link"
            style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent)" }}
            onClick={() => setModalKegiatanBaru(true)}
          >
            + Buat Kegiatan Baru
          </button>
        </div>

        <select
          id="pilih-kegiatan-id"
          value={kegiatanId}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "__buat_baru__") {
              setModalKegiatanBaru(true);
            } else {
              onUpdateKegiatanId(val);
              const terpilih = daftarKegiatan.find((k) => k.id === val);
              if (terpilih) {
                onUpdateKaitan(terpilih.nama);
              }
            }
          }}
          style={{ width: "100%", padding: "8px 10px", fontSize: "0.85rem" }}
        >
          <option value="">-- Pilih Kegiatan dari Daftar --</option>
          {daftarKegiatan.map((k) => (
            <option key={k.id} value={k.id}>
              📌 {k.nama} ({k.lokasi || "Lokasi tidak dicatat"} • {k.tanggalMulai} s.d {k.tanggalSelesai})
            </option>
          ))}
          <option value="__buat_baru__">+ Tambah / Buat Kegiatan Baru...</option>
        </select>

        {kegiatanTerpilih && batasFisik && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: batasFisik.hariTersisa < 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
              border: `1px solid ${batasFisik.hariTersisa < 0 ? "var(--keluar)" : "#10b981"}`,
              fontSize: "0.8rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
            }}
          >
            <div>
              <span>📍 {kegiatanTerpilih.lokasi || "Lokasi Lapangan"}</span>
              <span style={{ margin: "0 6px" }}>•</span>
              <span>📅 {kegiatanTerpilih.tanggalMulai} s.d {kegiatanTerpilih.tanggalSelesai}</span>
            </div>
            <div style={{ fontWeight: 700, color: batasFisik.hariTersisa < 0 ? "var(--keluar)" : "#10b981" }}>
              ⏳ Batas Penyerahan Laporan Fisik: {batasFisik.formatTeks}{" "}
              {batasFisik.hariTersisa < 0
                ? `(Terlewat ${Math.abs(batasFisik.hariTersisa)} hari)`
                : `(${batasFisik.hariTersisa} hari lagi)`}
            </div>
          </div>
        )}
      </div>

      {/* 2. Jenis Bukti & Nama Toko/Penyedia */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "12px" }}>
        <div className="field">
          <label htmlFor="jenis-bukti-select" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
            Jenis Bukti Transaksi:
          </label>
          <select
            id="jenis-bukti-select"
            value={jenisBukti}
            onChange={(e) => onUpdateJenisBukti(e.target.value as JenisBukti)}
            style={{ width: "100%", padding: "8px", fontSize: "0.84rem" }}
          >
            {DAFTAR_JENIS_BUKTI.map((jb) => (
              <option key={jb} value={jb}>
                {jb}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="nama-penjual" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
            Nama Penjual / Penyedia / Rekanan:
          </label>
          <input
            id="nama-penjual"
            type="text"
            placeholder="Contoh: Toko Berkah, RM Padang, Pak Joko"
            value={namaPenjualPenyedia}
            onChange={(e) => onUpdateNamaPenjualPenyedia(e.target.value)}
            style={{ width: "100%", padding: "8px", fontSize: "0.84rem" }}
          />
        </div>
      </div>

      {/* 3. Rincian: Banyaknya × Satuan × Harga Satuan */}
      <div
        style={{
          background: "var(--surface)",
          padding: "10px 12px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>
            Rincian Pembelian (Banyaknya × Satuan × Harga Satuan):
          </label>
          {subtotalRincian > 0 && (
            <span style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700 }}>
              = {formatRupiah(subtotalRincian)}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 140px", gap: "8px", alignItems: "center" }}>
          <div>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Jml (111)"
              value={rincianBanyaknya}
              onChange={(e) => onUpdateRincianBanyaknya(e.target.value)}
              style={{ width: "100%", padding: "7px 8px", fontSize: "0.82rem" }}
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Satuan (kg, hari, liter, porsi)"
              value={rincianSatuan}
              onChange={(e) => onUpdateRincianSatuan(e.target.value)}
              style={{ width: "100%", padding: "7px 8px", fontSize: "0.82rem" }}
            />
          </div>
          <div>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Harga (17000)"
              value={rincianHargaSatuan}
              onChange={(e) => onUpdateRincianHargaSatuan(e.target.value)}
              style={{ width: "100%", padding: "7px 8px", fontSize: "0.82rem" }}
            />
          </div>
        </div>

        {/* Quick Satuan Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Pilih satuan:</span>
          {["kg", "hari", "liter", "porsi", "orang", "unit", "lembar", "malam", "paket"].map((sat) => (
            <button
              key={sat}
              type="button"
              className="btn-small"
              style={{
                fontSize: "0.7rem",
                padding: "2px 7px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: rincianSatuan === sat ? "var(--accent)" : "transparent",
                color: rincianSatuan === sat ? "#fff" : "var(--text)",
                cursor: "pointer",
              }}
              onClick={() => onUpdateRincianSatuan(sat)}
            >
              {sat}
            </button>
          ))}
          {subtotalRincian > 0 && String(subtotalRincian) !== jumlah && (
            <button
              type="button"
              className="btn-small"
              style={{
                fontSize: "0.72rem",
                padding: "2px 8px",
                marginLeft: "auto",
                background: "#10b981",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={handleTerapkanSubtotalRincian}
              title="Salin hasil perkalian ke kolom Jumlah Utama"
            >
              ✓ Pakai Rp{formatRupiah(subtotalRincian).replace("Rp", "")}
            </button>
          )}
        </div>
      </div>

      {/* 4. Keterangan untuk Laporan (1–2 Kalimat Baku) */}
      <div className="field wide" style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
          <label htmlFor="ket-laporan" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
            Keterangan untuk Laporan SPJ (1–2 kalimat baku):
          </label>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Bahasa baku formal</span>
        </div>
        <textarea
          id="ket-laporan"
          rows={2}
          placeholder="Contoh: Perjalanan dari Tanjung Selor ke Tarakan dengan speedboat reguler SB Sekatak AAA Kaltara."
          value={keteranganLaporan}
          onChange={(e) => onUpdateKeteranganLaporan(e.target.value)}
          style={{ width: "100%", padding: "8px", fontSize: "0.84rem", borderRadius: "8px" }}
        />
      </div>

      {/* 5. Surat Justifikasi (Wajib bila jenis bukti = Bukti tidak lengkap) */}
      <div
        style={{
          background: jenisBukti === "Bukti tidak lengkap" ? "rgba(239, 68, 68, 0.08)" : "var(--surface)",
          padding: "10px 12px",
          borderRadius: "10px",
          border: jenisBukti === "Bukti tidak lengkap" ? "1px solid var(--keluar)" : "1px solid var(--border)",
          marginBottom: "12px",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.84rem" }}>
          <input
            type="checkbox"
            checked={perluSuratJustifikasi}
            onChange={(e) => onUpdatePerluSuratJustifikasi(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "var(--accent)" }}
          />
          <span>
            📄 Perlu Surat Justifikasi{" "}
            {jenisBukti === "Bukti tidak lengkap" && (
              <span style={{ color: "var(--keluar)", fontSize: "0.76rem" }}>(Wajib untuk bukti tidak lengkap)</span>
            )}
          </span>
        </label>

        {perluSuratJustifikasi && (
          <div style={{ marginTop: "8px" }}>
            <label htmlFor="alasan-justifikasi" style={{ fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "3px" }}>
              Alasan Singkat Justifikasi:
            </label>
            <input
              id="alasan-justifikasi"
              type="text"
              placeholder="Contoh: Pembelian di pedalaman tidak ada toko formal/nota resmi, kuitansi ditandatangani kepala desa."
              value={alasanJustifikasi}
              onChange={(e) => onUpdateAlasanJustifikasi(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", fontSize: "0.82rem" }}
              required={jenisBukti === "Bukti tidak lengkap"}
            />
          </div>
        )}
      </div>

      {/* 6. Isian Khusus per Kelompok Kategori */}
      {kategori === "Transportasi" && (
        <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
            🚗 Detail Khusus Transportasi
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: "8px", marginBottom: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Dari (Asal)</label>
              <input
                type="text"
                placeholder="Tanjung Selor"
                value={transportasi.dari || ""}
                onChange={(e) => onUpdateTransportasi({ ...transportasi, dari: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Ke (Tujuan)</label>
              <input
                type="text"
                placeholder="Tarakan"
                value={transportasi.ke || ""}
                onChange={(e) => onUpdateTransportasi({ ...transportasi, ke: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Moda</label>
              <input
                type="text"
                placeholder="Speedboat/Ojek"
                value={transportasi.moda || ""}
                onChange={(e) => onUpdateTransportasi({ ...transportasi, moda: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Nama Sopir (Travel/Ojek)</label>
              <input
                type="text"
                placeholder="Nama Pengemudi"
                value={transportasi.namaSopir || ""}
                onChange={(e) => onUpdateTransportasi({ ...transportasi, namaSopir: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>No. Telp Sopir</label>
              <input
                type="tel"
                placeholder="0812xxxx"
                value={transportasi.noTelpSopir || ""}
                onChange={(e) => onUpdateTransportasi({ ...transportasi, noTelpSopir: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>No. Polisi / Plat</label>
              <input
                type="text"
                placeholder="KU 1234 XX"
                value={transportasi.noPolisi || ""}
                onChange={(e) => onUpdateTransportasi({ ...transportasi, noPolisi: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>
        </div>
      )}

      {kategori === "Rental Kendaraan" && (
        <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
            🚙 Detail Khusus Rental Kendaraan
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jenis &amp; Merk</label>
              <input
                type="text"
                placeholder="Toyota Hilux 4x4"
                value={rentalKendaraan.jenisMerk || ""}
                onChange={(e) => onUpdateRentalKendaraan({ ...rentalKendaraan, jenisMerk: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Tahun Kendaraan</label>
              <input
                type="text"
                placeholder="2022"
                value={rentalKendaraan.tahun || ""}
                onChange={(e) => onUpdateRentalKendaraan({ ...rentalKendaraan, tahun: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>No. Polisi / Plat</label>
              <input
                type="text"
                placeholder="KU 8899 AB"
                value={rentalKendaraan.noPolisi || ""}
                onChange={(e) => onUpdateRentalKendaraan({ ...rentalKendaraan, noPolisi: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Nama Pemilik</label>
              <input
                type="text"
                placeholder="Nama Rental/Pemilik"
                value={rentalKendaraan.namaPemilik || ""}
                onChange={(e) => onUpdateRentalKendaraan({ ...rentalKendaraan, namaPemilik: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px", gap: "8px", marginBottom: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Tanggal Mulai Sewa</label>
              <input
                type="date"
                value={rentalKendaraan.tanggalMulai || ""}
                onChange={(e) => onUpdateRentalKendaraan({ ...rentalKendaraan, tanggalMulai: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Tanggal Selesai Sewa</label>
              <input
                type="date"
                value={rentalKendaraan.tanggalSelesai || ""}
                onChange={(e) => onUpdateRentalKendaraan({ ...rentalKendaraan, tanggalSelesai: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jml Hari</label>
              <input
                type="number"
                readOnly
                value={rentalKendaraan.jumlahHari || 1}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem", background: "rgba(0,0,0,0.1)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Gross-Up Pajak (%)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={rentalKendaraan.persenGrossUpPajak ?? 2}
                onChange={(e) => onUpdateRentalKendaraan({ ...rentalKendaraan, persenGrossUpPajak: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>

          {/* Timesheet Harian Toggle */}
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                📅 Timesheet Harian Rental ({(rentalKendaraan.timesheet || []).length} rute)
              </span>
              <button
                type="button"
                className="btn-small"
                onClick={() => setBukaTimesheet((prev) => !prev)}
                style={{ fontSize: "0.75rem", padding: "2px 8px" }}
              >
                {bukaTimesheet ? "Tutup Timesheet ▲" : "Buka / Kelola Timesheet ▼"}
              </button>
            </div>

            {bukaTimesheet && (
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {(rentalKendaraan.timesheet || []).map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 1fr 70px 30px",
                      gap: "6px",
                      alignItems: "center",
                      background: "rgba(0,0,0,0.05)",
                      padding: "6px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    <input
                      type="date"
                      value={item.tanggal}
                      onChange={(e) => {
                        const copy = [...(rentalKendaraan.timesheet || [])];
                        copy[idx].tanggal = e.target.value;
                        onUpdateRentalKendaraan({ ...rentalKendaraan, timesheet: copy });
                      }}
                      style={{ fontSize: "0.75rem", padding: "4px" }}
                    />
                    <input
                      type="text"
                      placeholder="Basecamp / Rute"
                      value={item.lokasiBasecampRute}
                      onChange={(e) => {
                        const copy = [...(rentalKendaraan.timesheet || [])];
                        copy[idx].lokasiBasecampRute = e.target.value;
                        onUpdateRentalKendaraan({ ...rentalKendaraan, timesheet: copy });
                      }}
                      style={{ fontSize: "0.75rem", padding: "4px" }}
                    />
                    <input
                      type="text"
                      placeholder="Cakupan Aktivitas"
                      value={item.cakupanAktivitas}
                      onChange={(e) => {
                        const copy = [...(rentalKendaraan.timesheet || [])];
                        copy[idx].cakupanAktivitas = e.target.value;
                        onUpdateRentalKendaraan({ ...rentalKendaraan, timesheet: copy });
                      }}
                      style={{ fontSize: "0.75rem", padding: "4px" }}
                    />
                    <input
                      type="number"
                      placeholder="Km"
                      value={item.jarakKm || ""}
                      onChange={(e) => {
                        const copy = [...(rentalKendaraan.timesheet || [])];
                        copy[idx].jarakKm = Number(e.target.value);
                        onUpdateRentalKendaraan({ ...rentalKendaraan, timesheet: copy });
                      }}
                      style={{ fontSize: "0.75rem", padding: "4px" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const copy = (rentalKendaraan.timesheet || []).filter((_, i) => i !== idx);
                        onUpdateRentalKendaraan({ ...rentalKendaraan, timesheet: copy });
                      }}
                      style={{ background: "none", border: "none", color: "var(--keluar)", cursor: "pointer", fontSize: "0.9rem" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const newItem: TimesheetRentalItem = {
                      id: buatId(),
                      tanggal: rentalKendaraan.tanggalMulai || hariIni(),
                      lokasiBasecampRute: "",
                      cakupanAktivitas: "",
                      jarakKm: 0,
                    };
                    onUpdateRentalKendaraan({
                      ...rentalKendaraan,
                      timesheet: [...(rentalKendaraan.timesheet || []), newItem],
                    });
                  }}
                  style={{ alignSelf: "flex-start", fontSize: "0.76rem", padding: "4px 10px", marginTop: "4px" }}
                >
                  + Tambah Baris Timesheet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {kategori === "BBM" && (
        <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
            ⛽ Detail Khusus Pengisian BBM
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginBottom: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>KM Saat Isi</label>
              <input
                type="number"
                placeholder="45210"
                value={bbm.kmSaatIsi ?? ""}
                onChange={(e) => onUpdateBBM({ ...bbm, kmSaatIsi: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jarak Tempuh (KM)</label>
              <input
                type="number"
                placeholder="150"
                value={bbm.jarakTempuh ?? ""}
                onChange={(e) => onUpdateBBM({ ...bbm, jarakTempuh: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Dari - Ke (Rute)</label>
              <input
                type="text"
                placeholder="Tanjung Selor - Malinau"
                value={bbm.dari && bbm.ke ? `${bbm.dari} - ${bbm.ke}` : bbm.dari || ""}
                onChange={(e) => {
                  const parts = e.target.value.split("-");
                  onUpdateBBM({
                    ...bbm,
                    dari: parts[0]?.trim() || "",
                    ke: parts[1]?.trim() || "",
                  });
                }}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>No. Polisi Kendaraan</label>
              <input
                type="text"
                placeholder="KU 1234 XX"
                value={bbm.noPolisi || ""}
                onChange={(e) => onUpdateBBM({ ...bbm, noPolisi: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>
        </div>
      )}

      {kategori === "Akomodasi" && (
        <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
            🏨 Detail Khusus Akomodasi &amp; Penginapan
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Nama Penginapan / Rumah Singgah</label>
              <input
                type="text"
                placeholder="Hotel Harmoni / Rumah Pak Kades"
                value={akomodasi.lokasi || ""}
                onChange={(e) => onUpdateAkomodasi({ ...akomodasi, lokasi: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Tanggal Masuk</label>
              <input
                type="date"
                value={akomodasi.tanggalMasuk || ""}
                onChange={(e) => onUpdateAkomodasi({ ...akomodasi, tanggalMasuk: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Tanggal Keluar</label>
              <input
                type="date"
                value={akomodasi.tanggalKeluar || ""}
                onChange={(e) => onUpdateAkomodasi({ ...akomodasi, tanggalKeluar: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jml Malam</label>
              <input
                type="number"
                readOnly
                value={akomodasi.jumlahMalam || 1}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem", background: "rgba(0,0,0,0.1)" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Nama Pemilik / Resepsionis</label>
              <input
                type="text"
                placeholder="Nama Pemilik"
                value={akomodasi.namaPemilik || ""}
                onChange={(e) => onUpdateAkomodasi({ ...akomodasi, namaPemilik: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>No. Telp Pemilik</label>
              <input
                type="tel"
                placeholder="0812xxxx"
                value={akomodasi.noTelp || ""}
                onChange={(e) => onUpdateAkomodasi({ ...akomodasi, noTelp: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>
        </div>
      )}

      {kategori === "Konsumsi" && (
        <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
            🍽️ Detail Khusus Konsumsi Kegiatan
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Penyedia / Rumah Makan</label>
              <input
                type="text"
                placeholder="Catering Berkah / RM Selera"
                value={konsumsi.penyedia || ""}
                onChange={(e) => onUpdateKonsumsi({ ...konsumsi, penyedia: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>No. Telp Penyedia</label>
              <input
                type="tel"
                placeholder="0813xxxx"
                value={konsumsi.noTelp || ""}
                onChange={(e) => onUpdateKonsumsi({ ...konsumsi, noTelp: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Lokasi Pertemuan/Makan</label>
              <input
                type="text"
                placeholder="Balai Desa / Kantor Desa"
                value={konsumsi.lokasi || ""}
                onChange={(e) => onUpdateKonsumsi({ ...konsumsi, lokasi: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jumlah Peserta (Orang)</label>
              <input
                type="number"
                min="1"
                placeholder="15"
                value={konsumsi.jumlahPeserta || ""}
                onChange={(e) => onUpdateKonsumsi({ ...konsumsi, jumlahPeserta: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>
        </div>
      )}

      {kategori === "Perdiem" && (
        <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
            📅 Perdiem (hak uang harian di lapangan)
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "8px" }}>
            <div>
              <label htmlFor="perdiem-hari" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jumlah Hari</label>
              <input
                id="perdiem-hari"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="5"
                value={perdiem.jumlahHari || ""}
                onChange={(e) => ubahPerdiem({ jumlahHari: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label htmlFor="perdiem-tarif" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Tarif per Hari (Rp)</label>
              <input
                id="perdiem-tarif"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="200000"
                value={perdiem.tarifPerHari || ""}
                onChange={(e) => ubahPerdiem({ tarifPerHari: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="perdiem-ket" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Keterangan (wilayah / rentang tanggal)</label>
              <input
                id="perdiem-ket"
                type="text"
                placeholder="Contoh: Kalimantan, 20-24 Sep 2026"
                value={perdiem.keterangan || ""}
                onChange={(e) => ubahPerdiem({ keterangan: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>
          {Number(perdiem.jumlahHari) > 0 && Number(perdiem.tarifPerHari) > 0 && (
            <div style={{ fontSize: "0.82rem" }}>
              {perdiem.jumlahHari} hari × {formatRupiah(Number(perdiem.tarifPerHari))} ={" "}
              <strong>{formatRupiah(Math.round(Number(perdiem.jumlahHari) * Number(perdiem.tarifPerHari)))}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>(mengisi kolom Jumlah)</span>
            </div>
          )}
          <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
            Perdiem ikut dihitung sebagai pengeluaran yang diakui pada penyelesaian akhir dana kegiatan.
          </p>
        </div>
      )}

      {kategori === "Honorarium & Ganti Hari" && (
        <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
            💼 Detail Khusus Honorarium &amp; Perhitungan Pajak
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "10px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Nama Lengkap Penerima</label>
              <input
                type="text"
                placeholder="Nama Penerima"
                value={honorarium.namaPenerima || ""}
                onChange={(e) => onUpdateHonorarium({ ...honorarium, namaPenerima: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Nomor Urut Absen</label>
              <input
                type="text"
                placeholder="No. 01 / Absen 12"
                value={honorarium.nomorAbsen || ""}
                onChange={(e) => onUpdateHonorarium({ ...honorarium, nomorAbsen: e.target.value })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jumlah Orang</label>
              <input
                type="number"
                min="1"
                value={honorarium.jumlahOrang || 1}
                onChange={(e) => onUpdateHonorarium({ ...honorarium, jumlahOrang: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Jumlah Hari</label>
              <input
                type="number"
                min="1"
                value={honorarium.jumlahHari || 1}
                onChange={(e) => onUpdateHonorarium({ ...honorarium, jumlahHari: Number(e.target.value) })}
                style={{ width: "100%", padding: "6px 8px", fontSize: "0.82rem" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={Boolean(honorarium.isPNS)}
                onChange={(e) => onUpdateHonorarium({ ...honorarium, isPNS: e.target.checked })}
                style={{ accentColor: "var(--accent)" }}
              />
              <span>PNS / ASN</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={Boolean(honorarium.hasNPWP)}
                onChange={(e) => onUpdateHonorarium({ ...honorarium, hasNPWP: e.target.checked })}
                style={{ accentColor: "var(--accent)" }}
              />
              <span>Memiliki NPWP</span>
            </label>
          </div>

          {/* Kotak Penghitungan Pajak Otomatis */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              background: "rgba(0,0,0,0.06)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "8px",
              fontSize: "0.82rem",
            }}
          >
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>Honor Bruto:</span>
              <strong>{formatRupiah(pajakHonor.bruto)}</strong>
            </div>
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>
                Potongan Pajak ({pajakHonor.tarifPersen}%):
              </span>
              <strong style={{ color: "var(--keluar)" }}>- {formatRupiah(pajakHonor.potongan)}</strong>
            </div>
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>Netto Diterima:</span>
              <strong style={{ color: "var(--masuk)" }}>{formatRupiah(pajakHonor.netto)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 7. Foto Pendukung Opsional (Barang, Kendaraan, Kegiatan) */}
      <div style={{ background: "var(--surface)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>
            📸 Foto Pendukung Opsional (Barang, Kendaraan, Kegiatan)
          </label>
          <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
            {fotoPendukung.length} foto terlampir
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          <label className="btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>📦 + Foto Barang</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => void handleTambahFotoPendukung(e, "barang")}
            />
          </label>

          <label className="btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>🚗 + Foto Kendaraan</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => void handleTambahFotoPendukung(e, "kendaraan")}
            />
          </label>

          <label className="btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>👥 + Foto Kegiatan</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => void handleTambahFotoPendukung(e, "kegiatan")}
            />
          </label>
        </div>

        {fotoPendukung.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {fotoPendukung.map((foto) => (
              <div
                key={foto.id}
                style={{
                  position: "relative",
                  width: "80px",
                  height: "80px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: "#000",
                }}
              >
                {foto.dataUrl ? (
                  <img src={foto.dataUrl} alt={foto.nama} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.7rem", color: "#fff" }}>
                    📷 Foto
                  </div>
                )}
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: "0.6rem",
                    padding: "1px 2px",
                    textAlign: "center",
                    textTransform: "capitalize",
                  }}
                >
                  {foto.kategoriFoto || "foto"}
                </span>
                <button
                  type="button"
                  onClick={() => handleHapusFotoPendukung(foto.id)}
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    background: "rgba(239,68,68,0.9)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    fontSize: "0.65rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8. Peringatan Ketentuan SPJ (Checklist Ramah & Edukatif) */}
      {daftarPeringatan.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid #f59e0b",
            fontSize: "0.82rem",
          }}
        >
          <strong style={{ color: "#d97706", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span>⚠️</span> Catatan Kepatuhan Bukti Fisik SPJ ({daftarPeringatan.length} catatan):
          </strong>
          <ul style={{ margin: "0", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {daftarPeringatan.map((p, idx) => (
              <li key={idx} style={{ color: "var(--text)" }}>
                <span>{p.pesan}</span>
                {p.rekomendasi && (
                  <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
                    ↳ {p.rekomendasi}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal Buat Kegiatan Baru */}
      {modalKegiatanBaru && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setModalKegiatanBaru(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "460px",
              width: "100%",
              background: "var(--surface)",
              border: "1.5px solid var(--accent)",
              borderRadius: "16px",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📌</span> Buat Data Kegiatan Baru
              </h3>
              <button
                type="button"
                onClick={() => setModalKegiatanBaru(false)}
                style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanKegiatanBaru} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="input-field">
                <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Nama Kegiatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Survei Batas Hutan Desa Long Belaka"
                  value={namaBaru}
                  onChange={(e) => setNamaBaru(e.target.value)}
                  required
                />
              </div>

              <div className="input-field">
                <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Lokasi Kegiatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Desa Long Belaka, Kec. Kayan Hilir"
                  value={lokasiBaru}
                  onChange={(e) => setLokasiBaru(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div className="input-field">
                  <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Tanggal Mulai</label>
                  <input
                    type="date"
                    value={tglMulaiBaru}
                    onChange={(e) => setTglMulaiBaru(e.target.value)}
                    required
                  />
                </div>
                <div className="input-field">
                  <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Tanggal Selesai</label>
                  <input
                    type="date"
                    value={tglSelesaiBaru}
                    onChange={(e) => setTglSelesaiBaru(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ fontSize: "0.78rem", color: "var(--muted)", background: "rgba(0,0,0,0.05)", padding: "8px 10px", borderRadius: "8px" }}>
                ⏳ <strong>Batas penyerahan laporan fisik SPJ:</strong> {hitungBatasLaporanFisik(tglSelesaiBaru).formatTeks} (14 hari setelah tanggal selesai).
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalKegiatanBaru(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  Simpan &amp; Pilih Kegiatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Ketentuan SPJ */}
      {bukaKetentuanModal && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setBukaKetentuanModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "560px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "var(--surface)",
              border: "1.5px solid var(--accent)",
              borderRadius: "16px",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--accent)" }}>
                📖 Ketentuan Pertanggungjawaban SPJ ({kategori})
              </h3>
              <button
                type="button"
                onClick={() => setBukaKetentuanModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            {/* Ketentuan Spesifik Kategori */}
            {KETENTUAN_DANA_KEGIATAN[kategori] && (
              <div style={{ marginBottom: "14px" }}>
                <h4 style={{ margin: "0 0 6px", fontSize: "0.9rem", color: "var(--text)" }}>
                  {KETENTUAN_DANA_KEGIATAN[kategori].judul}
                </h4>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {KETENTUAN_DANA_KEGIATAN[kategori].butir.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ketentuan Umum */}
            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: "10px" }}>
              <h4 style={{ margin: "0 0 6px", fontSize: "0.9rem", color: "var(--text)" }}>
                {KETENTUAN_DANA_KEGIATAN.Umum.judul}
              </h4>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                {KETENTUAN_DANA_KEGIATAN.Umum.butir.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            <div style={{ textAlign: "right", marginTop: "14px" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setBukaKetentuanModal(false)}
                style={{ padding: "6px 16px", fontSize: "0.82rem" }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
