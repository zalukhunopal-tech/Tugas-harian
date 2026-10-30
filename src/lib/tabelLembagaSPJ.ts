/**
 * Tabel Kelengkapan Pelaporan Keuangan (17 Kategori Resmi Lembaga).
 * Disusun persis dari dokumen otoritatif lembaga "Kelengkapan Pelaporan Keuangan.pdf".
 * Tidak ada parafrase, ringkasan, atau perubahan redaksi/angka pajak yang diizinkan.
 */

export interface ButirKelengkapanLembaga {
  nomor: number;
  jenis: string;
  dokumenPendukung: string[];
}

export const TABEL_KELENGKAPAN_LEMBAGA: ButirKelengkapanLembaga[] = [
  {
    nomor: 1,
    jenis: "Seluruh Kwitansi",
    dokumenPendukung: [
      "Memfotocopy bukti pembayaran yang mudah hilang (alfamart, Indomart, SPBU)",
      "Keterangan HARUS jelas untuk Rincian Pembelian(Jumlah, harga satuan), Tanggal, stampel toko, alamat, nama, telpon",
      "Tidak boleh ada perubahan (coretan, perubahan informasi / jumlah / deskripsi / tanggal, dll) pada tanda terima)",
      "Invoice harus disertai Kwitansi Pembayaran",
      "Nota /Kwitansi mulai dari 5 Juta membubuhkan materai 10.000",
      "Kwitansi HARUS Asli",
      "Tidak dibolehkan mengklaim kebutuhan pribadi (termasuk obat2an kecuali P3K)",
      "Apabila ada tambahan dalam pembelian mohon dibuat di kwitansi baru",
    ],
  },
  {
    nomor: 2,
    jenis: "Pengadaan Barang",
    dokumenPendukung: [
      "Staf tidak diperkenankan melakukan pembelian barang, staf hanya memasukkan surat permintaan pembelian barang ke administrasi",
      "Pengadaan Barang akan dilakukan oleh admininstrasi (Apabila Harus dibeli oleh staf Mohon melampirkan persetujuan dari ADM",
      "Permintaan pembelian barang yang di setujui koordinator, Persetujuan pembelian barang diluar Tor",
      "Nota diatas 5 Juta materai 10.000",
      "Tanggal, stampel toko, alamat, nama, telpon",
      "Pembelian diatas 5 Juta Melampirkan Kelengkapan pada list pengadaan ( 3 penawaran, dll)",
      "Rincian barang & harga satuan jelas",
    ],
  },
  {
    nomor: 3,
    jenis: "Honorarium",
    dokumenPendukung: [
      "Surat Penujukan Narasumber, Keynote, panitia Kegiatan",
      "Melampirkan kontrak dengan format terlampir CV",
      "Timesheet sesuai dengan hari dibayarkan (apabila perhari)",
      "Laporan Kegiatan/ Makalah (Narasumber)/materi yang disampaikan",
      "Kwitansi menjelaskan jasa yg diberikan, judul kegiatan, nama dan ttd dan materai diatas 5 Juta, sesi yang diambil untuk narasumber",
      "Biaya diatas 5 Juta Melampirkan Kelengkapan pada list pengadaan ( 3 penawaran, dll)",
      "Melampirkan KTP dan NPWP untuk kepentingan perpajakan",
      "Honor diatas Rp. 450.000 dipotong pajak (cara perhitungan : total dibagi 2 dikali persentase pajak. Untuk ganti hari dan honor diatas Rp.450.000, dan Pajak atas hadiah sebesar 20% dari total yang diterima) Untuk PNS tidak ada batas minimal, seluruh jumlah Honor dipotong pajak 5% untuk yang memiliki NPWP, dan 6% yang tidak memiliki NPWP. Untuk Lebih Jelas silahkan Lihat File Penerapan PPH pasal 21 atas Honor",
    ],
  },
  {
    nomor: 4,
    jenis: "Tiket Pesawat",
    dokumenPendukung: [
      "Kwitansi asli yang lengkap dari travel/Receipt",
      "Jika online E-Ticket",
      "Pembelian diatas 5 Juta Melampirkan Kelengkapan pada list pengadaan ( 3 penawaran, dll)",
      "Boarding pass asli",
    ],
  },
  {
    nomor: 5,
    jenis: "Transportasi (Travel, ojek, dll)",
    dokumenPendukung: [
      "Tiket Asli",
      "Struck pembayaran taksi/ travel, atau kutiansi dengan informasi no taxi/no. polisi,nama supir,no telp taxi/supir, STNK Kendaraan",
      "Pembelian diatas 5 Juta Melampirkan Kelengkapan pada list pengadaan ( 3 penawaran, dll)",
      "Karcis tol/parkir",
    ],
  },
  {
    nomor: 6,
    jenis: "Rental Mobil/ Motor",
    dokumenPendukung: [
      "Kwitansi atau nota sewa kendaraaan dari vendor atau pemilik dengan alamat, telp & stempel serta materai Rp. 10.000 untuk penyewaan di atas Rp. 5 juta.",
      "Pembelian diatas 5 Juta Melampirkan Kelengkapan pada list pengadaan ( 3 penawaran, dll)",
      "Fotocopy STNK, sim, KTP Peneriama Uang Rental/ Sewa kendaraan",
      "Form peminjaman kendaaraan roda 4",
      "Karcis tol, karcis parkir",
    ],
  },
  {
    nomor: 7,
    jenis: "Akomodasi",
    dokumenPendukung: [
      "Pembelian diatas 5 Juta Melampirkan Kelengkapan pada list pengadaan ( 3 penawaran, dll)",
      "Kwitansi mencantumkan Lokasi, tanggal, berapa lama, nama, ttd pemilik rumah, no. Telpon, KTP",
    ],
  },
  {
    nomor: 8,
    jenis: "Komunikasi, listrik, Telpon, Jasa Kurir",
    dokumenPendukung: [
      "Tanggal, bukti pemakaian Telpon (Detail Telpon/ biling telpon), Tagihan PLN, Kwitansi Asli.",
    ],
  },
  {
    nomor: 9,
    jenis: "Konsumsi Rapat/ Internal Meeting, Konsumsi Perjalanan/Bakon",
    dokumenPendukung: [
      "Kwitansi menjelaskan tanggal, nama penyedia, no telpon, rincian pembelian (Jumlah yang dibeli, harga Satuan, total), jumlah, lokasi, notulensi, rangkuman rapat untuk setiap konsusmi diskusi, meeting, rapat",
      "3 Penawaran untuk pembelian diatas 5 juta mengacu pada list Pengadaan",
      "Absensi asli, surat penjelasan apabila konsumsi lebih banyak dari jumlah absen, detail bakon",
      "Tidak diperbolehkan mengklaim minuman berenergi dan vitamin",
      "Foto kegiatan",
    ],
  },
  {
    nomor: 10,
    jenis: "Absensi/Ganti Hari",
    dokumenPendukung: [
      "Untuk pembayaran lebih dari 1 orang 1 hari dan atau lebih dari 1 hari untuk 1 orang",
      "Ganti hari dikenakan pajak kepada PNS, untuk orang desa/Rimba di atas Rp. 450.000,-",
      "Dikenakan Potongan Pajak sebesar 5% dengan NPWP dan 6 % tanpa NPWP",
      "Mencantumkan Nomor Absen pada kwitansi ganti hari",
      "KTP dan NPWP untuk kepentingan Perpajakan",
      "Tanda tangan Absensi harus konsisten dengan tanda terima/kwitansi ganti hari dan transport, apabila tidak sesuai akan menjadi tanggungjawab pribadi.",
    ],
  },
  {
    nomor: 11,
    jenis: "Penyerahan Perlengkapan kegiatan/ Seminar KIT",
    dokumenPendukung: [
      "Form tanda terima barang, ditanda tangani, dengan keterangan jenis dan jumlah barang yang diserahkan",
    ],
  },
  {
    nomor: 12,
    jenis: "BBM",
    dokumenPendukung: [
      "Mencatat KM pada saat pengisian BBM, Jarak tempuh, dan lokasi dari mana ke mana",
      "Kwitansi Asli, nama, lokasi, detail pembelian, no telpon, Plat No. Polisi kendaraan yang di isi",
    ],
  },
  {
    nomor: 13,
    jenis: "PCR/Antigen",
    dokumenPendukung: [
      "Kwitansi Asli, Melampirkan hasil test PCR/antigen baik cetak, foto, screen shoot peduli Lindungi",
    ],
  },
  {
    nomor: 14,
    jenis: "Gaji/Honor Staff",
    dokumenPendukung: [
      "Timesheet",
      "Kontrak Staf",
      "CV",
      "SK pengangkatan/penunjukan",
      "Dikenakan Potongan Pajak sebesar 5% dengan NPWP dan 6 % tanpa NPWP",
    ],
  },
  {
    nomor: 15,
    jenis: "Perdiem",
    dokumenPendukung: [
      "Sesuai dengan tor jika tidak mohon berikan penjelasan pada Btor",
    ],
  },
  {
    nomor: 16,
    jenis: "Over budget",
    dokumenPendukung: [
      "Alasan Atas Variansi Biaya Claim (reimbust)",
      "Mohon untuk memastikan alasan yang dicantumkan atas dasar kegiatan yang dilakukan (kenapa sangat penting dilakukan) dan tidak membuat alasan atas pengalihan dari project lain.",
    ],
  },
  {
    nomor: 17,
    jenis: "Lain-lain",
    dokumenPendukung: [
      "Surat Tugas sudah disetujui, dan sesuai dengan Tor",
      "Isi ToR sudah menjelaskan kegiatan yang akan saya lakukan sesuai dengan Advance dan hasil Workshop",
      "Isi BTOR sudah menjawab ToR dan perdiem, dibuat pertanggal dan ada foto kegiatannya",
      "Menyusun kwitansi/nota dengan urutan sesuai yang di input di WiMIS",
      "Laporan keuangan ini sudah bisa menjelaskan dirinya sendiri",
      "Menyerahkan Laporan Fisik Paling lambat 14 hari setelah Kegiatan berakhir",
    ],
  },
];
