import React from "react";
import { formatAngka, formatRupiah } from "../lib/constants";

/**
 * Teks berbeda untuk layar lebar dan HP. Keduanya dirender; CSS (.teks-pc / .teks-hp, batas 640px) memilih yang
 * tampil, sehingga tampilan tablet dan PC tetap persis seperti sebelumnya.
 */
export const TeksLayar: React.FC<{ pc: React.ReactNode; hp: React.ReactNode }> = ({ pc, hp }) => (
  <>
    <span className="teks-pc">{pc}</span>
    <span className="teks-hp">{hp}</span>
  </>
);

/** Nominal: di tablet/PC "Rp 1.234.567", di HP tanpa "Rp" supaya tabel muat tanpa digeser ke samping. */
export const Nominal: React.FC<{ n: number; tanda?: "+" | "-" }> = ({ n, tanda = "" }) => (
  <TeksLayar pc={`${tanda}${formatRupiah(n)}`} hp={`${tanda}${formatAngka(n)}`} />
);
