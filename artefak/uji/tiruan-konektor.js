/**
 * Tiruan `window.claude` untuk menguji artefak tanpa akun Claude: Google Drive dan Google Sheets palsu di
 * memori. Bentuk jawabannya meniru jawaban konektor asli yang diamati (search_files, get_file_metadata,
 * download_file_content, get_values, get_spreadsheet): lihat artefak/README.md.
 *
 * Dipasang lewat `page.add_init_script` sebelum halaman dimuat. Keadaan dan log panggilan ada di `window.__drive`.
 */
(() => {
  const FOLDER = "application/vnd.google-apps.folder";
  const SHEET = "application/vnd.google-apps.spreadsheet";
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const kePb64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const dariB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const tunda = () => new Promise((r) => setTimeout(r, 5));

  let urut = 1;
  const D = (window.__drive = {
    files: new Map(),
    sheets: new Map(), // id -> { tabs: [{ sheetId, title, rows: [[]] }] }
    calls: [],
    trashed: new Set(),
    izin: "granted", // jawaban permissions.state("mcp")
    izinMinta: "granted", // hasil permissions.request(["mcp"])
    tanpaMcp: false, // use("mcp") -> null
    tanpaSheets: false, // konektor Sheets tidak tersambung
    indeksLambat: false, // file yang dibuat sesudah flag ini menyala belum muncul di search_files
    sampahTerlihat: false, // search_files ikut memuat file di Sampah, seperti konektor asli (tidak ada klausa trashed)
    createTanpaId: false, // create_file/copy_file menjawab tanpa id
    gagal: {}, // tool -> objek galat yang dilempar
    hariIni: new Date().toISOString().slice(0, 10),
    akun: "saya@example.org", // email akun Google pemilik sesi ini
    izinFile: new Map(), // id file -> izin tambahan (selain pemilik) yang diberikan lewat share_file
    publik: new Set(), // id file yang bertautan publik ("siapa saja yang punya tautan")
    dibagikan: [], // file milik orang lain yang dibagikan kepada akun ini: {id, title, mimeType, owner, modifiedTime}
  });

  const header = [
    "No", "Tanggal", "Uraian", "Kategori", "Pemasukan (Rp)", "Pengeluaran (Rp)", "Saldo (Rp)",
    "Sumber / Tujuan", "Catatan", "ID Aplikasi", "Metode Bayar", "Bukti",
  ];

  function tambahFile(f) {
    const id = f.id || "id" + urut++;
    const file = {
      id,
      title: f.title,
      mimeType: f.mimeType || "application/octet-stream",
      parentId: f.parentId,
      bytes: f.bytes,
      modifiedTime: f.modifiedTime || new Date().toISOString(),
      belumTerindeks: Boolean(D.indeksLambat && f.baru),
    };
    D.files.set(id, file);
    return file;
  }

  function tambahSheet(id, baris) {
    const rows = [[], [], [], [], [], header.slice(), ...baris];
    D.sheets.set(id, { tabs: [{ sheetId: 355706310, title: "Untitled", rows }] });
  }

  D.tambahFile = tambahFile;
  D.tambahSheet = tambahSheet;

  D.mulai = (opsi = {}) => {
    D.files.clear();
    D.sheets.clear();
    D.calls.length = 0;
    D.trashed.clear();
    D.izinFile.clear();
    D.publik.clear();
    D.dibagikan.length = 0;
    tambahFile({ id: "root1", title: "My Drive", mimeType: FOLDER });
    tambahFile({ id: "F1", title: "Keuangan", mimeType: FOLDER, parentId: "root1" });
    tambahFile({ id: "SP", title: "Keuangan Pribadi 2026", mimeType: SHEET, parentId: "F1" });
    tambahFile({ id: "SK", title: "Keuangan Kegiatan 2026", mimeType: SHEET, parentId: "F1" });
    tambahFile({ id: "FB", title: "Bukti Transaksi", mimeType: FOLDER, parentId: "F1" });
    tambahSheet("SP", [
      ["1", D.hariIni, "Uji makan siang", "Makan & Minum", "", "45000", "-45000", "Warung", "Bayar QRIS", "idp1", "QRIS", ""],
      ["2", D.hariIni, "Uji gaji", "Gaji", "5000000", "", "4955000", "", "", "idp2", "Transfer", ""],
    ]);
    tambahSheet("SK", [
      ["1", D.hariIni, "Uji dana awal", "Penerimaan Dana", "25000000", "", "25000000", "", "", "idk1", "Transfer", ""],
    ]);
    if (opsi.denganAset) {
      tambahFile({ id: "AS", title: "Aset.json", mimeType: "application/json", parentId: "F1", bytes: enc.encode("[]") });
    }
  };
  D.mulai();

  // Potret seluruh isi Drive palsu sebagai teks dan pemulihannya, supaya uji bisa memuat ulang halaman (yang menghapus
  // memori halaman) seperti pasang ulang aplikasi sementara isi Drive tetap ada.
  D.potret = () =>
    JSON.stringify({
      files: [...D.files.entries()].map(([k, f]) => [k, { ...f, bytes: f.bytes ? kePb64(f.bytes) : undefined }]),
      sheets: [...D.sheets.entries()],
      trashed: [...D.trashed],
      izinFile: [...D.izinFile.entries()],
      publik: [...D.publik],
      dibagikan: D.dibagikan,
      urut,
    });
  D.pulihkan = (teks) => {
    const d = JSON.parse(teks);
    D.files.clear();
    for (const [k, f] of d.files) D.files.set(k, { ...f, bytes: f.bytes ? dariB64(f.bytes) : undefined });
    D.sheets.clear();
    for (const [k, v] of d.sheets) D.sheets.set(k, v);
    D.trashed.clear();
    d.trashed.forEach((x) => D.trashed.add(x));
    D.izinFile.clear();
    for (const [k, v] of d.izinFile) D.izinFile.set(k, v);
    D.publik.clear();
    d.publik.forEach((x) => D.publik.add(x));
    D.dibagikan.length = 0;
    D.dibagikan.push(...d.dibagikan);
    urut = d.urut;
    D.calls.length = 0;
  };

  /* ---- Sheets ---- */
  const kolomKe = (h) => [...h.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  function urai(rentang) {
    const m = /^(?:'?([^'!]+)'?!)?([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d*))?$/.exec(rentang);
    if (!m) throw { code: "tool_error", message: "Rentang tidak valid: " + rentang };
    return {
      tab: m[1],
      k1: kolomKe(m[2]),
      b1: Number(m[3]),
      k2: m[4] ? kolomKe(m[4]) : kolomKe(m[2]),
      b2: m[5] ? Number(m[5]) : 1000,
    };
  }
  function cariTab(id, nama) {
    const s = D.sheets.get(id);
    if (!s) throw { code: "tool_error", message: "Spreadsheet tidak ditemukan: " + id };
    const tab = nama ? s.tabs.find((t) => t.title === nama) : s.tabs[0];
    if (!tab) throw { code: "tool_error", message: "Tab tidak ditemukan: " + nama };
    return tab;
  }

  /* ---- Drive ---- */
  function cocok(f, klausa) {
    let m;
    if (klausa === "sharedWithMe = true") return true; // sumbernya sudah D.dibagikan
    if ((m = /^title (=|contains) '(.*)'$/.exec(klausa))) {
      return m[1] === "=" ? f.title === m[2] : f.title.toLowerCase().includes(m[2].toLowerCase());
    }
    if ((m = /^parentId = '(.*)'$/.exec(klausa))) return f.parentId === m[1];
    if ((m = /^mimeType (=|contains) '(.*)'$/.exec(klausa))) return m[1] === "=" ? f.mimeType === m[2] : f.mimeType.includes(m[2]);
    throw { code: "tool_error", message: "Kueri tidak dikenal oleh tiruan: " + klausa };
  }
  const bentuk = (f) => ({
    id: f.id,
    title: f.title,
    mimeType: f.mimeType,
    parentId: f.parentId,
    modifiedTime: f.modifiedTime,
    viewUrl: f.mimeType === FOLDER ? `https://drive.google.com/drive/folders/${f.id}` : `https://drive.google.com/file/d/${f.id}/view?usp=drivesdk`,
    resourceUri: `googledrive://file/${f.id}`,
    owner: f.owner || "pemilik@example.org",
  });

  const alat = {
    Drive: {
      search_files: (i) => {
        const klausa = i.query.split(/ and (?=(?:title|parentId|mimeType|sharedWithMe) )/);
        if (klausa.includes("sharedWithMe = true")) {
          const bagi = D.dibagikan.filter((f) => klausa.every((k) => cocok(f, k)));
          return { files: bagi.map((f) => ({ ...bentuk(f), owner: f.owner, sharedWithMeTime: f.modifiedTime })), nextPageToken: "~!!~token" };
        }
        const hasil = [...D.files.values()].filter(
          (f) => f.id !== "root1" && (D.sampahTerlihat || !D.trashed.has(f.id)) && !f.belumTerindeks && klausa.every((k) => cocok(f, k))
        );
        return { files: hasil.map(bentuk), nextPageToken: "~!!~token" };
      },
      get_file_permissions: (i) => {
        if (!D.files.has(i.fileId)) throw { code: "tool_error", message: "File tidak ditemukan" };
        return {
          permissions: [
            ...(D.publik.has(i.fileId) ? [{ role: "reader", type: "anyone" }] : []),
            { displayName: "Saya", emailAddress: D.akun, role: "owner", type: "user" },
            ...(D.izinFile.get(i.fileId) || []),
          ],
        };
      },
      share_file: (i) => {
        if (!D.files.has(i.fileId)) throw { code: "tool_error", message: "File tidak ditemukan" };
        if (!["reader", "commenter", "writer"].includes(i.role)) throw { code: "tool_error", message: "Peran tidak didukung" };
        const daftar = D.izinFile.get(i.fileId) || [];
        const ada = daftar.find((x) => x.emailAddress === i.emailAddress);
        if (ada) ada.role = i.role;
        else daftar.push({ displayName: i.emailAddress.split("@")[0], emailAddress: i.emailAddress, role: i.role, type: "user" });
        D.izinFile.set(i.fileId, daftar);
        return {};
      },
      get_file_metadata: (i) => {
        const f = D.files.get(i.fileId);
        if (!f) throw { code: "tool_error", message: "File tidak ditemukan" };
        return bentuk(f);
      },
      download_file_content: (i) => {
        const f = D.files.get(i.fileId);
        if (!f || !f.bytes) throw { code: "tool_error", message: "File tidak bisa diunduh" };
        return { content: kePb64(f.bytes), id: f.id, mimeType: f.mimeType, title: f.title };
      },
      create_file: async (i) => {
        let bytes;
        if (typeof i.textContent === "string") bytes = enc.encode(i.textContent);
        else if (i.base64Content && i.base64Content.$file) bytes = new Uint8Array(await i.base64Content.$file.data.arrayBuffer());
        else if (typeof i.base64Content === "string") bytes = dariB64(i.base64Content);
        const tipe = i.mimeType === FOLDER || i.contentMimeType === FOLDER ? FOLDER : i.contentMimeType || "application/octet-stream";
        const f = tambahFile({ title: i.title, mimeType: tipe, parentId: i.parentId || "root1", bytes, baru: true });
        return D.createTanpaId ? {} : bentuk(f);
      },
      copy_file: (i) => {
        const asal = D.files.get(i.fileId);
        const f = tambahFile({ title: i.title || "Copy of " + asal.title, mimeType: asal.mimeType, parentId: i.parentId || asal.parentId, bytes: asal.bytes, baru: true });
        if (D.sheets.has(asal.id)) D.sheets.set(f.id, JSON.parse(JSON.stringify(D.sheets.get(asal.id))));
        return D.createTanpaId ? {} : bentuk(f);
      },
      trash_file: (i) => {
        if (!D.files.has(i.fileId)) throw { code: "tool_error", message: "File tidak ditemukan" };
        D.trashed.add(i.fileId);
        return {};
      },
    },
    Sheets: {
      get_spreadsheet: (i) => {
        const s = D.sheets.get(i.spreadsheetId);
        if (!s) throw { code: "tool_error", message: "Spreadsheet tidak ditemukan" };
        return { revisionId: "rev", sheets: s.tabs.map((t) => ({ properties: { sheetId: t.sheetId, title: t.title } })) };
      },
      get_values: (i) => {
        const r = urai(i.range);
        const tab = cariTab(i.spreadsheetId, r.tab);
        const values = [];
        for (let b = r.b1; b <= Math.min(r.b2, tab.rows.length); b++) {
          const baris = (tab.rows[b - 1] || []).slice(r.k1 - 1, r.k2).map((v) => (v === undefined || v === null ? "" : String(v)));
          while (baris.length && baris[baris.length - 1] === "") baris.pop();
          values.push(baris);
        }
        while (values.length && values[values.length - 1].length === 0) values.pop();
        return { range: `${tab.title}!${i.range.split("!")[1].replace(/L$/, "L1000")}`, values };
      },
      update_values: (i) => {
        const r = urai(i.range);
        const tab = cariTab(i.spreadsheetId, r.tab);
        i.values.forEach((baris, dy) => {
          const y = r.b1 - 1 + dy;
          tab.rows[y] = tab.rows[y] || [];
          baris.forEach((v, dx) => {
            // USER_ENTERED: awalan apostrof menandai teks dan tidak ikut tersimpan (perilaku Google Sheets).
            if (v !== null) tab.rows[y][r.k1 - 1 + dx] = typeof v === "string" ? v.replace(/^'/, "") : v;
          });
        });
        return { updatedRange: i.range, updatedRows: i.values.length };
      },
      batch_clear_values: (i) => {
        for (const rentang of i.ranges) {
          const r = urai(rentang);
          const tab = cariTab(i.spreadsheetId, r.tab);
          for (let b = r.b1; b <= Math.min(r.b2, tab.rows.length); b++) {
            for (let k = r.k1; k <= r.k2; k++) if (tab.rows[b - 1]) tab.rows[b - 1][k - 1] = "";
          }
        }
        return { clearedRanges: i.ranges };
      },
    },
  };

  const mcp = Object.freeze({
    callTool: async (server, tool, input) => {
      D.calls.push({ server, tool, input: input && JSON.parse(JSON.stringify(input, (k, v) => (v instanceof Blob ? `[Blob ${v.size}]` : v))) });
      await tunda();
      const grup = server === "Google Drive" ? alat.Drive : server === "Google Sheets" ? alat.Sheets : null;
      if (!grup || (server === "Google Sheets" && D.tanpaSheets)) throw { code: "server_not_connected", server, message: "tidak tersambung" };
      if (!grup[tool]) throw { code: "not_in_manifest", message: "alat di luar manifest: " + tool };
      if (D.gagal[tool]) throw D.gagal[tool];
      const payload = await grup[tool](input || {});
      return { content: [], payload };
    },
    listTools: async () => ({
      fileArgs: true,
      servers: [
        { server: "Google Drive", authStatus: "connected", tools: Object.keys(alat.Drive).map((name) => ({ name })) },
        ...(D.tanpaSheets ? [] : [{ server: "Google Sheets", authStatus: "connected", tools: Object.keys(alat.Sheets).map((name) => ({ name })) }]),
      ],
    }),
  });

  const izin = Object.freeze({
    state: async () => D.izin,
    request: async () => ({ mcp: D.izinMinta }),
  });

  window.claude = Object.freeze({
    use: async (nama) => (nama === "mcp" ? (D.tanpaMcp ? null : mcp) : nama === "permissions" ? izin : null),
  });
})();
