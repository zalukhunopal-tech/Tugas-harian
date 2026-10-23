import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Transaksi,
  JenisTransaksi,
  NamaDana,
  TransaksiBerulang,
  BuktiItem,
  TargetTabunganItem,
  DataKegiatan,
  JenisBukti,
  FotoPendukung,
  DetailTransportasi,
  DetailRentalKendaraan,
  DetailBBM,
  DetailAkomodasi,
  DetailKonsumsi,
  DetailHonorarium,
  DataKhususKegiatan,
} from "../types";
import { KATEGORI, KAITAN, METODE_BAYAR, hariIni, formatRupiah } from "../lib/constants";
import { buatId } from "../lib/storage";
import { kompresBukti } from "../lib/buktiStorage";
import {
  optimalkanGambarStruk,
  prosesStrukDenganGemini,
  HasilBacaStruk,
} from "../lib/geminiStruk";
import { DanaKegiatanFormFields } from "./DanaKegiatanFormFields";
import { dapatkanInfoKategori } from "../lib/kategoriIcon";

interface TambahViewProps {
  editTransaksi: Transaksi | null;
  onSimpan: (t: Transaksi | Transaksi[]) => void;
  onBatalEdit: () => void;
  initialScanFile?: File | null;
  onResetInitialScan?: () => void;
  initialScanMode?: "kamera" | "galeri" | null;
  onResetInitialScanMode?: () => void;
  onBukaTransaksiBerulang?: () => void;
  jumlahJatuhTempo?: number;
  daftarBerulang?: TransaksiBerulang[];
  daftarTransaksi?: Transaksi[];
  daftarTargetTabungan?: TargetTabunganItem[];
  targetTabunganAwalId?: string;
  daftarKegiatan?: DataKegiatan[];
  onTambahKegiatan?: (kegiatan: DataKegiatan) => void;
}

export const TambahView: React.FC<TambahViewProps> = ({
  editTransaksi,
  onSimpan,
  onBatalEdit,
  initialScanFile = null,
  onResetInitialScan,
  initialScanMode = null,
  onResetInitialScanMode,
  onBukaTransaksiBerulang,
  jumlahJatuhTempo = 0,
  daftarBerulang = [],
  daftarTransaksi = [],
  daftarTargetTabungan = [],
  targetTabunganAwalId = "",
  daftarKegiatan = [],
  onTambahKegiatan,
}) => {
  const [modeTransaksi, setModeTransaksi] = useState<"pengeluaran" | "pemasukan" | "pindah_dana">("pengeluaran");
  const [danaAsal, setDanaAsal] = useState<NamaDana>("Dana Pribadi");
  const [danaTujuan, setDanaTujuan] = useState<NamaDana>("Dana Kegiatan");
  const [isTalangan, setIsTalangan] = useState<boolean>(false);
  const [statusTalangan, setStatusTalangan] = useState<"belum_diganti" | "sudah_diganti">("belum_diganti");
  const [talanganUntuk, setTalanganUntuk] = useState<string>("");
  const [targetTabunganId, setTargetTabunganId] = useState<string>(targetTabunganAwalId);

  const [jenis, setJenis] = useState<JenisTransaksi>("pengeluaran");
  const [dana, setDana] = useState<NamaDana>("Dana Pribadi");
  const [tanggal, setTanggal] = useState<string>(hariIni());
  const [deskripsi, setDeskripsi] = useState<string>("");
  const [kategori, setKategori] = useState<string>("");
  const [jumlah, setJumlah] = useState<string>("");
  const [metode, setMetode] = useState<string>("Tunai");
  const [kaitan, setKaitan] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");

  // Dana Kegiatan States
  const [kegiatanId, setKegiatanId] = useState<string>("");
  const [jenisBukti, setJenisBukti] = useState<JenisBukti>("Kwitansi");
  const [namaPenjualPenyedia, setNamaPenjualPenyedia] = useState<string>("");
  const [rincianBanyaknya, setRincianBanyaknya] = useState<string>("");
  const [rincianSatuan, setRincianSatuan] = useState<string>("");
  const [rincianHargaSatuan, setRincianHargaSatuan] = useState<string>("");
  const [keteranganLaporan, setKeteranganLaporan] = useState<string>("");
  const [perluSuratJustifikasi, setPerluSuratJustifikasi] = useState<boolean>(false);
  const [alasanJustifikasi, setAlasanJustifikasi] = useState<string>("");
  const [fotoPendukung, setFotoPendukung] = useState<FotoPendukung[]>([]);

  // Sub-kelompok states
  const [transportasi, setTransportasi] = useState<DetailTransportasi>({});
  const [rentalKendaraan, setRentalKendaraan] = useState<DetailRentalKendaraan>({
    persenGrossUpPajak: 2,
    timesheet: [],
  });
  const [bbm, setBBM] = useState<DetailBBM>({});
  const [akomodasi, setAkomodasi] = useState<DetailAkomodasi>({});
  const [konsumsi, setKonsumsi] = useState<DetailKonsumsi>({});
  const [honorarium, setHonorarium] = useState<DetailHonorarium>({
    isPNS: false,
    hasNPWP: true,
    jumlahOrang: 1,
    jumlahHari: 1,
  });

  // Bukti Transaksi States
  const [bukti, setBukti] = useState<BuktiItem[]>([]);
  const [memuatBukti, setMemuatBukti] = useState(false);
  const buktiKameraInputRef = useRef<HTMLInputElement>(null);
  const buktiGaleriInputRef = useRef<HTMLInputElement>(null);

  // Struk Scanner States
  const kameraInputRef = useRef<HTMLInputElement>(null);
  const galeriInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [memuatScan, setMemuatScan] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [hasilScan, setHasilScan] = useState<HasilBacaStruk | null>(null);
  const [errorScan, setErrorScan] = useState<string | null>(null);

  // Sync state when editing
  useEffect(() => {
    if (editTransaksi) {
      const isPindah = editTransaksi.kategori === "Pindah Dana" || Boolean(editTransaksi.pasanganId);
      if (isPindah) {
        setModeTransaksi("pindah_dana");
        if (editTransaksi.jenis === "pengeluaran") {
          setDanaAsal(editTransaksi.dana);
          setDanaTujuan(editTransaksi.dana === "Dana Pribadi" ? "Dana Kegiatan" : "Dana Pribadi");
        } else {
          setDanaTujuan(editTransaksi.dana);
          setDanaAsal(editTransaksi.dana === "Dana Pribadi" ? "Dana Kegiatan" : "Dana Pribadi");
        }
      } else {
        setModeTransaksi(editTransaksi.jenis);
        setDana(editTransaksi.dana);
      }
      setJenis(editTransaksi.jenis);
      setTanggal(editTransaksi.tanggal);
      setDeskripsi(editTransaksi.deskripsi);
      setKategori(editTransaksi.kategori);
      setJumlah(String(editTransaksi.jumlah));
      setMetode(editTransaksi.metode || "Tunai");
      setKaitan(editTransaksi.kaitan || "");
      setCatatan(editTransaksi.catatan || "");
      setBukti(editTransaksi.bukti || []);
      setIsTalangan(Boolean(editTransaksi.isTalangan));
      setStatusTalangan(editTransaksi.statusTalangan || "belum_diganti");
      setTalanganUntuk(editTransaksi.talanganUntuk || "");
      setTargetTabunganId(editTransaksi.targetTabunganId || "");

      // Dana Kegiatan Data
      if (editTransaksi.dana === "Dana Kegiatan") {
        setKegiatanId(editTransaksi.kegiatanId || "");
        if (editTransaksi.detailKegiatan) {
          const dk = editTransaksi.detailKegiatan;
          if (dk.jenisBukti) setJenisBukti(dk.jenisBukti);
          if (dk.namaPenjualPenyedia) setNamaPenjualPenyedia(dk.namaPenjualPenyedia);
          if (dk.rincian) {
            setRincianBanyaknya(String(dk.rincian.banyaknya || ""));
            setRincianSatuan(dk.rincian.satuan || "");
            setRincianHargaSatuan(String(dk.rincian.hargaSatuan || ""));
          }
          if (dk.keteranganLaporan) setKeteranganLaporan(dk.keteranganLaporan);
          setPerluSuratJustifikasi(Boolean(dk.perluSuratJustifikasi));
          setAlasanJustifikasi(dk.alasanJustifikasi || "");
          setFotoPendukung(dk.fotoPendukung || []);
          if (dk.transportasi) setTransportasi(dk.transportasi);
          if (dk.rentalKendaraan) setRentalKendaraan(dk.rentalKendaraan);
          if (dk.bbm) setBBM(dk.bbm);
          if (dk.akomodasi) setAkomodasi(dk.akomodasi);
          if (dk.konsumsi) setKonsumsi(dk.konsumsi);
          if (dk.honorarium) setHonorarium(dk.honorarium);
        }
      }
    } else {
      setModeTransaksi("pengeluaran");
      setJenis("pengeluaran");
      setDana("Dana Pribadi");
      setDanaAsal("Dana Pribadi");
      setDanaTujuan("Dana Kegiatan");
      setTanggal(hariIni());
      setDeskripsi("");
      setJumlah("");
      setMetode("Tunai");
      setKaitan("");
      setCatatan("");
      setBukti([]);
      setIsTalangan(false);
      setStatusTalangan("belum_diganti");
      setTalanganUntuk("");
      setTargetTabunganId(targetTabunganAwalId || "");
      const defaultKategori = targetTabunganAwalId ? "Tabungan" : KATEGORI["Dana Pribadi"].pengeluaran[0];
      setKategori(defaultKategori);

      // Reset Dana Kegiatan
      setKegiatanId("");
      setJenisBukti("Kwitansi");
      setNamaPenjualPenyedia("");
      setRincianBanyaknya("");
      setRincianSatuan("");
      setRincianHargaSatuan("");
      setKeteranganLaporan("");
      setPerluSuratJustifikasi(false);
      setAlasanJustifikasi("");
      setFotoPendukung([]);
      setTransportasi({});
      setRentalKendaraan({ persenGrossUpPajak: 2, timesheet: [] });
      setBBM({});
      setAkomodasi({});
      setKonsumsi({});
      setHonorarium({ isPNS: false, hasNPWP: true, jumlahOrang: 1, jumlahHari: 1 });
    }
  }, [editTransaksi, targetTabunganAwalId]);

  // Update default kategori when dana or jenis changes
  useEffect(() => {
    const list = KATEGORI[dana]?.[jenis] || [];
    if (!list.includes(kategori)) {
      setKategori(list[0] || "Lain-lain");
    }
  }, [dana, jenis, kategori]);

  const daftarKategori = KATEGORI[dana]?.[jenis] || [];
  const kaitanMeta = KAITAN[dana] || KAITAN["Dana Pribadi"];

  // Saran otomatis untuk Kaitan Kegiatan / Sumber & Tujuan
  const saranKaitan = useMemo(() => {
    if (!daftarTransaksi || daftarTransaksi.length === 0) return [];
    const set = new Set<string>();
    for (const t of daftarTransaksi) {
      if (t.dana === dana && t.kaitan && t.kaitan.trim()) {
        set.add(t.kaitan.trim());
      }
    }
    return Array.from(set).slice(0, 15);
  }, [daftarTransaksi, dana]);

  const handleProsesFileStruk = async (file: File) => {
    if (!file) return;
    try {
      setMemuatScan(true);
      setErrorScan(null);
      setHasilScan(null);

      // Foto struk belanja otomatis dijadikan bukti transaksi (Requirement A1 & A2)
      try {
        const kompres = await kompresBukti(file, file.name || "struk.jpg");
        setBukti((prev) => [
          ...prev,
          {
            id: buatId(),
            nama: kompres.namaFile,
            tipe: kompres.tipe,
            dataUrl: kompres.dataUrl,
            waktu: new Date().toISOString(),
          },
        ]);
      } catch (errBukti) {
        console.warn("Gagal mengompres struk sebagai bukti:", errBukti);
      }

      const { base64, mimeType, previewUrl } = await optimalkanGambarStruk(file);
      setPreviewFoto(previewUrl);

      const hasil = await prosesStrukDenganGemini(base64, mimeType);

      if (hasil.sukses) {
        setHasilScan(hasil);
        // Otomatis isi data pengeluaran dari hasil pembacaan Gemini
        setJenis("pengeluaran");
        if (hasil.deskripsi) setDeskripsi(hasil.deskripsi);
        if (hasil.jumlah && hasil.jumlah > 0) setJumlah(String(hasil.jumlah));
        if (hasil.tanggal) setTanggal(hasil.tanggal);
        if (hasil.kategori) {
          const list = KATEGORI[dana]?.pengeluaran || [];
          const match = list.find(
            (k) => k.toLowerCase() === hasil.kategori?.toLowerCase()
          );
          setKategori(match || hasil.kategori);
        }
        if (hasil.metode) {
          const mList = ["Tunai", "Transfer", "QRIS", "Debit", "Kredit", "Lainnya"];
          const matchM = mList.find(
            (m) => m.toLowerCase() === hasil.metode?.toLowerCase()
          );
          if (matchM) setMetode(matchM);
        }
        if (hasil.catatan) {
          setCatatan(hasil.catatan);
        }

        // Isian Khusus Dana Kegiatan dari Gemini
        if (hasil.jenisBukti) {
          setJenisBukti(hasil.jenisBukti);
        }
        if (hasil.namaPenjualPenyedia) {
          setNamaPenjualPenyedia(hasil.namaPenjualPenyedia);
        }
        if (hasil.rincian) {
          if (hasil.rincian.banyaknya) setRincianBanyaknya(String(hasil.rincian.banyaknya));
          if (hasil.rincian.satuan) setRincianSatuan(hasil.rincian.satuan);
          if (hasil.rincian.hargaSatuan) setRincianHargaSatuan(String(hasil.rincian.hargaSatuan));
        }
        if (hasil.keteranganLaporan) {
          setKeteranganLaporan(hasil.keteranganLaporan);
        }
        if (dana === "Dana Kegiatan" && hasil.kategoriDanaKegiatan) {
          setKategori(hasil.kategoriDanaKegiatan);
        }

        // Scroll halus ke formulir yang sudah terisi otomatis
        setTimeout(() => {
          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      } else {
        setErrorScan(
          hasil.pesan ||
            "Struk belanja tidak terbaca dengan jelas. Silakan coba dengan pencahayaan lebih terang atau isi manual."
        );
      }
    } catch (err: any) {
      setErrorScan(
        err.message ||
          "Gagal memproses struk dengan Gemini. Pastikan perangkat terhubung ke internet."
      );
    } finally {
      setMemuatScan(false);
    }
  };

  const handleResetScan = () => {
    setPreviewFoto(null);
    setHasilScan(null);
    setErrorScan(null);
    if (kameraInputRef.current) kameraInputRef.current.value = "";
    if (galeriInputRef.current) galeriInputRef.current.value = "";
    if (onResetInitialScan) onResetInitialScan();
  };

  // Lampirkan berkas bukti (kamera / galeri foto / PDF)
  const handleLampirkanFileBukti = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMemuatBukti(true);
    try {
      const itemsBaru: BuktiItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const kompres = await kompresBukti(f, f.name);
        itemsBaru.push({
          id: buatId(),
          nama: kompres.namaFile,
          tipe: kompres.tipe,
          dataUrl: kompres.dataUrl,
          waktu: new Date().toISOString(),
        });
      }
      setBukti((prev) => [...prev, ...itemsBaru]);
    } catch (err: any) {
      alert(`Gagal memproses lampiran bukti: ${err.message}`);
    } finally {
      setMemuatBukti(false);
      if (buktiKameraInputRef.current) buktiKameraInputRef.current.value = "";
      if (buktiGaleriInputRef.current) buktiGaleriInputRef.current.value = "";
    }
  };

  const handleHapusBukti = (idBukti: string) => {
    setBukti((prev) => prev.filter((b) => b.id !== idBukti));
  };

  // Otomatis jalankan jika ada initialScanFile dari navigasi luar
  useEffect(() => {
    if (initialScanFile) {
      void handleProsesFileStruk(initialScanFile);
    }
  }, [initialScanFile]);

  // Otomatis picu kamera atau galeri jika pengguna memilih lewat tombol plus di Navbar
  useEffect(() => {
    if (initialScanMode === "kamera") {
      setTimeout(() => {
        kameraInputRef.current?.click();
      }, 150);
      if (onResetInitialScanMode) onResetInitialScanMode();
    } else if (initialScanMode === "galeri") {
      setTimeout(() => {
        galeriInputRef.current?.click();
      }, 150);
      if (onResetInitialScanMode) onResetInitialScanMode();
    }
  }, [initialScanMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const jml = Number(jumlah);
    if (!jml || jml <= 0) return;

    if (modeTransaksi === "pindah_dana") {
      const pairId = editTransaksi?.pasanganId || ("pd_" + buatId());
      const pasanganLama = editTransaksi?.pasanganId
        ? daftarTransaksi.find(
            (t) => t.pasanganId === editTransaksi.pasanganId && t.id !== editTransaksi.id
          )
        : null;

      const idKeluar =
        editTransaksi?.jenis === "pengeluaran"
          ? editTransaksi.id
          : pasanganLama && pasanganLama.jenis === "pengeluaran"
          ? pasanganLama.id
          : buatId();

      const idMasuk =
        editTransaksi?.jenis === "pemasukan"
          ? editTransaksi.id
          : pasanganLama && pasanganLama.jenis === "pemasukan"
          ? pasanganLama.id
          : buatId();

      const uraianUtama =
        deskripsi.trim() || `Pindah Dana (${danaAsal} → ${danaTujuan})`;

      const trxKeluar: Transaksi = {
        id: idKeluar,
        jenis: "pengeluaran",
        dana: danaAsal,
        tanggal,
        deskripsi: uraianUtama,
        kategori: "Pindah Dana",
        jumlah: jml,
        metode,
        kaitan: kaitan.trim() || `Ke ${danaTujuan}`,
        catatan: catatan.trim(),
        pasanganId: pairId,
        isTalangan,
        statusTalangan: isTalangan ? statusTalangan : undefined,
        talanganUntuk: isTalangan ? talanganUntuk.trim() : undefined,
        diubah: new Date().toISOString(),
        bukti,
      };

      const trxMasuk: Transaksi = {
        id: idMasuk,
        jenis: "pemasukan",
        dana: danaTujuan,
        tanggal,
        deskripsi: uraianUtama,
        kategori: "Pindah Dana",
        jumlah: jml,
        metode,
        kaitan: kaitan.trim() || `Dari ${danaAsal}`,
        catatan: catatan.trim(),
        pasanganId: pairId,
        isTalangan,
        statusTalangan: isTalangan ? statusTalangan : undefined,
        talanganUntuk: isTalangan ? talanganUntuk.trim() : undefined,
        diubah: new Date().toISOString(),
        bukti,
      };

      onSimpan([trxKeluar, trxMasuk]);
    } else {
      if (!deskripsi.trim()) return;

      let detailKegiatanData: DataKhususKegiatan | undefined = undefined;
      if (dana === "Dana Kegiatan") {
        const subtotal =
          Number(rincianBanyaknya) > 0 && Number(rincianHargaSatuan) > 0
            ? Number(rincianBanyaknya) * Number(rincianHargaSatuan)
            : undefined;

        detailKegiatanData = {
          jenisBukti,
          namaPenjualPenyedia: namaPenjualPenyedia.trim() || undefined,
          rincian:
            subtotal !== undefined
              ? {
                  banyaknya: Number(rincianBanyaknya),
                  satuan: rincianSatuan.trim() || "unit",
                  hargaSatuan: Number(rincianHargaSatuan),
                  total: subtotal,
                }
              : undefined,
          keteranganLaporan: keteranganLaporan.trim() || undefined,
          perluSuratJustifikasi: Boolean(
            perluSuratJustifikasi || jenisBukti === "Bukti tidak lengkap"
          ),
          alasanJustifikasi: alasanJustifikasi.trim() || undefined,
          fotoPendukung: fotoPendukung.length > 0 ? fotoPendukung : undefined,
          transportasi: kategori === "Transportasi" ? transportasi : undefined,
          rentalKendaraan: kategori === "Rental Kendaraan" ? rentalKendaraan : undefined,
          bbm: kategori === "BBM" ? bbm : undefined,
          akomodasi: kategori === "Akomodasi" ? akomodasi : undefined,
          konsumsi: kategori === "Konsumsi" ? konsumsi : undefined,
          honorarium: kategori === "Honorarium & Ganti Hari" ? honorarium : undefined,
        };
      }

      const trx: Transaksi = {
        id: editTransaksi ? editTransaksi.id : buatId(),
        jenis,
        dana,
        tanggal,
        deskripsi: deskripsi.trim(),
        kategori: kategori || daftarKategori[0] || "Lain-lain",
        jumlah: jml,
        metode,
        kaitan: kaitan.trim(),
        catatan: catatan.trim(),
        isTalangan,
        statusTalangan: isTalangan ? statusTalangan : undefined,
        talanganUntuk: isTalangan ? talanganUntuk.trim() : undefined,
        targetTabunganId: kategori === "Tabungan" && targetTabunganId ? targetTabunganId : undefined,
        kegiatanId: dana === "Dana Kegiatan" && kegiatanId ? kegiatanId : undefined,
        detailKegiatan: detailKegiatanData,
        diubah: new Date().toISOString(),
        bukti,
      };

      onSimpan(trx);
    }

    if (!editTransaksi) {
      setDeskripsi("");
      setJumlah("");
      setKaitan("");
      setCatatan("");
      setBukti([]);
      setIsTalangan(false);
      setStatusTalangan("belum_diganti");
      setTalanganUntuk("");
      setTargetTabunganId("");
      setKegiatanId("");
      setJenisBukti("Kwitansi");
      setNamaPenjualPenyedia("");
      setRincianBanyaknya("");
      setRincianSatuan("");
      setRincianHargaSatuan("");
      setKeteranganLaporan("");
      setPerluSuratJustifikasi(false);
      setAlasanJustifikasi("");
      setFotoPendukung([]);
      setTransportasi({});
      setRentalKendaraan({ persenGrossUpPajak: 2, timesheet: [] });
      setBBM({});
      setAkomodasi({});
      setKonsumsi({});
      setHonorarium({ isPNS: false, hasNPWP: true, jumlahOrang: 1, jumlahHari: 1 });
      handleResetScan();
    }
  };

  const handlePilihJadwal = (item: TransaksiBerulang) => {
    setJenis(item.jenis);
    setDana(item.dana);
    setDeskripsi(item.nama);
    setJumlah(String(item.jumlah));
    setKategori(item.kategori);
    if (item.metode) setMetode(item.metode);
    if (item.kaitan) setKaitan(item.kaitan);
    if (item.catatan) setCatatan(item.catatan);
  };

  return (
    <section
      className="view"
      id="view-tambah"
      data-view="tambah"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onBatalEdit();
        }
      }}
    >
      {/* Input File Tersembunyi untuk Kamera & Galeri */}
      <input
        type="file"
        ref={kameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleProsesFileStruk(file);
        }}
      />
      <input
        type="file"
        ref={galeriInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleProsesFileStruk(file);
        }}
      />

      <div className="tambah-dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="tambah-dialog-topbar">
          <h2 className="tambah-dialog-title">
            {editTransaksi ? "Ubah Transaksi" : "Tambah Transaksi"}
          </h2>
          <button
            type="button"
            className="btn-ikon tambah-dialog-close"
            onClick={onBatalEdit}
            aria-label="Tutup formulir"
            title="Tutup formulir"
          >
            ✕
          </button>
        </div>

        {/* Tool Transaksi Berulang */}
        {!editTransaksi && onBukaTransaksiBerulang && (
        <section
          className="card-berulang-tool"
          aria-label="Tool Transaksi Berulang"
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "12px",
            border: jumlahJatuhTempo > 0 ? "1.5px solid var(--accent)" : "1px solid var(--border)",
            background:
              jumlahJatuhTempo > 0
                ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                : "var(--surface)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.4rem" }}>🔁</span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  Transaksi Berulang (Jadwal Rutin)
                </h3>
                <span className="help" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                  Kelola jadwal gaji, sewa, tagihan listrik, WiFi, atau langganan rutin
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-sync-topbar"
              onClick={onBukaTransaksiBerulang}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                fontWeight: 700,
                borderRadius: "999px",
                borderColor: "var(--accent)",
              }}
            >
              <span>⚙️ Kelola Jadwal</span>
              {jumlahJatuhTempo > 0 && (
                <span
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                >
                  {jumlahJatuhTempo} Jatuh Tempo
                </span>
              )}
            </button>
          </div>

          {/* Quick Shortcuts jika ada transaksi berulang aktif */}
          {daftarBerulang && daftarBerulang.filter((d) => d.aktif).length > 0 && (
            <div
              style={{
                marginTop: "10px",
                borderTop: "1px dashed var(--border)",
                paddingTop: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "0.76rem",
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                ⚡ Isi cepat formulir dari jadwal rutin:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {daftarBerulang
                  .filter((d) => d.aktif)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="chip"
                      style={{
                        fontSize: "0.76rem",
                        padding: "5px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => handlePilihJadwal(item)}
                      title={`Klik untuk otomatis mengisi formulir dengan data ${item.nama} (${formatRupiah(item.jumlah)})`}
                    >
                      <span>{item.jenis === "pemasukan" ? "📈" : "📉"}</span>
                      <strong style={{ color: "var(--text)" }}>{item.nama}</strong>
                      <span style={{ opacity: 0.8, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        ({formatRupiah(item.jumlah)})
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Bagian Scan Struk Belanja dengan Gemini AI */}
      {!editTransaksi && (
        <section className="card-struk-scanner" aria-label="Scan Struk Belanja dengan Gemini AI">
          <div className="struk-scanner-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.4rem" }}>🧾</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "var(--accent)" }}>
                  Scan Struk Belanja Otomatis (Gemini AI)
                </h3>
                <span className="help" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                  Foto struk kasir atau unggah gambar untuk otomatis mengisi pengeluaran
                </span>
              </div>
            </div>
          </div>

          <div className="struk-scanner-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={memuatScan}
              onClick={() => kameraInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              <span>📸</span> Ambil Foto Kamera
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={memuatScan}
              onClick={() => galeriInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              <span>🖼️</span> Pilih dari Galeri
            </button>
          </div>

          {/* Animasi Preview & Laser Scanning */}
          {memuatScan && previewFoto && (
            <div className="struk-preview-box">
              <img src={previewFoto} alt="Preview Struk" className="struk-preview-img" />
              <div className="struk-scan-laser" />
            </div>
          )}

          {memuatScan && (
            <div className="struk-scan-loading-text">
              <span>⚡</span>
              <span>Gemini AI sedang membaca dan menganalisis struk belanja Anda…</span>
            </div>
          )}

          {/* Hasil Sukses */}
          {hasilScan && !memuatScan && (
            <div className="struk-hasil-sukses">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <strong style={{ color: "var(--masuk)", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>✓</span> Struk Berhasil Dibaca oleh Gemini AI!
                </strong>
                <button
                  type="button"
                  className="btn-small"
                  onClick={handleResetScan}
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                >
                  Ganti Foto
                </button>
              </div>
              {hasilScan.ringkasan && (
                <p style={{ margin: "6px 0 4px", fontSize: "0.84rem", color: "var(--text)" }}>
                  {hasilScan.ringkasan}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                <span>🏬 {hasilScan.deskripsi}</span>
                <span>·</span>
                <span style={{ fontWeight: 700, color: "var(--keluar)" }}>
                  💰 {formatRupiah(hasilScan.jumlah || 0)}
                </span>
                <span>·</span>
                <span>📅 {hasilScan.tanggal}</span>
                <span>·</span>
                <span>🏷️ {hasilScan.kategori}</span>
                <span>·</span>
                <span>💳 {hasilScan.metode}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--accent)" }}>
                ↓ Silakan periksa detail pada formulir di bawah sebelum menyimpan.
              </p>
            </div>
          )}

          {/* Notifikasi Error */}
          {errorScan && !memuatScan && (
            <div className="struk-hasil-error">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <strong style={{ color: "var(--keluar)", fontSize: "0.85rem" }}>
                  ⚠️ {errorScan}
                </strong>
                <button
                  type="button"
                  className="btn-small"
                  onClick={handleResetScan}
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                >
                  Tutup
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Anda tetap dapat memasukkan data secara manual melalui formulir di bawah.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="card" id="kartu-form">
        <h2 id="judul-form">{editTransaksi ? "Ubah Transaksi" : "Formulir Transaksi"}</h2>
        <form id="form-transaksi" ref={formRef} onSubmit={handleSubmit}>
          <fieldset className="field segmented">
            <legend>Jenis Transaksi</legend>
            <div className="segmented-options" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <label style={{ flex: 1, minWidth: "100px" }}>
                <input
                  type="radio"
                  name="modeTransaksi"
                  value="pengeluaran"
                  checked={modeTransaksi === "pengeluaran"}
                  onChange={() => {
                    setModeTransaksi("pengeluaran");
                    setJenis("pengeluaran");
                  }}
                />
                <span>Pengeluaran</span>
              </label>
              <label style={{ flex: 1, minWidth: "100px" }}>
                <input
                  type="radio"
                  name="modeTransaksi"
                  value="pemasukan"
                  checked={modeTransaksi === "pemasukan"}
                  onChange={() => {
                    setModeTransaksi("pemasukan");
                    setJenis("pemasukan");
                  }}
                />
                <span>Pemasukan</span>
              </label>
              <label style={{ flex: 1, minWidth: "115px" }}>
                <input
                  type="radio"
                  name="modeTransaksi"
                  value="pindah_dana"
                  checked={modeTransaksi === "pindah_dana"}
                  onChange={() => setModeTransaksi("pindah_dana")}
                />
                <span>🔄 Pindah Dana</span>
              </label>
            </div>
          </fieldset>

          {modeTransaksi === "pindah_dana" ? (
            <div
              className="field wide"
              style={{
                background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
                padding: "12px",
                borderRadius: "12px",
                border: "1.5px solid var(--accent)",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                <strong style={{ fontSize: "0.88rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🔄</span> Pindah Dana Antar Rekening / Kas
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Disimpan otomatis sebagai 2 transaksi berpasangan
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="dana-asal" style={{ fontSize: "0.8rem", marginBottom: "4px", display: "block", fontWeight: 600 }}>
                    Dari (Dana Asal - Keluar):
                  </label>
                  <select
                    id="dana-asal"
                    value={danaAsal}
                    onChange={(e) => {
                      const asal = e.target.value as NamaDana;
                      setDanaAsal(asal);
                      setDanaTujuan(asal === "Dana Pribadi" ? "Dana Kegiatan" : "Dana Pribadi");
                    }}
                  >
                    <option value="Dana Pribadi">Dana Pribadi</option>
                    <option value="Dana Kegiatan">Dana Kegiatan</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    alignSelf: "flex-end",
                    height: "42px",
                    padding: "0 14px",
                    fontSize: "1.2rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => {
                    const temp = danaAsal;
                    setDanaAsal(danaTujuan);
                    setDanaTujuan(temp);
                  }}
                  title="Tukar Arah Pindah Dana"
                >
                  ⇄
                </button>
                <div style={{ flex: 1 }}>
                  <label htmlFor="dana-tujuan" style={{ fontSize: "0.8rem", marginBottom: "4px", display: "block", fontWeight: 600 }}>
                    Ke (Dana Tujuan - Masuk):
                  </label>
                  <select
                    id="dana-tujuan"
                    value={danaTujuan}
                    onChange={(e) => {
                      const tujuan = e.target.value as NamaDana;
                      setDanaTujuan(tujuan);
                      setDanaAsal(tujuan === "Dana Pribadi" ? "Dana Kegiatan" : "Dana Pribadi");
                    }}
                  >
                    <option value="Dana Pribadi">Dana Pribadi</option>
                    <option value="Dana Kegiatan">Dana Kegiatan</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="dana">Dana</label>
              <select
                id="dana"
                value={dana}
                onChange={(e) => setDana(e.target.value as NamaDana)}
              >
                <option value="Dana Pribadi">Dana Pribadi</option>
                <option value="Dana Kegiatan">Dana Kegiatan</option>
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="tanggal">Tanggal</label>
            <input
              type="date"
              id="tanggal"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="deskripsi">Uraian</label>
            <input
              type="text"
              id="deskripsi"
              placeholder={
                modeTransaksi === "pindah_dana"
                  ? `Pindah Dana (${danaAsal} → ${danaTujuan})`
                  : "Contoh: Pembelian makan siang"
              }
              maxLength={150}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              required={modeTransaksi !== "pindah_dana"}
            />
          </div>

          {modeTransaksi !== "pindah_dana" && (
            <div className="field">
              <label htmlFor="kategori">Kategori</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                {daftarKategori.map((kat) => {
                  const info = dapatkanInfoKategori(kat);
                  const Ikon = info.ikon;
                  const isSelected = kategori === kat;
                  return (
                    <button
                      key={kat}
                      type="button"
                      onClick={() => setKategori(kat)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 10px",
                        borderRadius: "999px",
                        fontSize: "0.8rem",
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? `2px solid ${info.warna}` : "1px solid var(--border)",
                        background: isSelected
                          ? `color-mix(in srgb, ${info.warna} 22%, var(--surface))`
                          : "var(--surface)",
                        color: isSelected ? info.warna : "var(--text)",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "6px",
                          background: info.warna,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                        }}
                      >
                        <Ikon size={12} strokeWidth={2.5} />
                      </span>
                      <span>{kat}</span>
                    </button>
                  );
                })}
              </div>
              <select
                id="kategori"
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
              >
                {daftarKategori.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {modeTransaksi !== "pindah_dana" && kategori === "Tabungan" && daftarTargetTabungan && daftarTargetTabungan.length > 0 && (
            <div
              className="field"
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid rgba(16, 185, 129, 0.25)",
              }}
            >
              <label htmlFor="target-tabungan" style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🎯</span> Alokasikan ke Target Tabungan:
              </label>
              <select
                id="target-tabungan"
                value={targetTabunganId}
                onChange={(e) => setTargetTabunganId(e.target.value)}
              >
                <option value="">-- Tabungan Umum (Semua Target) --</option>
                {daftarTargetTabungan.map((t) => (
                  <option key={t.id} value={t.id}>
                    🎯 {t.nama} (Target: {formatRupiah(t.targetJumlah)})
                  </option>
                ))}
              </select>
              <span className="help" style={{ fontSize: "0.76rem", margin: "4px 0 0" }}>
                Nominal transaksi ini akan otomatis menambahkan progres capaian target tabungan yang dipilih.
              </span>
            </div>
          )}

          <div className="field">
            <label htmlFor="jumlah">Jumlah (Rp)</label>
            <input
              type="number"
              id="jumlah"
              min="1"
              step="1"
              placeholder="25000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="metode">Metode bayar</label>
            <select
              id="metode"
              value={metode}
              onChange={(e) => setMetode(e.target.value)}
            >
              {METODE_BAYAR.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {dana === "Dana Kegiatan" && modeTransaksi !== "pindah_dana" ? (
            <div className="field wide" style={{ padding: 0 }}>
              <DanaKegiatanFormFields
                kategori={kategori}
                jumlah={jumlah}
                onUpdateJumlah={setJumlah}
                kaitan={kaitan}
                onUpdateKaitan={setKaitan}
                kegiatanId={kegiatanId}
                onUpdateKegiatanId={setKegiatanId}
                daftarKegiatan={daftarKegiatan}
                onTambahKegiatan={onTambahKegiatan || (() => {})}
                jenisBukti={jenisBukti}
                onUpdateJenisBukti={setJenisBukti}
                namaPenjualPenyedia={namaPenjualPenyedia}
                onUpdateNamaPenjualPenyedia={setNamaPenjualPenyedia}
                rincianBanyaknya={rincianBanyaknya}
                onUpdateRincianBanyaknya={setRincianBanyaknya}
                rincianSatuan={rincianSatuan}
                onUpdateRincianSatuan={setRincianSatuan}
                rincianHargaSatuan={rincianHargaSatuan}
                onUpdateRincianHargaSatuan={setRincianHargaSatuan}
                keteranganLaporan={keteranganLaporan}
                onUpdateKeteranganLaporan={setKeteranganLaporan}
                perluSuratJustifikasi={perluSuratJustifikasi}
                onUpdatePerluSuratJustifikasi={setPerluSuratJustifikasi}
                alasanJustifikasi={alasanJustifikasi}
                onUpdateAlasanJustifikasi={setAlasanJustifikasi}
                fotoPendukung={fotoPendukung}
                onUpdateFotoPendukung={setFotoPendukung}
                transportasi={transportasi}
                onUpdateTransportasi={setTransportasi}
                rentalKendaraan={rentalKendaraan}
                onUpdateRentalKendaraan={setRentalKendaraan}
                bbm={bbm}
                onUpdateBBM={setBBM}
                akomodasi={akomodasi}
                onUpdateAkomodasi={setAkomodasi}
                konsumsi={konsumsi}
                onUpdateKonsumsi={setKonsumsi}
                honorarium={honorarium}
                onUpdateHonorarium={setHonorarium}
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="kaitan" id="label-kaitan">
                {kaitanMeta.label}
              </label>
              <input
                type="text"
                id="kaitan"
                list="list-saran-kaitan"
                placeholder={kaitanMeta.placeholder}
                maxLength={150}
                value={kaitan}
                onChange={(e) => setKaitan(e.target.value)}
              />
              <datalist id="list-saran-kaitan">
                {saranKaitan.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
              {saranKaitan.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                  <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>Saran:</span>
                  {saranKaitan.slice(0, 5).map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn-small"
                      style={{
                        fontSize: "0.74rem",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        background: kaitan === s ? "var(--accent)" : "var(--surface)",
                        color: kaitan === s ? "#fff" : "var(--text)",
                        cursor: "pointer",
                      }}
                      onClick={() => setKaitan(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="field wide">
            <label htmlFor="catatan">Catatan (opsional)</label>
            <input
              type="text"
              id="catatan"
              placeholder="Contoh: Struk 0042, bersama tim"
              maxLength={300}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>

          {/* Talangan (perlu diganti) (Requirement 2) */}
          <div
            className="field wide"
            style={{
              padding: "12px 14px",
              background: isTalangan
                ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                : "color-mix(in srgb, var(--surface) 90%, var(--border))",
              border: isTalangan ? "1.5px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: "12px",
              transition: "all 0.2s ease",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                fontWeight: 700,
                margin: 0,
                fontSize: "0.92rem",
              }}
            >
              <input
                type="checkbox"
                checked={isTalangan}
                onChange={(e) => setIsTalangan(e.target.checked)}
                style={{ width: "19px", height: "19px", accentColor: "var(--accent)", cursor: "pointer" }}
              />
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🤝</span> Talangan (perlu diganti)
              </span>
            </label>
            {isTalangan && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    Status Penggantian:
                  </span>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.86rem",
                      cursor: "pointer",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      background: statusTalangan === "belum_diganti" ? "rgba(239,68,68,0.15)" : "transparent",
                      border: statusTalangan === "belum_diganti" ? "1px solid var(--keluar)" : "1px solid transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="statusTalangan"
                      value="belum_diganti"
                      checked={statusTalangan === "belum_diganti"}
                      onChange={() => setStatusTalangan("belum_diganti")}
                    />
                    <span style={{ color: "var(--keluar)", fontWeight: 700 }}>⏳ Belum diganti</span>
                  </label>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.86rem",
                      cursor: "pointer",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      background: statusTalangan === "sudah_diganti" ? "rgba(34,197,94,0.15)" : "transparent",
                      border: statusTalangan === "sudah_diganti" ? "1px solid var(--masuk)" : "1px solid transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="statusTalangan"
                      value="sudah_diganti"
                      checked={statusTalangan === "sudah_diganti"}
                      onChange={() => setStatusTalangan("sudah_diganti")}
                    />
                    <span style={{ color: "var(--masuk)", fontWeight: 700 }}>✓ Sudah diganti</span>
                  </label>
                </div>
                <div>
                  <label htmlFor="talangan-untuk" style={{ fontSize: "0.78rem", marginBottom: "4px", display: "block" }}>
                    Keterangan Talangan / Ditujukan ke:
                  </label>
                  <input
                    id="talangan-untuk"
                    type="text"
                    placeholder="Contoh: Ditalangi dulu untuk transport tim Pak Joko / Panitia"
                    value={talanganUntuk}
                    onChange={(e) => setTalanganUntuk(e.target.value)}
                    maxLength={150}
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Lampirkan Bukti Transaksi (Requirement A1 & A2) */}
          <div className="field wide" style={{ marginTop: "8px", borderTop: "1px dashed var(--border)", paddingTop: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📎 Lampiran Bukti / Nota</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--muted)" }}>
                  (Foto kamera/galeri atau PDF)
                </span>
              </label>
              {bukti.length > 0 && (
                <span style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700 }}>
                  {bukti.length} berkas terlampir
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", padding: "8px 14px" }}
                onClick={() => buktiKameraInputRef.current?.click()}
                disabled={memuatBukti}
              >
                📷 Ambil Foto (Kamera)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", padding: "8px 14px" }}
                onClick={() => buktiGaleriInputRef.current?.click()}
                disabled={memuatBukti}
              >
                📁 Pilih Galeri / PDF
              </button>

              <input
                ref={buktiKameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => handleLampirkanFileBukti(e.target.files)}
              />
              <input
                ref={buktiGaleriInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleLampirkanFileBukti(e.target.files)}
              />
            </div>

            {memuatBukti && (
              <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "var(--muted)" }}>
                ⏳ Sedang mengompres berkas bukti transaksi…
              </div>
            )}

            {/* Daftar Foto & PDF yang dilampirkan */}
            {bukti.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: "10px",
                  marginTop: "12px",
                }}
              >
                {bukti.map((item, idx) => {
                  const isPdf = item.tipe === "application/pdf" || item.nama.toLowerCase().endsWith(".pdf");
                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        position: "relative",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        overflow: "hidden",
                        background: "var(--surface)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {isPdf ? (
                        <div
                          style={{
                            height: "85px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(239, 68, 68, 0.1)",
                            fontSize: "1.8rem",
                          }}
                        >
                          📄
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--danger)" }}>PDF</span>
                        </div>
                      ) : (
                        <img
                          src={item.dataUrl || item.driveLink}
                          alt={item.nama}
                          style={{ width: "100%", height: "85px", objectFit: "cover" }}
                        />
                      )}
                      <div style={{ padding: "6px", fontSize: "0.72rem", flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={item.nama}
                        >
                          {item.nama}
                        </div>
                        {item.driveLink && (
                          <span style={{ color: "#16a34a", fontSize: "0.68rem", fontWeight: 700 }}>
                            ✓ Di Drive
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          border: "none",
                          fontSize: "11px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onClick={() => handleHapusBukti(item.id)}
                        title="Hapus bukti ini"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              id="btn-batal"
              className={`btn-secondary ${!editTransaksi ? "btn-batal-dialog-only" : ""}`}
              onClick={onBatalEdit}
            >
              Batal
            </button>
            <button type="submit" id="btn-simpan" className="btn-primary">
              {editTransaksi ? "Simpan Perubahan" : "Simpan"}
            </button>
          </div>
        </form>
      </section>
      </div>
    </section>
  );
};
