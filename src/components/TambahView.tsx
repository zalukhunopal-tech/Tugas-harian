import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Transaksi,
  JenisTransaksi,
  NamaDana,
  BuktiItem,
  TargetTabunganItem,
  DataKegiatan,
  ItemPenyusutan,
  JenisBukti,
  FotoPendukung,
  DetailTransportasi,
  DetailRentalKendaraan,
  DetailBBM,
  DetailAkomodasi,
  DetailKonsumsi,
  UkuranKotakTempel,
  DetailHonorarium,
  DetailPerdiem,
  DataKhususKegiatan,
} from "../types";
import { KATEGORI, KAITAN, METODE_BAYAR, hariIni, formatRupiah, formatTanggalPanjang, labelKategori } from "../lib/constants";
import { buatId, muatIdTerhapus } from "../lib/storage";
import { kompresBukti } from "../lib/buktiStorage";
import {
  optimalkanGambarStruk,
  prosesStrukDenganGemini,
  HasilBacaStruk,
  ambilPengaturanGemini,
} from "../lib/geminiStruk";
import { KameraStrukModal } from "./KameraStrukModal";
import { BagianFormKegiatan, DanaKegiatanFormFields } from "./DanaKegiatanFormFields";
import {
  NavigasiLangkah,
  PenunjukLangkah,
  PeriksaKelengkapan,
  PilihJenisPengeluaran,
  bacaPreferensiBertahap,
  simpanPreferensiBertahap,
  useLayarKecil,
} from "./PengisianBertahap";
import {
  IsianBertahap,
  LangkahBertahap,
  URUTAN_LANGKAH,
  daftarPrasyarat,
  dokumenFisik,
  galatLangkah,
  indeksLangkah,
  saranUraian,
} from "../lib/prasyaratDokumen";
import { ingatStaf, kategoriBolehPenerima } from "../lib/penerimaManfaat";
import { normalisasiJenisBukti } from "../lib/constants";
import { cekKetentuanTransaksi } from "../lib/ketentuanKegiatan";
import { cariKegiatanSama, satukanKegiatanKembar } from "../lib/kegiatanSama";
import { KotakDepresiasi } from "./KotakDepresiasi";
import { FORM_PENYUSUTAN_AWAL, FormPenyusutan, formDariItem, galatForm as galatPenyusutan, itemDariForm } from "../lib/penyusutan";
import { dapatkanInfoKategori } from "../lib/kategoriIcon";
import {
  PERDIEM_RENTANG_AWAL,
  PerdiemRentang,
  buatPemasukanPribadiDariPerdiem,
  cariPasanganPerdiem,
  hitungRentangPerdiem,
  idPemasukanPribadi,
  labelRentangPerdiem,
  rencanakanPerdiemRentang,
  tanggalPendek,
  tanggalSudahAdaPerdiem,
} from "../lib/perdiemOtomatis";

/** Uraian penerimaan dana kegiatan; judul kegiatannya ada di kolom kaitan dan tidak diulang di uraian. */
const URAIAN_PENERIMAAN_DANA = "Penerimaan Dana Kegiatan";

interface TambahViewProps {
  editTransaksi: Transaksi | null;
  /** `hapusIds`: transaksi yang harus ikut dihapus bersama penyimpanan ini (mis. pemasukan pribadi perdiem yang dilepas). */
  /** `opsi.sudahMemutuskanDepresiasi`: pengguna sudah menyentuh kotak "Masukkan ke Depresiasi Aset", jadi tawaran setelah simpan tidak perlu muncul. */
  onSimpan: (t: Transaksi | Transaksi[], hapusIds?: string[], opsi?: { sudahMemutuskanDepresiasi?: boolean }) => void;
  onBatalEdit: () => void;
  /** True bila form ini dibuka dari pemasukan pribadi otomatis dan dialihkan ke perdiem Dana Kegiatan-nya. */
  dialihkanDariPerdiemPribadi?: boolean;
  initialScanFile?: File | null;
  onResetInitialScan?: () => void;
  initialScanMode?: "kamera" | "galeri" | null;
  onResetInitialScanMode?: () => void;
  daftarTransaksi?: Transaksi[];
  daftarTargetTabungan?: TargetTabunganItem[];
  targetTabunganAwalId?: string;
  daftarKegiatan?: DataKegiatan[];
  onTambahKegiatan?: (kegiatan: DataKegiatan) => void;
  /** Barang yang dipantau Depresiasi Aset: pantauan milik transaksi yang diubah dibuka lagi, dan kotak centang menyimpannya. */
  daftarPenyusutan?: ItemPenyusutan[];
  onSimpanPenyusutan?: (item: ItemPenyusutan) => void;
  onHapusPenyusutan?: (id: string) => void;
}

export const TambahView: React.FC<TambahViewProps> = ({
  editTransaksi,
  onSimpan,
  onBatalEdit,
  dialihkanDariPerdiemPribadi = false,
  initialScanFile = null,
  onResetInitialScan,
  initialScanMode = null,
  onResetInitialScanMode,
  daftarTransaksi = [],
  daftarTargetTabungan = [],
  targetTabunganAwalId = "",
  daftarKegiatan = [],
  onTambahKegiatan,
  daftarPenyusutan = [],
  onSimpanPenyusutan,
  onHapusPenyusutan,
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
  // Depresiasi Aset: isian dari kotak centang, dan apakah pengguna sendiri sudah memutuskan (centang atau lepas).
  const [penyusutan, setPenyusutan] = useState<FormPenyusutan>(FORM_PENYUSUTAN_AWAL);
  const [penyusutanDisentuh, setPenyusutanDisentuh] = useState(false);
  const [jenisBukti, setJenisBukti] = useState<JenisBukti>("Kuitansi");
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
  const [perdiem, setPerdiem] = useState<DetailPerdiem>({});
  const [penerimaManfaat, setPenerimaManfaat] = useState<string[]>([]);
  const [kotakTempel, setKotakTempel] = useState<UkuranKotakTempel | undefined>(undefined);
  // Uang harian otomatis: pengisian sekaligus per rentang tanggal dan pemasukan pribadi yang menyertai perdiem
  const [perdiemRentang, setPerdiemRentang] = useState<PerdiemRentang>(PERDIEM_RENTANG_AWAL);
  const [catatPerdiemPribadi, setCatatPerdiemPribadi] = useState<boolean>(true);
  const [galatForm, setGalatForm] = useState<string>("");

  // Pengisian bertahap pengeluaran Dana Kegiatan (HP dan tablet; PC tetap memakai form lengkap)
  const layarKecil = useLayarKecil();
  const [isiBertahap, setIsiBertahap] = useState<boolean>(bacaPreferensiBertahap);
  const [langkah, setLangkah] = useState<LangkahBertahap>("kegiatan");
  const [langkahTerjauh, setLangkahTerjauh] = useState<number>(0);
  const [galatLangkahTeks, setGalatLangkahTeks] = useState<string>("");
  const [konfirmasiBelumLengkap, setKonfirmasiBelumLengkap] = useState<boolean>(false);
  const bertahapRef = useRef<HTMLDivElement>(null);

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
  const [kameraPanduanBuka, setKameraPanduanBuka] = useState(false);

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
      const pantauanLama = daftarPenyusutan.find((x) => x.transaksiId === editTransaksi.id);
      setPenyusutan(pantauanLama ? formDariItem(pantauanLama) : FORM_PENYUSUTAN_AWAL);
      setPenyusutanDisentuh(Boolean(pantauanLama));

      // Dana Kegiatan Data
      if (editTransaksi.dana === "Dana Kegiatan") {
        setKegiatanId(editTransaksi.kegiatanId || "");
        if (editTransaksi.detailKegiatan) {
          const dk = editTransaksi.detailKegiatan;
          if (dk.jenisBukti) setJenisBukti(normalisasiJenisBukti(dk.jenisBukti) ?? "Kuitansi");
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
          setPerdiem(dk.perdiem || {});
          setPenerimaManfaat(dk.penerimaManfaat ?? []);
          setKotakTempel(dk.kotakTempel);
        } else {
          setPenerimaManfaat([]);
          setKotakTempel(undefined);
        }
      }
      // Perdiem yang sudah punya pemasukan pribadi otomatis: pilihan awalnya tetap terhubung.
      setPerdiemRentang(PERDIEM_RENTANG_AWAL);
      setCatatPerdiemPribadi(Boolean(cariPasanganPerdiem(editTransaksi, daftarTransaksi)));
      setGalatForm("");
      // Mengubah transaksi: buka ringkasan kelengkapan, semua langkah bisa dipilih.
      setLangkah("periksa");
      setLangkahTerjauh(URUTAN_LANGKAH.length - 1);
      setGalatLangkahTeks("");
      setKonfirmasiBelumLengkap(false);
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
      setPenyusutan(FORM_PENYUSUTAN_AWAL);
      setPenyusutanDisentuh(false);
      setJenisBukti("Kuitansi");
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
      setPerdiem({});
      setPenerimaManfaat([]);
      setKotakTempel(undefined);
      setPerdiemRentang(PERDIEM_RENTANG_AWAL);
      setCatatPerdiemPribadi(true);
      setGalatForm("");
      setLangkah("kegiatan");
      setLangkahTerjauh(0);
      setGalatLangkahTeks("");
      setKonfirmasiBelumLengkap(false);
    }
  }, [editTransaksi, targetTabunganAwalId]);

  // Update default kategori when dana or jenis changes
  useEffect(() => {
    // Saat mengubah transaksi, kategori tersimpan adalah sumber kebenaran: jangan ditimpa default.
    // Tanpa penjagaan ini, efek di atas (yang mengisi form dari transaksi) dan efek ini berjalan bersamaan
    // pada render pertama dengan nilai lama (kategori masih ""), sehingga kategori tersimpan tertimpa
    // kategori pertama di daftar. Penjagaan berhenti berlaku begitu pengguna mengganti jenis atau dana.
    if (
      editTransaksi &&
      editTransaksi.kategori !== "Pindah Dana" &&
      (kategori === "" ||
        (kategori === editTransaksi.kategori && dana === editTransaksi.dana && jenis === editTransaksi.jenis))
    ) {
      return;
    }
    const list = KATEGORI[dana]?.[jenis] || [];
    if (!list.includes(kategori)) {
      setKategori(list[0] || "Lain-lain");
    }
  }, [dana, jenis, kategori, editTransaksi]);

  // Penerimaan Dana (pemasukan Dana Kegiatan) hanya mencatat dana yang diterima dan Nama/Judul Kegiatannya;
  // judul itulah patokan utama laporan kegiatan, jadi kelengkapan SPJ dan rincian belanja tidak ditampilkan.
  const penerimaanKegiatan = dana === "Dana Kegiatan" && modeTransaksi === "pemasukan";
  const daftarKategoriBaku = KATEGORI[dana]?.[jenis] || [];
  // Kategori tersimpan yang tidak ada di daftar baku (mis. dari spreadsheet atau versi lama) tetap tampil
  // sebagai pilihan selama transaksi itu diubah, supaya tidak hilang diam-diam.
  const kategoriTersimpanKustom =
    editTransaksi &&
    editTransaksi.kategori &&
    editTransaksi.kategori !== "Pindah Dana" &&
    dana === editTransaksi.dana &&
    jenis === editTransaksi.jenis &&
    !daftarKategoriBaku.includes(editTransaksi.kategori)
      ? editTransaksi.kategori
      : null;
  const daftarKategori = kategoriTersimpanKustom ? [...daftarKategoriBaku, kategoriTersimpanKustom] : daftarKategoriBaku;
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
            lebarPx: kompres.lebarPx,
            tinggiPx: kompres.tinggiPx,
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
          lebarPx: kompres.lebarPx,
          tinggiPx: kompres.tinggiPx,
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
        setKameraPanduanBuka(true);
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
    if (pakaiBertahap) {
      // Enter di langkah mana pun berarti "Lanjut", bukan simpan.
      if (langkah !== "periksa") {
        lanjutLangkah();
        return;
      }
      const galatInti = galatLangkah("nominal", isianBertahap);
      if (galatInti) {
        setGalatLangkahTeks(`${galatInti} Lengkapi di langkah Nominal.`);
        return;
      }
      const wajibKurang = prasyaratBertahap.filter((p) => p.tingkat === "wajib" && !p.terpenuhi);
      if (wajibKurang.length > 0 && !konfirmasiBelumLengkap) {
        setKonfirmasiBelumLengkap(true);
        return;
      }
    }
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
      // Penerimaan Dana: judul kegiatan wajib; kegiatan dengan judul sama dipakai ulang, judul baru membuat kegiatan baru.
      let kaitanSimpan = kaitan.trim();
      let kegiatanIdSimpan = kegiatanId;
      let deskripsiSimpan = deskripsi.trim();
      if (penerimaanKegiatan) {
        if (kaitanSimpan.length < 3) {
          setGalatForm("Isi Nama/Judul Kegiatan (minimal 3 huruf), mis. Kegiatan Pemetaan Krayan Batch 4.");
          return;
        }
        const cocok = cariKegiatanSama(daftarKegiatan, { nama: kaitanSimpan, tanggalMulai: tanggal, tanggalSelesai: tanggal });
        if (cocok) {
          kegiatanIdSimpan = cocok.id;
          kaitanSimpan = cocok.nama;
        } else {
          const baru: DataKegiatan = {
            id: "kg_" + buatId(),
            nama: kaitanSimpan,
            lokasi: "",
            tanggalMulai: tanggal,
            tanggalSelesai: tanggal,
            dibuat: new Date().toISOString(),
          };
          onTambahKegiatan?.(baru);
          kegiatanIdSimpan = baru.id;
        }
        // Judul kegiatan sudah tersimpan di kaitan dan kegiatanId; uraian tidak mengulanginya.
        if (!editTransaksi || !deskripsiSimpan || deskripsiSimpan.startsWith("Penerimaan Dana")) deskripsiSimpan = URAIAN_PENERIMAAN_DANA;
      }
      if (!deskripsiSimpan) return;
      setGalatForm("");

      // Depresiasi Aset (kotak centang): pengeluaran barang saja, bukan uang harian atau penerimaan dana.
      const bolehDepresiasi = jenis === "pengeluaran" && !penerimaanKegiatan && kategori !== "Perdiem";
      if (bolehDepresiasi && penyusutan.aktif) {
        const galat = galatPenyusutan(penyusutan, jml);
        if (galat) {
          setGalatForm(galat.replace(/^Penyusutan: /, "Depresiasi Aset: "));
          return;
        }
      }

      const perdiemKegiatan = dana === "Dana Kegiatan" && jenis === "pengeluaran" && kategori === "Perdiem";

      // Membangun satu transaksi dari isian form. Pada pengisian perdiem sekaligus fungsi ini dipanggil sekali
      // per transaksi dengan tanggal, jumlah, dan rincian perdiem masing-masing; lampiran (bukti dan foto
      // pendukung) hanya dilekatkan pada transaksi pertama supaya tidak digandakan puluhan kali.
      const bangunTransaksi = (o: {
        id: string;
        tanggal: string;
        deskripsi: string;
        jumlah: number;
        perdiem?: DetailPerdiem;
        denganLampiran: boolean;
      }): Transaksi => {
        let detailKegiatanData: DataKhususKegiatan | undefined = undefined;
        if (dana === "Dana Kegiatan" && !penerimaanKegiatan) {
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
            fotoPendukung: o.denganLampiran && fotoPendukung.length > 0 ? fotoPendukung : undefined,
            transportasi: kategori === "Transportasi" ? transportasi : undefined,
            rentalKendaraan: kategori === "Rental Kendaraan" ? rentalKendaraan : undefined,
            bbm: kategori === "BBM" ? bbm : undefined,
            akomodasi: kategori === "Akomodasi" ? akomodasi : undefined,
            konsumsi: kategori === "Konsumsi" ? konsumsi : undefined,
            honorarium: kategori === "Honorarium & Ganti Hari" ? honorarium : undefined,
            perdiem: kategori === "Perdiem" ? o.perdiem ?? perdiem : undefined,
            penerimaManfaat:
              (kategoriBolehPenerima(kategori) || (kategori === "Konsumsi" && konsumsi.kudapanPerjalanan)) && penerimaManfaat.length > 0
                ? penerimaManfaat
                : undefined,
            kotakTempel: kategori !== "Perdiem" ? kotakTempel : undefined,
          };
          if (detailKegiatanData.penerimaManfaat) ingatStaf(detailKegiatanData.penerimaManfaat);
        }

        return {
          id: o.id,
          jenis,
          dana,
          tanggal: o.tanggal,
          deskripsi: o.deskripsi,
          kategori: kategori || daftarKategori[0] || "Lain-lain",
          jumlah: o.jumlah,
          metode,
          kaitan: kaitanSimpan,
          catatan: catatan.trim(),
          isTalangan,
          statusTalangan: isTalangan ? statusTalangan : undefined,
          talanganUntuk: isTalangan ? talanganUntuk.trim() : undefined,
          targetTabunganId: kategori === "Tabungan" && targetTabunganId ? targetTabunganId : undefined,
          kegiatanId: dana === "Dana Kegiatan" && kegiatanIdSimpan ? kegiatanIdSimpan : undefined,
          detailKegiatan: detailKegiatanData,
          diubah: new Date().toISOString(),
          bukti: o.denganLampiran ? bukti : [],
        };
      };

      if (perdiemKegiatan && !editTransaksi && perdiemRentang.aktif) {
        // Perdiem sekaligus untuk rentang tanggal (mis. 20 Sep - 28 Okt): satu transaksi per hari atau satu gabungan.
        const tarif = Number(perdiem.tarifPerHari) || 0;
        const hitungan = hitungRentangPerdiem(perdiemRentang, tarif);
        const idTerpakai = new Set(daftarTransaksi.map((t) => t.id));
        const idBaru = () => {
          let id = buatId();
          while (idTerpakai.has(id)) id = buatId();
          idTerpakai.add(id);
          return id;
        };
        const uraian = deskripsi.trim();
        const rencana = rencanakanPerdiemRentang({
          rentang: perdiemRentang,
          tarifPerHari: tarif,
          catatPribadi: catatPerdiemPribadi,
          sudahAda: tanggalSudahAdaPerdiem(daftarTransaksi, kegiatanId, hitungan.dipakai),
          buat: (u) =>
            bangunTransaksi({
              id: idBaru(),
              tanggal: u.tanggal,
              deskripsi: `${uraian} · ${u.labelRentang ?? tanggalPendek(u.tanggal)}`,
              jumlah: u.jumlah,
              perdiem: {
                jumlahHari: u.hari,
                tarifPerHari: Math.round(tarif),
                keterangan: [perdiem.keterangan?.trim(), u.labelRentang].filter(Boolean).join(" · ") || undefined,
              },
              denganLampiran: u.urutan === 0,
            }),
        });
        if (rencana.galat) {
          setGalatForm(rencana.galat);
          return;
        }
        onSimpan(rencana.semua);
      } else {
        const trx = bangunTransaksi({
          id: editTransaksi ? editTransaksi.id : buatId(),
          tanggal,
          deskripsi: deskripsiSimpan,
          jumlah: jml,
          denganLampiran: true,
        });
        // Pemasukan pribadi otomatis milik perdiem yang sedang diubah (bila ada). Dipertahankan bila perdiem
        // tetap perdiem Dana Kegiatan dan pilihannya masih aktif; selain itu dilepas dan dihapus.
        const pasanganLama = editTransaksi ? cariPasanganPerdiem(editTransaksi, daftarTransaksi) : undefined;
        // Pantauan Depresiasi Aset disimpan lebih dulu supaya App tahu transaksi ini sudah diputuskan; dilepas bila centang dimatikan.
        const pantauanLama = daftarPenyusutan.find((x) => x.transaksiId === trx.id);
        const pantauanBaru =
          bolehDepresiasi && penyusutan.aktif
            ? itemDariForm(penyusutan, { id: pantauanLama?.id ?? "pny_" + buatId(), transaksiId: trx.id, harga: trx.jumlah, tanggalTransaksi: trx.tanggal, namaCadangan: trx.deskripsi, lama: pantauanLama })
            : null;
        if (pantauanBaru) onSimpanPenyusutan?.(pantauanBaru);
        else if (pantauanLama) onHapusPenyusutan?.(pantauanLama.id);
        const opsiSimpan = { sudahMemutuskanDepresiasi: penyusutanDisentuh || Boolean(pantauanBaru) };
        if (perdiemKegiatan && catatPerdiemPribadi) {
          const idPasangan = pasanganLama?.id ?? idPemasukanPribadi(trx.id, muatIdTerhapus());
          onSimpan([trx, buatPemasukanPribadiDariPerdiem(trx, idPasangan)]);
        } else {
          onSimpan(trx, pasanganLama ? [pasanganLama.id] : undefined, opsiSimpan);
        }
      }
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
      setJenisBukti("Kuitansi");
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
      setPerdiem({});
      setPenerimaManfaat([]);
      setKotakTempel(undefined);
      setPerdiemRentang(PERDIEM_RENTANG_AWAL);
      setLangkah("kegiatan");
      setLangkahTerjauh(0);
      setKonfirmasiBelumLengkap(false);
      handleResetScan();
    }
  };

  const rentangPerdiemAktif =
    !editTransaksi &&
    perdiemRentang.aktif &&
    modeTransaksi !== "pindah_dana" &&
    dana === "Dana Kegiatan" &&
    jenis === "pengeluaran" &&
    kategori === "Perdiem";

  /* ---------- pengisian bertahap ---------- */
  const pakaiBertahap = layarKecil && isiBertahap && modeTransaksi === "pengeluaran" && dana === "Dana Kegiatan";
  const kegiatanTerpilih = daftarKegiatan.find((k) => k.id === kegiatanId);
  const subtotalRincian =
    Number(rincianBanyaknya) > 0 && Number(rincianHargaSatuan) > 0
      ? Math.round(Number(rincianBanyaknya) * Number(rincianHargaSatuan))
      : 0;
  const hitunganRentang = rentangPerdiemAktif ? hitungRentangPerdiem(perdiemRentang, Number(perdiem.tarifPerHari) || 0) : null;
  const detailBertahap: DataKhususKegiatan = {
    jenisBukti,
    namaPenjualPenyedia,
    rincian: subtotalRincian
      ? {
          banyaknya: Number(rincianBanyaknya),
          satuan: rincianSatuan.trim() || "unit",
          hargaSatuan: Number(rincianHargaSatuan),
          total: subtotalRincian,
        }
      : undefined,
    keteranganLaporan,
    perluSuratJustifikasi,
    alasanJustifikasi,
    transportasi,
    rentalKendaraan,
    bbm,
    akomodasi,
    konsumsi,
    honorarium,
    perdiem,
    penerimaManfaat,
    kotakTempel,
  };
  const isianBertahap: IsianBertahap = {
    kegiatanId,
    kategori,
    tanggal,
    deskripsi,
    jumlah: Number(jumlah) || 0,
    detail: detailBertahap,
    jumlahBukti: bukti.length,
    kategoriFotoPendukung: fotoPendukung.map((f) => f.kategoriFoto),
    perdiemRentang: hitunganRentang ? { hari: hitunganRentang.hari, galat: hitunganRentang.galat } : null,
  };
  const prasyaratBertahap = daftarPrasyarat(isianBertahap);

  const aturIsiBertahap = (aktif: boolean) => {
    setIsiBertahap(aktif);
    simpanPreferensiBertahap(aktif);
  };

  const pindahKeLangkah = (tujuan: LangkahBertahap) => {
    setLangkah(tujuan);
    setLangkahTerjauh((m) => Math.max(m, indeksLangkah(tujuan)));
    setGalatLangkahTeks("");
    setKonfirmasiBelumLengkap(false);
    requestAnimationFrame(() => bertahapRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  const lanjutLangkah = () => {
    const galat = galatLangkah(langkah, isianBertahap);
    if (galat) {
      setGalatLangkahTeks(galat);
      return;
    }
    if (langkah === "rincian") {
      // Saran uraian dan jumlah dari rincian yang baru diisi, hanya bila kolomnya masih kosong.
      if (!deskripsi.trim()) setDeskripsi(saranUraian(kategori, detailBertahap));
      if (!jumlah && subtotalRincian > 0) setJumlah(String(subtotalRincian));
    }
    const i = indeksLangkah(langkah);
    if (i < URUTAN_LANGKAH.length - 1) pindahKeLangkah(URUTAN_LANGKAH[i + 1].kunci);
  };

  const kembaliLangkah = () => {
    const i = indeksLangkah(langkah);
    if (i > 0) pindahKeLangkah(URUTAN_LANGKAH[i - 1].kunci);
  };

  // Potongan form. Form lengkap menyusun semuanya dengan urutan tetap; pengisian bertahap memakai sebagian per langkah.
  const renderDanaKegiatan = (bagian: BagianFormKegiatan = "semua", onLanjutBagian?: () => void) => (
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
      perdiem={perdiem}
      onUpdatePerdiem={setPerdiem}
      penerimaManfaat={penerimaManfaat}
      onUpdatePenerimaManfaat={setPenerimaManfaat}
      kotakTempel={kotakTempel}
      onUpdateKotakTempel={setKotakTempel}
      rentangPerdiem={perdiemRentang}
      onUpdateRentangPerdiem={setPerdiemRentang}
      catatPerdiemPribadi={catatPerdiemPribadi}
      onUpdateCatatPerdiemPribadi={setCatatPerdiemPribadi}
      bolehIsiSekaligus={!editTransaksi}
      tanggalForm={tanggal}
      daftarTransaksi={daftarTransaksi}
      sudahTerhubungPribadi={Boolean(editTransaksi && cariPasanganPerdiem(editTransaksi, daftarTransaksi))}
      bagian={bagian}
      onLanjut={onLanjutBagian}
    />
  );
  const blokTanggal = (
    <>
      <div className="field f-tanggal">
        <label htmlFor="tanggal">Tanggal</label>
        <input
          type="date"
          id="tanggal"
          value={rentangPerdiemAktif ? perdiemRentang.mulai || tanggal : tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          disabled={rentangPerdiemAktif}
          title={rentangPerdiemAktif ? "Tanggal mengikuti rentang uang harian di bawah" : undefined}
          required
        />
      </div>
    </>
  );
  const kegiatanBerjudulSama = useMemo(
    () => (kaitan.trim().length < 3 ? undefined : cariKegiatanSama(daftarKegiatan, { nama: kaitan, tanggalMulai: tanggal, tanggalSelesai: tanggal })),
    [kaitan, tanggal, daftarKegiatan]
  );
  // Kegiatan yang sama dari Penerimaan Dana dan Timesheet tampil sebagai satu pilihan.
  const kegiatanUntukDipilih = useMemo(
    () => [...satukanKegiatanKembar(daftarKegiatan).daftar].sort((x, y) => (x.tanggalMulai < y.tanggalMulai ? 1 : -1)),
    [daftarKegiatan]
  );
  const blokJudulKegiatan = (
    <div className="field f-judul-kegiatan" data-testid="judul-kegiatan">
      <label htmlFor="judul-kegiatan">Nama / Judul Kegiatan</label>
      {kegiatanUntukDipilih.length > 0 && (
        <select
          id="pilih-kegiatan-ada"
          aria-label="Pilih kegiatan yang sudah ada"
          value={kegiatanBerjudulSama && kegiatanBerjudulSama.nama === kaitan ? kegiatanBerjudulSama.id : ""}
          onChange={(e) => {
            const dipilih = kegiatanUntukDipilih.find((k) => k.id === e.target.value);
            if (dipilih) setKaitan(dipilih.nama);
          }}
        >
          <option value="">Pilih kegiatan yang sudah ada…</option>
          {kegiatanUntukDipilih.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama.length > 90 ? `${k.nama.slice(0, 90)}…` : k.nama}
              {k.timesheetId ? " • timesheet" : ""}
            </option>
          ))}
        </select>
      )}
      <textarea
        id="judul-kegiatan"
        rows={3}
        placeholder="Atau ketik judul kegiatan, mis. Kegiatan Pemetaan Krayan Batch 4"
        maxLength={500}
        autoComplete="off"
        value={kaitan}
        onChange={(e) => setKaitan(e.target.value.replace(/\s*\n+\s*/g, " "))}
        required
      />
      {(() => {
        if (kaitan.trim().length < 3) return <p className="judul-kegiatan__ket">Judul ini menjadi patokan utama laporan kegiatan: pengeluaran dan dokumen dengan judul yang sama dihimpun dalam satu laporan.</p>;
        return kegiatanBerjudulSama ? (
          <p className="judul-kegiatan__ket judul-kegiatan__ket--ada" data-testid="judul-ada">✓ Terhubung ke kegiatan yang sudah ada{kegiatanBerjudulSama.nama !== kaitan.trim() ? ` (${kegiatanBerjudulSama.nama.length > 80 ? `${kegiatanBerjudulSama.nama.slice(0, 80)}…` : kegiatanBerjudulSama.nama})` : ""}.</p>
        ) : (
          <p className="judul-kegiatan__ket judul-kegiatan__ket--baru" data-testid="judul-baru">Judul baru: kegiatan ini dibuat otomatis saat disimpan.</p>
        );
      })()}
    </div>
  );
  const blokUraian = penerimaanKegiatan ? null : (
    <>
      <div className="field f-uraian">
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
    </>
  );
  const tampilDepresiasi = modeTransaksi === "pengeluaran" && kategori !== "Perdiem";
  const blokDepresiasi = tampilDepresiasi ? (
    <KotakDepresiasi
      nilai={penyusutan}
      onUbah={setPenyusutan}
      onDisentuh={() => setPenyusutanDisentuh(true)}
      harga={Number(jumlah) || 0}
      tanggal={tanggal}
      uraian={deskripsi}
      kategori={kategori}
    />
  ) : null;
  const blokKategori = penerimaanKegiatan ? null : (
    <>
      {modeTransaksi !== "pindah_dana" && (
        <div className="field f-kategori">
          <label htmlFor="kategori">Kategori</label>
          <div className="kategori-pilih" role="group" aria-label="Pilih kategori" data-testid="kategori-pilih">
            {daftarKategori.map((kat) => {
              const info = dapatkanInfoKategori(kat);
              const Ikon = info.ikon;
              const isSelected = kategori === kat;
              return (
                <button
                  key={kat}
                  type="button"
                  className="kategori-ubin"
                  aria-pressed={isSelected}
                  onClick={() => setKategori(kat)}
                  style={{ "--warna": info.warna } as React.CSSProperties}
                >
                  <span className="kategori-ubin__ikon" aria-hidden="true">
                    <Ikon size={14} strokeWidth={2.4} />
                  </span>
                  <span className="kategori-ubin__nama">{labelKategori(kat)}</span>
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
                {labelKategori(kat)}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
  const blokTargetTabungan = (
    <>
      {modeTransaksi !== "pindah_dana" && kategori === "Tabungan" && daftarTargetTabungan && daftarTargetTabungan.length > 0 && (
        <div
          className="field f-target"
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
    </>
  );
  const blokJumlah = (
    <>
      <div className="field f-jumlah">
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
    </>
  );
  const blokMetode = (
    <>
      <div className="field f-metode">
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
    </>
  );
  const blokDanaKegiatanAtauKaitan = penerimaanKegiatan ? null : (
    <>
      {dana === "Dana Kegiatan" && modeTransaksi !== "pindah_dana" ? (
        <div className="field wide" style={{ padding: 0 }}>
          {renderDanaKegiatan()}
        </div>
      ) : (
        <div className="field f-kaitan">
          <label htmlFor="kaitan" id="label-kaitan">
            {kaitanMeta.label}
          </label>
          <input
            type="text"
            id="kaitan"
            list="list-saran-kaitan"
            placeholder={kaitanMeta.placeholder}
            maxLength={500}
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
    </>
  );
  const blokCatatan = (
    <>
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
    </>
  );
  const blokTalangan = penerimaanKegiatan ? null : (
    <>
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
    </>
  );
  const blokBukti = (
    <>
      {/* Lampirkan Bukti Transaksi (Requirement A1 & A2) */}
      <div className="field wide lampiran-bukti" data-testid="lampiran-bukti">
        <div className="lampiran-bukti__kepala">
          <label className="lampiran-bukti__judul">
            <span>📎 Lampiran Bukti / Nota</span>
            <span className="lampiran-bukti__ket">(Foto kamera/galeri atau PDF, bisa lebih dari satu)</span>
          </label>
          {bukti.length > 0 && <span className="lampiran-bukti__jumlah">{bukti.length} berkas terlampir</span>}
        </div>

        <div className="lampiran-bukti__tombol">
          <button
            type="button"
            className="btn-secondary lampiran-bukti__btn"
            onClick={() => buktiKameraInputRef.current?.click()}
            disabled={memuatBukti}
            data-testid="tombol-foto-bukti"
          >
            {bukti.length > 0 ? "📷 Tambah Foto Lagi" : "📷 Ambil Foto (Kamera)"}
          </button>
          <button
            type="button"
            className="btn-secondary lampiran-bukti__btn"
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

        <p className="lampiran-bukti__petunjuk" data-testid="petunjuk-banyak-foto">
          Satu pengeluaran boleh punya beberapa foto bukti, mis. tiket pesawat atau speedboat tiap orang yang ikut diklaim, atau
          beberapa struk snack perjalanan. Semua foto ikut tercetak di laporan dan dokumen Word.
        </p>

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
                  <span className="lampiran-bukti__urut" aria-label={`Bukti ${idx + 1} dari ${bukti.length}`}>
                    {idx + 1}
                  </span>
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
    </>
  );
  const blokGalat = (
    <>
      {galatForm && (
        <p id="galat-form" role="alert" style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "var(--keluar)" }}>
          {galatForm}
        </p>
      )}
    </>
  );
  const blokAksi = (
    <>
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
    </>
  );


  const renderPengisianBertahap = () => {
    const wajibKurang = prasyaratBertahap.filter((p) => p.tingkat === "wajib" && !p.terpenuhi);
    const tarifPerdiem = Number(perdiem.tarifPerHari) || 0;
    const ringkasan = [
      { label: "Kegiatan", nilai: kegiatanTerpilih ? kegiatanTerpilih.nama : "Belum dipilih", langkah: "kegiatan" as const },
      { label: "Jenis", nilai: kategori, langkah: "jenis" as const },
      {
        label: "Tanggal",
        nilai: hitunganRentang
          ? labelRentangPerdiem(perdiemRentang.mulai, perdiemRentang.selesai, perdiemRentang.kecuali.length)
          : formatTanggalPanjang(tanggal) || "—",
        langkah: "nominal" as const,
      },
      { label: "Uraian", nilai: deskripsi.trim() || "—", langkah: "nominal" as const },
      ...(penerimaManfaat.length > 0 && kategori !== "Perdiem"
        ? [{ label: "Penerima manfaat", nilai: penerimaManfaat.join(", "), langkah: "rincian" as const }]
        : []),
      {
        label: "Jumlah",
        nilai: hitunganRentang
          ? `${hitunganRentang.hari} hari × ${formatRupiah(tarifPerdiem)} = ${formatRupiah(hitunganRentang.total)}`
          : Number(jumlah) > 0
          ? formatRupiah(Number(jumlah))
          : "—",
        langkah: "nominal" as const,
      },
      {
        label: "Bukti",
        nilai:
          kategori === "Perdiem"
            ? "Sesuai TOR, tanpa nota"
            : `${jenisBukti}${bukti.length ? ` · ${bukti.length} lampiran` : " · belum ada foto"}`,
        langkah: "bukti" as const,
      },
    ];
    const catatan = cekKetentuanTransaksi(
      { dana: "Dana Kegiatan", kategori, jumlah: Number(jumlah) || 0, detailKegiatan: detailBertahap },
      kegiatanTerpilih
    ).filter((c) => c.tipe !== "peringatan");

    return (
      <div className="bertahap" ref={bertahapRef} data-langkah={langkah}>
        <PenunjukLangkah
          langkah={langkah}
          terjauh={langkahTerjauh}
          kategori={kategori}
          onPilih={pindahKeLangkah}
          onTampilkanSemua={() => aturIsiBertahap(false)}
        />

        {langkah === "kegiatan" && renderDanaKegiatan("kegiatan", lanjutLangkah)}

        {langkah === "jenis" && (
          <PilihJenisPengeluaran
            daftar={daftarKategori}
            terpilih={kategori}
            onPilih={(k) => {
              setKategori(k);
              pindahKeLangkah("rincian");
            }}
          />
        )}

        {langkah === "rincian" && (
          <>
            {(kategori === "Komunikasi, Listrik & Kurir" || kategori === "Lain-lain") && (
              <p className="help">Rincian banyaknya × harga satuan boleh dilewati bila tidak perlu.</p>
            )}
            {renderDanaKegiatan("rincian")}
          </>
        )}

        {langkah === "nominal" && (
          <>
            {blokTanggal}
            {blokUraian}
            {blokJumlah}
            {blokMetode}
            {blokDepresiasi}
            {renderDanaKegiatan("keterangan")}
          </>
        )}

        {langkah === "bukti" && (
          <>
            {kategori === "Perdiem" ? (
              <p className="help bertahap-info">
                Uang harian dibayarkan sesuai TOR kegiatan, jadi tidak memerlukan nota. Lampiran di bawah boleh dikosongkan.
              </p>
            ) : (
              renderDanaKegiatan("bukti")
            )}
            {blokBukti}
            {kategori !== "Perdiem" && renderDanaKegiatan("foto")}
            <details className="bertahap-lainnya">
              <summary>Lainnya (opsional): catatan dan talangan</summary>
              {blokCatatan}
              {blokTalangan}
            </details>
          </>
        )}

        {langkah === "periksa" && (
          <PeriksaKelengkapan
            ringkasan={ringkasan}
            prasyarat={prasyaratBertahap}
            catatan={catatan}
            dokumenFisik={dokumenFisik(kategori)}
            onKe={pindahKeLangkah}
          />
        )}

        {galatLangkahTeks && (
          <p id="galat-langkah" role="alert" className="bertahap-galat">
            {galatLangkahTeks}
          </p>
        )}

        {langkah === "periksa" ? (
          <>
            {konfirmasiBelumLengkap && wajibKurang.length > 0 && (
              <p id="peringatan-belum-lengkap" role="alert" className="bertahap-galat">
                Masih ada {wajibKurang.length} prasyarat wajib yang belum lengkap. Lengkapi lewat tombol "Lengkapi", atau
                tekan "Tetap simpan" untuk menyimpan sekarang dan melengkapinya nanti.
              </p>
            )}
            {blokGalat}
            <div className="form-actions bertahap-navigasi">
              <button type="button" className="btn-secondary" id="btn-kembali-langkah" onClick={kembaliLangkah}>
                Kembali
              </button>
              <button type="submit" id="btn-simpan" className="btn-primary">
                {konfirmasiBelumLengkap && wajibKurang.length > 0
                  ? "Tetap simpan"
                  : editTransaksi
                  ? "Simpan Perubahan"
                  : "Simpan"}
              </button>
            </div>
          </>
        ) : (
          <NavigasiLangkah bisaKembali={indeksLangkah(langkah) > 0} onKembali={kembaliLangkah} onLanjut={lanjutLangkah} />
        )}
      </div>
    );
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

      {/* Bagian Scan Struk Belanja dengan Gemini AI */}
      {!editTransaksi && (
        <section className="card-struk-scanner" aria-label="Scan Struk Belanja dengan Gemini AI">
          <div className="struk-scanner-header">
            <div className="struk-scanner-judul">
              <span className="struk-scanner-ikon" aria-hidden="true">
                🧾
              </span>
              <div>
                <h3 className="struk-scanner-nama">Scan Struk Belanja Otomatis (Gemini AI)</h3>
                <span className="help struk-scanner-ket">Foto struk kasir atau unggah gambar untuk otomatis mengisi formulir pengeluaran</span>
              </div>
            </div>
          </div>

          <div className="struk-scanner-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={memuatScan}
              onClick={() => setKameraPanduanBuka(true)}
            >
              <span aria-hidden="true">📸</span> Ambil Foto Kamera
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={memuatScan}
              onClick={() => galeriInputRef.current?.click()}
            >
              <span aria-hidden="true">🖼️</span> Pilih dari Galeri
            </button>
          </div>

          {/* Animasi Preview & Laser Scanning */}
          {memuatScan && previewFoto && (
            <div className="struk-preview-box">
              <img src={previewFoto} alt="Pratinjau Struk" className="struk-preview-img" />
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
              <div className="struk-hasil-rincian">
                <span>🏬 {hasilScan.deskripsi}</span>
                <span className="struk-hasil-pemisah" aria-hidden="true">·</span>
                <span style={{ fontWeight: 700, color: "var(--keluar)" }}>
                  💰 {formatRupiah(hasilScan.jumlah || 0)}
                </span>
                <span className="struk-hasil-pemisah" aria-hidden="true">·</span>
                <span>📅 {hasilScan.tanggal}</span>
                <span className="struk-hasil-pemisah" aria-hidden="true">·</span>
                <span>🏷️ {labelKategori(hasilScan.kategori)}</span>
                <span className="struk-hasil-pemisah" aria-hidden="true">·</span>
                <span>💳 {hasilScan.metode}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--accent)" }}>
                ↓ Silakan periksa detail pada formulir di bawah sebelum menyimpan.
              </p>
            </div>
          )}

          {/* Notifikasi Error */}
          {errorScan && !memuatScan && (
            <div
              className="struk-hasil-error"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "14px 16px",
                borderRadius: "12px",
                background: "color-mix(in srgb, var(--keluar) 12%, var(--surface))",
                border: "1.5px solid var(--keluar)",
                marginTop: "14px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  borderBottom: "1px solid color-mix(in srgb, var(--keluar) 25%, transparent)",
                  paddingBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                  <strong style={{ color: "var(--keluar)", fontSize: "0.88rem", fontWeight: 700 }}>
                    Struk Belum Berhasil Dianalisis
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={handleResetScan}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: 0,
                  }}
                  aria-label="Tutup notifikasi"
                  title="Tutup notifikasi"
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text)",
                  lineHeight: 1.5,
                  margin: 0,
                  wordBreak: "break-word",
                }}
              >
                {errorScan}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginTop: "4px",
                  paddingTop: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.76rem",
                    color: "var(--muted)",
                    lineHeight: 1.4,
                  }}
                >
                  Anda tetap dapat mengisi formulir secara manual di bawah.
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleResetScan}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                  }}
                >
                  Tutup Notifikasi
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card" id="kartu-form">
        <h2 id="judul-form">{editTransaksi ? "Ubah Transaksi" : "Formulir Transaksi"}</h2>
        <form id="form-transaksi" ref={formRef} onSubmit={handleSubmit} data-mode={modeTransaksi}>
          {dialihkanDariPerdiemPribadi && (
            <p
              id="info-dialihkan-perdiem"
              style={{
                margin: "0 0 12px",
                padding: "8px 12px",
                fontSize: "0.82rem",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
              }}
            >
              Pemasukan ini dibuat otomatis dari uang harian di Dana Kegiatan, jadi yang dibuka adalah uang hariannya.
              Perubahan di sini ikut mengubah pemasukan pribadinya.
            </p>
          )}
          <fieldset className="field segmented f-jenis">
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
            <div className="field f-dana">
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

          {pakaiBertahap ? (
            renderPengisianBertahap()
          ) : (
            <>
              {layarKecil && modeTransaksi === "pengeluaran" && dana === "Dana Kegiatan" && (
                <button type="button" className="btn-link bertahap-aktifkan" onClick={() => aturIsiBertahap(true)}>
                  Isi bertahap, satu pertanyaan per langkah
                </button>
              )}
              {blokTanggal}
              {blokUraian}
              {penerimaanKegiatan && blokJudulKegiatan}
              {blokKategori}
              {blokTargetTabungan}
              {blokJumlah}
              {blokMetode}
              {blokDepresiasi}
              {blokDanaKegiatanAtauKaitan}
              {blokCatatan}
              {blokTalangan}
              {blokBukti}
              {blokGalat}
              {blokAksi}
            </>
          )}
        </form>
      </section>
      </div>

      {/* Modal Kamera dengan Kotak Panduan */}
      {kameraPanduanBuka && (
        <KameraStrukModal
          onTutup={() => setKameraPanduanBuka(false)}
          onFotoTerambil={(file) => {
            void handleProsesFileStruk(file);
          }}
        />
      )}


    </section>
  );
};
