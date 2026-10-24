import React from "react";
import { KarakterId } from "../types";
import { KARAKTER } from "../lib/constants";
import { TOKOH_TEMA, rgbTriplet } from "../lib/tokohTema";

interface KarakterAnimasiProps {
  karakter: KarakterId;
  ukuran?: number;
  showAura?: boolean;
  interaktif?: boolean;
  onClick?: () => void;
  className?: string;
  title?: string;
}

/** Avatar bulat tokoh (header, sidebar, kartu Pendamping, layar kunci): gambar tokoh dengan cincin dan cahaya warnanya. */
export const KarakterAnimasi: React.FC<KarakterAnimasiProps> = ({
  karakter,
  ukuran = 48,
  showAura = false,
  interaktif = false,
  onClick,
  className = "",
  title,
}) => {
  const tema = TOKOH_TEMA[karakter];
  const defaultTitle = KARAKTER[karakter]
    ? `${KARAKTER[karakter].nama} · ${KARAKTER[karakter].teknik}`
    : "Karakter Jujutsu Kaisen";

  return (
    <div
      className={`karakter-avatar-wrap ${showAura ? "dengan-aura" : ""} ${interaktif ? "interaktif" : ""} ${className}`}
      style={
        {
          width: `${ukuran}px`,
          height: `${ukuran}px`,
          cursor: onClick || interaktif ? "pointer" : "default",
          "--tokoh": rgbTriplet(tema.warna),
        } as React.CSSProperties
      }
      onClick={onClick}
      title={title || defaultTitle}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <img
        className="karakter-avatar-img"
        src={tema.avatar}
        alt=""
        width={156}
        height={156}
        decoding="async"
        draggable={false}
      />
    </div>
  );
};
