import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, ScanLine, ShieldAlert } from "lucide-react";
import type { User } from "firebase/auth";
import { Transaksi } from "../types";
import { formatRupiah } from "../lib/constants";
import type { KeuanganDriveContents } from "../lib/gdriveSync";
import {
  BerkasDibagikan,
  BerkasKeuangan,
  DanaBerbagi,
  KodeAnggota,
  LABEL_DANA,
  PemilikDibagikan,
  RencanaBerbagi,
  SEMUA_DANA,
  adalahEmail,
  akunPemilikDariIzin,
  berkasTautanPublik,
  buatKodeAnggota,
  kelompokkanDibagikan,
  rencanaBerbagi,
  ringkasAnggota,
} from "../lib/berbagi";
import {
  ambilIzinBerkas,
  bacaDataDibagikan,
  batasiTautanPublik,
  daftarDibagikanKeSaya,
  muatBerkasKeuangan,
  tautanBerkas,
  terapkanRencana,
} from "../lib/berbagiDrive";
import { KodeQR } from "./KodeQR";
import { PemindaiKode } from "./PemindaiKode";

interface KeluargaViewProps {
  googleUser: User | null;
  /** Token Google saat ini (di mode artefak: pengganti yang dipahami konektor). */
  ambilToken: () => Promise<string | null>;
  driveContents: KeuanganDriveContents | null;
  /** Nama untuk kode saya bila pengguna belum mengisi sendiri. */
  namaPelapor?: string;
  onPeriksaDrive: () => Promise<void>;
}

const KUNCI_NAMA = "keuangan_nama_tampil";
const KUNCI_EMAIL = "keuangan_email_saya";
const KUNCI_NAMA_ANGGOTA = "keuangan_nama_anggota";

function bacaLokal(kunci: string): string {
  try {
    return localStorage.getItem(kunci) ?? "";
  } catch {
    return "";
  }
}

function tulisLokal(kunci: string, nilai: string): void {
  try {
    localStorage.setItem(kunci, nilai);
  } catch {
    // penyimpanan tidak tersedia; isian hanya berlaku selama halaman terbuka
  }
}

/** Nama anggota dari kode QR yang pernah dipindai di perangkat ini: dipakai bila Google tidak memberi nama untuk izinnya. */
function bacaNamaAnggota(): Record<string, string> {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_NAMA_ANGGOTA) || "{}");
    return d && typeof d === "object" ? (d as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const pesanGalat = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const namaBulan = (ym: string): string => {
  const [t, b] = ym.split("-").map(Number);
  return new Date(t, (b || 1) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

interface SaklarProps {
  label: string;
  /** "mixed" untuk sebagian (mis. hanya beberapa tahun terbuka). */
  nilai: boolean | "mixed";
  onUbah: () => void;
  nonaktif?: boolean;
  keterangan?: string;
}

const Saklar: React.FC<SaklarProps> = ({ label, nilai, onUbah, nonaktif, keterangan }) => (
  <button
    type="button"
    role="switch"
    aria-checked={nilai}
    aria-label={label}
    className={`saklar ${nilai === true ? "nyala" : nilai === "mixed" ? "sebagian" : ""}`}
    disabled={nonaktif}
    onClick={onUbah}
  >
    <span className="saklar-teks">
      {label}
      {keterangan && <small>{keterangan}</small>}
    </span>
    <span className="saklar-rel" aria-hidden="true">
      <span className="saklar-bulat" />
    </span>
  </button>
);

/** Tampilan baca-saja data keuangan yang dibagikan orang lain. Tidak disimpan dan tidak digabung dengan data saya. */
const DataDibagikan: React.FC<{
  pemilik: PemilikDibagikan;
  ambilToken: () => Promise<string | null>;
}> = ({ pemilik, ambilToken }) => {
  const danaAda = SEMUA_DANA.filter((d) => pemilik.berkas[d].length > 0);
  const [dana, setDana] = useState<DanaBerbagi>(danaAda[0]);
  const [indeks, setIndeks] = useState(0);
  const [transaksi, setTransaksi] = useState<Transaksi[] | null>(null);
  const [galat, setGalat] = useState("");
  const berkas: BerkasDibagikan | undefined = pemilik.berkas[dana][indeks];

  useEffect(() => {
    let batal = false;
    setTransaksi(null);
    setGalat("");
    if (!berkas) return;
    void (async () => {
      try {
        const token = await ambilToken();
        if (!token) throw new Error("Belum masuk Google.");
        const data = await bacaDataDibagikan(token, berkas, dana);
        if (!batal) setTransaksi(data);
      } catch (err) {
        if (!batal) setGalat(`Data tidak bisa dibaca. Mungkin ${pemilik.nama} sudah mencabut aksesnya. (${pesanGalat(err)})`);
      }
    })();
    return () => {
      batal = true;
    };
  }, [berkas?.id, dana, ambilToken, pemilik.nama]);

  const ringkas = useMemo(() => {
    const peta = new Map<string, { masuk: number; keluar: number }>();
    for (const t of transaksi ?? []) {
      const ym = t.tanggal.slice(0, 7);
      const r = peta.get(ym) ?? { masuk: 0, keluar: 0 };
      if (t.jenis === "pemasukan") r.masuk += t.jumlah;
      else r.keluar += t.jumlah;
      peta.set(ym, r);
    }
    return [...peta.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transaksi]);

  const total = useMemo(
    () =>
      (transaksi ?? []).reduce(
        (a, t) => (t.jenis === "pemasukan" ? { ...a, masuk: a.masuk + t.jumlah } : { ...a, keluar: a.keluar + t.jumlah }),
        { masuk: 0, keluar: 0 }
      ),
    [transaksi]
  );

  const terbaru = useMemo(() => [...(transaksi ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 40), [transaksi]);

  return (
    <div className="keluarga-lihat" data-lihat={pemilik.email}>
      <div className="keluarga-lihat-kepala">
        <span className="keluarga-baca-saja">Hanya lihat</span>
      </div>

      {danaAda.length > 1 && (
        <div className="keluarga-pilih" role="tablist" aria-label="Dana">
          {danaAda.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === dana}
              className={d === dana ? "aktif" : ""}
              onClick={() => {
                setDana(d);
                setIndeks(0);
              }}
            >
              {LABEL_DANA[d]}
            </button>
          ))}
        </div>
      )}
      {pemilik.berkas[dana].length > 1 && (
        <select
          className="keluarga-tahun"
          aria-label="Berkas"
          value={indeks}
          onChange={(e) => setIndeks(Number(e.target.value))}
        >
          {pemilik.berkas[dana].map((f, i) => (
            <option key={f.id} value={i}>
              {f.nama}
            </option>
          ))}
        </select>
      )}
      {danaAda.length === 1 && pemilik.berkas[dana].length === 1 && <p className="help">{berkas?.nama}</p>}

      {galat && <p className="keluarga-galat">{galat}</p>}
      {!galat && transaksi === null && <p className="help">Membaca data…</p>}
      {transaksi && (
        <>
          <div className="keluarga-total">
            <div>
              <span>Pemasukan</span>
              <strong>{formatRupiah(total.masuk)}</strong>
            </div>
            <div>
              <span>Pengeluaran</span>
              <strong>{formatRupiah(total.keluar)}</strong>
            </div>
            <div>
              <span>Saldo</span>
              <strong>{formatRupiah(total.masuk - total.keluar)}</strong>
            </div>
          </div>
          {transaksi.length === 0 ? (
            <p className="help">Belum ada transaksi di berkas ini.</p>
          ) : (
            <>
              <table className="keluarga-tabel">
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th>Pemasukan</th>
                    <th>Pengeluaran</th>
                  </tr>
                </thead>
                <tbody>
                  {ringkas.map(([ym, r]) => (
                    <tr key={ym}>
                      <td>{namaBulan(ym)}</td>
                      <td>{formatRupiah(r.masuk)}</td>
                      <td>{formatRupiah(r.keluar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="keluarga-transaksi">
                {terbaru.map((t) => (
                  <li key={t.id}>
                    <span className="keluarga-transaksi-teks">
                      <span>{t.deskripsi || t.kategori}</span>
                      <small>
                        {t.tanggal} · {t.kategori}
                      </small>
                    </span>
                    <strong className={t.jenis === "pemasukan" ? "masuk" : "keluar"}>
                      {t.jenis === "pemasukan" ? "+" : "−"}
                      {formatRupiah(t.jumlah)}
                    </strong>
                  </li>
                ))}
              </ul>
              {transaksi.length > terbaru.length && <p className="help">Menampilkan {terbaru.length} transaksi terbaru dari {transaksi.length}.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
};

export const KeluargaView: React.FC<KeluargaViewProps> = ({ googleUser, ambilToken, driveContents, namaPelapor, onPeriksaDrive }) => {
  const [berkas, setBerkas] = useState<BerkasKeuangan[] | null>(null);
  const [folderPublik, setFolderPublik] = useState(false);
  const [galatBerkas, setGalatBerkas] = useState("");
  const [kelompok, setKelompok] = useState<PemilikDibagikan[] | null>(null);
  const [galatDibagikan, setGalatDibagikan] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [pindai, setPindai] = useState(false);
  const [tamu, setTamu] = useState<KodeAnggota | null>(null);
  const [pilihan, setPilihan] = useState<Record<DanaBerbagi, boolean>>({ pribadi: false, kegiatan: true });
  const [cabutManual, setCabutManual] = useState<Array<{ email: string; nama: string; berkas: BerkasKeuangan[] }>>([]);
  const [nama, setNama] = useState(() => bacaLokal(KUNCI_NAMA));
  const [emailManual, setEmailManual] = useState(() => bacaLokal(KUNCI_EMAIL));
  const [dilihat, setDilihat] = useState<string | null>(null);
  const [namaAnggota, setNamaAnggota] = useState<Record<string, string>>(bacaNamaAnggota);

  const muat = useCallback(async () => {
    if (!googleUser) return;
    setMemuat(true);
    setGalatBerkas("");
    setGalatDibagikan("");
    try {
      const token = await ambilToken();
      if (!token) {
        setGalatBerkas("Masuk dengan Google dulu di aplikasi Drive Keuangan.");
        return;
      }
      try {
        setBerkas(driveContents ? await muatBerkasKeuangan(token, driveContents) : []);
      } catch (err) {
        setGalatBerkas(`Daftar berkas keuangan tidak bisa dibaca. ${pesanGalat(err)}`);
      }
      if (driveContents) {
        try {
          const izinFolder = await ambilIzinBerkas(token, driveContents.folder.id);
          setFolderPublik(izinFolder.some((i) => i.type === "anyone" || i.type === "domain"));
        } catch {
          setFolderPublik(false);
        }
      }
      try {
        setKelompok(kelompokkanDibagikan(await daftarDibagikanKeSaya(token)));
      } catch (err) {
        setGalatDibagikan(`Data yang dibagikan kepada Anda tidak bisa dibaca. ${pesanGalat(err)}`);
      }
    } finally {
      setMemuat(false);
    }
  }, [googleUser, ambilToken, driveContents]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const emailProfil = googleUser?.email && adalahEmail(googleUser.email) ? googleUser.email.trim().toLowerCase() : "";
  const akunIzin = useMemo(() => (berkas ? akunPemilikDariIzin(berkas) : null), [berkas]);
  const emailSaya = emailProfil || akunIzin?.email || (adalahEmail(emailManual) ? emailManual.trim().toLowerCase() : "");
  const namaProfil = googleUser && googleUser.uid !== "konektor-claude" ? googleUser.displayName ?? "" : "";
  const namaSaya = nama.trim() || namaProfil || namaPelapor?.trim() || akunIzin?.nama || (emailSaya ? emailSaya.split("@")[0] : "");
  const kodeSaya = emailSaya ? buatKodeAnggota({ nama: namaSaya, email: emailSaya }) : "";

  const anggota = useMemo(
    () =>
      (berkas && emailSaya ? ringkasAnggota(berkas, emailSaya) : []).map((a) =>
        // Google tidak selalu memberi nama; ringkasAnggota lalu memakai awalan email. Nama dari QR lebih ramah.
        a.nama === a.email.split("@")[0] && namaAnggota[a.email] ? { ...a, nama: namaAnggota[a.email] } : a
      ),
    [berkas, emailSaya, namaAnggota]
  );
  const publik = useMemo(() => (berkas ? berkasTautanPublik(berkas) : []), [berkas]);
  const adaBerkas = (berkas?.length ?? 0) > 0;

  const terapkan = async (orang: { email: string; nama: string }, rencana: RencanaBerbagi) => {
    if (rencana.bagikan.length === 0 && rencana.cabut.length === 0) {
      setPesan("Tidak ada yang perlu diubah.");
      return;
    }
    setSibuk(true);
    setPesan("");
    try {
      const token = await ambilToken();
      if (!token) throw new Error("Belum masuk Google.");
      const h = await terapkanRencana(token, orang.email, rencana);
      setCabutManual((lama) => [
        ...lama.filter((x) => x.email !== orang.email),
        ...(h.cabutManual.length > 0 ? [{ email: orang.email, nama: orang.nama, berkas: h.cabutManual }] : []),
      ]);
      const bagian: string[] = [];
      if (h.dibagikan > 0) bagian.push(`${h.dibagikan} berkas dibagikan kepada ${orang.nama}`);
      if (h.dicabut > 0) bagian.push(`akses ${h.dicabut} berkas dicabut`);
      if (h.cabutManual.length > 0) bagian.push(`${h.cabutManual.length} berkas harus dicabut sendiri di Google Drive (lihat petunjuk di bawah)`);
      if (h.galat.length > 0) bagian.push(`gagal: ${h.galat.join("; ")}`);
      setPesan(bagian.join(". ") + ".");
      await muat();
    } catch (err) {
      setPesan(`Gagal mengubah akses. ${pesanGalat(err)}`);
    } finally {
      setSibuk(false);
    }
  };

  const batasi = async () => {
    setSibuk(true);
    setPesan("");
    try {
      const token = await ambilToken();
      if (!token) throw new Error("Belum masuk Google.");
      const h = await batasiTautanPublik(token, publik);
      setPesan(
        h.dibatasi > 0
          ? `${h.dibatasi} berkas tidak lagi bisa dibuka lewat tautan.${h.manual.length > 0 ? " Sisanya perlu dibatasi sendiri di Google Drive." : ""}`
          : "Tautan umum tidak bisa dicabut dari sini. Batasi lewat Bagikan di Google Drive."
      );
      await muat();
    } catch (err) {
      setPesan(`Gagal membatasi tautan. ${pesanGalat(err)}`);
    } finally {
      setSibuk(false);
    }
  };

  const saatKodeTerbaca = (kode: KodeAnggota) => {
    setPindai(false);
    if (kode.email === emailSaya) {
      setPesan("Itu kode Anda sendiri. Pindai kode milik anggota lain.");
      return;
    }
    const tersimpan = { ...namaAnggota, [kode.email]: kode.nama };
    setNamaAnggota(tersimpan);
    tulisLokal(KUNCI_NAMA_ANGGOTA, JSON.stringify(tersimpan));
    const ada = anggota.find((a) => a.email === kode.email);
    setPilihan(ada ? { pribadi: ada.dana.pribadi !== "tidak", kegiatan: ada.dana.kegiatan !== "tidak" } : { pribadi: false, kegiatan: true });
    setPesan("");
    setTamu(kode);
  };

  const salinKode = async () => {
    try {
      await navigator.clipboard.writeText(kodeSaya);
      setPesan("Kode disalin. Tempel di pesan ke pemilik data.");
    } catch {
      setPesan("Kode tidak bisa disalin otomatis. Tekan lama pada kotak kode lalu salin.");
    }
  };

  if (!googleUser) {
    return (
      <p className="help" id="keluarga-belum-masuk">
        Masuk dengan Google di aplikasi <strong>Drive Keuangan</strong> lebih dulu. Berbagi data memakai Google Drive Anda sendiri, tanpa server lain.
      </p>
    );
  }

  const pemilikDilihat = kelompok?.find((p) => p.email === dilihat) ?? null;

  return (
    <div className="keluarga">
      <p className="help">
        Hubungkan dengan keluarga atau komunitas yang memakai aplikasi ini. Data tetap di Google Drive pemiliknya: Anda memilih dana mana yang
        boleh dilihat, dan Google sendiri yang menolak akses ke dana yang tidak dipilih. Orang yang dihubungkan hanya bisa melihat, tidak bisa mengubah.
      </p>

      {galatBerkas && <p className="keluarga-galat">{galatBerkas}</p>}

      {(publik.length > 0 || folderPublik) && (
        <div className="keluarga-peringatan" role="alert" id="keluarga-publik">
          <div className="keluarga-peringatan-judul">
            <ShieldAlert size={18} aria-hidden="true" /> Sebagian data Anda bisa dibuka siapa saja yang punya tautannya
          </div>
          <p>
            Pilihan dana di bawah tidak berlaku untuk berkas ini karena aksesnya "siapa saja yang punya tautan":
            {" "}
            {[...(folderPublik ? ["folder Keuangan"] : []), ...publik.map((p) => p.nama)].join(", ")}.
          </p>
          <p>
            Di Google Drive: buka berkas atau folder → <strong>Bagikan</strong> → <strong>Akses umum</strong> → pilih <strong>Dibatasi</strong>. Bila izinnya
            berasal dari folder Keuangan, ubah di folder (izin turunan folder tidak bisa dicabut dari berkasnya).
          </p>
          <div className="keluarga-aksi">
            {driveContents?.folder.webViewLink && (
              <a className="btn-small" href={driveContents.folder.webViewLink} target="_blank" rel="noreferrer">
                Buka folder di Drive ↗
              </a>
            )}
            {publik.length > 0 && publik.every((p) => p.izin.filter((i) => i.type === "anyone").every((i) => i.id)) && (
              <button type="button" className="btn-small" disabled={sibuk} onClick={() => void batasi()}>
                Batasi sekarang
              </button>
            )}
          </div>
        </div>
      )}

      <section className="keluarga-kartu" id="keluarga-kode-saya">
        <h3>Kode saya</h3>
        {kodeSaya ? (
          <>
            <p className="help">Perlihatkan kode ini kepada pemilik data supaya dipindai. Isinya hanya nama dan email Google Anda.</p>
            <div className="keluarga-kode">
              <KodeQR teks={kodeSaya} ukuran={220} label={`Kode QR ${namaSaya}`} />
              <div className="keluarga-identitas">
                <label htmlFor="keluarga-nama">Nama yang tampil</label>
                <input
                  id="keluarga-nama"
                  type="text"
                  value={nama || namaSaya}
                  maxLength={60}
                  onChange={(e) => {
                    setNama(e.target.value);
                    tulisLokal(KUNCI_NAMA, e.target.value);
                  }}
                />
                <span className="keluarga-email">{emailSaya}</span>
                <button type="button" className="btn-small" onClick={() => void salinKode()}>
                  Salin kode teks
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="keluarga-identitas">
            <p className="help">
              Aplikasi belum tahu alamat email Google Anda{adaBerkas ? "" : " (muncul otomatis setelah folder Keuangan terbaca)"}. Isi sendiri supaya kode bisa dibuat.
            </p>
            <label htmlFor="keluarga-email">Email Google saya</label>
            <input
              id="keluarga-email"
              type="email"
              inputMode="email"
              value={emailManual}
              placeholder="nama@gmail.com"
              onChange={(e) => {
                setEmailManual(e.target.value);
                tulisLokal(KUNCI_EMAIL, e.target.value);
              }}
            />
          </div>
        )}
      </section>

      <section className="keluarga-kartu" id="keluarga-hubungkan">
        <h3>Bagikan data saya</h3>
        {!adaBerkas ? (
          <>
            <p className="help">
              Belum ada berkas <em>Keuangan Pribadi</em> atau <em>Keuangan Kegiatan</em> di folder Keuangan Anda. Siapkan folder lebih dulu.
            </p>
            <div className="keluarga-aksi">
              <button type="button" className="btn-secondary" disabled={memuat} onClick={() => void onPeriksaDrive()}>
                Periksa &amp; siapkan folder Keuangan
              </button>
            </div>
          </>
        ) : tamu ? (
          <div className="keluarga-konfirmasi" id="keluarga-konfirmasi">
            <p>
              Hubungkan <strong>{tamu.nama}</strong> <span className="keluarga-email">({tamu.email})</span>. Pilih dana yang boleh dilihatnya:
            </p>
            {SEMUA_DANA.map((d) => (
              <Saklar key={d} label={LABEL_DANA[d]} nilai={pilihan[d]} onUbah={() => setPilihan({ ...pilihan, [d]: !pilihan[d] })} nonaktif={sibuk} />
            ))}
            <p className="help">Hanya izin lihat. Google mengirim tautan berkas hanya bila Anda membagikannya sendiri; aplikasi tidak mengirim email.</p>
            <div className="keluarga-aksi">
              <button
                type="button"
                className="btn-primary"
                disabled={sibuk || (!pilihan.pribadi && !pilihan.kegiatan && !anggota.some((a) => a.email === tamu.email))}
                onClick={async () => {
                  await terapkan(tamu, rencanaBerbagi(berkas ?? [], tamu.email, pilihan));
                  setTamu(null);
                }}
              >
                {sibuk ? "Memproses…" : "Hubungkan"}
              </button>
              <button type="button" className="btn-secondary" disabled={sibuk} onClick={() => setTamu(null)}>
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="help">Pindai kode QR milik anggota yang ingin dihubungkan, lalu pilih dana yang boleh dilihatnya.</p>
            <div className="keluarga-aksi">
              <button type="button" className="btn-primary" id="keluarga-pindai" disabled={sibuk || !emailSaya} onClick={() => setPindai(true)}>
                <ScanLine size={18} aria-hidden="true" /> Pindai kode anggota
              </button>
            </div>
          </>
        )}
        {pesan && (
          <p className="keluarga-pesan" role="status" id="keluarga-pesan">
            {pesan}
          </p>
        )}
      </section>

      {adaBerkas && (
        <section className="keluarga-kartu" id="keluarga-terhubung">
          <h3>Terhubung dengan saya</h3>
          {anggota.length === 0 ? (
            <p className="help">Belum ada anggota yang dihubungkan. Dana yang tidak dibagikan tetap hanya bisa dibuka oleh Anda.</p>
          ) : (
            <ul className="keluarga-daftar">
              {anggota.map((a) => (
                <li key={a.email} className="keluarga-anggota" data-email={a.email}>
                  <div className="keluarga-anggota-kepala">
                    <span className="keluarga-avatar" aria-hidden="true">
                      {a.nama[0]?.toUpperCase()}
                    </span>
                    <span className="keluarga-anggota-nama">
                      <strong>{a.nama}</strong>
                      <small>{a.email}</small>
                    </span>
                    <button
                      type="button"
                      className="btn-small btn-delete"
                      disabled={sibuk}
                      onClick={() => void terapkan(a, rencanaBerbagi(berkas ?? [], a.email, { pribadi: false, kegiatan: false }))}
                    >
                      Putuskan
                    </button>
                  </div>
                  {SEMUA_DANA.map((d) => (
                    <Saklar
                      key={d}
                      label={LABEL_DANA[d]}
                      nilai={a.dana[d] === "ya" ? true : a.dana[d] === "sebagian" ? "mixed" : false}
                      keterangan={a.dana[d] === "sebagian" ? "sebagian tahun" : undefined}
                      nonaktif={sibuk}
                      onUbah={() =>
                        void terapkan(
                          a,
                          rencanaBerbagi((berkas ?? []).filter((b) => b.dana === d), a.email, { pribadi: a.dana[d] !== "ya", kegiatan: a.dana[d] !== "ya" })
                        )
                      }
                    />
                  ))}
                  {a.bisaMengubah && <p className="help">Orang ini juga bisa mengubah data (diatur di Google Drive).</p>}
                </li>
              ))}
            </ul>
          )}

          {cabutManual.length > 0 && (
            <div className="keluarga-peringatan" id="keluarga-cabut-manual">
              <div className="keluarga-peringatan-judul">Cabut akses sendiri di Google Drive</div>
              <p>Versi aplikasi ini tidak bisa mencabut izin. Buka tiap berkas, pilih Bagikan, lalu hapus orangnya:</p>
              <ul>
                {cabutManual.flatMap((c) =>
                  c.berkas.map((b) => (
                    <li key={`${c.email}-${b.id}`}>
                      <a href={tautanBerkas(b.id)} target="_blank" rel="noreferrer">
                        {b.nama} ↗
                      </a>{" "}
                      — hapus <strong>{c.email}</strong>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="keluarga-kartu" id="keluarga-dibagikan">
        <h3>Dibagikan kepada saya</h3>
        {galatDibagikan && <p className="keluarga-galat">{galatDibagikan}</p>}
        {kelompok === null && !galatDibagikan ? (
          <p className="help">Memeriksa…</p>
        ) : kelompok && kelompok.length === 0 ? (
          <p className="help">Belum ada yang membagikan data keuangan kepada Anda. Perlihatkan Kode saya kepada mereka supaya dipindai.</p>
        ) : (
          <ul className="keluarga-daftar">
            {(kelompok ?? []).map((p) => (
              <li key={p.email} className="keluarga-anggota" data-pemilik={p.email}>
                <div className="keluarga-anggota-kepala">
                  <span className="keluarga-avatar" aria-hidden="true">
                    {p.nama[0]?.toUpperCase()}
                  </span>
                  <span className="keluarga-anggota-nama">
                    <strong>{p.nama}</strong>
                    <small>
                      {SEMUA_DANA.filter((d) => p.berkas[d].length > 0)
                        .map((d) => LABEL_DANA[d])
                        .join(" · ")}
                    </small>
                  </span>
                  <button type="button" className="btn-small" onClick={() => setDilihat(dilihat === p.email ? null : p.email)}>
                    <Eye size={14} aria-hidden="true" /> {dilihat === p.email ? "Tutup" : "Lihat"}
                  </button>
                </div>
                {pemilikDilihat?.email === p.email && <DataDibagikan pemilik={p} ambilToken={ambilToken} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pindai && <PemindaiKode onKode={saatKodeTerbaca} onTutup={() => setPindai(false)} />}
    </div>
  );
};
