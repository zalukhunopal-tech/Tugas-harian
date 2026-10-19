export interface HasilBacaStruk {
  sukses: boolean;
  deskripsi?: string;
  jumlah?: number;
  tanggal?: string;
  kategori?: string;
  metode?: string;
  catatan?: string;
  ringkasan?: string;
  pesan?: string;
}

/**
 * Membaca File gambar dari input kamera/file, lalu melakukan kompresi cerdas di browser
 * (maksimal dimensi 1600px, JPEG 85%) agar ukuran upload ringan (< 300KB) dan cepat diproses AI.
 */
export async function optimalkanGambarStruk(
  file: File
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat elemen gambar"));
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback tanpa canvas
          const raw = String(reader.result || "");
          const clean = raw.includes(";base64,") ? raw.split(";base64,")[1] : raw;
          resolve({
            base64: clean,
            mimeType: file.type || "image/jpeg",
            previewUrl: raw,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64Data = compressedDataUrl.split(";base64,")[1];

        resolve({
          base64: base64Data,
          mimeType: "image/jpeg",
          previewUrl: compressedDataUrl,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Mengirim gambar struk ke endpoint backend /api/gemini/baca-struk
 */
export async function prosesStrukDenganGemini(
  base64: string,
  mimeType: string = "image/jpeg"
): Promise<HasilBacaStruk> {
  const res = await fetch("/api/gemini/baca-struk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: base64,
      mimeType,
    }),
  });

  if (!res.ok) {
    let errorMsg = `Server error HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.pesan) errorMsg = errJson.pesan;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const data: HasilBacaStruk = await res.json();
  return data;
}
