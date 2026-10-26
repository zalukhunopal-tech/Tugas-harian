#!/usr/bin/env bash
# Menolak data pribadi yang tidak boleh ikut di repo publik atau di hasil build. Dipanggil dari
# .github/workflows/keamanan.yml dan bisa dijalankan sendiri: bash scripts/periksa_data_pribadi.sh
# Hanya pola umum yang bisa diperiksa di sini (nama orang tidak boleh ditulis di repo): ID folder/berkas Google Drive,
# alamat email nyata, dan isi bawaan Profil Pelapor.
set -u
cd "$(git rev-parse --show-toplevel)"
gagal=0
lingkup=(src public artefak scripts index.html)

# 1. ID folder atau berkas Google Drive (33 atau 44 karakter berawalan 1) di dalam tanda kutip.
if git grep -nIE "[\"'\`]1[A-Za-z0-9_-]{32}([A-Za-z0-9_-]{11})?[\"'\`]" -- "${lingkup[@]}" ':!*.zip'; then
  echo "::error::Ada ID folder/berkas Google Drive yang tertulis di kode. Folder harus dicari lewat nama atau dipilih pengguna, bukan ditanam."
  gagal=1
fi

# 2. Alamat email selain contoh (example.org / example.com). Mengabaikan nama paket npm berawalan @.
email=$(git grep -nIiE "[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}" -- "${lingkup[@]}" ':!*.zip' ':!*.svg' | grep -viE "@example\.(org|com)" | grep -viE "@(types|vitejs|google|resvg|firebase|react)/" || true)
if [ -n "$email" ]; then
  echo "$email"
  echo "::error::Ada alamat email nyata. Pakai @example.org atau @example.com untuk contoh dan uji."
  gagal=1
fi

# 3. Bawaan Profil Pelapor harus kosong (aplikasi dipakai banyak orang).
isi=$(awk '/export const PROFIL_PELAPOR_DEFAULT *= *\{/,/\};/' src/lib/constants.ts | grep -E "^[[:space:]]*[a-z]+: *\"" | grep -vE ":[[:space:]]*\"\"," || true)
if [ -n "$isi" ]; then
  echo "$isi"
  echo "::error::PROFIL_PELAPOR_DEFAULT berisi nilai. Kosongkan; pengguna mengisinya sendiri di tab Saya."
  gagal=1
fi

# 4. Berkas biner hasil build yang membawa salinan lama aplikasi tidak boleh ikut dilacak.
if git ls-files | grep -E "^public/.*\.zip$"; then
  echo "::error::Ada arsip .zip di public/. Arsip lama membawa salinan aplikasi (dan bawaan lamanya); buat ulang saat deploy, jangan dilacak."
  gagal=1
fi

# 5. Kata-kata milik Anda sendiri (nama, lembaga, toko langganan, lokasi kegiatan). Kata itu tidak ditulis di repo; berikan lewat
#    variabel lingkungan, dipisah "|":  PERIKSA_KATA_PRIBADI="kata satu|kata dua" bash scripts/periksa_data_pribadi.sh
#    Tambahkan PERIKSA_RIWAYAT=1 untuk ikut memeriksa riwayat Git (semua cabang): isi lama yang sudah dihapus dari berkas
#    masih bisa dibaca siapa pun selama commit-nya ada di repo publik.
if [ -n "${PERIKSA_KATA_PRIBADI:-}" ]; then
  if git grep -nIiE "$PERIKSA_KATA_PRIBADI" -- "${lingkup[@]}" README.md SECURITY.md ':!*.zip' ':!*.svg'; then
    echo "::error::Ada kata pribadi Anda (PERIKSA_KATA_PRIBADI) di berkas yang dilacak."
    gagal=1
  fi
  if [ "${PERIKSA_RIWAYAT:-0}" = "1" ]; then
    riwayat=$(git log --all --oneline -i -G"$PERIKSA_KATA_PRIBADI" 2>/dev/null || true)
    if [ -n "$riwayat" ]; then
      echo "$riwayat"
      echo "::error::Riwayat Git masih memuat kata pribadi Anda pada commit di atas (lihat SECURITY.md: Membersihkan riwayat Git)."
      gagal=1
    fi
  fi
fi

[ "$gagal" -eq 0 ] && echo "Tidak ada data pribadi yang terdeteksi."
exit "$gagal"
