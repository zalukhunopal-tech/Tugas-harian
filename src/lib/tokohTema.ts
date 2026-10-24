import { KarakterId } from "../types";
import gojoAvatar from "../assets/karakter/gojo-avatar.webp";
import gojoBanner from "../assets/karakter/gojo-banner.webp";
import sukunaAvatar from "../assets/karakter/sukuna-avatar.webp";
import sukunaBanner from "../assets/karakter/sukuna-banner.webp";
import jogoAvatar from "../assets/karakter/jogo-avatar.webp";
import jogoBanner from "../assets/karakter/jogo-banner.webp";
import nanamiAvatar from "../assets/karakter/nanami-avatar.webp";
import nanamiBanner from "../assets/karakter/nanami-banner.webp";
import itadoriAvatar from "../assets/karakter/itadori-avatar.webp";
import itadoriBanner from "../assets/karakter/itadori-banner.webp";
import megumiAvatar from "../assets/karakter/megumi-avatar.webp";
import megumiBanner from "../assets/karakter/megumi-banner.webp";
import nobaraAvatar from "../assets/karakter/nobara-avatar.webp";
import nobaraBanner from "../assets/karakter/nobara-banner.webp";
import yutaAvatar from "../assets/karakter/yuta-avatar.webp";
import yutaBanner from "../assets/karakter/yuta-banner.webp";
import tojiAvatar from "../assets/karakter/toji-avatar.webp";
import tojiBanner from "../assets/karakter/toji-banner.webp";

/**
 * Tampilan kartu pemilihan tokoh di tab Saya.
 * warna/warnaKedua: warna ciri tokoh untuk cincin avatar, bingkai bercahaya, dan gradasi kartu.
 * avatar/banner: potongan ilustrasi (avatar bulat dan ilustrasi setengah badan di kanan kartu).
 * Tokoh tanpa gambar memakai avatar SVG KarakterAnimasi dan lambangnya sebagai pengganti ilustrasi.
 */
export interface TokohTema {
  warna: string;
  warnaKedua: string;
  avatar?: string;
  banner?: string;
}

export const TOKOH_TEMA: Record<KarakterId, TokohTema> = {
  gojo: { warna: "#38BDF8", warnaKedua: "#A855F7", avatar: gojoAvatar, banner: gojoBanner },
  sukuna: { warna: "#EF4444", warnaKedua: "#991B1B", avatar: sukunaAvatar, banner: sukunaBanner },
  jogo: { warna: "#F97316", warnaKedua: "#EAB308", avatar: jogoAvatar, banner: jogoBanner },
  nanami: { warna: "#EAB308", warnaKedua: "#F59E0B", avatar: nanamiAvatar, banner: nanamiBanner },
  itadori: { warna: "#E11D48", warnaKedua: "#FB7185", avatar: itadoriAvatar, banner: itadoriBanner },
  megumi: { warna: "#10B981", warnaKedua: "#FACC15", avatar: megumiAvatar, banner: megumiBanner },
  nobara: { warna: "#F43F5E", warnaKedua: "#FB923C", avatar: nobaraAvatar, banner: nobaraBanner },
  yuta: { warna: "#C084FC", warnaKedua: "#E879F9", avatar: yutaAvatar, banner: yutaBanner },
  toji: { warna: "#94A3B8", warnaKedua: "#64748B", avatar: tojiAvatar, banner: tojiBanner },
  geto: { warna: "#F59E0B", warnaKedua: "#A855F7" },
  maki: { warna: "#22C55E", warnaKedua: "#EF4444" },
  mahito: { warna: "#38BDF8", warnaKedua: "#94A3B8" },
};

/** "#38BDF8" → "56, 189, 248", untuk dipakai sebagai rgba(var(--tokoh), a) seperti --k1 di tema Jujutsu. */
export function rgbTriplet(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
