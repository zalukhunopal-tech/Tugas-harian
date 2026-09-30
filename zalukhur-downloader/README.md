# ZalukhuR Downloader

Aplikasi web untuk mencari, memfilter, memotong (crop AOI), dan mengunduh citra **Sentinel-2 L2A**
sebagai GeoTIFF / Cloud Optimized GeoTIFF (COG) beserta `metadata.json`.

> **Status: Tahap 1 (MVP dasar).** Peta, AOI, query katalog, filter tanggal & cloud cover, daftar scene,
> preview, crop AOI, dan unduhan GeoTIFF/COG sudah berfungsi. **Cloud masking level piksel, pengisian dari
> citra sebelumnya, dan komposit multi-tanggal (Tahap 2) belum dibuat**; aplikasi ini sengaja tidak
> mengklaim menghilangkan awan. Cloud cover katalog hanya dipakai sebagai penyaring scene.

## Alur

```
Peta → AOI (draw / upload / koordinat) → tanggal + cloud cover → CARI CITRA
     → daftar scene → Preview → Pilih → band/resolusi/format → PROSES
     → job (QUEUED → DOWNLOADING → GENERATING → COMPLETED) → GeoTIFF / COG / metadata.json
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
| `POST /api/download` | Membuat job (202); `GET /api/jobs/{id}`; `GET /api/jobs/{id}/files/{nama}` |
| `GET /api/geocode?q=` | Pencarian lokasi (Nominatim, lewat backend) |

Pesan error berbahasa Indonesia dalam bentuk `{"code": "...", "detail": "..."}`.

## Perilaku geospasial

- **CRS & georeferensi**: keluaran berada di CRS asli scene (UTM). Grid keluaran disejajarkan dengan origin tile,
  sehingga untuk band yang resolusi aslinya sama dengan resolusi keluaran, nilai piksel **identik** dengan sumber
  (diverifikasi terhadap data Sentinel-2 asli, lihat “Pengujian”).
- **NoData** = 0 (konvensi Sentinel-2). Piksel di luar poligon AOI (opsional, bawaan aktif), di luar tepi scene,
  atau tanpa data menjadi NoData. `valid_pixel_pct` per band dicatat di metadata.
- **Reflektansi**: nilai disimpan sebagai DN `uint16`; `scale`/`offset` (mis. 0.0001 / −0.1) ditulis sebagai
  scale/offset GeoTIFF sehingga QGIS/GDAL dapat mengonversi: `reflektansi = DN × scale + offset`.
- **Resampling eksplisit** (dicatat di metadata per band): `auto` = nearest saat resolusi keluaran lebih halus
  dari resolusi asli band (nilai asli tidak “dikarang”), average saat lebih kasar. Bisa diganti manual.
- **Urutan band** mengikuti urutan pilihan pengguna. Preset RGB = `B04, B03, B02` (band 1–3 = R, G, B) agar
  tampil benar secara default di QGIS/ArcGIS; nama band ada di *band description* dan `metadata.json`.
- **Scene yang hanya menutupi sebagian AOI** ditandai di daftar (persentase) dan dicatat di metadata.
- AOI pada sisi antimeridian (±180°) belum didukung.

## Struktur

```
backend/app/
  api/        aoi.py  query.py  download.py  geocode.py
  services/   aoi.py (baca/validasi)  catalog.py (Query Engine STAC)  crop.py  preview.py
  processing/ raster.py (grid, mask, window)  resampling.py  metadata.py
  models/     aoi.py  scene.py
  jobs.py     antrean job + status tersimpan di disk
frontend/src/ App.tsx  components/{MapView,AoiPanel,FilterPanel,SceneList,DownloadPanel,GeocodeBox}  lib/
```

## Pengujian

```bash
cd backend && pytest                       # 48 tes: AOI, katalog (mock), crop, preview, job, API
cd frontend && npm test && npm run typecheck
cd frontend && npm run build && npm run test:e2e   # e2e browser + backend asli + katalog STAC palsu
cd backend && PYTHONPATH=. python scripts/verify_real_scene.py   # crop ke scene Sentinel-2 ASLI (butuh internet)
```

Data sintetis / katalog palsu **hanya** dipakai di tes otomatis (`backend/tests`). Aplikasi berjalan memakai
katalog dan data Sentinel-2 sungguhan.

## Keterbatasan yang diketahui

- Tidak ada autentikasi/rate limiting; sebelum dibuka ke publik, pasang di belakang reverse proxy yang
  membatasi akses. Job disimpan di disk lokal (bukan object storage) dan status job di memori + `job.json`.
- PostgreSQL/PostGIS belum dipakai (belum ada data yang perlu disimpan permanen di Tahap 1).
- Sumber katalog saat ini hanya Earth Search (AWS). Penyedia Copernicus Data Space dapat ditambahkan dengan
  antarmuka yang sama seperti `StacCatalog` (`search`, `get_item`); butuh kredensial dan belum dibuat.
- Preview membaca band pada resolusi tereduksi, tetapi COG Earth Search tidak punya overview, sehingga AOI
  besar tetap membaca banyak blok. AOI puluhan km² cepat (detik); mendekati batas 2500 km² bisa lama.

## Rencana

- **Tahap 2**: cloud masking via SCL (awan, bayangan, cirrus, salju), pengisian piksel dari citra sebelumnya,
  komposit multi-tanggal, pemisahan status job `PROCESSING`/`CROPPING`.
- **Tahap 3**: NDVI/NDWI/NBR, deteksi perubahan, batch processing.
