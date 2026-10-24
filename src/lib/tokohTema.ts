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
import getoAvatar from "../assets/karakter/geto-avatar.webp";
import getoBanner from "../assets/karakter/geto-banner.webp";
import makiAvatar from "../assets/karakter/maki-avatar.webp";
import makiBanner from "../assets/karakter/maki-banner.webp";
import mahitoAvatar from "../assets/karakter/mahito-avatar.webp";
import mahitoBanner from "../assets/karakter/mahito-banner.webp";
import gojoWall from "../assets/wallpaper/wallpaper-gojo.webp";
import sukunaWall from "../assets/wallpaper/wallpaper-sukuna.webp";
import jogoWall from "../assets/wallpaper/wallpaper-jogo.webp";
import nanamiWall from "../assets/wallpaper/wallpaper-nanami.webp";
import itadoriWall from "../assets/wallpaper/wallpaper-itadori.webp";
import megumiWall from "../assets/wallpaper/wallpaper-megumi.webp";
import nobaraWall from "../assets/wallpaper/wallpaper-nobara.webp";
import yutaWall from "../assets/wallpaper/wallpaper-yuta.webp";
import tojiWall from "../assets/wallpaper/wallpaper-toji.webp";
import getoWall from "../assets/wallpaper/wallpaper-geto.webp";
import makiWall from "../assets/wallpaper/wallpaper-maki.webp";
import mahitoWall from "../assets/wallpaper/wallpaper-mahito.webp";

/**
 * Tampilan satu tokoh: kartu pemilih di tab Saya dan wallpaper latar aplikasi (tema Jujutsu).
 * warna/warnaKedua: warna ciri tokoh untuk cincin avatar, bingkai bercahaya, dan gradasi kartu.
 * avatar/banner: potongan ilustrasi (avatar bulat dan ilustrasi setengah badan di kanan kartu).
 * Avatar yang sama juga dipakai di header, sidebar, kartu Pendamping, dan layar kunci (KarakterAnimasi.tsx).
 * wallpaper: gambar latar layar penuh (potret); dimuat hanya saat tokoh itu dipilih.
 */
export interface TokohTema {
  warna: string;
  warnaKedua: string;
  avatar: string;
  banner: string;
  wallpaper: string;
}

export const TOKOH_TEMA: Record<KarakterId, TokohTema> = {
  gojo: { warna: "#38BDF8", warnaKedua: "#A855F7", avatar: gojoAvatar, banner: gojoBanner, wallpaper: gojoWall },
  sukuna: { warna: "#EF4444", warnaKedua: "#991B1B", avatar: sukunaAvatar, banner: sukunaBanner, wallpaper: sukunaWall },
  jogo: { warna: "#F97316", warnaKedua: "#EAB308", avatar: jogoAvatar, banner: jogoBanner, wallpaper: jogoWall },
  nanami: { warna: "#EAB308", warnaKedua: "#F59E0B", avatar: nanamiAvatar, banner: nanamiBanner, wallpaper: nanamiWall },
  itadori: { warna: "#E11D48", warnaKedua: "#FB7185", avatar: itadoriAvatar, banner: itadoriBanner, wallpaper: itadoriWall },
  megumi: { warna: "#10B981", warnaKedua: "#FACC15", avatar: megumiAvatar, banner: megumiBanner, wallpaper: megumiWall },
  nobara: { warna: "#F43F5E", warnaKedua: "#FB923C", avatar: nobaraAvatar, banner: nobaraBanner, wallpaper: nobaraWall },
  yuta: { warna: "#C084FC", warnaKedua: "#E879F9", avatar: yutaAvatar, banner: yutaBanner, wallpaper: yutaWall },
  toji: { warna: "#94A3B8", warnaKedua: "#64748B", avatar: tojiAvatar, banner: tojiBanner, wallpaper: tojiWall },
  geto: { warna: "#F59E0B", warnaKedua: "#A855F7", avatar: getoAvatar, banner: getoBanner, wallpaper: getoWall },
  maki: { warna: "#22C55E", warnaKedua: "#EF4444", avatar: makiAvatar, banner: makiBanner, wallpaper: makiWall },
  mahito: { warna: "#38BDF8", warnaKedua: "#94A3B8", avatar: mahitoAvatar, banner: mahitoBanner, wallpaper: mahitoWall },
};

/** "#38BDF8" → "56, 189, 248", untuk dipakai sebagai rgba(var(--tokoh), a) seperti --k1 di tema Jujutsu. */
export function rgbTriplet(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
