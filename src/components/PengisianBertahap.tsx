import React, { useEffect, useState } from "react";
import { dapatkanInfoKategori } from "../lib/kategoriIcon";
import { KETENTUAN_DANA_KEGIATAN, KetentuanPeringatan } from "../lib/ketentuanKegiatan";
import { LangkahBertahap, Prasyarat, URUTAN_LANGKAH, indeksLangkah, judulLangkah } from "../lib/prasyaratDokumen";

/** Pengisian bertahap hanya untuk HP dan tablet; di PC (1024 px ke atas) form lengkap tetap dipakai. */
export const KUERI_LAYAR_BERTAHAP = "(max-width: 1023.98px)";

export function useLayarKecil(kueri: string = KUERI_LAYAR_BERTAHAP): boolean {
  const cocok = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(kueri).matches;
  const [kecil, setKecil] = useState<boolean>(cocok);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(kueri);
    const ubah = () => setKecil(mq.matches);
    ubah();
    mq.addEventListener("change", ubah);
    return () => mq.removeEventListener("change", ubah);
  }, [kueri]);
  return kecil;
}

const KUNCI_PREFERENSI = "keuangan-isi-bertahap";

export function bacaPreferensiBertahap(): boolean {
  try {
    return localStorage.getItem(KUNCI_PREFERENSI) !== "0";
  } catch {
    return true;
  }
}

export function simpanPreferensiBertahap(aktif: boolean): void {
  try {
    localStorage.setItem(KUNCI_PREFERENSI, aktif ? "1" : "0");
  } catch {
    // penyimpanan tidak tersedia: pilihan hanya berlaku sampai halaman ditutup
  }
}

/* ---------- penunjuk langkah ---------- */

export const PenunjukLangkah: React.FC<{
  langkah: LangkahBertahap;
  terjauh: number;
  kategori: string;
  onPilih: (l: LangkahBertahap) => void;
  onTampilkanSemua: () => void;
}> = ({ langkah, terjauh, kategori, onPilih, onTampilkanSemua }) => {
  const aktif = indeksLangkah(langkah);
  return (
    <div className="bertahap-kepala">
      <ol className="bertahap-langkah" aria-label="Langkah pengisian">
        {URUTAN_LANGKAH.map((l, i) => {
          const status = i === aktif ? "aktif" : i < aktif ? "selesai" : "nanti";
          return (
            <li key={l.kunci} data-status={status}>
              <button
                type="button"
                onClick={() => onPilih(l.kunci)}
                disabled={i > terjauh}
                aria-current={i === aktif ? "step" : undefined}
                aria-label={`Langkah ${i + 1}: ${l.label}`}
              >
                <span className="bertahap-langkah__nomor">{status === "selesai" ? "✓" : i + 1}</span>
                <span className="bertahap-langkah__label">{l.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="bertahap-judul">
        <div>
          <div className="bertahap-judul__ke">
            Langkah {aktif + 1} dari {URUTAN_LANGKAH.length}
          </div>
          <h3 id="judul-langkah">{judulLangkah(langkah, kategori)}</h3>
        </div>
        <button type="button" className="btn-link bertahap-semua" onClick={onTampilkanSemua}>
          Tampilkan semua isian
        </button>
      </div>
    </div>
  );
};

/* ---------- langkah 2: jenis pengeluaran ---------- */

export const PilihJenisPengeluaran: React.FC<{
  daftar: string[];
  terpilih: string;
  onPilih: (kategori: string) => void;
}> = ({ daftar, terpilih, onPilih }) => (
  <div className="bertahap-ubin" role="list">
    {daftar.map((kat) => {
      const info = dapatkanInfoKategori(kat);
      const Ikon = info.ikon;
      return (
        <button
          key={kat}
          type="button"
          role="listitem"
          className="bertahap-ubin__item"
          aria-pressed={kat === terpilih}
          data-kategori={kat}
          onClick={() => onPilih(kat)}
          style={{ "--warna-ubin": info.warna } as React.CSSProperties}
        >
          <span className="bertahap-ubin__ikon" aria-hidden="true">
            <Ikon size={18} strokeWidth={2.3} />
          </span>
          <span className="bertahap-ubin__teks">
            <strong>{kat}</strong>
            {KETENTUAN_DANA_KEGIATAN[kat]?.ringkasan && <span>{KETENTUAN_DANA_KEGIATAN[kat].ringkasan}</span>}
          </span>
        </button>
      );
    })}
  </div>
);

/* ---------- langkah 6: periksa kelengkapan ---------- */

export interface BarisRingkasan {
  label: string;
  nilai: React.ReactNode;
  langkah: LangkahBertahap;
}

const ikonPrasyarat = (p: Prasyarat) => (p.terpenuhi ? "✓" : p.tingkat === "wajib" ? "!" : "○");

export const PeriksaKelengkapan: React.FC<{
  ringkasan: BarisRingkasan[];
  prasyarat: Prasyarat[];
  catatan: KetentuanPeringatan[];
  dokumenFisik: string[];
  onKe: (l: LangkahBertahap) => void;
}> = ({ ringkasan, prasyarat, catatan, dokumenFisik, onKe }) => {
  const wajibKurang = prasyarat.filter((p) => p.tingkat === "wajib" && !p.terpenuhi).length;
  const semuaWajib = prasyarat.filter((p) => p.tingkat === "wajib").length;
  return (
    <div className="bertahap-periksa">
      <dl className="bertahap-ringkasan">
        {ringkasan.map((b) => (
          <div key={b.label}>
            <dt>{b.label}</dt>
            <dd>{b.nilai}</dd>
            <button type="button" className="btn-link" onClick={() => onKe(b.langkah)} aria-label={`Ubah ${b.label}`}>
              Ubah
            </button>
          </div>
        ))}
      </dl>

      <section className="bertahap-prasyarat" aria-labelledby="judul-prasyarat" data-lengkap={wajibKurang === 0}>
        <h4 id="judul-prasyarat">
          Prasyarat dokumen keuangan{" "}
          <span>
            {semuaWajib - wajibKurang}/{semuaWajib} wajib terpenuhi
          </span>
        </h4>
        <ul>
          {prasyarat.map((p) => (
            <li key={p.kunci} data-terpenuhi={p.terpenuhi} data-tingkat={p.tingkat}>
              <span className="bertahap-prasyarat__ikon" aria-hidden="true">
                {ikonPrasyarat(p)}
              </span>
              <span className="bertahap-prasyarat__teks">
                {p.teks}
                <small>{p.terpenuhi ? "Sudah" : p.tingkat === "wajib" ? "Wajib, belum diisi" : "Dianjurkan"}</small>
              </span>
              {!p.terpenuhi && (
                <button type="button" className="btn-small" onClick={() => onKe(p.langkah)}>
                  Lengkapi
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {catatan.length > 0 && (
        <section className="bertahap-catatan" aria-label="Catatan SPJ">
          <h4>Catatan SPJ</h4>
          <ul>
            {catatan.map((c, i) => (
              <li key={i} data-tipe={c.tipe}>
                {c.pesan}
                {c.rekomendasi && <small>{c.rekomendasi}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dokumenFisik.length > 0 && (
        <details className="bertahap-dokumen">
          <summary>Dokumen fisik yang perlu disiapkan ({dokumenFisik.length})</summary>
          <ul>
            {dokumenFisik.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

/* ---------- navigasi bawah ---------- */

export const NavigasiLangkah: React.FC<{
  bisaKembali: boolean;
  onKembali: () => void;
  onLanjut: () => void;
}> = ({ bisaKembali, onKembali, onLanjut }) => (
  <div className="form-actions bertahap-navigasi">
    <button type="button" className="btn-secondary" id="btn-kembali-langkah" onClick={onKembali} disabled={!bisaKembali}>
      Kembali
    </button>
    <button type="button" className="btn-primary" id="btn-lanjut-langkah" onClick={onLanjut}>
      Lanjut
    </button>
  </div>
);
