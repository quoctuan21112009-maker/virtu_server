/* ================================================================
 * giao_dien_style.js — VIRTU Design System (JS helper)
 * Song hành với css/theme.css — quản lý theme dark/light,
 * tương đương phần Python: MAU_THEO_NHAN, TEN_HIEN_THI_NHAN,
 * qss_toan_cuc(che_do).
 * ================================================================ */

const KHOA_LUU_THEME = "virtu_theme";

export const CHE_DO_MAC_DINH = "dark";

export const MAU = {
  dark: {
    MAU_NEN_CHINH: "#1e1e2e",
    MAU_NEN_THE: "#2b2b3b",
    MAU_CHU_PHU: "#a6adc8",
    MAU_NHAN: "#4F6BFF",
    MAU_THANH_CONG: "#1DB97A",
    MAU_CANH_BAO: "#F59E0B",
    MAU_NGUY_HIEM: "#EF4444",
  },
  light: {
    MAU_NEN_CHINH: "#F0F2FA",
    MAU_NEN_THE: "#FFFFFF",
    MAU_CHU_PHU: "#444466",
    MAU_NHAN: "#4F6BFF",
    MAU_THANH_CONG: "#059669",
    MAU_CANH_BAO: "#D97706",
    MAU_NGUY_HIEM: "#DC2626",
  },
};

export const MAU_THEO_NHAN = {
  normal: "MAU_THANH_CONG",
  suspicious: "MAU_CANH_BAO",
  cheating: "MAU_NGUY_HIEM",
};

export const TEN_HIEN_THI_NHAN = {
  normal: { vi: "BÌNH THƯỜNG", en: "NORMAL", zh: "正常" },
  suspicious: { vi: "NGHI VẤN", en: "SUSPICIOUS", zh: "可疑" },
  cheating: { vi: "GIAN LẬN", en: "CHEATING", zh: "作弊" },
};

export function layMauTheoNhan(nhan, cheDo = layCheDo()) {
  const key = MAU_THEO_NHAN[nhan] || "MAU_THANH_CONG";
  return MAU[cheDo][key];
}

export function layCheDo() {
  try {
    return localStorage.getItem(KHOA_LUU_THEME) || CHE_DO_MAC_DINH;
  } catch (e) {
    return CHE_DO_MAC_DINH;
  }
}

export function datCheDo(cheDo) {
  const cd = cheDo === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", cd);
  try { localStorage.setItem(KHOA_LUU_THEME, cd); } catch (e) { /* ignore */ }
}

export function apDungCheDoDaLuu() {
  datCheDo(layCheDo());
}

export function toggleCheDo() {
  const cd = layCheDo() === "dark" ? "light" : "dark";
  datCheDo(cd);
  return cd;
}
