# Aturan kerja di repositori ini

## Periksa perubahan sebelum mengedit file

Setiap kali akan mengedit, membuat, atau menimpa file di repositori ini (lewat git di sesi, atau lewat alat GitHub seperti
`create_or_update_file` dan `push_files`), **periksa dulu apakah file itu sudah berubah**. Jangan mengedit dari salinan lama.

1. **Ambil kabar terbaru**: `git fetch origin`, lalu bandingkan cabang kerja dengan remote dan `main`
   (`git status -sb`, `git log --oneline HEAD..origin/<cabang>` dan `HEAD..origin/main`).
2. **Lihat apakah file yang akan diubah ikut berubah**: `git diff HEAD..origin/<cabang> -- <file>` dan
   `git diff HEAD..origin/main -- <file>`. Periksa juga perubahan lokal yang belum di-commit (`git status`, `git diff`).
3. **Bila ada perubahan**: gabungkan dulu (`git merge origin/<cabang>`, atau `origin/main` bila cabang sudah di-merge ke `main`),
   lalu **baca ulang file** sebelum mengedit. Jangan menimpa pekerjaan orang lain; bila bentrok dan tidak jelas mana yang benar,
   tanyakan kepada pemilik repositori.
4. **Lewat alat GitHub** (tanpa git lokal): ambil isi dan SHA terbaru file di cabang tujuan (`get_file_contents`) tepat sebelum
   menulis, dan kirim SHA itu saat memperbarui. Bila SHA berubah di tengah jalan, ulangi dari langkah 1.
5. **Bila peralatan menyatakan file berubah di disk** sejak dibaca terakhir, anggap itu keadaan terbaru: baca ulang, jangan
   dikembalikan.
6. **Sebelum push**: ulangi `git fetch origin` dan pastikan cabang tidak tertinggal. Tidak boleh force-push atau menulis ulang
   riwayat tanpa persetujuan eksplisit pemilik repositori.

Setelah memeriksa, sebutkan hasilnya singkat di laporan (mis. "tidak ada perubahan baru di remote" atau "menggabungkan 2 commit
baru dari main sebelum mengedit").
