import qrcode from "qrcode-generator";
import jsQR from "jsqr";

/** Gambar kode QR ke kanvas: latar putih, modul hitam, tepi kosong 4 modul (syarat agar mudah dipindai). */
export function gambarQRKeCanvas(canvas: HTMLCanvasElement, teks: string, ukuran = 256): void {
  const qr = qrcode(0, "M");
  qr.addData(teks);
  qr.make();
  const n = qr.getModuleCount();
  const sel = Math.max(2, Math.floor(ukuran / (n + 8)));
  const sisi = sel * (n + 8);
  canvas.width = sisi;
  canvas.height = sisi;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sisi, sisi);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + 4) * sel, (r + 4) * sel, sel, sel);
    }
  }
}

/** Cari kode QR pada piksel gambar; null bila tidak ada. */
export function dekodeQRDariPiksel(data: Uint8ClampedArray, lebar: number, tinggi: number): string | null {
  const hasil = jsQR(data, lebar, tinggi, { inversionAttempts: "attemptBoth" });
  return hasil?.data ?? null;
}

/** Baca kode QR dari berkas gambar (mis. tangkapan layar atau foto kode). Gambar besar diperkecil dulu agar cepat. */
export async function dekodeQRDariBerkas(berkas: File, sisiMaks = 1200): Promise<string | null> {
  const url = URL.createObjectURL(berkas);
  try {
    const img = await new Promise<HTMLImageElement>((ok, gagal) => {
      const el = new Image();
      el.onload = () => ok(el);
      el.onerror = () => gagal(new Error("Gambar tidak bisa dibuka."));
      el.src = url;
    });
    const skala = Math.min(1, sisiMaks / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * skala));
    const h = Math.max(1, Math.round(img.naturalHeight * skala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return dekodeQRDariPiksel(ctx.getImageData(0, 0, w, h).data, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}
