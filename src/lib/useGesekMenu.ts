import { useEffect, useRef } from "react";

/** Jarak geser mendatar minimal (px) dan perbandingannya terhadap geseran tegak, supaya menggulir halaman tidak terhitung. */
const AMBANG_X = 70;
const NISBAH_MENDATAR = 1.7;
const BATAS_WAKTU_MS = 900;
/** Sentuhan yang dimulai di tepi layar dibiarkan untuk gestur kembali milik sistem. */
const LEBAR_TEPI = 24;

/**
 * Gesekan boleh dimulai bila sentuhan tidak berada di kolom isian, lapisan penuh (dialog, modal), area yang bisa
 * digeser mendatar sendiri (deret chip, tabel), atau elemen bertanda data-tanpa-gesek.
 */
function bolehMulai(sasaran: EventTarget | null): boolean {
  let el = sasaran instanceof Element ? sasaran : null;
  while (el && el !== document.body) {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable) return false;
    if (el.hasAttribute("data-tanpa-gesek")) return false;
    const gaya = getComputedStyle(el);
    if (gaya.position === "fixed" && !el.matches(".navbar")) return false;
    if ((gaya.overflowX === "auto" || gaya.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) return false;
    el = el.parentElement;
  }
  return true;
}

/**
 * Geser jari ke kiri atau kanan untuk pindah menu. onGesek(1) = menu berikutnya (geser ke kiri), onGesek(-1) =
 * sebelumnya (geser ke kanan). Hanya bereaksi pada sentuhan, jadi mouse di PC tidak terpengaruh.
 */
export function useGesekMenu(aktif: boolean, onGesek: (arah: 1 | -1) => void): void {
  const pegangan = useRef(onGesek);
  pegangan.current = onGesek;

  useEffect(() => {
    if (!aktif) return;
    let awal: { x: number; y: number; waktu: number } | null = null;

    const mulai = (e: TouchEvent) => {
      awal = null;
      if (e.touches.length !== 1) return;
      if (window.visualViewport && window.visualViewport.scale > 1.01) return; // sedang diperbesar
      const t = e.touches[0];
      if (t.clientX < LEBAR_TEPI || t.clientX > window.innerWidth - LEBAR_TEPI) return;
      if (!bolehMulai(e.target)) return;
      awal = { x: t.clientX, y: t.clientY, waktu: Date.now() };
    };
    const gerak = (e: TouchEvent) => {
      if (e.touches.length > 1) awal = null; // cubit untuk memperbesar
    };
    const selesai = (e: TouchEvent) => {
      const a = awal;
      awal = null;
      if (!a || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - a.x;
      const dy = t.clientY - a.y;
      if (Date.now() - a.waktu > BATAS_WAKTU_MS) return;
      if (Math.abs(dx) < AMBANG_X || Math.abs(dx) < Math.abs(dy) * NISBAH_MENDATAR) return;
      if (window.getSelection()?.toString()) return; // sedang memilih teks
      pegangan.current(dx < 0 ? 1 : -1);
    };
    const batal = () => {
      awal = null;
    };

    document.addEventListener("touchstart", mulai, { passive: true });
    document.addEventListener("touchmove", gerak, { passive: true });
    document.addEventListener("touchend", selesai, { passive: true });
    document.addEventListener("touchcancel", batal, { passive: true });
    return () => {
      document.removeEventListener("touchstart", mulai);
      document.removeEventListener("touchmove", gerak);
      document.removeEventListener("touchend", selesai);
      document.removeEventListener("touchcancel", batal);
    };
  }, [aktif]);
}
