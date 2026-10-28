import React, { useCallback, useEffect, useRef, useState } from "react";

/** Logo Google Drive (enam bidang warna resmi). */
export const LogoDrive: React.FC<{ ukuran?: number }> = ({ ukuran = 64 }) => (
  <svg viewBox="0 0 87.3 78" width={ukuran} height={ukuran * (78 / 87.3)} aria-hidden="true" focusable="false">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47" />
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
  </svg>
);

type StatusSinkron = "diam" | "menahan" | "proses" | "berhasil" | "gagal";

interface TombolSinkronProps {
  /** Sudah tersambung ke akun Google; bila belum, lingkaran redup dan tidak bisa ditekan. */
  tersambung: boolean;
  /** Sedang ada proses Drive lain berjalan. */
  sibuk?: boolean;
  /** Dipanggil setelah lingkaran ditahan penuh; true bila sinkronisasi berhasil. */
  onSelesaiTahan: () => Promise<boolean>;
  /** Lama menahan (milidetik). */
  durasiMs?: number;
}

const JARI_JARI = 54;
const KELILING = 2 * Math.PI * JARI_JARI;

/** "14.05" dari Date, tanpa bergantung pada lokal perangkat. */
const jamMenit = (d: Date) => `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * Tombol sinkronisasi berbentuk lingkaran berlogo Google Drive. Ditekan dan ditahan 3 detik: cincin terisi searah jarum jam
 * (tahan lagi bila terlepas sebelum penuh), lalu data otomatis disinkronkan. Bisa juga dengan keyboard (tahan Spasi atau Enter).
 * Memakai satu ukuran lama tahan untuk cincin (transisi CSS) dan penghitung waktu supaya keduanya selalu selaras.
 */
export const TombolSinkron: React.FC<TombolSinkronProps> = ({ tersambung, sibuk = false, onSelesaiTahan, durasiMs = 3000 }) => {
  const [status, setStatus] = useState<StatusSinkron>("diam");
  const [sisaDetik, setSisaDetik] = useState(Math.ceil(durasiMs / 1000));
  const [terakhir, setTerakhir] = useState<Date | null>(null);
  const timerSelesai = useRef<number | null>(null);
  const timerHitung = useRef<number | null>(null);
  const timerPulih = useRef<number | null>(null);
  const mulaiAt = useRef(0);
  const statusRef = useRef<StatusSinkron>("diam");
  statusRef.current = status;

  const bersihkanTahan = useCallback(() => {
    if (timerSelesai.current !== null) window.clearTimeout(timerSelesai.current);
    if (timerHitung.current !== null) window.clearInterval(timerHitung.current);
    timerSelesai.current = null;
    timerHitung.current = null;
  }, []);

  useEffect(
    () => () => {
      bersihkanTahan();
      if (timerPulih.current !== null) window.clearTimeout(timerPulih.current);
    },
    [bersihkanTahan]
  );

  const batalkan = useCallback(() => {
    if (statusRef.current !== "menahan") return;
    bersihkanTahan();
    setStatus("diam");
  }, [bersihkanTahan]);

  const selesai = useCallback(async () => {
    bersihkanTahan();
    setStatus("proses");
    try {
      navigator.vibrate?.([30, 40, 30]);
    } catch {
      /* getaran tidak didukung */
    }
    let ok = false;
    try {
      ok = await onSelesaiTahan();
    } catch {
      ok = false;
    }
    if (ok) setTerakhir(new Date());
    setStatus(ok ? "berhasil" : "gagal");
    if (timerPulih.current !== null) window.clearTimeout(timerPulih.current);
    timerPulih.current = window.setTimeout(() => setStatus("diam"), ok ? 6000 : 7000);
  }, [bersihkanTahan, onSelesaiTahan]);

  const mulai = useCallback(() => {
    if (!tersambung || sibuk || statusRef.current === "menahan" || statusRef.current === "proses") return;
    if (timerPulih.current !== null) window.clearTimeout(timerPulih.current);
    mulaiAt.current = Date.now();
    setSisaDetik(Math.ceil(durasiMs / 1000));
    setStatus("menahan");
    try {
      navigator.vibrate?.(15);
    } catch {
      /* getaran tidak didukung */
    }
    timerHitung.current = window.setInterval(() => {
      setSisaDetik(Math.max(1, Math.ceil((durasiMs - (Date.now() - mulaiAt.current)) / 1000)));
    }, 120);
    timerSelesai.current = window.setTimeout(() => void selesai(), durasiMs);
  }, [tersambung, sibuk, durasiMs, selesai]);

  const bekerja = status === "proses" || (sibuk && status === "diam");
  const tampilStatus: StatusSinkron = bekerja ? "proses" : status;
  const menahan = status === "menahan";
  const detik = Math.round(durasiMs / 1000);

  const petunjuk = !tersambung
    ? "Masuk dengan Google dulu"
    : tampilStatus === "menahan"
      ? `Terus tahan… ${sisaDetik} dtk`
      : tampilStatus === "proses"
        ? "Menyinkronkan data…"
        : tampilStatus === "berhasil"
          ? terakhir
            ? `Tersinkron pukul ${jamMenit(terakhir)}`
            : "Tersinkron"
          : tampilStatus === "gagal"
            ? "Belum berhasil. Tahan lagi untuk mencoba"
            : `Tekan & tahan ${detik} detik`;

  return (
    <div className="sinkron-wadah" data-status={tampilStatus} data-tersambung={tersambung ? "ya" : "tidak"}>
      <button
        type="button"
        className="sinkron-tombol"
        data-testid="tombol-sinkron"
        data-status={tampilStatus}
        data-menahan={menahan ? "ya" : "tidak"}
        aria-label={`Sinkronisasi data dengan Google Drive. Tekan dan tahan ${detik} detik`}
        aria-describedby="sinkron-petunjuk"
        disabled={!tersambung || bekerja}
        style={{ "--sinkron-durasi": `${durasiMs}ms` } as React.CSSProperties}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* penangkapan penunjuk tidak didukung */
          }
          mulai();
        }}
        onPointerUp={batalkan}
        onPointerCancel={batalkan}
        onLostPointerCapture={batalkan}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            mulai();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") batalkan();
        }}
        onBlur={batalkan}
      >
        <span className="sinkron-denyut" aria-hidden="true" />
        <span className="sinkron-denyut sinkron-denyut--kedua" aria-hidden="true" />
        <span className="sinkron-cakram" aria-hidden="true">
          {tampilStatus === "berhasil" ? (
            <svg className="sinkron-centang" viewBox="0 0 52 52" width="64" height="64" focusable="false">
              <circle cx="26" cy="26" r="24" fill="none" stroke="#16a34a" strokeWidth="3" />
              <path d="M14 27 l8 8 l16 -17" fill="none" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <LogoDrive ukuran={70} />
          )}
        </span>
        <svg className="sinkron-cincin" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="sinkron-gradasi" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4285f4" />
              <stop offset="50%" stopColor="#34a853" />
              <stop offset="100%" stopColor="#fbbc05" />
            </linearGradient>
          </defs>
          <circle className="sinkron-jalur" cx="60" cy="60" r={JARI_JARI} fill="none" strokeWidth="6" />
          <circle
            className="sinkron-isi"
            cx="60"
            cy="60"
            r={JARI_JARI}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={KELILING}
            strokeDashoffset={menahan || tampilStatus === "proses" || tampilStatus === "berhasil" ? 0 : KELILING}
          />
        </svg>
      </button>
      <p id="sinkron-petunjuk" className="sinkron-petunjuk" data-testid="petunjuk-sinkron" role="status" aria-live="polite">
        {petunjuk}
      </p>
    </div>
  );
};
