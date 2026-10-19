import React from "react";
import { KarakterId } from "../types";
import { KARAKTER } from "../lib/constants";

interface KarakterAnimasiProps {
  karakter: KarakterId;
  ukuran?: number;
  showAura?: boolean;
  interaktif?: boolean;
  onClick?: () => void;
  className?: string;
  title?: string;
}

export const KarakterAnimasi: React.FC<KarakterAnimasiProps> = ({
  karakter,
  ukuran = 48,
  showAura = false,
  interaktif = false,
  onClick,
  className = "",
  title,
}) => {
  const defaultTitle = KARAKTER[karakter]
    ? `${KARAKTER[karakter].nama} · ${KARAKTER[karakter].teknik}`
    : "Karakter Jujutsu Kaisen";

  return (
    <div
      className={`karakter-avatar-wrap ${karakter}-wrap ${
        showAura ? "dengan-aura" : ""
      } ${interaktif ? "interaktif" : ""} ${className}`}
      style={{
        width: `${ukuran}px`,
        height: `${ukuran}px`,
        cursor: onClick || interaktif ? "pointer" : "default",
      }}
      onClick={onClick}
      title={title || defaultTitle}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <svg
        viewBox="0 0 100 100"
        className="karakter-avatar-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Gradient Gojo */}
          <linearGradient id="gojoHairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="gojoUniformGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Gradient Sukuna */}
          <linearGradient id="sukunaHairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="60%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
          <linearGradient id="sukunaSlashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="45%" stopColor="#fee2e2" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="1" />
            <stop offset="55%" stopColor="#fee2e2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Gradient Jogo */}
          <linearGradient id="volcanoLavaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
          <radialGradient id="cyclopsEyeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>

          {/* Gradient Nanami */}
          <linearGradient id="nanamiHairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="60%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          <linearGradient id="nanamiLensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* ==========================================================
            1. GOJO SATORU
            ========================================================== */}
        {karakter === "gojo" && (
          <g>
            {/* Background & Mugen Barrier */}
            <circle cx="50" cy="50" r="48" fill="#090d16" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#38bdf8"
              className="gojo-mugen-ring"
            />
            <circle
              cx="50"
              cy="50"
              r="34"
              fill="none"
              stroke="#0284c7"
              strokeDasharray="4 6"
              opacity="0.5"
            />

            {/* Cursed Energy Sparks */}
            <circle cx="20" cy="35" r="1.5" fill="#7dd3fc" className="gojo-spark-1" />
            <circle cx="82" cy="40" r="1.8" fill="#38bdf8" className="gojo-spark-2" />
            <circle cx="28" cy="75" r="1.2" fill="#bae6fd" className="gojo-spark-2" />

            {/* Badan & Seragam Kerah Tinggi */}
            <g className="anim-napas">
              {/* Kerah Jubah Hitam */}
              <path
                d="M 22 98 Q 28 72 42 70 L 58 70 Q 72 72 78 98 Z"
                fill="url(#gojoUniformGrad)"
              />
              <path
                d="M 38 70 L 50 82 L 62 70"
                fill="none"
                stroke="#334155"
                strokeWidth="1.5"
              />
              {/* Kancing Spiral Jujutsu */}
              <circle cx="50" cy="79" r="2.5" fill="#f59e0b" />
              <circle cx="50" cy="79" r="1" fill="#78350f" />

              {/* Leher & Wajah */}
              <path d="M 43 65 L 43 72 L 57 72 L 57 65 Z" fill="#fcd34d" />
              <path
                d="M 33 46 Q 33 66 50 67 Q 67 66 67 46 Q 67 36 50 36 Q 33 36 33 46 Z"
                fill="#ffedd5"
              />

              {/* Hidung & Senyum Khas Gojo */}
              <path d="M 49 53 L 51 54 L 50 55" stroke="#fba979" strokeWidth="1" fill="none" />
              <path
                d="M 45 60 Q 50 63 55 60"
                stroke="#b45309"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />

              {/* Blindfold / Penutup Mata Hitam Ikonik */}
              <path
                d="M 31 43 Q 50 41 69 43 L 69 52 Q 50 54 31 52 Z"
                fill="#0f172a"
              />
              <path
                d="M 31 43 Q 50 41 69 43"
                stroke="#1e293b"
                strokeWidth="1"
                fill="none"
              />
              {/* Celah Six Eyes (Mata Biru Bersinar Menembus Blindfold) */}
              <ellipse
                cx="42"
                cy="47.5"
                rx="5"
                ry="1.8"
                fill="#38bdf8"
                className="gojo-sixeyes"
              />
              <ellipse
                cx="58"
                cy="47.5"
                rx="5"
                ry="1.8"
                fill="#38bdf8"
                className="gojo-sixeyes"
              />
              <circle cx="42" cy="47.5" r="1" fill="#ffffff" />
              <circle cx="58" cy="47.5" r="1" fill="#ffffff" />

              {/* Rambut Putih Ikonik Berdiri */}
              <g className="gojo-hair">
                <path
                  d="M 28 44 Q 22 28 32 20 Q 38 30 40 18 Q 47 28 50 14 Q 54 26 60 18 Q 63 28 68 20 Q 78 28 72 44 Q 68 36 60 36 Q 50 35 40 36 Q 32 36 28 44 Z"
                  fill="url(#gojoHairGrad)"
                />
                {/* Helai Poni Depan Halus */}
                <path d="M 33 38 Q 37 45 39 42" stroke="#e2e8f0" strokeWidth="1.5" fill="none" />
                <path d="M 48 35 Q 50 43 53 41" stroke="#e2e8f0" strokeWidth="1.5" fill="none" />
                <path d="M 64 38 Q 62 44 60 42" stroke="#e2e8f0" strokeWidth="1.5" fill="none" />
              </g>
            </g>
          </g>
        )}

        {/* ==========================================================
            2. RYOMEN SUKUNA
            ========================================================== */}
        {karakter === "sukuna" && (
          <g>
            {/* Background Cursed Red */}
            <circle cx="50" cy="50" r="48" fill="#180404" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#7f1d1d" strokeWidth="1" />

            {/* Garis Tebasan Dismantle / Cleave yang Melintas */}
            <line
              x1="5"
              y1="95"
              x2="95"
              y2="5"
              stroke="url(#sukunaSlashGrad)"
              strokeWidth="2.5"
              className="sukuna-slash-line"
            />
            <line
              x1="10"
              y1="10"
              x2="90"
              y2="90"
              stroke="#ef4444"
              strokeWidth="1"
              opacity="0.3"
              strokeDasharray="2 6"
            />

            {/* Kobaran Api Kutukan di Bawah */}
            <path
              d="M 15 95 Q 30 85 40 92 Q 50 82 65 90 Q 80 84 88 95 Z"
              fill="#991b1b"
              opacity="0.5"
              className="sukuna-cursed-flame"
            />

            <g className="anim-napas">
              {/* Bahu & Kimono Putih Terbuka */}
              <path
                d="M 20 98 Q 28 72 42 70 L 58 70 Q 72 72 80 98 Z"
                fill="#f1f5f9"
              />
              <path
                d="M 36 70 L 50 86 L 64 70"
                fill="#18181b"
              />
              {/* Tato Kutukan di Leher / Tulang Selangka */}
              <path d="M 45 74 L 55 74" stroke="#09090b" strokeWidth="1.5" />
              <path d="M 47 78 L 53 78" stroke="#09090b" strokeWidth="1.2" />

              {/* Wajah Sukuna & Garis Rahang Kuat */}
              <path
                d="M 33 46 Q 33 66 50 68 Q 67 66 67 46 Q 67 36 50 36 Q 33 36 33 46 Z"
                fill="#fed7aa"
              />

              {/* Tato Kutukan Ikonik Wajah Sukuna */}
              {/* 1. Dahi: Mahkota Kutukan */}
              <circle cx="50" cy="38" r="2.2" fill="#09090b" />
              <path d="M 44 41 L 56 41" stroke="#09090b" strokeWidth="1.5" />
              <path d="M 46 43 L 54 43" stroke="#09090b" strokeWidth="1.2" />
              {/* 2. Garis Hidung Melintang */}
              <path d="M 45 52 L 55 52" stroke="#09090b" strokeWidth="1.6" />
              {/* 3. Garis Pipih Kiri & Kanan */}
              <path d="M 35 52 L 40 54" stroke="#09090b" strokeWidth="1.5" />
              <path d="M 65 52 L 60 54" stroke="#09090b" strokeWidth="1.5" />
              <path d="M 36 57 L 41 58" stroke="#09090b" strokeWidth="1.2" />
              <path d="M 64 57 L 59 58" stroke="#09090b" strokeWidth="1.2" />

              {/* Mata Utama (Merah Membara) */}
              <g className="sukuna-eyes">
                <path d="M 39 46 Q 44 44 47 47 Q 44 49 39 46 Z" fill="#09090b" />
                <circle cx="43.5" cy="46.5" r="1.6" fill="#ef4444" />
                <circle cx="43.5" cy="46.5" r="0.6" fill="#fef08a" />

                <path d="M 61 46 Q 56 44 53 47 Q 56 49 61 46 Z" fill="#09090b" />
                <circle cx="56.5" cy="46.5" r="1.6" fill="#ef4444" />
                <circle cx="56.5" cy="46.5" r="0.6" fill="#fef08a" />

                {/* Pasang Mata Kedua di Bawah Mata Utama (Ciri Khas Raja Kutukan) */}
                <ellipse cx="43.5" cy="50" rx="2.5" ry="0.9" fill="#991b1b" />
                <ellipse cx="56.5" cy="50" rx="2.5" ry="0.9" fill="#991b1b" />
                <circle cx="43.5" cy="50" r="0.6" fill="#fee2e2" />
                <circle cx="56.5" cy="50" r="0.6" fill="#fee2e2" />
              </g>

              {/* Senyum Menyeringai Iblis / Taring Sukuna */}
              <path
                d="M 43 60 Q 50 65 57 60"
                stroke="#7f1d1d"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
              <polygon points="46,60 48,62 47,60" fill="#ffffff" />
              <polygon points="54,60 52,62 53,60" fill="#ffffff" />

              {/* Rambut Spiky Pink/Hitam Sukuna */}
              <path
                d="M 30 42 Q 22 28 32 18 Q 38 26 42 16 Q 48 24 50 14 Q 54 22 58 16 Q 63 26 68 18 Q 78 28 70 42 Q 67 36 60 35 Q 50 34 40 35 Q 33 36 30 42 Z"
                fill="url(#sukunaHairGrad)"
              />
              {/* Undercut Hitam */}
              <path d="M 31 43 Q 32 38 36 36 L 33 46 Z" fill="#18181b" />
              <path d="M 69 43 Q 68 38 64 36 L 67 46 Z" fill="#18181b" />
            </g>
          </g>
        )}

        {/* ==========================================================
            3. JOGO / JUGO
            ========================================================== */}
        {karakter === "jogo" && (
          <g>
            {/* Background Vulkanik Lava */}
            <circle cx="50" cy="50" r="48" fill="#1c1917" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#7c2d12" strokeWidth="1" />

            {/* Asap Hitam / Abu Vulkanik yang Mengepul dari Kawah Kepala */}
            <g>
              <ellipse
                cx="50"
                cy="14"
                rx="7"
                ry="4"
                fill="#78716c"
                className="volcano-smoke-puff-1"
              />
              <ellipse
                cx="53"
                cy="11"
                rx="6"
                ry="3.5"
                fill="#57534e"
                className="volcano-smoke-puff-2"
              />
            </g>

            {/* Percikan Api / Bara Melayang */}
            <circle cx="36" cy="18" r="1.5" fill="#f97316" className="fire-ember-1" />
            <circle cx="62" cy="15" r="1.8" fill="#ef4444" className="fire-ember-2" />
            <circle cx="68" cy="22" r="1.2" fill="#facc15" className="fire-ember-1" />

            <g className="anim-napas">
              {/* Jubah Bertotol Batu Vulkanik Jogo */}
              <path
                d="M 22 98 Q 28 72 40 70 L 60 70 Q 72 72 78 98 Z"
                fill="#44403c"
              />
              {/* Corak Batu Hitam di Jubah */}
              <circle cx="36" cy="80" r="2.5" fill="#1c1917" />
              <circle cx="48" cy="85" r="3" fill="#1c1917" />
              <circle cx="62" cy="79" r="2.8" fill="#1c1917" />
              <circle cx="56" cy="92" r="2" fill="#1c1917" />

              {/* Kerah Tinggi Leher */}
              <path
                d="M 38 67 L 50 74 L 62 67 Z"
                fill="#292524"
              />

              {/* Kepala Hijau Zaitun Khas Roh Kutukan Jogo */}
              <path
                d="M 33 46 Q 32 67 50 68 Q 68 67 67 46 Q 66 32 50 32 Q 34 32 33 46 Z"
                fill="#8fa963"
              />

              {/* Kawah Gunung Berapi di Puncak Kepala */}
              <path
                d="M 38 32 L 42 20 L 58 20 L 62 32 Z"
                fill="#292524"
                stroke="#1c1917"
                strokeWidth="1"
              />
              {/* Bibir Kawah & Magma Mendidih */}
              <ellipse cx="50" cy="20" rx="8" ry="3" fill="#0c0a09" />
              <ellipse
                cx="50"
                cy="20"
                rx="6"
                ry="2.2"
                fill="url(#volcanoLavaGrad)"
                className="volcano-lava"
              />

              {/* Mata Siklop Tunggal Raksasa di Tengah Wajah */}
              <g className="cyclops-eye-glow">
                {/* Kelopak Luar Hitam */}
                <ellipse cx="50" cy="46" rx="10" ry="10" fill="#1c1917" />
                {/* Bola Mata Kuning Menyala */}
                <circle cx="50" cy="46" r="8" fill="url(#cyclopsEyeGrad)" />
                {/* Pupil Vertikal Monster Api */}
                <ellipse cx="50" cy="46" rx="2.4" ry="7" fill="#0f172a" />
                <circle cx="52" cy="43" r="1.5" fill="#ffffff" opacity="0.8" />
              </g>

              {/* Gigi Bergerigi & Mulut Bengis */}
              <path
                d="M 40 60 Q 50 63 60 60"
                stroke="#292524"
                strokeWidth="2"
                fill="none"
              />
              <polygon points="44,60 46,63 45,60" fill="#fef08a" />
              <polygon points="49,60 51,64 50,60" fill="#fef08a" />
              <polygon points="54,60 56,63 55,60" fill="#fef08a" />

              {/* Lubang Telinga Sumbat Gabus Ikonik Jogo */}
              <ellipse cx="32" cy="48" rx="2" ry="4" fill="#a16207" />
              <ellipse cx="68" cy="48" rx="2" ry="4" fill="#a16207" />
            </g>
          </g>
        )}

        {/* ==========================================================
            4. NANAMI KENTO
            ========================================================== */}
        {karakter === "nanami" && (
          <g>
            {/* Background Smart Navy & Amber */}
            <circle cx="50" cy="50" r="48" fill="#0f172a" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#d97706" strokeWidth="1" />

            {/* Grid Rasio 7:3 di Latar Belakang */}
            <line x1="70" y1="10" x2="70" y2="90" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 4" opacity="0.4" />
            <text x="73" y="24" fill="#f59e0b" fontSize="6" fontWeight="bold" opacity="0.6">7:3</text>

            <g className="anim-napas">
              {/* Jas Rapi & Kemeja Kantor */}
              <path
                d="M 20 98 Q 28 72 40 70 L 60 70 Q 72 72 80 98 Z"
                fill="#334155"
              />
              {/* Kemeja Biru Muda */}
              <polygon points="40,70 50,85 60,70" fill="#e2e8f0" />
              {/* Dasi Totol Kuning Ikonik Nanami */}
              <path d="M 47 72 L 53 72 L 52 98 L 48 98 Z" fill="#facc15" />
              <circle cx="50" cy="76" r="0.9" fill="#0f172a" />
              <circle cx="50" cy="82" r="1.1" fill="#0f172a" />
              <circle cx="50" cy="88" r="1" fill="#0f172a" />
              <circle cx="50" cy="94" r="1.1" fill="#0f172a" />

              {/* Bentuk Wajah Tegas & Dewasa */}
              <path
                d="M 34 44 Q 34 66 50 67 Q 66 66 66 44 Q 66 36 50 36 Q 34 36 34 44 Z"
                fill="#fed7aa"
              />

              {/* Hidung Mancung & Mulut Tenang/Disiplin */}
              <path d="M 49 51 L 52 53 L 49 54" stroke="#e09067" strokeWidth="1.2" fill="none" />
              <line x1="45" y1="59" x2="55" y2="59" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" />

              {/* Kacamata Tanpa Bingkai (Rimless Glasses) Ikonik Nanami */}
              <g>
                {/* Lensa Kiri & Kanan */}
                <ellipse cx="42" cy="46" rx="6.5" ry="4" fill="url(#nanamiLensGrad)" stroke="#78350f" strokeWidth="0.8" />
                <ellipse cx="58" cy="46" rx="6.5" ry="4" fill="url(#nanamiLensGrad)" stroke="#78350f" strokeWidth="0.8" />
                {/* Jembatan Kacamata */}
                <path d="M 48.5 45.5 Q 50 44 51.5 45.5" stroke="#78350f" strokeWidth="1.2" fill="none" />

                {/* Kilatan Cahaya Berjalan di Lensa Kacamata */}
                <line
                  x1="36"
                  y1="43"
                  x2="48"
                  y2="49"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="nanami-glint"
                  strokeLinecap="round"
                />
              </g>

              {/* Rambut Pirang Belah 7:3 Rapi */}
              <g>
                <path
                  d="M 32 44 Q 31 30 42 22 Q 52 20 62 25 Q 68 30 67 44 Q 63 36 50 36 Q 37 36 32 44 Z"
                  fill="url(#nanamiHairGrad)"
                />
                {/* Belahan Rambut 7:3 Tajam */}
                <path d="M 44 23 Q 48 30 46 36" stroke="#ca8a04" strokeWidth="1.2" fill="none" />
                <path d="M 54 24 Q 57 32 60 36" stroke="#ca8a04" strokeWidth="1" fill="none" />
              </g>

              {/* Pisau Tebas Berbalut Kain di Pojok Kanan Bawah */}
              <g transform="translate(62, 60) rotate(-15)">
                {/* Bilah Tumpul */}
                <rect x="0" y="0" width="24" height="6.5" rx="1.5" fill="#64748b" />
                {/* Balutan Kain Tutul */}
                <rect x="2" y="0.5" width="16" height="5.5" fill="#fef08a" />
                <circle cx="5" cy="3" r="0.8" fill="#1c1917" />
                <circle cx="10" cy="4" r="0.9" fill="#1c1917" />
                <circle cx="14" cy="2" r="0.8" fill="#1c1917" />
                {/* Titik Rasio Kritis (Critical Hit 7:3) */}
                <circle cx="17" cy="3.2" r="2.5" fill="#ef4444" className="ratio-point" />
              </g>
            </g>
          </g>
        )}

        {/* ==========================================================
            5. YUJI ITADORI (KOKUSEN / KILATAN HITAM)
            ========================================================== */}
        {karakter === "itadori" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#18040a" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#f43f5e" strokeWidth="1" />
            <g className="anim-napas">
              {/* Seragam Jujutsu dengan Kerudung Merah Ikonik */}
              <path d="M 22 98 Q 30 74 42 72 L 58 72 Q 70 74 78 98 Z" fill="#1e1b4b" />
              <path d="M 38 72 Q 50 88 62 72 Q 58 64 50 64 Q 42 64 38 72 Z" fill="#e11d48" />
              {/* Wajah & Leher */}
              <path d="M 36 46 Q 36 68 50 68 Q 64 68 64 46 Q 64 38 50 38 Q 36 38 36 46 Z" fill="#fed7aa" />
              {/* Mata Bersemangat */}
              <ellipse cx="44" cy="48" rx="2.8" ry="3.5" fill="#18040a" />
              <ellipse cx="56" cy="48" rx="2.8" ry="3.5" fill="#18040a" />
              <circle cx="45" cy="47" r="1.1" fill="#ffffff" />
              <circle cx="57" cy="47" r="1.1" fill="#ffffff" />
              {/* Bekas Mata Sukuna di Pipi */}
              <line x1="39" y1="53" x2="43" y2="54" stroke="#e11d48" strokeWidth="1" />
              <line x1="57" y1="54" x2="61" y2="53" stroke="#e11d48" strokeWidth="1" />
              {/* Senyum Percaya Diri */}
              <path d="M 46 58 Q 50 61 54 58" stroke="#991b1b" strokeWidth="1.2" fill="none" />
              {/* Rambut Spiky Pink Itadori */}
              <path
                d="M 32 44 Q 30 26 38 20 Q 42 28 46 16 Q 50 26 56 18 Q 62 26 66 22 Q 68 34 67 44 Q 50 38 32 44 Z"
                fill="#fb7185"
              />
              <path d="M 36 34 L 40 40 L 44 32 L 48 38 L 54 32 L 58 39 L 63 34" fill="#fb7185" />
              {/* Tinju Kokusen dengan Kilatan Hitam di Pojok Bawah */}
              <g transform="translate(62, 65)">
                <circle cx="12" cy="12" r="10" fill="#000000" />
                <circle cx="12" cy="12" r="8" fill="#e11d48" opacity="0.8" />
                <path d="M 2 12 L 8 8 L 14 16 L 22 6" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              </g>
            </g>
          </g>
        )}

        {/* ==========================================================
            6. MEGUMI FUSHIGURO (CHIMERA SHADOW GARDEN)
            ========================================================== */}
        {karakter === "megumi" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#041219" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#14b8a6" strokeWidth="1" />
            <g className="anim-napas">
              {/* Seragam Jujutsu Kerah Tinggi */}
              <path d="M 22 98 Q 30 74 42 70 L 58 70 Q 70 74 78 98 Z" fill="#0f172a" />
              <rect x="42" y="62" width="16" height="12" fill="#1e293b" />
              {/* Wajah Tenang & Dingin */}
              <path d="M 36 46 Q 36 66 50 66 Q 64 66 64 46 Q 64 38 50 38 Q 36 38 36 46 Z" fill="#fed7aa" />
              <ellipse cx="44" cy="48" rx="2.6" ry="3.2" fill="#0d9488" />
              <ellipse cx="56" cy="48" rx="2.6" ry="3.2" fill="#0d9488" />
              <line x1="47" y1="58" x2="53" y2="58" stroke="#334155" strokeWidth="1" />
              {/* Rambut Hitam Berantakan Spiky */}
              <path
                d="M 30 46 Q 24 30 32 18 Q 38 28 42 12 Q 48 24 54 10 Q 60 22 66 14 Q 74 26 70 46 Q 50 36 30 46 Z"
                fill="#090d16"
              />
              {/* Mata Anjing Bayangan Kon (Hijau Terang) di Latar Belakang */}
              <circle cx="22" cy="35" r="2.5" fill="#2dd4bf" />
              <circle cx="28" cy="35" r="2.5" fill="#2dd4bf" />
            </g>
          </g>
        )}

        {/* ==========================================================
            7. NOBARA KUGISAKI (RESONANSI & PAKU)
            ========================================================== */}
        {karakter === "nobara" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#18040d" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#ec4899" strokeWidth="1" />
            <g className="anim-napas">
              {/* Seragam Jujutsu dengan Kemeja Putih */}
              <path d="M 22 98 Q 30 74 42 70 L 58 70 Q 70 74 78 98 Z" fill="#1e1b4b" />
              <polygon points="44,70 50,82 56,70" fill="#f8fafc" />
              {/* Wajah & Senyum Percaya Diri */}
              <path d="M 36 46 Q 36 67 50 67 Q 64 67 64 46 Q 64 38 50 38 Q 36 38 36 46 Z" fill="#fed7aa" />
              <ellipse cx="44" cy="48" rx="2.8" ry="3.4" fill="#9d174d" />
              <ellipse cx="56" cy="48" rx="2.8" ry="3.4" fill="#9d174d" />
              <path d="M 46 58 Q 50 61 54 58" stroke="#be185d" strokeWidth="1.2" fill="none" />
              {/* Rambut Bob Jingga/Oranye Cokelat */}
              <path
                d="M 30 48 Q 28 26 44 20 Q 60 20 68 28 Q 72 40 70 52 Q 65 42 63 36 Q 50 36 37 40 Q 32 44 30 48 Z"
                fill="#ea580c"
              />
              <path d="M 32 42 Q 38 52 38 60" stroke="#ea580c" strokeWidth="4" fill="none" />
              {/* Paku Besi Berkilau di Samping */}
              <g transform="translate(68, 45) rotate(25)">
                <rect x="0" y="0" width="3" height="18" fill="#e2e8f0" rx="1" />
                <rect x="-2" y="-2" width="7" height="3" fill="#94a3b8" rx="1" />
                <circle cx="1.5" cy="18" r="2.5" fill="#f43f5e" opacity="0.8" />
              </g>
            </g>
          </g>
        )}

        {/* ==========================================================
            8. YUTA OKKOTSU (CINTA SEJATI & RIKA)
            ========================================================== */}
        {karakter === "yuta" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#0d071a" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#a855f7" strokeWidth="1" />
            <g className="anim-napas">
              {/* Jubah Putih Khas Yuta dengan Tali Pedang Hitam */}
              <path d="M 22 98 Q 30 74 42 70 L 58 70 Q 70 74 78 98 Z" fill="#f8fafc" />
              <line x1="28" y1="98" x2="68" y2="70" stroke="#1e1b4b" strokeWidth="3" />
              {/* Wajah Lembut namun Tekad Kuat */}
              <path d="M 36 46 Q 36 67 50 67 Q 64 67 64 46 Q 64 38 50 38 Q 36 38 36 46 Z" fill="#fed7aa" />
              <ellipse cx="44" cy="48" rx="2.7" ry="3.4" fill="#6b21a8" />
              <ellipse cx="56" cy="48" rx="2.7" ry="3.4" fill="#6b21a8" />
              {/* Kantung Mata Hitam Lemah Letih */}
              <path d="M 41 52 Q 44 54 47 52" stroke="#a855f7" strokeWidth="0.8" fill="none" />
              <path d="M 53 52 Q 56 54 59 52" stroke="#a855f7" strokeWidth="0.8" fill="none" />
              <line x1="47" y1="59" x2="53" y2="59" stroke="#581c87" strokeWidth="1" />
              {/* Rambut Hitam Belah Tengah Alami */}
              <path
                d="M 32 46 Q 30 24 50 20 Q 70 24 68 46 Q 60 36 50 36 Q 40 36 32 46 Z"
                fill="#171123"
              />
              <path d="M 44 23 Q 48 34 46 42" stroke="#171123" strokeWidth="3" fill="none" />
              {/* Cincin Ikatan Suci dengan Rika Berkilau di Jari */}
              <circle cx="68" cy="76" r="3.5" fill="none" stroke="#e9d5ff" strokeWidth="1.5" />
              <circle cx="68" cy="74" r="1.5" fill="#ffffff" />
            </g>
          </g>
        )}

        {/* ==========================================================
            9. TOJI FUSHIGURO (BATASAN SURGAWI & AMANOSAKAHOKO)
            ========================================================== */}
        {karakter === "toji" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#080c12" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#64748b" strokeWidth="1" />
            <g className="anim-napas">
              {/* Kaos Ketat Hitam Atletis */}
              <path d="M 20 98 Q 28 72 40 70 L 60 70 Q 72 72 80 98 Z" fill="#0f172a" />
              {/* Leher Berotot & Bekas Luka di Bibir Kanan */}
              <path d="M 35 44 Q 35 66 50 67 Q 65 66 65 44 Q 65 36 50 36 Q 35 36 35 44 Z" fill="#fed7aa" />
              <ellipse cx="43" cy="47" rx="2.7" ry="3.2" fill="#0f172a" />
              <ellipse cx="57" cy="47" rx="2.7" ry="3.2" fill="#0f172a" />
              {/* Bekas Luka Legendaris di Sudut Bibir Kanan */}
              <line x1="56" y1="56" x2="60" y2="61" stroke="#991b1b" strokeWidth="1.4" />
              <line x1="45" y1="58" x2="55" y2="58" stroke="#475569" strokeWidth="1.2" />
              {/* Rambut Hitam Rapi Sedikit Berantakan */}
              <path
                d="M 32 44 Q 30 26 44 20 Q 58 20 68 28 Q 70 38 68 46 Q 60 36 50 36 Q 38 36 32 44 Z"
                fill="#090d16"
              />
              {/* Belati Pembalik Surga (Inverted Spear of Heaven) */}
              <g transform="translate(68, 52) rotate(20)">
                <rect x="0" y="0" width="4" height="24" fill="#94a3b8" rx="1" />
                <polygon points="-2,16 6,16 2,24" fill="#cbd5e1" />
                <circle cx="2" cy="4" r="2.5" fill="#475569" />
              </g>
            </g>
          </g>
        )}

        {/* ==========================================================
            10. SUGURU GETO (MANIPULASI ROH KUTUKAN)
            ========================================================== */}
        {karakter === "geto" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#120f04" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#ca8a04" strokeWidth="1" />
            <g className="anim-napas">
              {/* Jubah Biksu Kesa Emas Kuno */}
              <path d="M 20 98 Q 28 72 40 70 L 60 70 Q 72 72 80 98 Z" fill="#1c1917" />
              <polygon points="35,70 50,98 65,70" fill="#ca8a04" />
              {/* Wajah Tenang Tersenyum Misterius */}
              <path d="M 35 44 Q 35 66 50 67 Q 65 66 65 44 Q 65 36 50 36 Q 35 36 35 44 Z" fill="#fed7aa" />
              <path d="M 42 48 Q 45 46 48 48" stroke="#1c1917" strokeWidth="1.5" fill="none" />
              <path d="M 54 48 Q 57 46 60 48" stroke="#1c1917" strokeWidth="1.5" fill="none" />
              <path d="M 46 58 Q 50 61 54 58" stroke="#854d0e" strokeWidth="1.2" fill="none" />
              {/* Rambut Panjang Hitam & Poni Ikonik Menutup Wajah */}
              <path
                d="M 30 46 Q 30 22 50 18 Q 70 22 70 46 Q 62 34 50 34 Q 36 34 30 46 Z"
                fill="#0f172a"
              />
              <path d="M 42 22 Q 46 38 42 54" stroke="#0f172a" strokeWidth="3.5" fill="none" />
              {/* Bola Roh Kutukan Berputar di Dekat Tangan */}
              <circle cx="70" cy="72" r="5.5" fill="#1e1b4b" stroke="#ca8a04" strokeWidth="1" />
            </g>
          </g>
        )}

        {/* ==========================================================
            11. MAKI ZEN'IN (PEDANG PEMOTONG JIWA)
            ========================================================== */}
        {karakter === "maki" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#140407" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#e11d48" strokeWidth="1" />
            <g className="anim-napas">
              <path d="M 22 98 Q 30 74 42 70 L 58 70 Q 70 74 78 98 Z" fill="#0f172a" />
              <path d="M 36 46 Q 36 67 50 67 Q 64 67 64 46 Q 64 38 50 38 Q 36 38 36 46 Z" fill="#fed7aa" />
              <ellipse cx="44" cy="48" rx="2.8" ry="3.2" fill="#047857" />
              <ellipse cx="56" cy="48" rx="2.8" ry="3.2" fill="#047857" />
              {/* Kacamata & Ikatan Kuncir Rambut Tinggi */}
              <circle cx="44" cy="48" r="4" fill="none" stroke="#334155" strokeWidth="0.9" />
              <circle cx="56" cy="48" r="4" fill="none" stroke="#334155" strokeWidth="0.9" />
              <line x1="48" y1="48" x2="52" y2="48" stroke="#334155" strokeWidth="0.9" />
              {/* Kuncir Rambut Tinggi Hijau Gelap */}
              <path
                d="M 32 46 Q 30 24 50 20 Q 70 24 68 46 Q 50 36 32 46 Z"
                fill="#064e3b"
              />
              <path d="M 62 26 Q 78 20 82 38" stroke="#064e3b" strokeWidth="4.5" fill="none" />
            </g>
          </g>
        )}

        {/* ==========================================================
            12. MAHITO (MUTASI JIWA & WAJAH BERJAHIT)
            ========================================================== */}
        {karakter === "mahito" && (
          <g>
            <circle cx="50" cy="50" r="48" fill="#060c14" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#38bdf8" strokeWidth="1" />
            <g className="anim-napas">
              <path d="M 22 98 Q 30 74 42 70 L 58 70 Q 70 74 78 98 Z" fill="#1e1b4b" />
              <path d="M 36 46 Q 36 67 50 67 Q 64 67 64 46 Q 64 38 50 38 Q 36 38 36 46 Z" fill="#e2e8f0" />
              {/* Mata Heterokromia (Abu-abu & Biru) */}
              <ellipse cx="44" cy="48" rx="2.8" ry="3.4" fill="#38bdf8" />
              <ellipse cx="56" cy="48" rx="2.8" ry="3.4" fill="#64748b" />
              {/* Jahitan Khas di Wajah Mahito */}
              <line x1="38" y1="44" x2="62" y2="52" stroke="#475569" strokeWidth="1" />
              <line x1="43" y1="45" x2="44" y2="48" stroke="#475569" strokeWidth="1" />
              <line x1="51" y1="47" x2="52" y2="50" stroke="#475569" strokeWidth="1" />
              <line x1="58" y1="49" x2="59" y2="52" stroke="#475569" strokeWidth="1" />
              {/* Senyum Lebar Nakal */}
              <path d="M 44 58 Q 50 64 56 58" stroke="#0284c7" strokeWidth="1.4" fill="none" />
              {/* Rambut Abu-abu Kebiruan Berantakan */}
              <path
                d="M 30 46 Q 28 22 50 18 Q 72 22 70 46 Q 60 36 50 36 Q 40 36 30 46 Z"
                fill="#94a3b8"
              />
              <path d="M 32 46 Q 26 56 30 68" stroke="#94a3b8" strokeWidth="3" fill="none" />
              <path d="M 68 46 Q 74 56 70 68" stroke="#94a3b8" strokeWidth="3" fill="none" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
