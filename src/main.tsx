import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles/style.css";
import "./styles/tema-jujutsu.css";
import "./styles/karakter-animasi.css";

// Pastikan update PWA langsung aktif dan halaman dimuat ulang jika ada versi baru
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
