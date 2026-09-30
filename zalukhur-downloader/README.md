# ZalukhuR Downloader

Aplikasi web untuk mencari, memfilter, memotong (crop AOI), dan mengunduh citra **Sentinel-2 L2A**
sebagai GeoTIFF / Cloud Optimized GeoTIFF (COG) beserta `metadata.json`.

> **Status: Tahap 1 + Tahap 2.** Peta, AOI, query katalog, filter tanggal & cloud cover, daftar scene,
> preview, crop AOI, unduhan GeoTIFF/COG, **cloud masking level piksel (SCL)**, **pengisian dari citra
> sebelumnya**, dan **komposit multi-tanggal** berfungsi. Cloud cover katalog hanya penyaring scene awal;
> awan tepat di atas AOI ditangani oleh mask piksel (lihat “Cloud masking”).

## Alur

```
Peta → AOI (draw / upload / koordinat) → tanggal + cloud cover → CARI CITRA
     → daftar scene → Preview → Pilih → [cloud mask + citra sebelumnya] → band/resolusi/format → PROSES
     → job (QUEUED → DOWNLOADING → PROCESSING → CROPPING → GENERATING → COMPLETED)
     → GeoTIFF / COG / peta QA / metadata.json
```

Crop dilakukan **saat pembacaan**: hanya window AOI dari tiap band (COG di S3 publik, HTTP range request)
yang diunduh, bukan seluruh scene.

## Menjalankan

Prasyarat: Python ≥ 3.11 dan Node ≥ 20. Rasterio/GDAL terpasang lewat wheel (tidak perlu GDAL sistem).

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

Produksi satu server: `npm run build` lalu `FRONTEND_DIST=../frontend/dist uvicorn app.main:create_app --factory`.

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
| `POST /api/download` | Membuat job (202) — crop, dan bila `cloud_mask.enabled`, mask + pengisian; `GET /api/jobs/{id}`; `GET /api/jobs/{id}/files/{nama}` |
| `GET /api/geocode?q=` | Pencarian lokasi (Nominatim, lewat backend) |

Pengganti endpoint `/api/process/{cloud-mask,crop,composite}` pada PRD: satu endpoint `/api/download` dengan
objek `cloud_mask` (`enabled`, `classes`, `dilate_m`, `fill_from_previous`, `previous_scene_ids`, `include_qa`);
crop, mask, dan komposit adalah satu job sehingga data tidak diunduh berulang. `/api/scenes/preview` menerima
objek `cloud_mask` yang sama untuk pratinjau.

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

## Struktur

```
backend/app/
  api/        aoi.py  query.py  processing.py  download.py  geocode.py
  services/   aoi.py (baca/validasi)  catalog.py (Query Engine STAC)  crop.py  preview.py
              cloud_mask.py (SCL)  composite.py (isi/QA/harmonisasi)  previous.py
  processing/ raster.py (grid, mask, window)  resampling.py  metadata.py
  models/     aoi.py  scene.py
  jobs.py     antrean job + status tersimpan di disk
frontend/src/ App.tsx  components/{MapView,AoiPanel,FilterPanel,SceneList,DownloadPanel,CloudMaskPanel,GeocodeBox}  lib/
```

## Pengujian

```bash
cd backend && pytest                       # 74 tes: AOI, katalog (mock), crop, cloud mask/komposit, preview, job, API
cd frontend && npm test && npm run typecheck
cd frontend && npm run build && npm run test:e2e   # e2e browser + backend asli + katalog STAC palsu
cd backend && PYTHONPATH=. python scripts/verify_real_scene.py        # crop ke scene Sentinel-2 ASLI (butuh internet)
cd backend && PYTHONPATH=. python scripts/verify_real_cloud_mask.py  # mask + isi multi-tanggal pada data ASLI, termasuk beda offset 2021 vs 2024
```

Data sintetis / katalog palsu **hanya** dipakai di tes otomatis (`backend/tests`). Aplikasi berjalan memakai
katalog dan data Sentinel-2 sungguhan.

## Keterbatasan yang diketahui

- Cloud masking hanya memakai SCL (akurasi SCL terbatas: awan tipis/bayangan kecil bisa lolos, permukaan terang bisa
  terdeteksi sebagai awan). Perbedaan waktu antar citra pengisi berarti perubahan permukaan nyata (panen, banjir)
  ikut terisi; periksa peta QA sebelum memakai hasil untuk analisis.
- Tidak ada autentikasi/rate limiting; sebelum dibuka ke publik, pasang di belakang reverse proxy yang
  membatasi akses. Job disimpan di disk lokal (bukan object storage) dan status job di memori + `job.json`.
- PostgreSQL/PostGIS belum dipakai (belum ada data yang perlu disimpan permanen di Tahap 1).
- Sumber katalog saat ini hanya Earth Search (AWS). Penyedia Copernicus Data Space dapat ditambahkan dengan
  antarmuka yang sama seperti `StacCatalog` (`search`, `get_item`); butuh kredensial dan belum dibuat.
- Preview membaca band pada resolusi tereduksi, tetapi COG Earth Search tidak punya overview, sehingga AOI
  besar tetap membaca banyak blok. AOI puluhan km² cepat (detik); mendekati batas 2500 km² bisa lama.

## Rencana

- **Tahap 3**: NDVI/NDWI/NBR, deteksi perubahan, batch processing.
- Opsi mengisi area NoData tepi swath dari citra lain, dan pemilihan citra pengisi otomatis (mis. paling bersih di AOI).
