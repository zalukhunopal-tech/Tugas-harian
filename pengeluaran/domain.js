// Efek "Perluasan Domain" (領域展開) per karakter: lapisan penuh layar dengan kanvas
// selama beberapa detik, lalu memudar. Dipanggil lewat window.perluasanDomain(karakter).
(() => {
  const DURASI = 3800;
  let aktif = false;

  const acak = (a, b) => a + Math.random() * (b - a);

  const EFEK = {
    gojo: {
      nama: "無量空処",
      romaji: "Muryōkūsho · Unlimited Void — Gojo Satoru",
      mulai(w, h) {
        const bintang = [];
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
          ctx.strokeStyle = `rgba(${b.jarak > 0.5 ? "255,255,255" : "150,200,255"}, ${Math.min(1, b.jarak * 1.6)})`;
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
          const fase = ((t * 0.5 + i / 3) % 1);
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
        s.tebasan = s.tebasan.filter((tb) => tb.umur < 0.9);
      },
    },

    jogo: {
      nama: "蓋棺鉄囲山",
      romaji: "Gaikan Tetsuisen · Coffin of the Iron Mountain — Jogo",
      mulai(w, h) {
        const bara = [];
        for (let i = 0; i < 160; i++) {
          bara.push({ x: acak(0, w), y: acak(0, h * 1.2), r: acak(1, 4), laju: acak(40, 140), goyang: acak(0, 6.28) });
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
          ctx.fillStyle = `rgba(255, ${Math.round(120 + 120 * panas)}, ${Math.round(30 * panas)}, ${0.5 + 0.5 * panas})`;
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
        const percik = [];
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
  };

  function perluasanDomain(karakter) {
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
    let w = 0;
    let h = 0;
    let keadaan = null;
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

    function bingkai(sekarang) {
      if (selesai) return;
      // Stempel waktu frame pertama bisa sedikit lebih awal dari `awal`, jadi t dan dt dijaga >= 0.
      const t = Math.max(0, (sekarang - awal) / 1000);
      const dt = Math.max(0, Math.min(0.05, (sekarang - sebelumnya) / 1000));
      sebelumnya = sekarang;
      const p = (sekarang - awal) / durasi;
      if (!kurangiGerak) efek.gambar(ctx, w, h, t, dt, keadaan);
      if (!overlay.classList.contains("tutup")) {
        overlay.style.opacity = p < 0.08 ? p / 0.08 : p > 0.85 ? Math.max(0, (1 - p) / 0.15) : 1;
      }
      if (p < 1) requestAnimationFrame(bingkai);
      else tutup();
    }
    // Klik atau ketuk untuk menutup lebih cepat; memudar lewat CSS dan timer,
    // jadi tidak bergantung pada laju frame animasi.
    overlay.addEventListener("click", () => {
      overlay.classList.add("tutup");
      setTimeout(tutup, 450);
    });
    // Pengaman: tetap ditutup walau animasi frame berhenti (mis. tab disembunyikan).
    setTimeout(tutup, durasi + 500);
    requestAnimationFrame(bingkai);
  }

  window.perluasanDomain = perluasanDomain;
})();
