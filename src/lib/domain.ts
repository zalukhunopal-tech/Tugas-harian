import { KarakterId } from "../types";

const DURASI = 3800;

const acak = (a: number, b: number) => a + Math.random() * (b - a);

interface EfekDefinisi {
  nama: string;
  romaji: string;
  mulai: (w: number, h: number) => any;
  gambar: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number, s: any) => void;
}

const EFEK: Record<KarakterId, EfekDefinisi> = {
  gojo: {
    nama: "無量空処",
    romaji: "Muryōkūsho · Unlimited Void — Gojo Satoru",
    mulai(w, h) {
      const bintang: Array<{ sudut: number; jarak: number; laju: number }> = [];
      for (let i = 0; i < 420; i++) {
        bintang.push({ sudut: acak(0, Math.PI * 2), jarak: Math.random(), laju: acak(0.15, 0.6) });
      }
      return { bintang, maks: Math.hypot(w, h) / 2 };
    },
    gambar(ctx, w, h, t, dt, s) {
      ctx.fillStyle = "rgba(3, 6, 22, 0.32)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const gas = 0.3 + Math.min(t, 2.2) * 0.9;
      ctx.lineWidth = 1.2;
      for (const b of s.bintang) {
        const lama = b.jarak;
        b.jarak += b.laju * gas * dt;
        if (b.jarak > 1) {
          b.jarak = acak(0, 0.08);
          b.sudut = acak(0, Math.PI * 2);
        }
        const x1 = cx + Math.cos(b.sudut) * lama * s.maks;
        const y1 = cy + Math.sin(b.sudut) * lama * s.maks;
        const x2 = cx + Math.cos(b.sudut) * b.jarak * s.maks;
        const y2 = cy + Math.sin(b.sudut) * b.jarak * s.maks;
        ctx.strokeStyle = `rgba(${b.jarak > 0.5 ? "255,255,255" : "150,200,255"}, ${Math.min(
          1,
          b.jarak * 1.6
        )})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      const denyut = 0.55 + 0.45 * Math.sin(t * 5);
      const cahaya = ctx.createRadialGradient(cx, cy, 0, cx, cy, s.maks * 0.55);
      cahaya.addColorStop(0, `rgba(255, 255, 255, ${0.85 * denyut})`);
      cahaya.addColorStop(0.15, `rgba(120, 190, 255, ${0.45 * denyut})`);
      cahaya.addColorStop(1, "rgba(60, 40, 160, 0)");
      ctx.fillStyle = cahaya;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        const fase = (t * 0.5 + i / 3) % 1;
        ctx.strokeStyle = `rgba(200, 230, 255, ${(1 - fase) * 0.8})`;
        ctx.lineWidth = 2 + (1 - fase) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, fase * s.maks), 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },

  sukuna: {
    nama: "伏魔御廚子",
    romaji: "Fukuma Mizushi · Malevolent Shrine — Ryomen Sukuna",
    mulai() {
      return { tebasan: [], sisa: 0 };
    },
    gambar(ctx, w, h, t, dt, s) {
      ctx.fillStyle = "rgba(18, 0, 2, 0.28)";
      ctx.fillRect(0, 0, w, h);
      const vignet = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, Math.hypot(w, h) / 2);
      vignet.addColorStop(0, "rgba(120, 0, 10, 0)");
      vignet.addColorStop(1, "rgba(90, 0, 8, 0.55)");
      ctx.fillStyle = vignet;
      ctx.fillRect(0, 0, w, h);

      s.sisa -= dt;
      if (s.sisa <= 0 && t > 0.3) {
        s.sisa = acak(0.05, 0.16);
        const sudut = acak(-0.9, 0.9) + (Math.random() < 0.5 ? 0 : Math.PI / 2);
        const x = acak(0, w);
        const y = acak(0, h);
        const panjang = Math.hypot(w, h);
        s.tebasan.push({
          x1: x - Math.cos(sudut) * panjang,
          y1: y - Math.sin(sudut) * panjang,
          x2: x + Math.cos(sudut) * panjang,
          y2: y + Math.sin(sudut) * panjang,
          umur: 0,
        });
      }
      ctx.lineCap = "round";
      for (const tb of s.tebasan) {
        tb.umur += dt;
        const alpha = Math.max(0, 1 - tb.umur / 0.9);
        ctx.shadowBlur = 22;
        ctx.shadowColor = "rgba(255, 40, 60, 0.9)";
        ctx.strokeStyle = `rgba(255, 60, 80, ${alpha})`;
        ctx.lineWidth = 6 * alpha + 1;
        ctx.beginPath();
        ctx.moveTo(tb.x1, tb.y1);
        ctx.lineTo(tb.x2, tb.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 245, 245, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      s.tebasan = s.tebasan.filter((tb: any) => tb.umur < 0.9);
    },
  },

  jogo: {
    nama: "蓋棺鉄囲山",
    romaji: "Gaikan Tetsuisen · Coffin of the Iron Mountain — Jogo",
    mulai(w, h) {
      const bara: Array<{ x: number; y: number; r: number; laju: number; goyang: number }> = [];
      for (let i = 0; i < 160; i++) {
        bara.push({
          x: acak(0, w),
          y: acak(0, h * 1.2),
          r: acak(1, 4),
          laju: acak(40, 140),
          goyang: acak(0, 6.28),
        });
      }
      return { bara };
    },
    gambar(ctx, w, h, t, dt, s) {
      ctx.fillStyle = "rgba(12, 3, 0, 0.3)";
      ctx.fillRect(0, 0, w, h);
      const nyala = 0.7 + 0.3 * Math.sin(t * 7);
      const lava = ctx.createLinearGradient(0, h, 0, h * 0.35);
      lava.addColorStop(0, `rgba(255, 120, 20, ${0.75 * nyala})`);
      lava.addColorStop(0.4, `rgba(200, 40, 0, ${0.35 * nyala})`);
      lava.addColorStop(1, "rgba(60, 5, 0, 0)");
      ctx.fillStyle = lava;
      ctx.fillRect(0, 0, w, h);
      for (const b of s.bara) {
        b.y -= b.laju * dt;
        b.x += Math.sin(t * 2 + b.goyang) * 25 * dt;
        if (b.y < -10) {
          b.y = h + acak(0, 40);
          b.x = acak(0, w);
        }
        const panas = b.y / h;
        ctx.fillStyle = `rgba(255, ${Math.round(120 + 120 * panas)}, ${Math.round(30 * panas)}, ${
          0.5 + 0.5 * panas
        })`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const fase = Math.min(1, Math.max(0, (t - 0.35) / 1.4));
      if (fase > 0 && fase < 1) {
        ctx.strokeStyle = `rgba(255, 170, 60, ${1 - fase})`;
        ctx.lineWidth = 14 * (1 - fase) + 2;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.62, fase * Math.hypot(w, h) * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },

  nanami: {
    nama: "十劃呪法",
    romaji: "Jukkakujuhō · Teknik Rasio 7:3 — Nanami Kento",
    mulai(w, h) {
      const percik: Array<{ x: number; y: number; r: number; fase: number }> = [];
      for (let i = 0; i < 70; i++) {
        percik.push({ x: acak(0, w), y: acak(0, h), r: acak(0.6, 2), fase: acak(0, 6.28) });
      }
      return { percik };
    },
    gambar(ctx, w, h, t, dt, s) {
      ctx.fillStyle = "rgba(10, 9, 4, 0.4)";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(230, 190, 80, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (const p of s.percik) {
        const kedip = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + p.fase));
        ctx.fillStyle = `rgba(255, 215, 110, ${kedip})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const maju = Math.min(1, t / 0.9);
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(255, 200, 80, 0.9)";
      ctx.strokeStyle = "rgba(255, 210, 90, 0.95)";
      ctx.lineWidth = 3;
      for (const y of [h * 0.3, h * 0.7]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w * maju, y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255, 220, 120, 0.9)";
      ctx.font = `700 ${Math.round(Math.min(w, h) * 0.08)}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      if (maju >= 1) {
        ctx.fillText("7", w - 24, h * 0.3 - 12);
        ctx.fillText("3", w - 24, h * 0.7 + Math.min(w, h) * 0.08);
      }
      const potong = Math.min(1, Math.max(0, (t - 1.1) / 0.35));
      if (potong > 0) {
        ctx.shadowBlur = 24;
        ctx.shadowColor = "rgba(255, 230, 140, 1)";
        ctx.strokeStyle = `rgba(255, 245, 210, ${1 - Math.max(0, (t - 2.6) / 0.8)})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.85);
        ctx.lineTo(w * 0.1 + w * 0.8 * potong, h * 0.85 - h * 0.7 * potong);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    },
  },

  itadori: {
    nama: "黒閃",
    romaji: "Kokusen · Black Flash — Yuji Itadori",
    mulai() {
      return { kilat: [], ledakan: 0 };
    },
    gambar(ctx, w, h, t, dt, s) {
      ctx.fillStyle = "rgba(10, 0, 5, 0.35)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;

      // Gelombang Distorsi Spasial Kokusen
      const rMaks = Math.hypot(w, h) * 0.5;
      for (let i = 0; i < 4; i++) {
        const fase = (t * 0.9 + i / 4) % 1;
        ctx.strokeStyle = `rgba(225, 29, 72, ${(1 - fase) * 0.9})`;
        ctx.lineWidth = 4 * (1 - fase) + 1;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, fase * rMaks), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Kilatan Hitam Merah (Black Flash)
      if (Math.random() < 0.45 && t > 0.4) {
        ctx.save();
        ctx.shadowColor = "#e11d48";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        let kx = cx + acak(-60, 60);
        let ky = cy + acak(-60, 60);
        ctx.moveTo(kx, ky);
        for (let j = 0; j < 6; j++) {
          kx += acak(-80, 80);
          ky += acak(-80, 80);
          ctx.lineTo(kx, ky);
        }
        ctx.stroke();

        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    },
  },

  megumi: {
    nama: "嵌合暗翳庭",
    romaji: "Kangō An'eitei · Chimera Shadow Garden — Megumi Fushiguro",
    mulai() {
      return { bayang: [] };
    },
    gambar(ctx, w, h, t, dt) {
      ctx.fillStyle = "rgba(2, 6, 23, 0.3)";
      ctx.fillRect(0, 0, w, h);

      // Cairan Bayangan Menggenang di Bawah
      const grad = ctx.createLinearGradient(0, h * 0.3, 0, h);
      grad.addColorStop(0, "rgba(4, 47, 46, 0)");
      grad.addColorStop(0.6, "rgba(15, 118, 110, 0.4)");
      grad.addColorStop(1, "rgba(2, 44, 34, 0.95)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Gelombang Bayangan Bergelombang
      ctx.fillStyle = "rgba(13, 148, 136, 0.25)";
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 30) {
        const y = h * 0.65 + Math.sin(x * 0.015 + t * 2) * 25 + Math.cos(x * 0.03 - t) * 15;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Mata Serigala Kembar (Kon / Divine Dog) di Kegelapan
      const kedip = Math.abs(Math.sin(t * 2));
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * kedip})`;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.5, 4, 0, Math.PI * 2);
      ctx.arc(w * 0.42, h * 0.5, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(45, 212, 191, ${0.4 + 0.6 * kedip})`;
      ctx.beginPath();
      ctx.arc(w * 0.58, h * 0.48, 4, 0, Math.PI * 2);
      ctx.arc(w * 0.65, h * 0.48, 4, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  nobara: {
    nama: "芻霊呪法",
    romaji: "Sūrei Juhō · Resonance & Hairpin — Nobara Kugisaki",
    mulai() {
      return { paku: [] };
    },
    gambar(ctx, w, h, t, dt) {
      ctx.fillStyle = "rgba(26, 5, 29, 0.35)";
      ctx.fillRect(0, 0, w, h);

      // Denyut Jantung Resonansi Boneka Jerami
      const cx = w / 2;
      const cy = h / 2;
      const denyut = (Math.sin(t * 6) + 1) * 0.5;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180);
      glow.addColorStop(0, `rgba(219, 39, 119, ${0.6 * denyut})`);
      glow.addColorStop(0.5, `rgba(225, 29, 72, ${0.2 * denyut})`);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Paku Berterbangan dan Percikan Biru / Merah Muda
      if (Math.random() < 0.4) {
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.shadowColor = "#db2777";
        ctx.shadowBlur = 15;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const px = acak(w * 0.1, w * 0.9);
        const py = acak(h * 0.1, h * 0.9);
        ctx.moveTo(px, py);
        ctx.lineTo(px + acak(30, 80), py + acak(30, 80));
        ctx.stroke();
        ctx.restore();
      }
    },
  },

  yuta: {
    nama: "真正相互愛",
    romaji: "Shinsetsu Sōgo Ai · Authentic Mutual Love — Yuta Okkotsu",
    mulai(w, h) {
      return { cincin: [] };
    },
    gambar(ctx, w, h, t, dt) {
      ctx.fillStyle = "rgba(9, 5, 20, 0.3)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;

      // Pita Rohani Ethereal Rika (Ungu & Perak)
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.hypot(w, h) * 0.55);
      grad.addColorStop(0, "rgba(168, 85, 247, 0.5)");
      grad.addColorStop(0.4, "rgba(147, 51, 234, 0.25)");
      grad.addColorStop(1, "rgba(59, 7, 100, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Cincin Ikatan Suci Berputar
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.8);
      ctx.strokeStyle = "rgba(233, 213, 255, 0.85)";
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.5;
      for (let r = 50; r <= 150; r += 50) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 1.6);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  toji: {
    nama: "天与呪縛",
    romaji: "Ten'yo Jubaku · Heavenly Restriction — Toji Fushiguro",
    mulai() {
      return { garis: [] };
    },
    gambar(ctx, w, h, t, dt) {
      ctx.fillStyle = "rgba(10, 14, 20, 0.35)";
      ctx.fillRect(0, 0, w, h);
      // Rantai melayang & kilatan belati perak
      ctx.save();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7 + Math.sin(t * 3) * 50);
      ctx.bezierCurveTo(w * 0.3, h * 0.2, w * 0.7, h * 0.8, w, h * 0.3);
      ctx.stroke();
      ctx.restore();
    },
  },

  geto: {
    nama: "極ノ番「うずまき」",
    romaji: "Gokunoban: Uzumaki · Maximum: Uzumaki — Suguru Geto",
    mulai() {
      return { sudut: 0 };
    },
    gambar(ctx, w, h, t) {
      ctx.fillStyle = "rgba(15, 12, 3, 0.3)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 1.5);
      ctx.strokeStyle = "rgba(202, 138, 4, 0.8)";
      ctx.shadowColor = "#eab308";
      ctx.shadowBlur = 20;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 80 + i * 45, 0, Math.PI * 1.2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  maki: {
    nama: "釈魂刀",
    romaji: "Shiratama · Soul Splitter Katana — Maki Zen'in",
    mulai() {
      return {};
    },
    gambar(ctx, w, h, t) {
      ctx.fillStyle = "rgba(20, 5, 8, 0.32)";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#f43f5e";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.8);
      ctx.lineTo(w * 0.9, h * 0.2);
      ctx.stroke();
      ctx.restore();
    },
  },

  mahito: {
    nama: "自閉円頓裹",
    romaji: "Jihei Endonka · Self-Embodiment of Perfection — Mahito",
    mulai() {
      return {};
    },
    gambar(ctx, w, h, t) {
      ctx.fillStyle = "rgba(6, 12, 22, 0.35)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      for (let r = 40; r < 240; r += 50) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + Math.sin(t * 4 + r) * 15, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
};

let aktif = false;

export function jalankanPerluasanDomain(karakter: KarakterId) {
  if (aktif) return;
  const efek = EFEK[karakter] || EFEK.gojo;
  aktif = true;

  const overlay = document.createElement("div");
  overlay.className = `domain-overlay ${karakter}`;
  overlay.setAttribute("role", "presentation");
  const canvas = document.createElement("canvas");
  const teks = document.createElement("div");
  teks.className = "domain-teks";
  const seru = document.createElement("span");
  seru.className = "domain-seru";
  seru.textContent = "領域展開";
  const nama = document.createElement("span");
  nama.className = "domain-nama";
  nama.textContent = efek.nama;
  const romaji = document.createElement("span");
  romaji.className = "domain-romaji";
  romaji.textContent = efek.romaji;
  teks.append(seru, nama, romaji);
  overlay.append(canvas, teks);
  document.body.append(overlay);

  const kurangiGerak = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    overlay.remove();
    aktif = false;
    return;
  }

  let w = 0;
  let h = 0;
  let keadaan: any = null;
  const ukur = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    keadaan = efek.mulai(w, h);
  };
  ukur();
  window.addEventListener("resize", ukur);

  const awal = performance.now();
  let sebelumnya = awal;
  let selesai = false;
  const durasi = kurangiGerak ? 1600 : DURASI;

  function tutup() {
    if (selesai) return;
    selesai = true;
    window.removeEventListener("resize", ukur);
    overlay.remove();
    aktif = false;
  }

  function bingkai(sekarang: number) {
    if (selesai) return;
    const t = Math.max(0, (sekarang - awal) / 1000);
    const dt = Math.max(0, Math.min(0.05, (sekarang - sebelumnya) / 1000));
    sebelumnya = sekarang;
    const p = (sekarang - awal) / durasi;
    if (!kurangiGerak && ctx) efek.gambar(ctx, w, h, t, dt, keadaan);
    if (!overlay.classList.contains("tutup")) {
      overlay.style.opacity = String(
        p < 0.08 ? p / 0.08 : p > 0.85 ? Math.max(0, (1 - p) / 0.15) : 1
      );
    }
    if (p < 1) requestAnimationFrame(bingkai);
    else tutup();
  }

  overlay.addEventListener("click", () => {
    overlay.classList.add("tutup");
    setTimeout(tutup, 450);
  });

  setTimeout(tutup, durasi + 500);
  requestAnimationFrame(bingkai);
}
