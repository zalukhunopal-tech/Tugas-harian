import React, { useState, useMemo, useEffect } from "react";
import { Transaksi, NamaDana, ProfilPelapor, DataKegiatan } from "../types";
import {
  formatRupiah,
  formatAngka,
  hariIni,
  formatRentangTanggal,
  formatTanggalPanjang,
  PROFIL_PELAPOR_DEFAULT,
  KELOMPOK_DANA_KEGIATAN,
  LAPORAN_AGENDA_KEY,
  labelKategori,
} from "../lib/constants";
import { bacaJsonStorage, tulisStorage } from "../lib/storage";
import { Pencil } from "lucide-react";
import { DokumenSiapCetak } from "./DokumenSiapCetak";
import { KartuPenyelesaianDana } from "./KartuPenyelesaianDana";
import { KartuTimesheet } from "./KartuTimesheet";
import { KartuTimesheetDrive } from "./KartuTimesheetDrive";
import { hitungPenyelesaian, kegiatanBerjalanDalam, susunTransaksiPenyelesaian, transaksiKegiatan } from "../lib/penyelesaianDana";
import { CATATAN_SPJ_FISIK } from "../lib/ketentuanKegiatan";
import { satukanKegiatanKembar } from "../lib/kegiatanSama";
import { buatDokumenLaporanKegiatanDocx, unduhFileBlob } from "../lib/docxGenerator";
import {
  cariFolderKeuangan,
  dapatkanFolderLaporanKegiatan,
  simpanDocxLaporanKeDrive,
} from "../lib/gdriveSync";

interface LaporanViewProps {
  transaksi: Transaksi[];
  profilPelapor?: ProfilPelapor;
  daftarKegiatan?: DataKegiatan[];
  onUpdateKegiatan?: (kegiatan: DataKegiatan) => void;
  onSimpanProfilPelapor?: (profil: ProfilPelapor) => void;
  onTambahKegiatan?: (kegiatan: DataKegiatan) => void;
  googleToken?: string;
  isLoggedInGoogle?: boolean;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  transaksi,
  profilPelapor = PROFIL_PELAPOR_DEFAULT,
  daftarKegiatan = [],
  onUpdateKegiatan,
  onSimpanProfilPelapor,
  onTambahKegiatan,
  googleToken,
  isLoggedInGoogle,
}) => {
  // 1. Pilihan filter
  const [dana, setDana] = useState<string>("Dana Kegiatan"); // default Dana Kegiatan
  const [pilihKegiatanId, setPilihKegiatanId] = useState<string>("");
  const [sedangProsesDocx, setSedangProsesDocx] = useState<boolean>(false);
  const [pesanStatusDocx, setPesanStatusDocx] = useState<{ teks: string; tipe: "sukses" | "error" | "info" } | null>(null);
  const [panelWiMISBuka, setPanelWiMISBuka] = useState<boolean>(true);
  
  // Default rentang tanggal: awal bulan ini sampai hari ini
  const tglSekarang = hariIni();
  const awalBulanIni = `${tglSekarang.slice(0, 7)}-01`;
  const [tglMulai, setTglMulai] = useState<string>(awalBulanIni);
  const [tglSelesai, setTglSelesai] = useState<string>(tglSekarang);

  // "Kaitan / Agenda" di kop laporan: otomatis dari pilihan kegiatan, tetapi bisa diubah. Teks yang diubah
  // disimpan di browser per kegiatan, jadi tidak hilang saat berpindah laporan.
  const [agendaKustom, setAgendaKustom] = useState<Record<string, string>>(() => {
    const data = bacaJsonStorage<Record<string, string>>(LAPORAN_AGENDA_KEY, {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  });
  const [sedangUbahAgenda, setSedangUbahAgenda] = useState<boolean>(false);
  const [draftAgenda, setDraftAgenda] = useState<string>("");

  // Preset Rentang Tanggal Cepat
  const terapkanPreset = (tipe: "bulan-ini" | "bulan-lalu" | "tahun-ini" | "semua") => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (tipe === "bulan-ini") {
      setTglMulai(`${y}-${String(m + 1).padStart(2, "0")}-01`);
      setTglSelesai(hariIni());
    } else if (tipe === "bulan-lalu") {
      const dLalu = new Date(y, m - 1, 1);
      const akhirLalu = new Date(y, m, 0);
      setTglMulai(dLalu.toISOString().slice(0, 10));
      setTglSelesai(akhirLalu.toISOString().slice(0, 10));
    } else if (tipe === "tahun-ini") {
      setTglMulai(`${y}-01-01`);
      setTglSelesai(hariIni());
    } else if (tipe === "semua") {
      setTglMulai("2020-01-01");
      setTglSelesai(hariIni());
    }
  };

  const kegiatanTerpilih = useMemo(() => {
    return daftarKegiatan.find((k) => k.id === pilihKegiatanId);
  }, [daftarKegiatan, pilihKegiatanId]);
  // "Pilih Kegiatan Lapangan": kegiatan yang sama dari Penerimaan Dana dan Timesheet tampil sebagai satu pilihan.
  const daftarPilihan = useMemo(() => satukanKegiatanKembar(daftarKegiatan).daftar, [daftarKegiatan]);

  // Transaksi milik kegiatan terpilih: yang dikaitkan, ditambah dana awal dan perdiem dalam rentang kegiatan yang belum dikaitkan.
  const idTransaksiKegiatanTerpilih = useMemo(
    () => (kegiatanTerpilih ? new Set(transaksiKegiatan(transaksi, kegiatanTerpilih, daftarKegiatan).map((t) => t.id)) : new Set<string>()),
    [transaksi, kegiatanTerpilih, daftarKegiatan]
  );

  // Pengeluaran pra-kegiatan (tiket berangkat, belanja logistik awal, kudapan keberangkatan) bertanggal sebelum tanggal mulai
  // kegiatan. Saat sebuah kegiatan dipilih, "Dari Tanggal" otomatis sama dengan tanggal mulainya, sehingga batas bawah itu
  // tidak boleh membuang transaksi milik kegiatan tersebut: semuanya ikut dan diurutkan menurut tanggal transaksi.
  const tglMulaiLaporan = useMemo(() => {
    if (!kegiatanTerpilih) return tglMulai;
    let awal = tglMulai;
    for (const t of transaksi) {
      if (dana !== "Semua" && t.dana !== dana) continue;
      const milik = t.kegiatanId === pilihKegiatanId || t.kaitan === kegiatanTerpilih.nama || idTransaksiKegiatanTerpilih.has(t.id);
      if (milik && t.tanggal < awal) awal = t.tanggal;
    }
    return awal;
  }, [transaksi, dana, tglMulai, pilihKegiatanId, kegiatanTerpilih, idTransaksiKegiatanTerpilih]);
  const adaPraKegiatan = tglMulaiLaporan < tglMulai;

  // Kunci lama berakhiran "|Semua" dipertahankan supaya agenda yang pernah diubah pengguna tidak hilang.
  const kunciAgenda = `${pilihKegiatanId}|Semua`;
  const agendaOtomatis = kegiatanTerpilih ? kegiatanTerpilih.nama : "Seluruh Kegiatan";
  const agendaTersimpan = agendaKustom[kunciAgenda];
  const agendaTampil = agendaTersimpan || agendaOtomatis;

  useEffect(() => {
    setSedangUbahAgenda(false);
  }, [kunciAgenda]);

  const simpanAgendaKustom = (nilai: Record<string, string>) => {
    setAgendaKustom(nilai);
    tulisStorage(LAPORAN_AGENDA_KEY, JSON.stringify(nilai));
  };

  const mulaiUbahAgenda = () => {
    setDraftAgenda(agendaTampil);
    setSedangUbahAgenda(true);
  };

  const terapkanAgenda = () => {
    const teks = draftAgenda.trim().replace(/\s+/g, " ");
    const baru = { ...agendaKustom };
    if (!teks || teks === agendaOtomatis) delete baru[kunciAgenda];
    else baru[kunciAgenda] = teks;
    simpanAgendaKustom(baru);
    setSedangUbahAgenda(false);
  };

  const kembalikanAgendaOtomatis = () => {
    const baru = { ...agendaKustom };
    delete baru[kunciAgenda];
    simpanAgendaKustom(baru);
    setSedangUbahAgenda(false);
  };

  // 2. Perhitungan Saldo Awal (sebelum tglMulai)
  const saldoAwal = useMemo(() => {
    return transaksi
      .filter((t) => {
        if (dana !== "Semua" && t.dana !== dana) return false;
        if (pilihKegiatanId) {
          const cocokId = t.kegiatanId === pilihKegiatanId;
          const cocokNama = kegiatanTerpilih && t.kaitan === kegiatanTerpilih.nama;
          if (!cocokId && !cocokNama && !idTransaksiKegiatanTerpilih.has(t.id)) return false;
        }
        return t.tanggal < tglMulaiLaporan;
      })
      .reduce((acc, t) => {
        return acc + (t.jenis === "pemasukan" ? t.jumlah : -t.jumlah);
      }, 0);
  }, [transaksi, dana, tglMulaiLaporan, pilihKegiatanId, kegiatanTerpilih, idTransaksiKegiatanTerpilih]);

  // Transaksi dalam rentang tanggal dan kegiatan terpilih
  const transaksiLaporan = useMemo(() => {
    return transaksi
      .filter((t) => {
        if (dana !== "Semua" && t.dana !== dana) return false;
        if (pilihKegiatanId) {
          const cocokId = t.kegiatanId === pilihKegiatanId;
          const cocokNama = kegiatanTerpilih && t.kaitan === kegiatanTerpilih.nama;
          if (!cocokId && !cocokNama && !idTransaksiKegiatanTerpilih.has(t.id)) return false;
        }
        return t.tanggal >= tglMulaiLaporan && t.tanggal <= tglSelesai;
      })
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [transaksi, dana, tglMulaiLaporan, tglSelesai, pilihKegiatanId, kegiatanTerpilih, idTransaksiKegiatanTerpilih]);

  // Total Penerimaan & Pengeluaran dalam periode (Kategori Pindah Dana tidak dihitung)
  const totalPenerimaan = useMemo(() => {
    return transaksiLaporan
      .filter((t) => t.jenis === "pemasukan" && t.kategori !== "Pindah Dana")
      .reduce((sum, t) => sum + t.jumlah, 0);
  }, [transaksiLaporan]);

  const totalPengeluaran = useMemo(() => {
    return transaksiLaporan
      .filter((t) => t.jenis === "pengeluaran" && t.kategori !== "Pindah Dana")
      .reduce((sum, t) => sum + t.jumlah, 0);
  }, [transaksiLaporan]);

  // Arus bersih Pindah Dana untuk penghitungan saldo akhir per dana
  const netPindahDana = useMemo(() => {
    return transaksiLaporan
      .filter((t) => t.kategori === "Pindah Dana")
      .reduce((acc, t) => acc + (t.jenis === "pemasukan" ? t.jumlah : -t.jumlah), 0);
  }, [transaksiLaporan]);

  const saldoAkhir = saldoAwal + totalPenerimaan - totalPengeluaran + netPindahDana;

  // Breakdown Pengeluaran per Kategori (Kategori Pindah Dana tidak dihitung)
  const pengeluaranPerKategori = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transaksiLaporan) {
      if (t.jenis === "pengeluaran" && t.kategori !== "Pindah Dana") {
        map.set(t.kategori, (map.get(t.kategori) || 0) + t.jumlah);
      }
    }
    const arr = Array.from(map.entries()).map(([kategori, total]) => ({
      kategori,
      total,
      persen: totalPengeluaran > 0 ? (total / totalPengeluaran) * 100 : 0,
    }));
    return arr.sort((a, b) => b.total - a.total);
  }, [transaksiLaporan, totalPengeluaran]);

  // Peringatan transaksi pengeluaran tanpa bukti
  const pengeluaranTanpaBukti = useMemo(() => {
    return transaksiLaporan.filter(
      (t) => t.jenis === "pengeluaran" && (!t.bukti || t.bukti.length === 0)
    );
  }, [transaksiLaporan]);

  // 3. Unduh CSV / Excel
  const handleUnduhCSV = () => {
    const judul = dana === "Dana Kegiatan" ? "Laporan Penggunaan Dana Kegiatan" : `Laporan Keuangan (${dana})`;
    const barisMeta = [
      [judul],
      [`Periode: ${tglMulaiLaporan} s.d. ${tglSelesai}`],
      [`Kegiatan: ${kegiatanTerpilih ? kegiatanTerpilih.nama : "Semua Kegiatan"}`],
      [`Tanggal Dibuat: ${new Date().toLocaleString("id-ID")}`],
      [],
      ["RINGKASAN LAPORAN"],
      ["Saldo Awal (Sebelum Periode)", saldoAwal],
      ["Total Penerimaan", totalPenerimaan],
      ["Total Pengeluaran", totalPengeluaran],
      ["Saldo Akhir", saldoAkhir],
      [],
      ["RINCIAN PENGELUARAN PER KATEGORI"],
      ["Kategori", "Jumlah (Rp)", "Persentase (%)"],
      ...pengeluaranPerKategori.map((k) => [
        `"${labelKategori(k.kategori).replace(/"/g, '""')}"`,
        k.total,
        `${k.persen.toFixed(1)}%`,
      ]),
      [],
      ["TABEL TRANSAKSI"],
      [
        "No",
        "Tanggal",
        "Uraian",
        "Kategori",
        "Dana",
        "Pemasukan (Rp)",
        "Pengeluaran (Rp)",
        "Metode Bayar",
        "Bukti Transaksi (Ada/Tidak)",
        "Link Bukti Drive",
      ],
      ...transaksiLaporan.map((t, idx) => {
        const adaBukti = t.bukti && t.bukti.length > 0;
        const linkBukti = (t.bukti || []).map((b) => b.driveLink || "").filter(Boolean).join(" ; ");
        return [
          idx + 1,
          t.tanggal,
          `"${(t.deskripsi || "").replace(/"/g, '""')}"`,
          `"${labelKategori(t.kategori || "").replace(/"/g, '""')}"`,
          `"${(t.dana || "").replace(/"/g, '""')}"`,
          t.jenis === "pemasukan" ? t.jumlah : "",
          t.jenis === "pengeluaran" ? t.jumlah : "",
          `"${(t.metode || "Tunai").replace(/"/g, '""')}"`,
          adaBukti ? `Ada (${t.bukti?.length || 0})` : "Belum Ada",
          `"${linkBukti.replace(/"/g, '""')}"`,
        ];
      }),
    ];

    const csvKonten = "\uFEFF" + barisMeta.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvKonten], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${dana.toLowerCase().replace(/\s+/g, "-")}-${tglMulaiLaporan}-sd-${tglSelesai}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Transaksi pengeluaran khusus kegiatan terpilih untuk pengurutan manual WiMIS
  const transaksiPengeluaranKegiatan = useMemo(() => {
    if (!kegiatanTerpilih) return [];
    return transaksi.filter((t) => {
      if (t.jenis !== "pengeluaran") return false;
      const cocokId = t.kegiatanId === kegiatanTerpilih.id;
      const cocokNama = t.kaitan === kegiatanTerpilih.nama && t.dana === "Dana Kegiatan";
      return cocokId || cocokNama || idTransaksiKegiatanTerpilih.has(t.id);
    });
  }, [transaksi, kegiatanTerpilih, idTransaksiKegiatanTerpilih]);

  // Transaksi pengeluaran terurut menurut urutan WiMIS (atau default kelompok lalu tanggal)
  const transaksiPengeluaranTerurut = useMemo(() => {
    const list = [...transaksiPengeluaranKegiatan];
    const urutanMap = new Map<string, number>();
    if (kegiatanTerpilih?.urutanTransaksi) {
      kegiatanTerpilih.urutanTransaksi.forEach((id, idx) => urutanMap.set(id, idx));
    }

    return list.sort((a, b) => {
      const posA = urutanMap.has(a.id) ? urutanMap.get(a.id)! : 999999;
      const posB = urutanMap.has(b.id) ? urutanMap.get(b.id)! : 999999;
      if (posA !== posB) return posA - posB;

      // Default: Urut menurut urutan kelompok lalu tanggal (Requirement 3.c)
      const katA = KELOMPOK_DANA_KEGIATAN.indexOf(a.kategori as any);
      const katB = KELOMPOK_DANA_KEGIATAN.indexOf(b.kategori as any);
      const idxA = katA >= 0 ? katA : 999;
      const idxB = katB >= 0 ? katB : 999;
      if (idxA !== idxB) return idxA - idxB;
      return a.tanggal.localeCompare(b.tanggal);
    });
  }, [transaksiPengeluaranKegiatan, kegiatanTerpilih]);

  const handleGeserUrutanWiMIS = (trxId: string, arah: "atas" | "bawah") => {
    if (!kegiatanTerpilih || !onUpdateKegiatan) return;
    const currentIds = transaksiPengeluaranTerurut.map((t) => t.id);
    const idx = currentIds.indexOf(trxId);
    if (idx < 0) return;
    const targetIdx = arah === "atas" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentIds.length) return;

    const newIds = [...currentIds];
    const temp = newIds[idx];
    newIds[idx] = newIds[targetIdx];
    newIds[targetIdx] = temp;

    onUpdateKegiatan({
      ...kegiatanTerpilih,
      urutanTransaksi: newIds,
    });
  };

  const handleResetUrutanWiMIS = () => {
    if (!kegiatanTerpilih || !onUpdateKegiatan) return;
    onUpdateKegiatan({
      ...kegiatanTerpilih,
      urutanTransaksi: [],
    });
  };

  const handleToggleDaftarPeriksa = (checked: boolean) => {
    if (!kegiatanTerpilih || !onUpdateKegiatan) return;
    onUpdateKegiatan({
      ...kegiatanTerpilih,
      sertakanDaftarPeriksa: checked,
    });
  };

  // Unduh Laporan format Word (.docx) dengan tempel bukti & auto-sync ke Google Drive
  const handleUnduhDocx = async () => {
    if (!kegiatanTerpilih) {
      alert("Silakan pilih Kegiatan Lapangan terlebih dahulu untuk mengunduh Laporan Word.");
      return;
    }

    setSedangProsesDocx(true);
    setPesanStatusDocx({
      teks: "Menyusun dokumen Word SPJ (memproses foto bukti, kotak tempel & kelengkapan)...",
      tipe: "info",
    });

    try {
      const blob = await buatDokumenLaporanKegiatanDocx({
        transaksi,
        kegiatan: kegiatanTerpilih,
        daftarKegiatan,
        profilPelapor,
        urutanTransaksiIds: kegiatanTerpilih.urutanTransaksi,
        sertakanDaftarPeriksa: kegiatanTerpilih.sertakanDaftarPeriksa !== false,
        googleToken,
      });

      // Format nama file unduhan: "Laporan Keuangan – <nama kegiatan> – <periode>.docx"
      const periodeStr = `${kegiatanTerpilih.tanggalMulai}_sd_${kegiatanTerpilih.tanggalSelesai}`;
      const namaFileUnduhan = `Laporan Keuangan – ${kegiatanTerpilih.nama} – ${periodeStr}.docx`;
      unduhFileBlob(blob, namaFileUnduhan);

      // Simpan atau perbarui file di Drive jika Google Token tersedia
      if (googleToken) {
        try {
          setPesanStatusDocx({
            teks: "Menyimpan salinan ke Google Drive: Keuangan / Laporan Kegiatan / ...",
            tipe: "info",
          });
          const folderKeuangan = await cariFolderKeuangan(googleToken);
          if (folderKeuangan) {
            const folderLaporan = await dapatkanFolderLaporanKegiatan(googleToken, folderKeuangan.id);
            const namaFileDrive = `Laporan Keuangan – ${kegiatanTerpilih.nama}.docx`;
            const resDrive = await simpanDocxLaporanKeDrive(
              googleToken,
              folderLaporan.id,
              namaFileDrive,
              blob,
              kegiatanTerpilih.docxDriveId
            );
            if (resDrive.id && resDrive.id !== kegiatanTerpilih.docxDriveId && onUpdateKegiatan) {
              onUpdateKegiatan({
                ...kegiatanTerpilih,
                docxDriveId: resDrive.id,
              });
            }
            setPesanStatusDocx({
              teks: `Berhasil diunduh dan tersimpan di Drive: ${namaFileDrive}`,
              tipe: "sukses",
            });
            setTimeout(() => setPesanStatusDocx(null), 4000);
            return;
          }
        } catch (errDrive: any) {
          console.warn("Gagal simpan ke Drive saat unduh Word:", errDrive);
          setPesanStatusDocx({
            teks: `File Word terunduh. (Sinkron Drive gagal: ${errDrive.message})`,
            tipe: "info",
          });
          setTimeout(() => setPesanStatusDocx(null), 5000);
          return;
        }
      }

      setPesanStatusDocx({ teks: `Berhasil mengunduh ${namaFileUnduhan}`, tipe: "sukses" });
      setTimeout(() => setPesanStatusDocx(null), 3500);
    } catch (err: any) {
      console.error("Gagal membuat dokumen Word:", err);
      setPesanStatusDocx({ teks: `Gagal membuat dokumen Word: ${err.message}`, tipe: "error" });
    } finally {
      setSedangProsesDocx(false);
    }
  };

  const judulLaporan =
    dana === "Dana Kegiatan"
      ? "Laporan Penggunaan Dana Kegiatan"
      : `Laporan Keuangan ${dana}`;

  // Penyelesaian akhir dana kegiatan (cash advance). Dihitung dari SEMUA transaksi kegiatan yang tercakup, tidak
  // dibatasi rentang tanggal laporan, karena dana awal biasanya diterima sebelum periode yang dipilih. Kegiatan yang
  // tercakup: yang dipilih, atau (bila tidak ada pilihan) yang berjalan dalam periode laporan. Penerimaan dana pada rentang
  // kegiatan, atau sebelum tanggal mulainya (pra-kegiatan), ikut sebagai dana awal walau belum dikaitkan (lihat penyelesaianDana).
  const kegiatanTercakup = useMemo(() => {
    if (dana !== "Dana Kegiatan") return [];
    if (kegiatanTerpilih) return [kegiatanTerpilih];
    return kegiatanBerjalanDalam(daftarKegiatan, tglMulai, tglSelesai);
  }, [dana, kegiatanTerpilih, daftarKegiatan, tglMulai, tglSelesai]);

  const transaksiPenyelesaian = useMemo(
    () => susunTransaksiPenyelesaian(transaksi, kegiatanTerpilih ? [] : transaksiLaporan, kegiatanTercakup, daftarKegiatan),
    [transaksi, transaksiLaporan, kegiatanTerpilih, kegiatanTercakup, daftarKegiatan]
  );
  const namaCakupan = kegiatanTercakup.length > 0 ? kegiatanTercakup.map((k) => k.nama).join(", ") : undefined;
  const rentangCakupan =
    kegiatanTercakup.length === 1
      ? formatRentangTanggal(kegiatanTercakup[0].tanggalMulai, kegiatanTercakup[0].tanggalSelesai)
      : undefined;

  const penyelesaian = useMemo(() => {
    if (dana !== "Dana Kegiatan") return null;
    const hasil = hitungPenyelesaian(transaksiPenyelesaian);
    // Tanpa transaksi satu pun, "dana awal sama dengan pengeluaran" (0 = 0) hanya menyesatkan.
    return hasil.jumlahTransaksi > 0 ? hasil : null;
  }, [dana, transaksiPenyelesaian]);
  const penyelesaianSementara = kegiatanTercakup.some((k) => k.tanggalSelesai >= hariIni());
  const periodeTeks = `Periode laporan: ${formatRentangTanggal(tglMulaiLaporan, tglSelesai)}${
    adaPraKegiatan ? ` (termasuk pengeluaran pra-kegiatan sebelum ${formatTanggalPanjang(tglMulai)})` : ""
  }`;

  return (
    <div className="laporan-container" style={{ width: "100%" }}>
      {/* ===== KARTU FILTER LAPORAN ===== */}
      <div className="card no-print" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>📋 Parameter Laporan</h2>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
              Saring pembukuan berdasarkan jenis dana, rentang tanggal, dan kegiatan lapangan.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleUnduhCSV}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "8px 14px" }}
            >
              📊 Unduh CSV
            </button>
          </div>
        </div>

        {/* Pilihan Dana */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
            Pilih Dana
          </label>
          <div className="filter-chips" style={{ margin: 0 }}>
            <button
              type="button"
              className="chip"
              data-dana="Dana Kegiatan"
              aria-checked={dana === "Dana Kegiatan"}
              onClick={() => setDana("Dana Kegiatan")}
            >
              Dana Kegiatan
            </button>
            <button
              type="button"
              className="chip"
              data-dana="Dana Pribadi"
              aria-checked={dana === "Dana Pribadi"}
              onClick={() => setDana("Dana Pribadi")}
            >
              Dana Pribadi
            </button>
            <button
              type="button"
              className="chip"
              data-dana="Semua"
              aria-checked={dana === "Semua"}
              onClick={() => setDana("Semua")}
            >
              Semua Dana
            </button>
          </div>
        </div>

        {/* Rentang Tanggal & Preset */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label htmlFor="lap-tgl-mulai" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
              Dari Tanggal
            </label>
            <input
              type="date"
              id="lap-tgl-mulai"
              value={tglMulai}
              onChange={(e) => setTglMulai(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label htmlFor="lap-tgl-selesai" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
              Sampai Tanggal
            </label>
            <input
              type="date"
              id="lap-tgl-selesai"
              value={tglSelesai}
              onChange={(e) => setTglSelesai(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>
        </div>

        {/* Preset Cepat Tanggal */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)", marginRight: "4px" }}>Periode cepat:</span>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("bulan-ini")}>
            Bulan Ini
          </button>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("bulan-lalu")}>
            Bulan Lalu
          </button>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("tahun-ini")}>
            Tahun Ini
          </button>
          <button type="button" className="btn-small" onClick={() => terapkanPreset("semua")}>
            Sepanjang Waktu
          </button>
        </div>

        {adaPraKegiatan && (
          <p className="laporan-pra-kegiatan no-print" role="status" data-testid="info-pra-kegiatan">
            Kegiatan dimulai {formatTanggalPanjang(tglMulai)}. Laporan tetap memuat {transaksiLaporan.filter((t) => t.tanggal < tglMulai).length} transaksi
            pra-kegiatan sejak {formatTanggalPanjang(tglMulaiLaporan)} (mis. penerimaan dana, tiket keberangkatan, dan belanja awal).
          </p>
        )}

        {/* Kaitan Kegiatan / Kegiatan Lapangan */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "6px" }}>
          {dana === "Dana Kegiatan" && daftarKegiatan.length > 0 && (
            <div>
              <label htmlFor="lap-kegiatan-select" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
                Pilih Kegiatan Lapangan
              </label>
              <select
                id="lap-kegiatan-select"
                value={pilihKegiatanId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPilihKegiatanId(id);
                  const kg = daftarKegiatan.find((k) => k.id === id);
                  if (kg) {
                    setTglMulai(kg.tanggalMulai);
                    setTglSelesai(kg.tanggalSelesai);
                  }
                }}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
              >
                <option value="">Semua Kegiatan Lapangan</option>
                {daftarPilihan.map((k) => (
                  <option key={k.id} value={k.id}>
                    📌 {k.nama} ({k.lokasi || "Lokasi tidak dicatat"})
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>
        {dana === "Dana Kegiatan" && kegiatanTerpilih && (
          <p className="catatan-spj-fisik" data-testid="catatan-spj-fisik">
            {CATATAN_SPJ_FISIK}
          </p>
        )}
      </div>

      {/* ===== TIMESHEET DI DRIVE: hanya bila belum ada data kegiatan sama sekali; buat kegiatan dari file timesheet ===== */}
      {dana === "Dana Kegiatan" && daftarKegiatan.length === 0 && (
        <KartuTimesheetDrive
          daftarKegiatan={daftarKegiatan}
          googleToken={googleToken}
          isLoggedInGoogle={isLoggedInGoogle}
          onTambahKegiatan={onTambahKegiatan}
        />
      )}

      {/* ===== KARTU TIMESHEET PERDIEM (keterangan kegiatan lapangan per hari) ===== */}
      {dana === "Dana Kegiatan" && kegiatanTerpilih && (
        <KartuTimesheet
          kegiatan={kegiatanTerpilih}
          daftarKegiatan={daftarKegiatan}
          transaksi={transaksi}
          profilPelapor={profilPelapor}
          googleToken={googleToken}
          isLoggedInGoogle={isLoggedInGoogle}
          onUpdateKegiatan={onUpdateKegiatan}
          onSimpanProfilPelapor={onSimpanProfilPelapor}
        />
      )}

      {/* ===== KARTU KELENGKAPAN SPJ & PENGURUTAN MANUAL WiMIS (DOKUMEN WORD) ===== */}
      {dana === "Dana Kegiatan" && kegiatanTerpilih && (
        <div className="card no-print" style={{ marginBottom: "20px", border: "1.5px solid var(--accent)", borderRadius: "12px", background: "var(--surface)" }}>
          <div
            style={{
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              cursor: "pointer",
              borderBottom: panelWiMISBuka ? "1px solid var(--border)" : "none",
            }}
            onClick={() => setPanelWiMISBuka(!panelWiMISBuka)}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>📝</span>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
                  Dokumen Word SPJ WiMIS &amp; Pengurutan Bukti
                </h3>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  {transaksiPengeluaranTerurut.length} Bukti Kuitansi
                </span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                Sesuaikan urutan bukti agar sama persis dengan urutan input di WiMIS. Nomor urut (1..N) ini otomatis dipakai di seluruh dokumen Word.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  setPanelWiMISBuka(!panelWiMISBuka);
                }}
              >
                {panelWiMISBuka ? "Tutup ▲" : "Buka Urutan ▼"}
              </button>
            </div>
          </div>

          {panelWiMISBuka && (
            <div style={{ padding: "16px 18px" }}>
              {/* Opsi Checklist Halaman Terakhir */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  marginBottom: "16px",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", margin: 0, fontSize: "0.85rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={kegiatanTerpilih.sertakanDaftarPeriksa !== false}
                    onChange={(e) => handleToggleDaftarPeriksa(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <span>Sertakan Halaman <strong>Daftar Periksa Kelengkapan</strong> (Checklist SPJ) di halaman terakhir Word</span>
                </label>
                <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
                  (Dapat dimatikan bila tidak perlu dicetak)
                </span>
              </div>

              {/* Tabel / Daftar Pengurutan WiMIS */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                    Urutan Bukti Transaksi Pengeluaran:
                  </span>
                  {kegiatanTerpilih.urutanTransaksi && kegiatanTerpilih.urutanTransaksi.length > 0 && (
                    <button
                      type="button"
                      className="btn-small"
                      onClick={handleResetUrutanWiMIS}
                      style={{ fontSize: "0.74rem", color: "var(--muted)" }}
                      title="Kembalikan urutan otomatis berdasarkan kelompok lalu tanggal"
                    >
                      ↺ Kembalikan ke Urutan Standar
                    </button>
                  )}
                </div>

                {transaksiPengeluaranTerurut.length === 0 ? (
                  <p style={{ margin: "8px 0", fontSize: "0.82rem", color: "var(--muted)", fontStyle: "italic" }}>
                    Belum ada transaksi pengeluaran pada kegiatan ini.
                  </p>
                ) : (
                  <div style={{ maxHeight: "320px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                          <th style={{ padding: "8px 10px", width: "50px", textAlign: "center" }}>No</th>
                          <th style={{ padding: "8px 10px", width: "95px" }}>Tanggal</th>
                          <th style={{ padding: "8px 10px" }}>Uraian Bukti</th>
                          <th style={{ padding: "8px 10px", width: "130px" }}>Kelompok</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", width: "110px" }}>Nominal</th>
                          <th style={{ padding: "8px 10px", textAlign: "center", width: "90px" }}>Urut WiMIS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transaksiPengeluaranTerurut.map((item, idx) => (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              background: idx % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--surface) 60%, transparent)",
                            }}
                          >
                            <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 800, color: "var(--accent)" }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "7px 10px", color: "var(--muted)" }}>
                              {item.tanggal}
                            </td>
                            <td style={{ padding: "7px 10px", fontWeight: 600 }}>
                              {item.deskripsi}
                            </td>
                            <td style={{ padding: "7px 10px" }}>
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--bg)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                {labelKategori(item.kategori)}
                              </span>
                            </td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "var(--keluar)" }}>
                              {formatRupiah(item.jumlah)}
                            </td>
                            <td style={{ padding: "7px 10px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: "4px" }}>
                                <button
                                  type="button"
                                  className="btn-small"
                                  disabled={idx === 0}
                                  onClick={() => handleGeserUrutanWiMIS(item.id, "atas")}
                                  style={{ padding: "2px 6px", fontSize: "0.75rem", opacity: idx === 0 ? 0.3 : 1 }}
                                  title="Geser ke atas"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="btn-small"
                                  disabled={idx === transaksiPengeluaranTerurut.length - 1}
                                  onClick={() => handleGeserUrutanWiMIS(item.id, "bawah")}
                                  style={{ padding: "2px 6px", fontSize: "0.75rem", opacity: idx === transaksiPengeluaranTerurut.length - 1 ? 0.3 : 1 }}
                                  title="Geser ke bawah"
                                >
                                  ▼
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== LEMBAR LAPORAN RESMI: hanya dokumen siap cetak yang tercetak; kop, ringkasan, dan kartu di atasnya khusus layar ===== */}
      <div className="card printable-report" style={{ padding: "24px", marginBottom: "24px" }}>
        {/* KOP / JUDUL LAPORAN */}
        <header className="report-header laporan-kop no-print">
          <div className="laporan-kop__jenis">Dokumen Laporan Pertanggungjawaban (SPJ)</div>
          <h1 className="laporan-kop__judul">{judulLaporan}</h1>
          <dl className="laporan-kop__data">
            <div>
              <dt>Periode</dt>
              <dd>
                {formatRentangTanggal(tglMulaiLaporan, tglSelesai)}
                {adaPraKegiatan && <span className="laporan-kop__catatan"> · termasuk pengeluaran pra-kegiatan</span>}
              </dd>
            </div>
            <div>
              <dt>Kaitan / Agenda</dt>
              <dd className="laporan-kop__agenda">
                {sedangUbahAgenda ? (
                  <form
                    className="laporan-kop__agenda-form no-print"
                    onSubmit={(e) => {
                      e.preventDefault();
                      terapkanAgenda();
                    }}
                  >
                    <input
                      id="lap-agenda-input"
                      type="text"
                      value={draftAgenda}
                      onChange={(e) => setDraftAgenda(e.target.value)}
                      placeholder={agendaOtomatis}
                      maxLength={500}
                      aria-label="Kaitan / Agenda"
                      autoFocus
                    />
                    <button type="submit" className="btn-small">
                      Simpan
                    </button>
                    <button type="button" className="laporan-kop__agenda-batal" onClick={() => setSedangUbahAgenda(false)}>
                      Batal
                    </button>
                    {agendaTersimpan && (
                      <button type="button" className="laporan-kop__agenda-batal" onClick={kembalikanAgendaOtomatis}>
                        Kembalikan otomatis
                      </button>
                    )}
                  </form>
                ) : (
                  <>
                    <span id="lap-agenda-teks">
                      {agendaTampil.includes(" ") ? agendaTampil.slice(0, agendaTampil.lastIndexOf(" ") + 1) : ""}
                      {/* Kata terakhir dan pensil tidak dipisah baris, supaya pensil tidak sendirian di baris baru. */}
                      <span className="laporan-kop__agenda-akhir">
                        {agendaTampil.slice(agendaTampil.lastIndexOf(" ") + 1)}
                        <button
                          type="button"
                          className="laporan-kop__agenda-ubah no-print"
                          onClick={mulaiUbahAgenda}
                          aria-label="Ubah Kaitan / Agenda"
                          title="Ubah Kaitan / Agenda"
                        >
                          <Pencil size={13} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      </span>
                    </span>
                  </>
                )}
              </dd>
            </div>
            {kegiatanTerpilih?.lokasi && (
              <div>
                <dt>Lokasi</dt>
                <dd>{kegiatanTerpilih.lokasi}</dd>
              </div>
            )}
            <div>
              <dt>Dicetak</dt>
              <dd>{formatTanggalPanjang(hariIni())}</dd>
            </div>
          </dl>
        </header>

        {/* Profil Pelapor & Batas Penyerahan Laporan Fisik */}
        {dana === "Dana Kegiatan" && (
          <div
            className="no-print"
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
              border: "1.5px solid var(--accent)",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", fontWeight: 700 }}>
                Pelapor / Penanggung Jawab Lapangan:
              </div>
              {profilPelapor.nama ? (
                <>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: "2px" }}>
                    {profilPelapor.nama}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {profilPelapor.jabatan} · {profilPelapor.lembaga} (Proyek: {profilPelapor.proyek})
                  </div>
                </>
              ) : (
                <div id="profil-belum-diisi" style={{ fontSize: "0.88rem", marginTop: "2px", color: "var(--text-muted)" }}>
                  Profil Pelapor belum diisi. Isi di bagian Profil Pelapor di atas supaya nama Anda tercantum di laporan.
                </div>
              )}
            </div>

          </div>
        )}

        {/* PERINGATAN TRANSAKSI TANPA BUKTI */}
        {pengeluaranTanpaBukti.length > 0 && (
          <div
            className="no-print"
            style={{
              marginBottom: "20px",
              padding: "12px 16px",
              borderRadius: "10px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1.5px solid #f59e0b",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>⚠️</span>
            <div style={{ fontSize: "0.86rem" }}>
              <strong>Perhatian Kelengkapan Dokumen:</strong> Terdapat{" "}
              <strong>{pengeluaranTanpaBukti.length} transaksi pengeluaran</strong> dalam laporan ini yang{" "}
              <strong>belum memiliki bukti nota/kuitansi</strong>. Pastikan melampirkan bukti fisik demi akuntabilitas pertanggungjawaban.
            </div>
          </div>
        )}

        {/* KARTU RINGKASAN SALDO & ARUS KAS: 4 kolom sebaris di PC, 2 × 2 di tablet; label di atas dan nominal di bawah sejajar antarkartu */}
        <div className="ringkasan-saldo no-print" data-testid="ringkasan-saldo">
          <div className="ringkasan-saldo__kartu" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="ringkasan-saldo__label" style={{ color: "var(--muted)" }}>Saldo Awal (Sebelum Periode)</div>
            <div className="ringkasan-saldo__nilai" style={{ color: saldoAwal < 0 ? "var(--danger)" : "var(--text)" }}>
              {formatRupiah(saldoAwal)}
            </div>
          </div>

          <div className="ringkasan-saldo__kartu" style={{ border: "1px solid var(--border)", background: "rgba(34, 197, 94, 0.08)" }}>
            <div className="ringkasan-saldo__label" style={{ color: "var(--masuk)" }}>Total Penerimaan (+)</div>
            <div className="ringkasan-saldo__nilai" style={{ color: "var(--masuk)" }}>
              +{formatRupiah(totalPenerimaan)}
            </div>
          </div>

          <div className="ringkasan-saldo__kartu" style={{ border: "1px solid var(--border)", background: "rgba(239, 68, 68, 0.08)" }}>
            <div className="ringkasan-saldo__label" style={{ color: "var(--keluar)" }}>Total Pengeluaran (-)</div>
            <div className="ringkasan-saldo__nilai" style={{ color: "var(--keluar)" }}>
              -{formatRupiah(totalPengeluaran)}
            </div>
          </div>

          <div
            className="ringkasan-saldo__kartu ringkasan-saldo__kartu--akhir"
            style={{ border: "2px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }}
          >
            <div className="ringkasan-saldo__label" style={{ color: "var(--accent)", fontWeight: 700 }}>Saldo Akhir Periode</div>
            <div className="ringkasan-saldo__nilai" style={{ color: saldoAkhir < 0 ? "var(--danger)" : "var(--accent)" }}>
              {formatRupiah(saldoAkhir)}
            </div>
          </div>
        </div>

        {/* PENYELESAIAN DANA KEGIATAN (di layar; di dokumen cetak ada di lembar penutup) */}
        {dana === "Dana Kegiatan" && penyelesaian && (
          <div className="no-print" style={{ marginBottom: "24px" }}>
            <KartuPenyelesaianDana
              ringkasan={penyelesaian}
              namaKegiatan={namaCakupan}
              rentangKegiatan={rentangCakupan}
              sementara={penyelesaianSementara}
            />
            {!kegiatanTerpilih && (
              <p style={{ margin: "6px 2px 0", fontSize: "0.76rem", color: "var(--muted)" }}>
                {kegiatanTercakup.length > 0
                  ? "Belum memilih kegiatan: dihitung dari seluruh transaksi kegiatan yang berjalan pada periode laporan, termasuk dana awal yang diterima sebelum periode. Pilih kegiatan untuk menghitung satu kegiatan saja."
                  : "Belum memilih kegiatan: dihitung dari transaksi pada rentang tanggal dan kaitan yang dipilih. Pilih kegiatan untuk menghitung seluruh transaksinya."}
              </p>
            )}
          </div>
        )}

        {/* REKAPITULASI PENGELUARAN PER KATEGORI (di layar saja; di dokumen cetak ada tabel per kategori) */}
        <div className="no-print" style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 10px 0", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
            Rincian Pengeluaran per Kategori
          </h3>
          {pengeluaranPerKategori.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>Tidak ada pengeluaran dalam periode ini.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px" }}>
              {pengeluaranPerKategori.map((k) => (
                <div
                  key={k.kategori}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    fontSize: "0.85rem",
                  }}
                >
                  <span>
                    <strong>{labelKategori(k.kategori)}</strong>{" "}
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>({k.persen.toFixed(1)}%)</span>
                  </span>
                  <span style={{ fontWeight: 700, color: "var(--keluar)" }}>{formatRupiah(k.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PREVIEW DOKUMEN SIAP CETAK (per kategori, lampiran bukti dengan rasio asli) */}
        <DokumenSiapCetak
          transaksi={transaksiLaporan}
          judulLaporan={judulLaporan}
          periodeTeks={periodeTeks}
          adalahKegiatan={dana === "Dana Kegiatan"}
          kegiatan={kegiatanTerpilih}
          profilPelapor={profilPelapor}
          googleToken={googleToken}
          penyelesaian={penyelesaian}
          penyelesaianSementara={penyelesaianSementara}
          namaKegiatanPenyelesaian={namaCakupan}
          rentangKegiatanPenyelesaian={rentangCakupan}
          saldo={{ awal: saldoAwal, akhir: saldoAkhir }}
          aksiWord={
            dana === "Dana Kegiatan" && kegiatanTerpilih
              ? { onUnduh: handleUnduhDocx, sedang: sedangProsesDocx, pesan: pesanStatusDocx }
              : undefined
          }
        />
      </div>
    </div>
  );
};
