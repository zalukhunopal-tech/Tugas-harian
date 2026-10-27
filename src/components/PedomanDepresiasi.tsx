import React from "react";
import { PresetBarang, presetPerKelompok } from "../lib/basisDataUmur";
import {
  ATURAN_PERINGATAN,
  CATATAN_PAJAK,
  KELOMPOK_PAJAK,
  KETERANGAN_VARIABEL,
  PANDUAN_PEMILIHAN,
  RUMUS_DEPRESIASI,
  SUMBER_RISET,
} from "../lib/pedomanDepresiasi";

interface PedomanDepresiasiProps {
  /** Dipanggil bila pengguna menekan "Pantau" pada satu baris daftar umur standar. */
  onPakaiPreset?: (preset: PresetBarang) => void;
}

/** Pedoman ringkas: rumus, kelompok masa manfaat, daftar umur standar, dan sumbernya. Semua bagian bisa dilipat. */
export const PedomanDepresiasi: React.FC<PedomanDepresiasiProps> = ({ onPakaiPreset }) => (
  <section className="dep-pedoman card" aria-label="Pedoman depresiasi" data-testid="pedoman-depresiasi">
    <h3 className="dep-pedoman__judul">📚 Pedoman Depresiasi</h3>
    <p className="dep-pedoman__intro">Rumus dan umur standar yang dipakai aplikasi. Angka sumber berbeda-beda, jadi selalu bisa Anda ubah.</p>

    <details className="dep-lipat" data-testid="pedoman-rumus">
      <summary>Rumus perhitungan</summary>
      <p className="dep-lipat__catatan">{KETERANGAN_VARIABEL}</p>
      <div className="dep-rumus">
        {RUMUS_DEPRESIASI.map((r) => (
          <article className="dep-rumus__kartu" key={r.id}>
            <h4>{r.nama}</h4>
            <ul>
              {r.rumus.map((baris) => (
                <li key={baris}>
                  <code>{baris}</code>
                </li>
              ))}
            </ul>
            <p>{r.kapan}</p>
          </article>
        ))}
      </div>
      <p className="dep-lipat__catatan">{ATURAN_PERINGATAN}</p>
    </details>

    <details className="dep-lipat" data-testid="pedoman-pajak">
      <summary>Kelompok masa manfaat (PMK 72/2023)</summary>
      <div className="dep-tabel-gulir">
        <table className="dep-tabel">
          <thead>
            <tr>
              <th>Kelompok</th>
              <th>Masa manfaat</th>
              <th>Garis lurus</th>
              <th>Saldo menurun</th>
              <th>Contoh umum</th>
            </tr>
          </thead>
          <tbody>
            {KELOMPOK_PAJAK.map((k) => (
              <tr key={k.kelompok}>
                <td>{k.kelompok}</td>
                <td>{k.masa}</td>
                <td>{k.garisLurus}</td>
                <td>{k.saldoMenurun}</td>
                <td>{k.contoh}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dep-lipat__catatan">{CATATAN_PAJAK}</p>
      <h4 className="dep-lipat__subjudul">Metode yang cocok</h4>
      <ul className="dep-panduan">
        {PANDUAN_PEMILIHAN.map((p) => (
          <li key={p.barang}>
            <strong>{p.barang}</strong>
            <span>{p.metode}</span>
          </li>
        ))}
      </ul>
    </details>

    <details className="dep-lipat" data-testid="pedoman-katalog">
      <summary>Daftar umur standar barang</summary>
      {presetPerKelompok().map((g) => (
        <div className="dep-katalog" key={g.kelompok}>
          <h4 className="dep-lipat__subjudul">{g.kelompok}</h4>
          <ul className="dep-katalog__daftar">
            {g.daftar.map((p) => (
              <li className="dep-katalog__baris" key={p.id} data-preset-baris={p.id}>
                <span className="dep-katalog__ikon" aria-hidden="true">
                  {p.ikon}
                </span>
                <div className="dep-katalog__teks">
                  <strong>{p.nama}</strong>
                  <span>{p.catatan}</span>
                  <small>
                    {p.rentang} · {p.keyakinan === "sumber" ? p.sumber : "perkiraan umum"}
                  </small>
                </div>
                {onPakaiPreset && (
                  <button type="button" className="btn-secondary dep-katalog__pantau" data-pantau={p.id} onClick={() => onPakaiPreset(p)}>
                    Pantau
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>

    <details className="dep-lipat" data-testid="pedoman-sumber">
      <summary>Sumber riset</summary>
      <ul className="dep-sumber">
        {SUMBER_RISET.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="dep-lipat__catatan">Patokan yang bertanda "perkiraan umum" belum ditemukan sumber tegasnya; ikuti buku servis kendaraan atau perangkat Anda.</p>
    </details>
  </section>
);
