/**
 * Pengganti `window.confirm` dan `window.alert` untuk sandbox artefak.
 *
 * Sandbox tidak pernah menampilkan dialog bawaan browser: `confirm()` langsung mengembalikan false dan
 * `alert()` tidak menampilkan apa-apa. Akibatnya semua tombol yang meminta konfirmasi (hapus transaksi,
 * hapus aset, kirim ke Drive secara manual) diam saja.
 *
 * `confirm()` bersifat sinkron sehingga tidak bisa menunggu dialog buatan sendiri. Jalan keluarnya:
 *   1. `confirm(pesan)` menampilkan dialog di halaman dan mengembalikan false (aksi dibatalkan dulu);
 *   2. bila pengguna memilih "Lanjutkan", pesan itu ditandai disetujui lalu tombol yang tadi diklik
 *      diklik ulang secara terprogram;
 *   3. pada klik ulang, `confirm(pesan)` yang sama mengembalikan true dan aksi berjalan.
 * Semua pemanggilan `confirm` di aplikasi berasal dari klik tombol, jadi pola ini cukup.
 *
 * Persetujuan milik SATU klik pengguna: setiap klik asli (isTrusted) di luar dialog menghapus semua
 * persetujuan. Jadi klik "Hapus" pada item lain dengan pesan yang sama selalu memunculkan dialog lagi,
 * sedangkan klik ulang terprogram (bukan klik asli) tidak menghapusnya, sehingga alur yang meminta dua
 * konfirmasi berurutan tetap bisa selesai.
 */

const MASA_BERLAKU_MS = 60_000;

const disetujui = new Map<string, number>();
let klikTerakhir: Element | null = null;
let dialogTerbuka = false;

const GAYA = `
.dlg-artefak{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(3,6,18,.72)}
.dlg-artefak__kotak{box-sizing:border-box;width:min(100%,420px);max-height:min(80vh,560px);display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:14px;background:#10162e;color:#f2f4ff;border:1px solid rgba(160,175,255,.35);box-shadow:0 18px 50px rgba(0,0,0,.5);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
.dlg-artefak__pesan{margin:0;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.dlg-artefak__aksi{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.dlg-artefak__aksi button{min-height:40px;padding:8px 16px;border-radius:10px;border:1px solid rgba(160,175,255,.4);background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}
.dlg-artefak__aksi button.utama{background:#6d7bff;border-color:#6d7bff;color:#fff}
.dlg-artefak__aksi button:focus-visible{outline:2px solid #fff;outline-offset:2px}
`;

function pasangGaya(): void {
  if (document.getElementById("gaya-dlg-artefak")) return;
  const el = document.createElement("style");
  el.id = "gaya-dlg-artefak";
  el.textContent = GAYA;
  document.head.appendChild(el);
}

function tampilkan(pesan: string, tombolBatal: boolean, saatLanjut: () => void): void {
  if (dialogTerbuka) return;
  dialogTerbuka = true;
  pasangGaya();
  const fokusAwal = document.activeElement as HTMLElement | null;

  const latar = document.createElement("div");
  latar.className = "dlg-artefak";
  const kotak = document.createElement("div");
  kotak.className = "dlg-artefak__kotak";
  kotak.setAttribute("role", tombolBatal ? "alertdialog" : "dialog");
  kotak.setAttribute("aria-modal", "true");
  const teks = document.createElement("p");
  teks.className = "dlg-artefak__pesan";
  teks.textContent = pesan;
  const aksi = document.createElement("div");
  aksi.className = "dlg-artefak__aksi";

  const tutup = () => {
    latar.remove();
    document.removeEventListener("keydown", tekanTombol, true);
    dialogTerbuka = false;
    fokusAwal?.focus?.();
  };
  const tekanTombol = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      tutup();
    }
  };

  if (tombolBatal) {
    const batal = document.createElement("button");
    batal.type = "button";
    batal.textContent = "Batal";
    batal.onclick = tutup;
    aksi.appendChild(batal);
  }
  const lanjut = document.createElement("button");
  lanjut.type = "button";
  lanjut.className = "utama";
  lanjut.textContent = tombolBatal ? "Lanjutkan" : "Mengerti";
  lanjut.onclick = () => {
    tutup();
    saatLanjut();
  };
  aksi.appendChild(lanjut);

  kotak.append(teks, aksi);
  latar.appendChild(kotak);
  document.body.appendChild(latar);
  document.addEventListener("keydown", tekanTombol, true);
  // Untuk konfirmasi, fokus awal di "Batal" supaya Enter tidak langsung menyetujui aksi.
  ((tombolBatal ? aksi.firstElementChild : lanjut) as HTMLElement | null)?.focus();
}

export function pasangDialog(): void {
  document.addEventListener(
    "click",
    (e) => {
      if (!e.isTrusted || !(e.target instanceof Element)) return;
      if (e.target.closest(".dlg-artefak")) return; // klik di dialog bukan aksi baru
      disetujui.clear();
      klikTerakhir = e.target;
    },
    true
  );

  window.confirm = (pesan?: string): boolean => {
    const kunci = String(pesan ?? "");
    const batas = disetujui.get(kunci);
    if (batas && batas > Date.now()) return true;

    const sumber = klikTerakhir;
    tampilkan(kunci, true, () => {
      disetujui.set(kunci, Date.now() + MASA_BERLAKU_MS);
      if (sumber && sumber.isConnected) (sumber as HTMLElement).click();
    });
    return false;
  };

  window.alert = (pesan?: unknown): void => {
    tampilkan(String(pesan ?? ""), false, () => {});
  };
}
