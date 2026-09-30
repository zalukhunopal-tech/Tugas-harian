# ZalukhuR Downloader

Aplikasi web untuk mencari, memfilter, memotong (crop AOI), dan mengunduh citra **Sentinel-2 L2A**
sebagai GeoTIFF / Cloud Optimized GeoTIFF (COG) beserta `metadata.json`.

> **Status: Tahap 1 + 2 + 3.** Peta, AOI, query katalog, filter tanggal & cloud cover, daftar scene,
> preview, crop AOI, unduhan GeoTIFF/COG, **cloud masking level piksel (SCL)**, **pengisian dari citra
> sebelumnya**, **komposit multi-tanggal**, **indeks NDVI/NDWI/NBR**, **deteksi perubahan**, dan **batch
> processing** berfungsi. “AI analysis” dari PRD belum dibuat (tidak ada spesifikasinya; lihat Rencana). Cloud cover katalog hanya penyaring scene awal;
> awan tepat di atas AOI ditangani oleh mask piksel (lihat “Cloud masking”).

## Alur

```
Peta → AOI (draw / upload / koordinat) → tanggal + cloud cover → CARI CITRA
     → daftar scene → Preview → Pilih → [cloud mask + citra sebelumnya] → band/resolusi/format → PROSES
     → [indeks / deteksi perubahan] → PROSES (satu scene, atau batch banyak scene)
     → job (QUEUED → DOWNLOADING → PROCESSING → CROPPING → GENERATING → COMPLETED)
     → GeoTIFF / COG / peta QA / indeks / peta perubahan / metadata.json (batch: satu ZIP)
```

Crop dilakukan **saat pembacaan**: hanya window AOI dari tiap band (COG di S3 publik, HTTP range request)
yang diunduh, bukan seluruh scene.

## Menjalankan

Prasyarat: Python ≥ 3.11 dan Node ≥ 20. Rasterio/GDAL terpasang lewat wheel (tidak perlu GDAL sistem).

**Cara tercepat (satu perintah, satu server)**

```bash
cd zalukhur-downloader
./run.sh            # pasang dependensi + bangun UI (sekali), lalu buka http://127.0.0.1:8000
```

`./run.sh setup` hanya memasang; `./run.sh start` hanya menjalankan; `HOST`/`PORT` mengatur alamat.

**Di web tanpa memasang apa pun: GitHub Codespaces** (URL privat, hanya akun GitHub Anda)

1. Di GitHub, buka repositori → *Code* → *Codespaces* → *New with options…*.
2. Pilih branch yang memuat folder `.devcontainer` dan konfigurasi **ZalukhuR Downloader**.
3. Tunggu ±1–2 menit; aplikasi terbuka otomatis di tab baru (port 8000, privat). Log: `/tmp/zalukhur.log`.

Katalog Sentinel diakses dari server Codespaces, jadi pencarian dan unduhan bekerja seperti di komputer sendiri.

**Docker (hosting sendiri)**

```bash
docker compose up --build        # http://localhost:8000 ; hasil job di volume zalukhur-data
# atau: docker build -t zalukhur-downloader . && docker run -p 8000:8000 -v zalukhur-data:/data zalukhur-downloader
```

Image yang sama bisa dipakai di Render/Railway/Fly (variabel `PORT` dihormati). **Sebelum membuka ke publik**: aplikasi
belum punya autentikasi dan pembatasan laju, sementara tiap unduhan memakai CPU dan bandwidth server. Taruh di belakang
reverse proxy dengan login atau batasi aksesnya. (Catatan: Dockerfile ditulis dan langkah-langkahnya diperiksa manual,
tetapi image-nya belum pernah dibangun di lingkungan pengembangan ini karena tidak ada daemon Docker.)

**Mode pengembangan (dua proses)**

```bash
# Backend
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:create_app --factory --reload      # http://127.0.0.1:8000  (docs: /docs)

# Frontend (terminal lain)
cd frontend
npm install
npm run dev                                          # http://localhost:5173 (proxy /api → :8000)
```

Produksi satu server tanpa skrip: `npm run build` lalu `FRONTEND_DIST=../frontend/dist uvicorn app.main:create_app --factory`.

### Konfigurasi (environment variable, hanya di backend)

| Variabel | Bawaan | Keterangan |
|---|---|---|
| `STAC_URL` | `https://earth-search.aws.element84.com/v1` | Katalog STAC Sentinel-2 L2A (COG, tanpa kredensial) |
| `STAC_COLLECTION` | `sentinel-2-l2a` | |
| `DATA_DIR` | `./data` | Folder hasil job (dihapus otomatis setelah `JOB_TTL_HOURS`, bawaan 24) |
| `MAX_AOI_KM2` | `2500` | Batas luas AOI |
| `MAX_OUTPUT_PIXELS` | `60000000` | Batas piksel per band pada satu unduhan |
| `MAX_UPLOAD_MB` | `20` | Batas ukuran berkas AOI |
| `JOB_WORKERS` | `2` | Jumlah proses job paralel |
| `CORS_ORIGINS` | `http://localhost:5173,…` | Asal yang diizinkan (dev) |
| `FRONTEND_DIST` | – | Bila diisi, backend juga melayani frontend hasil build |
| `USER_AGENT` | `ZalukhuR-Downloader/1.0 …` | Dipakai untuk pencarian lokasi (Nominatim) |

Tidak ada kunci/rahasia di frontend. Bila kelak memakai Copernicus Data Space, kredensialnya cukup ditaruh di
environment backend.

## API

| Endpoint | Fungsi |
|---|---|
| `GET /api/config` | Batas, daftar band, preset, resolusi |
| `POST /api/aoi` | Validasi/normalisasi AOI dari geometri, atau `lat`,`lon`,`radius_m` |
| `POST /api/aoi/upload` | AOI dari GeoJSON / KML / SHP(ZIP) / GeoPackage |
| `POST /api/scenes/search` | `aoi`, `start_date`, `end_date`, `max_cloud_cover`, `satellite`, `product_level` |
| `POST /api/scenes/preview` | PNG true/false color pada AOI + koordinat sudut untuk peta |
| `POST /api/scenes/previous` | Kandidat citra sebelumnya (lebih lama, menutupi AOI, terdekat dulu) |
| `POST /api/scenes/aoi-cloud` | % awan (SCL) tepat di dalam AOI per scene |
| `POST /api/batch` | Opsi yang sama untuk ≤ 20 scene (`scene_ids`); satu job per scene. `GET /api/batches/{id}`, `GET /api/batches/{id}/download.zip` |
| `POST /api/download` | Membuat job (202) — crop, dan bila `cloud_mask.enabled`, mask + pengisian; `GET /api/jobs/{id}`; `GET /api/jobs/{id}/files/{nama}` |
| `GET /api/geocode?q=` | Pencarian lokasi (Nominatim, lewat backend) |

Pengganti endpoint `/api/process/{cloud-mask,crop,composite}` pada PRD: satu endpoint `/api/download` dengan
objek `cloud_mask` (`enabled`, `classes`, `dilate_m`, `fill_from_previous`, `previous_scene_ids`, `include_qa`);
crop, mask, dan komposit adalah satu job sehingga data tidak diunduh berulang. `/api/scenes/preview` menerima
objek `cloud_mask` yang sama untuk pratinjau.

Opsi tambahan Tahap 3 pada `/api/download` dan `/api/batch`: `indices` (`NDVI`,`NDWI`,`NBR`; `bands` boleh kosong bila
ada indeks), `change` (`enabled`, `index`, `reference_scene_id`, `threshold`), dan `cloud_mask.auto_previous` /
`auto_lookback_days` (pilih 1–5 citra sebelumnya otomatis). `/api/scenes/preview` menerima `mode`
`ndvi`/`ndwi`/`nbr`.

Pesan error berbahasa Indonesia dalam bentuk `{"code": "...", "detail": "..."}`.

## Perilaku geospasial

- **CRS & georeferensi**: keluaran berada di CRS asli scene (UTM). Grid keluaran disejajarkan dengan origin tile,
  sehingga untuk band yang resolusi aslinya sama dengan resolusi keluaran, nilai piksel **identik** dengan sumber
  (diverifikasi terhadap data Sentinel-2 asli, lihat “Pengujian”).
- **NoData** = 0 (konvensi Sentinel-2). Piksel di luar poligon AOI (opsional, bawaan aktif), di luar tepi scene,
  atau tanpa data menjadi NoData. `valid_pixel_pct` per band dicatat di metadata.
- **Reflektansi**: nilai disimpan sebagai DN `uint16`; `scale`/`offset` **efektif** ditulis sebagai scale/offset
  GeoTIFF sehingga QGIS/GDAL dapat mengonversi: `reflektansi = DN × scale + offset`. Earth Search menandai scene
  baseline ≥ 04.00 dengan `earthsearch:boa_offset_applied = true`: offset BOA (+1000) sudah dikurangkan dari DN,
  walau `raster:bands.offset` di metadata masih −0,1. Aplikasi **mengabaikan** offset katalog itu (offset efektif 0)
  dan mencatatnya di `band_details` (`offset_declared_in_catalog`). Dasarnya pengukuran pada data asli: median
  B05 di tutupan vegetasi ≈ 880–960 pada scene 2021 (tanpa offset), 2022, dan 2024; bila offset −0,1 diterapkan
  reflektansi hutan menjadi negatif. Katalog tanpa flag itu dipercaya sesuai metadatanya.
- **Resampling eksplisit** (dicatat di metadata per band): `auto` = nearest saat resolusi keluaran lebih halus
  dari resolusi asli band (nilai asli tidak “dikarang”), average saat lebih kasar. Bisa diganti manual.
- **Urutan band** mengikuti urutan pilihan pengguna. Preset RGB = `B04, B03, B02` (band 1–3 = R, G, B) agar
  tampil benar secara default di QGIS/ArcGIS; nama band ada di *band description* dan `metadata.json`.
- **Scene yang hanya menutupi sebagian AOI** ditandai di daftar (persentase) dan dicatat di metadata.
- AOI pada sisi antimeridian (±180°) belum didukung.

## Cloud masking (Tahap 2)

Dipisahkan tegas dari *cloud cover*: cloud cover katalog hanya menyaring scene; mask bekerja per piksel.

1. **Mask SCL** — kelas yang bisa dipilih: awan (SCL 8–9), bayangan awan (3), cirrus (10), salju/es (11, tidak aktif
   bawaan). Mask bisa diperbesar (`dilate_m`, bawaan 20 m) untuk menutup tepi awan tipis. Pada resolusi 60 m,
   satu piksel SCL 20 m yang berawan me-mask seluruh blok 60 m (aturan “any”, konservatif).
   Aset probabilitas awan (CLD) **tidak tersedia** dari sumber ini, jadi hanya SCL yang dipakai.
2. **Isi dari citra sebelumnya** — citra sebelumnya *hanya* mengisi piksel yang ter-mask di citra utama; piksel
   bersih tidak diganti. Citra pengisi juga di-mask dengan aturan yang sama, jadi piksel berawan tidak dipakai
   untuk mengisi.
3. **Komposit multi-tanggal** — pilih beberapa citra sebelumnya (maks 5); dipakai berurutan sesuai prioritas
   (urutan klik). Piksel yang tetap berawan di semua citra tetap **NoData** (0).
4. **Harmonisasi radiometrik** — DN citra pengisi dikonversi ke skala/offset **efektif** citra utama
   (`reflektansi = DN × scale + offset`). Pada Earth Search semua offset efektif 0 sehingga DN disalin apa adanya;
   konversi hanya aktif bila sumbernya berbeda (mis. data ESA mentah beroffset −0,1). Diuji terhadap data asli.
5. **Peta QA** (`*_QA.tif`, uint8, nodata 255): `1` = citra utama bersih, `2…N+1` = diisi dari citra sebelumnya
   ke‑1…N, `254` = ter-mask tanpa pengganti, `255` = di luar AOI / tanpa data. Legenda ada di `metadata.json`.
6. **Metadata** mencatat metode, kelas & kode SCL, dilasi, citra sebelumnya (id, tanggal, piksel terisi), dan statistik
   (ter-mask %, terisi %, sisa NoData %).

Catatan perilaku: piksel `NO_DATA` di citra utama (di luar swath/tepi tile) tidak dianggap awan dan tidak diisi.
Citra pengisi harus lebih lama dari citra utama dan menutupi AOI; boleh berbeda tile (direproyeksikan ke grid keluaran).
Pratinjau (“Pratinjau hasil di peta”) menampilkan sisa NoData berwarna magenta.

## Indeks spektral (Tahap 3)

| Indeks | Rumus | Band |
|---|---|---|
| NDVI | (B08 − B04) / (B08 + B04) | vegetasi |
| NDWI (McFeeters) | (B03 − B08) / (B03 + B08) | air |
| NBR | (B08 − B12) / (B08 + B12) | luka bakar / vegetasi |

- Dihitung dari **reflektansi** (`DN × scale + offset` efektif), bukan DN mentah. Reflektansi negatif (derau) dipotong
  ke 0; piksel dengan penyebut ≤ 0 atau band NoData menjadi NoData. Keluaran Float32, NoData = −9999, rentang −1…1,
  satu berkas per indeks (`*_NDVI.tif`, dan `*_NDVI_COG.tif` bila COG dipilih). Statistik (rata-rata, min, maks, % valid)
  ada di `metadata.json` → `products.indices`.
- Indeks mengikuti cloud mask/pengisian yang sama dengan band: piksel berawan menjadi NoData, atau diisi dari citra
  sebelumnya bila diminta.
- NBR memakai B12 (20 m); pada 10 m nilainya di-*upsample* (nearest) sesuai pengaturan resampling.

## Deteksi perubahan (Tahap 3)

Δ = indeks citra utama (terbaru) − indeks citra referensi (lebih lama; harus lebih lama dan menutupi AOI).
Keluaran: `*_d<INDEKS>_vs_<tanggal>.tif` (selisih, Float32) dan `*_change_<INDEKS>_vs_<tanggal>.tif` (uint8, nodata 0:
`1` turun, `2` tidak berubah signifikan, `3` naik; ambang ±`threshold`, bawaan 0,1). `metadata.json` →
`products.change_detection` memuat piksel, luas (ha), dan persen per kelas.

- Indeks tiap tanggal dihitung dari reflektansi tanggalnya sendiri. Bila cloud mask aktif, citra referensi di-mask
  dengan aturan yang sama (tanpa pengisian); piksel berawan di salah satu tanggal menjadi NoData, bukan “perubahan”.
  UI memperingatkan bila cloud mask mati.
- Untuk dNBR luka bakar klasik (pre − post), balik tandanya: dNBR = −Δ.
- Ambang bersifat umum, bukan klasifikasi baku (mis. tingkat keparahan USGS); sesuaikan untuk kasus Anda.

## Batch processing (Tahap 3)

Centang “Batch” pada beberapa scene (maks 20), atur opsi sekali, lalu proses. Satu job per scene di antrean yang sama
(paralelisme `JOB_WORKERS`); kegagalan satu scene tidak menghentikan yang lain (status batch `COMPLETED_WITH_ERRORS`).
Hasil selesai dapat diunduh sekaligus sebagai satu ZIP (satu folder per scene). Pengisian dari citra sebelumnya di
batch selalu otomatis (`auto_previous`, 1–5 terdekat, tile sama lebih dulu); deteksi perubahan belum tersedia untuk batch
karena butuh satu referensi per scene.

## Struktur

```
backend/app/
  api/        aoi.py  query.py  processing.py  download.py  geocode.py
  services/   aoi.py (baca/validasi)  catalog.py (Query Engine STAC)  crop.py  preview.py
              cloud_mask.py (SCL)  composite.py (isi/QA/harmonisasi)  previous.py  change.py
              assets.py (offset efektif)  scene_reader.py (jalur baca bersama)
  processing/ raster.py (grid, mask, window)  resampling.py  metadata.py  indices.py
  models/     aoi.py  scene.py
  jobs.py     antrean job + status tersimpan di disk   batches.py  batch = kumpulan job + ZIP
frontend/src/ App.tsx  components/{MapView,AoiPanel,FilterPanel,SceneList,DownloadPanel,CloudMaskPanel,ChangePanel,BatchPanel,GeocodeBox}  lib/
```

## Pengujian

```bash
cd backend && pytest                       # 103 tes: AOI, katalog (mock), crop, cloud mask/komposit, indeks, perubahan, batch, radiometri, API
cd frontend && npm test && npm run typecheck
cd frontend && npm run build && npm run test:e2e   # e2e browser + backend asli + katalog STAC palsu
cd backend && PYTHONPATH=. python scripts/verify_real_scene.py        # crop ke scene Sentinel-2 ASLI (butuh internet)
cd backend && PYTHONPATH=. python scripts/verify_real_cloud_mask.py  # mask + isi multi-tanggal pada data ASLI (2021 + 2024)
cd backend && PYTHONPATH=. python scripts/verify_real_indices.py     # NDVI/NDWI/NBR + perubahan dibandingkan hitungan independen pada data ASLI
```

Data sintetis / katalog palsu **hanya** dipakai di tes otomatis (`backend/tests`). Aplikasi berjalan memakai
katalog dan data Sentinel-2 sungguhan.

## Keterbatasan yang diketahui

- Cloud masking hanya memakai SCL (akurasi SCL terbatas: awan tipis/bayangan kecil bisa lolos, permukaan terang bisa
  terdeteksi sebagai awan). Pada uji data asli, tambalan yang diisi dari tanggal lain
  kadang tampak berkabut karena kabut tipis di citra pengisi tidak dikenali SCL (ditandai vegetasi). Pilih citra pengisi
  yang bersih (lihat “di AOI %” pada daftar kandidat dan pratinjau) dan periksa peta QA; pemilihan otomatis hanya
  memilih yang terdekat waktunya. Perbedaan waktu antar citra pengisi berarti perubahan permukaan nyata (panen, banjir)
  ikut terisi; periksa peta QA sebelum memakai hasil untuk analisis.
- Tidak ada autentikasi/rate limiting; sebelum dibuka ke publik, pasang di belakang reverse proxy yang
  membatasi akses. Job disimpan di disk lokal (bukan object storage) dan status job di memori + `job.json`.
- PostgreSQL/PostGIS belum dipakai (belum ada data yang perlu disimpan permanen di Tahap 1).
- Sumber katalog saat ini hanya Earth Search (AWS). Penyedia Copernicus Data Space dapat ditambahkan dengan
  antarmuka yang sama seperti `StacCatalog` (`search`, `get_item`); butuh kredensial dan belum dibuat.
- Preview membaca band pada resolusi tereduksi, tetapi COG Earth Search tidak punya overview, sehingga AOI
  besar tetap membaca banyak blok. AOI puluhan km² cepat (detik); mendekati batas 2500 km² bisa lama.

## Rencana

- **“AI analysis” (PRD tahap 3)** belum dibuat: PRD tidak menyebut masukan/keluarannya. Kandidat yang masuk akal:
  ringkasan naratif otomatis dari statistik indeks/perubahan (butuh kunci API di backend), atau klasifikasi tutupan
  lahan. Perlu keputusan sebelum dikerjakan.
- Batch lintas AOI (banyak poligon) dan deteksi perubahan untuk batch (referensi otomatis per scene).
- Opsi mengisi area NoData tepi swath dari citra lain, dan pemilihan citra pengisi otomatis berdasar % awan di AOI.
