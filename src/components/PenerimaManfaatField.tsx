import React, { useMemo, useState } from "react";
import { UkuranKotakTempel } from "../types";
import { hapusPenerima, muatDaftarStaf, tambahPenerima } from "../lib/penerimaManfaat";
import { DAFTAR_UKURAN_KOTAK, UKURAN_KOTAK } from "../lib/lembarTempel";

interface PenerimaManfaatFieldProps {
  id: string;
  judul: string;
  petunjuk?: string;
  nilai: string[];
  onUbah: (daftar: string[]) => void;
}

/**
 * Daftar nama staf sebagai tag (chips): ketik nama lalu Enter atau koma; nama yang pernah dicatat muncul sebagai saran
 * sekali ketuk. Satu baris input kecil, jadi tidak melebarkan formulir yang sudah ada.
 */
export const PenerimaManfaatField: React.FC<PenerimaManfaatFieldProps> = ({ id, judul, petunjuk, nilai, onUbah }) => {
  const [teks, setTeks] = useState("");
  // Daftar saran dibaca sekali per tampilan field; nama baru baru masuk daftar saat transaksi disimpan.
  const staf = useMemo(() => muatDaftarStaf(), []);
  const saran = staf.filter((n) => !nilai.some((x) => x.toLowerCase() === n.toLowerCase())).slice(0, 8);

  const tambah = (masukan: string) => {
    const baru = tambahPenerima(nilai, masukan);
    if (baru.length !== nilai.length) onUbah(baru);
    setTeks("");
  };

  return (
    <div className="penerima-manfaat" data-testid="penerima-manfaat">
      <label htmlFor={id} className="penerima-manfaat__judul">
        {judul}
        {nilai.length > 0 && <span className="penerima-manfaat__jumlah">{nilai.length} orang</span>}
      </label>
      {petunjuk && <p className="penerima-manfaat__petunjuk">{petunjuk}</p>}

      {nilai.length > 0 && (
        <ul className="penerima-manfaat__daftar" aria-label="Daftar penerima manfaat">
          {nilai.map((n) => (
            <li key={n} className="penerima-manfaat__tag">
              <span>{n}</span>
              <button type="button" onClick={() => onUbah(hapusPenerima(nilai, n))} aria-label={`Hapus ${n}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="penerima-manfaat__input">
        <input
          id={id}
          type="text"
          value={teks}
          placeholder="Ketik nama staf, lalu Enter"
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            const v = e.target.value;
            // Koma langsung menutup satu nama (juga untuk nama yang ditempel sekaligus).
            if (/[,;]/.test(v)) tambah(v);
            else setTeks(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (teks.trim()) tambah(teks);
            } else if (e.key === "Backspace" && !teks && nilai.length > 0) {
              onUbah(nilai.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (teks.trim()) tambah(teks);
          }}
        />
        <button type="button" className="btn-secondary" disabled={!teks.trim()} onClick={() => tambah(teks)}>
          Tambah
        </button>
      </div>

      {saran.length > 0 && (
        <div className="penerima-manfaat__saran">
          <span>Pernah dicatat:</span>
          {saran.map((n) => (
            <button key={n} type="button" onClick={() => tambah(n)}>
              + {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface PilihKotakTempelProps {
  nilai: UkuranKotakTempel | undefined;
  otomatis: UkuranKotakTempel;
  onUbah: (u: UkuranKotakTempel | undefined) => void;
}

/** Ukuran kotak tempel bukti fisik di Lembar Tempel Bukti: otomatis atau dipilih sendiri. */
export const PilihKotakTempel: React.FC<PilihKotakTempelProps> = ({ nilai, otomatis, onUbah }) => {
  const aktif = nilai ?? otomatis;
  return (
    <div className="kotak-tempel-pilih" data-testid="pilih-kotak-tempel">
      <span className="kotak-tempel-pilih__judul">Ukuran kotak tempel di lembar bukti</span>
      <div className="kotak-tempel-pilih__opsi" role="group" aria-label="Ukuran kotak tempel">
        {DAFTAR_UKURAN_KOTAK.map((u) => (
          <button
            key={u.kode}
            type="button"
            aria-pressed={aktif === u.kode}
            title={`${u.nama} (${u.lebarMm} × ${u.tinggiMm} mm): ${u.contoh}`}
            onClick={() => onUbah(u.kode)}
          >
            Tipe {u.kode}
          </button>
        ))}
        <button type="button" className="kotak-tempel-pilih__otomatis" aria-pressed={!nilai} onClick={() => onUbah(undefined)}>
          Otomatis (ikuti foto)
        </button>
      </div>
      <span className="kotak-tempel-pilih__ket">
        {UKURAN_KOTAK[aktif].nama} · {UKURAN_KOTAK[aktif].lebarMm} × {UKURAN_KOTAK[aktif].tinggiMm} mm
        {nilai ? "" : " (otomatis ikuti foto)"}
      </span>
    </div>
  );
};
