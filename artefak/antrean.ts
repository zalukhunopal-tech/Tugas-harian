/**
 * Antrean untuk operasi tulis ke Drive.
 *
 * Satu sinkron lewat konektor berupa puluhan panggilan berurutan dan bisa makan satu menit lebih, sedangkan
 * aplikasi menjadwalkan sinkron otomatis 5 detik setelah setiap perubahan. Tanpa antrean, dua sinkron bisa
 * jalan bersamaan: yang satu mengosongkan baris sheet saat yang lain menulisnya, atau keduanya membuat
 * Aset.json sendiri-sendiri. Dengan antrean:
 * - `berurutan`: panggilan dijalankan satu per satu menurut urutan datangnya;
 * - `berurutanGabung`: seperti di atas, tetapi paling banyak SATU panggilan menunggu; panggilan baru
 *   menggantikan argumen yang menunggu dan memakai hasil yang sama (argumen terbaru yang menang, karena
 *   sinkron selalu menulis keadaan penuh).
 * Galat satu panggilan tidak menahan panggilan berikutnya.
 */
export function buatAntrean() {
  let rantai: Promise<unknown> = Promise.resolve();

  function berurutan<A extends unknown[], R>(fn: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
    return (...args: A) => {
      const hasil = rantai.then(() => fn(...args));
      rantai = hasil.catch(() => undefined);
      return hasil;
    };
  }

  function berurutanGabung<A extends unknown[], R>(fn: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
    let tertunda: { args: A; janji: Promise<R> } | null = null;
    return (...args: A) => {
      if (tertunda) {
        tertunda.args = args;
        return tertunda.janji;
      }
      const entri = { args, janji: undefined as unknown as Promise<R> };
      entri.janji = rantai.then(() => {
        tertunda = null;
        return fn(...entri.args);
      });
      tertunda = entri;
      rantai = entri.janji.catch(() => undefined);
      return entri.janji;
    };
  }

  return { berurutan, berurutanGabung };
}
