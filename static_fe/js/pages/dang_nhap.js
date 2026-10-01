/* ================================================================
 * dang_nhap.js — Trang đăng nhập / đăng ký VIRTU
 * ================================================================ */
import { RESTClient, LoiApi } from "../core/ket_noi_client.js";
import { T, khoiTaoNgonNgu, datNgonNgu, layNgonNgu, NGON_NGU_HO_TRO } from "../core/ngon_ngu.js";
import { apDungCheDoDaLuu, toggleCheDo, layCheDo } from "../core/giao_dien_style.js";
import { icon } from "../core/icons.js";

const MON_THI_KEYS = ["toan_hoc", "vat_ly", "hoa_hoc", "sinh_hoc", "lich_su", "dia_ly", "tin_hoc", "tieng_anh", "ngu_van"];

const KHOA_LUU_SERVER = "virtu_dia_chi_server";
const KHOA_LUU_PHIEN = "virtu_phien_dang_nhap";

let che_do_hien_tai = "dang_nhap"; // "dang_nhap" | "dang_ky"
let vai_tro_chon = "hoc_sinh";

function layDiaChiServerMacDinh() {
  try {
    return localStorage.getItem(KHOA_LUU_SERVER) || window.location.origin || "http://localhost:5000";
  } catch (e) {
    return "http://localhost:5000";
  }
}

function luuDiaChiServer(dc) {
  try { localStorage.setItem(KHOA_LUU_SERVER, dc); } catch (e) { /* ignore */ }
}

export function luuPhienDangNhap(data) {
  try { sessionStorage.setItem(KHOA_LUU_PHIEN, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export function docPhienDangNhap() {
  try {
    const raw = sessionStorage.getItem(KHOA_LUU_PHIEN);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function xoaPhienDangNhap() {
  try { sessionStorage.removeItem(KHOA_LUU_PHIEN); } catch (e) { /* ignore */ }
}

export function chuanHoaVaiTro(vaiTro) {
  if (!vaiTro) return "hoc_sinh";
  const vt = String(vaiTro).toLowerCase().trim();
  if (vt.includes("giao_vien") || vt.includes("teacher") || vt === "gv" || vt === "instructor") {
    return "giao_vien";
  }
  if (vt.includes("quan_tri") || vt.includes("admin") || vt === "superadmin" || vt === "root") {
    return "quan_tri_vien";
  }
  return "hoc_sinh";
}

export function dieuHuongTheoVaiTro(rawVaiTro) {
  const vaiTro = chuanHoaVaiTro(rawVaiTro);
  const map = {
    hoc_sinh: "hoc_sinh.html",
    giao_vien: "giao_vien.html",
    quan_tri_vien: "quan_tri.html",
  };
  window.location.href = map[vaiTro] || "hoc_sinh.html";
}

/**
 * Kiểm tra quyền truy cập của trang hiện tại.
 * @param {string[]} cacVaiTroHopLe - Danh sách vai trò được phép vào (ví dụ: ["giao_vien", "quan_tri_vien"])
 * @returns {object|null} Trả về session nếu hợp lệ, ngược lại tự động chuyển hướng.
 */
export function guardVaiTro(cacVaiTroHopLe = []) {
  const phien = docPhienDangNhap();
  if (!phien) {
    window.location.href = "index.html";
    return null;
  }
  const rawRole = phien.vai_tro || phien.nguoi_dung?.vai_tro || phien.nguoi_dung?.role || "";
  const vaiTro = chuanHoaVaiTro(rawRole);
  
  if (cacVaiTroHopLe.length > 0 && !cacVaiTroHopLe.includes(vaiTro)) {
    // Nếu không có quyền vào trang này, điều hướng về đúng trang của vai trò
    dieuHuongTheoVaiTro(vaiTro);
    return null;
  }
  return phien;
}

function render() {
  const root = document.getElementById("app");

  const dsNgonNgu = Object.keys(NGON_NGU_HO_TRO)
    .map((ma) => `<button class="lang-btn ${layNgonNgu() === ma ? "active" : ""}" data-lang="${ma}">${NGON_NGU_HO_TRO[ma]}</button>`)
    .join("");

  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="lang-select-row">${dsNgonNgu}</div>

        <div class="login-logo-row">
          <div class="logo-circle">
            <img src="logo/logo.png" alt="Virtu Logo" class="login-logo-img" />
          </div>
          <h1 class="login-title">${T("virtu")}</h1>
          <p class="login-subtitle">${T("he_thong_giam_sat")}</p>
        </div>

        <div id="login-error" class="login-error"></div>

        <div id="form-dang-nhap" class="${che_do_hien_tai === "dang_nhap" ? "" : "hidden"}">
          <p class="login-section-title">${T("chao_mung_tro_lai")}</p>

          <div class="login-field">
            <label>${T("dia_chi_server")}</label>
            <input type="text" id="ip-server" value="${layDiaChiServerMacDinh()}" placeholder="http://192.168.1.10:5000" />
          </div>

          <div class="login-field">
            <label>${T("ten_dang_nhap")}</label>
            <input type="text" id="ln-user" placeholder="${T("ten_tai_khoan")}" autocomplete="username" />
          </div>

          <div class="login-field">
            <label>${T("mat_khau")}</label>
            <input type="password" id="ln-pass" placeholder="${T("mat_khau")}" autocomplete="current-password" />
          </div>

          <div class="login-actions">
            <button id="btn-dang-nhap" class="btn-primary-glow">${T("dang_nhap")}</button>
          </div>

          <p class="login-switch">
            ${T("dang_ky")}? <a id="lien-ket-dang-ky">${T("tao_tai_khoan")}</a>
          </p>
        </div>

        <div id="form-dang-ky" class="${che_do_hien_tai === "dang_ky" ? "" : "hidden"}">
          <div class="login-field">
            <label>${T("dia_chi_server")}</label>
            <input type="text" id="dk-server" value="${layDiaChiServerMacDinh()}" placeholder="http://192.168.1.10:5000" />
          </div>

          <div class="role-select">
            <div class="role-btn ${vai_tro_chon === "hoc_sinh" ? "active" : ""}" data-role="hoc_sinh">
              ${icon("student")}
              <span>${T("hoc_sinh")}</span>
            </div>
            <div class="role-btn ${vai_tro_chon === "giao_vien" ? "active" : ""}" data-role="giao_vien">
              ${icon("teacher")}
              <span>${T("giao_vien")}</span>
            </div>
            <div class="role-btn ${vai_tro_chon === "quan_tri_vien" ? "active" : ""}" data-role="quan_tri_vien">
              ${icon("shield")}
              <span>${T("quan_tri_vien")}</span>
            </div>
          </div>

          <div class="login-field">
            <label>${T("ho_va_ten")}</label>
            <input type="text" id="dk-hoten" placeholder="${T("ho_va_ten")}" />
          </div>
          <div class="login-field">
            <label>${T("ten_dang_nhap")}</label>
            <input type="text" id="dk-user" placeholder="${T("ten_dang_nhap")}" autocomplete="username" />
          </div>
          <div class="login-field">
            <label>${T("mat_khau")}</label>
            <input type="password" id="dk-pass" placeholder="${T("mat_khau")}" autocomplete="new-password" />
          </div>
          <div class="login-field">
            <label>${T("ten_truong")}</label>
            <input type="text" id="dk-truong" placeholder="${T("ten_truong")}" />
          </div>

          <div class="login-actions">
            <button id="btn-dang-ky" class="btn-primary-glow">${T("tao_tai_khoan")}</button>
          </div>

          <p class="login-switch">
            ${T("dang_nhap")}? <a id="lien-ket-dang-nhap">${T("dang_nhap")}</a>
          </p>
        </div>

        <div class="login-footer-row">
          <div class="icon-btn-sm" id="btn-toggle-theme" title="${T(layCheDo() === "dark" ? "doi_giao_dien_sang" : "doi_giao_dien_toi")}">
            ${icon(layCheDo() === "dark" ? "sun" : "moon")}
          </div>
          <span class="phu-de">VIRTU AI Security v2.0</span>
          <div class="icon-btn-sm" id="btn-quet-qr" title="${T("quet_qr")}">
            ${icon("qr")}
          </div>
        </div>

        <p class="login-hint">${T("ghi_chu_dang_nhap")}</p>
      </div>
    </div>
  `;

  ganSuKien();
}

function hienThiLoi(msg) {
  const el = document.getElementById("login-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
}

function anLoi() {
  const el = document.getElementById("login-error");
  if (!el) return;
  el.classList.remove("show");
  el.textContent = "";
}

function ganSuKien() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      datNgonNgu(btn.dataset.lang);
      render();
    });
  });

  document.getElementById("btn-toggle-theme")?.addEventListener("click", () => {
    toggleCheDo();
    render();
  });

  document.getElementById("lien-ket-dang-ky")?.addEventListener("click", () => {
    che_do_hien_tai = "dang_ky";
    anLoi();
    render();
  });
  document.getElementById("lien-ket-dang-nhap")?.addEventListener("click", () => {
    che_do_hien_tai = "dang_nhap";
    anLoi();
    render();
  });

  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      vai_tro_chon = btn.dataset.role;
      render();
    });
  });

  document.getElementById("btn-dang-nhap")?.addEventListener("click", xuLyDangNhap);
  document.getElementById("btn-dang-ky")?.addEventListener("click", xuLyDangKy);

  // Enter để submit
  ["ln-user", "ln-pass"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") xuLyDangNhap();
    });
  });
  ["dk-hoten", "dk-user", "dk-pass", "dk-truong"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") xuLyDangKy();
    });
  });
}

async function xuLyDangNhap() {
  anLoi();
  const diaChiServer = document.getElementById("ip-server")?.value.trim() || "";
  const tenDangNhap = document.getElementById("ln-user")?.value.trim() || "";
  const matKhau = document.getElementById("ln-pass")?.value || "";

  if (!tenDangNhap || !matKhau) {
    hienThiLoi(T("loi_nhap_du"));
    return;
  }
  if (!diaChiServer) {
    hienThiLoi(T("loi_ket_noi"));
    return;
  }

  const btn = document.getElementById("btn-dang-nhap");
  if (btn) {
    btn.disabled = true;
    btn.textContent = T("dang_ket_noi");
  }

  try {
    luuDiaChiServer(diaChiServer);
    const rest = new RESTClient(diaChiServer);
    const d = await rest.dang_nhap(tenDangNhap, matKhau);
    
    // Extract user info & normalized role
    const user = d.nguoi_dung || d.user || d;
    const rawRole = user.vai_tro || user.role || d.vai_tro || d.role || "";
    const vaiTro = chuanHoaVaiTro(rawRole);
    user.vai_tro = vaiTro;

    luuPhienDangNhap({
      dia_chi_server: diaChiServer,
      token: d.token || d.access_token,
      nguoi_dung: user,
      vai_tro: vaiTro,
    });

    dieuHuongTheoVaiTro(vaiTro);
  } catch (e) {
    hienThiLoi(e instanceof LoiApi ? e.thong_diep : `${T("loi_ket_noi")}: ${e.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = T("dang_nhap");
    }
  }
}

async function xuLyDangKy() {
  anLoi();
  const diaChiServer = document.getElementById("dk-server")?.value.trim() || "";
  const hoTen = document.getElementById("dk-hoten")?.value.trim() || "";
  const tenDangNhap = document.getElementById("dk-user")?.value.trim() || "";
  const matKhau = document.getElementById("dk-pass")?.value || "";
  const tenTruong = document.getElementById("dk-truong")?.value.trim() || "";

  if (!hoTen || !tenDangNhap || !matKhau || !tenTruong) {
    hienThiLoi(T("loi_thieu_thong_tin"));
    return;
  }

  const btn = document.getElementById("btn-dang-ky");
  if (btn) {
    btn.disabled = true;
    btn.textContent = T("dang_ket_noi");
  }

  try {
    luuDiaChiServer(diaChiServer);
    const rest = new RESTClient(diaChiServer);
    await rest.dang_ky(tenDangNhap, matKhau, hoTen, vai_tro_chon, tenTruong);
    anLoi();

    // Tự động đăng nhập sau khi đăng ký thành công
    const d = await rest.dang_nhap(tenDangNhap, matKhau);
    const user = d.nguoi_dung || d.user || d;
    const rawRole = user.vai_tro || user.role || d.vai_tro || d.role || vai_tro_chon;
    const vaiTro = chuanHoaVaiTro(rawRole);
    user.vai_tro = vaiTro;

    luuPhienDangNhap({
      dia_chi_server: diaChiServer,
      token: d.token || d.access_token,
      nguoi_dung: user,
      vai_tro: vaiTro,
    });

    dieuHuongTheoVaiTro(vaiTro);
  } catch (e) {
    hienThiLoi(e instanceof LoiApi ? e.thong_diep : `${T("loi_ket_noi")}: ${e.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = T("tao_tai_khoan");
    }
  }
}

// ---- Khởi động ----
khoiTaoNgonNgu();
apDungCheDoDaLuu();
render();
