/* ================================================================
 * quan_tri.js — Trang Quản trị viên VIRTU
 * ================================================================ */
import { RESTClient, KetNoiThoiGianThuc, LoiApi } from "../core/ket_noi_client.js";
import { T, khoiTaoNgonNgu } from "../core/ngon_ngu.js";
import { apDungCheDoDaLuu, toggleCheDo, layCheDo } from "../core/giao_dien_style.js";
import { LuoiGiamSat } from "./luoi_giam_sat.js";
import { docPhienDangNhap, xoaPhienDangNhap, guardVaiTro } from "./dang_nhap.js";
import { xuatPDF, xuatCSV } from "../core/bao_cao.js";
import { icon } from "../core/icons.js";

let rest, ketNoi, phien;
let luoiDangMo = null;
let tabHienTai = "tong_quan"; // tong_quan | phong_thi | nguoi_dung | bao_cao | cai_dat | nhat_ky
let dsPhong = [];
let dsNhatKy = [];

function baoVePhien() {
  phien = guardVaiTro(["quan_tri_vien"]);
  return !!phien;
}

function khoiTaoKetNoi() {
  rest = new RESTClient(phien.dia_chi_server);
  rest.token = phien.token;
  ketNoi = new KetNoiThoiGianThuc(phien.dia_chi_server, phien.token);
  ketNoi.ket_noi_nen();
}

function render() {
  const root = document.getElementById("app");
  const nd = phien.nguoi_dung || {};
  const hoTen = nd.ho_ten || nd.name || nd.ten_dang_nhap || "Quản trị viên";

  root.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon"><img src="logo/logo.png" alt="Virtu Logo" class="sidebar-logo-img" /></div>
        <div class="app-name">Virtu</div>
      </div>

      <div class="sidebar-nav">
        <div class="nav-item ${tabHienTai === "tong_quan" ? "active" : ""}" data-tab="tong_quan">
          ${icon("dashboard")} <span>${T("tong_quan")}</span>
        </div>
        <div class="nav-item ${tabHienTai === "phong_thi" ? "active" : ""}" data-tab="phong_thi">
          ${icon("room")} <span>Toàn bộ phòng thi</span>
        </div>
        <div class="nav-item ${tabHienTai === "nguoi_dung" ? "active" : ""}" data-tab="nguoi_dung">
          ${icon("students")} <span>Quản lý tài khoản</span>
        </div>
        <div class="nav-item ${tabHienTai === "bao_cao" ? "active" : ""}" data-tab="bao_cao">
          ${icon("report")} <span>${T("bao_cao")}</span>
        </div>
        <div class="nav-item ${tabHienTai === "cai_dat" ? "active" : ""}" data-tab="cai_dat">
          ${icon("settings")} <span>${T("cai_dat")}</span>
        </div>
        <div class="nav-item ${tabHienTai === "nhat_ky" ? "active" : ""}" data-tab="nhat_ky">
          ${icon("log")} <span>${T("nhat_ky")}</span>
        </div>
      </div>

      <div class="sidebar-user">
        <div class="user-avatar">${hoTen.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name" title="${hoTen}">${hoTen}</div>
          <div class="user-role">${T("quan_tri_vien")}</div>
        </div>
        <button class="btn-logout" id="btn-dang-xuat" title="${T("dang_xuat")}">
          ${icon("logout")}
        </button>
      </div>
    </div>

    <div class="main-wrapper">
      <div id="page-content" class="flex-1 flex-col" style="overflow:hidden;"></div>
    </div>
    <div id="modal-slot"></div>
  `;

  ganSuKienSidebar();
  chuyenTab(tabHienTai);
}

function ganSuKienSidebar() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => chuyenTab(btn.dataset.tab));
  });

  document.getElementById("btn-dang-xuat")?.addEventListener("click", () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      dondep();
      xoaPhienDangNhap();
      window.location.href = "index.html";
    }
  });
}

function chuyenTab(tab) {
  tabHienTai = tab;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  if (luoiDangMo) {
    luoiDangMo.donDep();
    luoiDangMo = null;
  }

  const container = document.getElementById("page-content");
  if (!container) return;

  switch (tab) {
    case "tong_quan":
      renderTabTongQuan(container);
      break;
    case "phong_thi":
      renderTabPhongThi(container);
      break;
    case "nguoi_dung":
      renderTabNguoiDung(container);
      break;
    case "bao_cao":
      renderTabBaoCao(container);
      break;
    case "cai_dat":
      renderTabCaiDat(container);
      break;
    case "nhat_ky":
      renderTabNhatKy(container);
      break;
    default:
      renderTabTongQuan(container);
  }
}

// TAB TỔNG QUAN
async function renderTabTongQuan(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Tổng quan Quản trị Trường</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-qt">${icon("refresh")} ${T("lam_moi")}</button>
      </div>
    </div>
    <div class="page-body">
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-header"><div class="stat-icon">${icon("monitor")}</div><span>Phiên đang mở</span></div>
          <div class="stat-value" id="stat-qt-live">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><div class="stat-icon">${icon("room")}</div><span>Tổng phòng thi</span></div>
          <div class="stat-value" id="stat-qt-phong">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><div class="stat-icon">${icon("teacher")}</div><span>Tổng giáo viên</span></div>
          <div class="stat-value" id="stat-qt-gv">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><div class="stat-icon">${icon("students")}</div><span>Tổng thí sinh</span></div>
          <div class="stat-value" id="stat-qt-hs">0</div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">Danh sách phiên thi toàn trường</div>
        <div class="panel-body">
          <table class="bang">
            <thead>
              <tr><th>MÃ PHÒNG</th><th>TÊN PHIÊN</th><th>GIÁO VIÊN</th><th>MÔN THI</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr>
            </thead>
            <tbody id="tbl-qt-phong-body">
              <tr><td colspan="6" class="phu-de text-center" style="padding:20px;">Đang tải dữ liệu...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-lam-moi-qt")?.addEventListener("click", () => renderTabTongQuan(container));

  try {
    const d = await rest.phong_cua_truong();
    dsPhong = Array.isArray(d) ? d : (d.phong || []);
    const live = dsPhong.filter((p) => p.dang_hoat_dong);
    document.getElementById("stat-qt-live").textContent = live.length;
    document.getElementById("stat-qt-phong").textContent = dsPhong.length;

    try {
      const gvList = await rest.danh_sach_nguoi_dung("giao_vien");
      const hsList = await rest.danh_sach_nguoi_dung("hoc_sinh");
      document.getElementById("stat-qt-gv").textContent = (gvList.nguoi_dung || gvList || []).length;
      document.getElementById("stat-qt-hs").textContent = (hsList.nguoi_dung || hsList || []).length;
    } catch (e) { /* ignore */ }

    const tbody = document.getElementById("tbl-qt-phong-body");
    if (!tbody) return;

    if (dsPhong.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="phu-de text-center" style="padding:20px;">Chưa có phòng thi nào trong trường.</td></tr>`;
      return;
    }

    tbody.innerHTML = dsPhong.map((p) => `
      <tr>
        <td><b style="color:var(--nhan);">${p.ma_phong}</b></td>
        <td>${p.ten_phien}</td>
        <td>${p.ten_giao_vien || "Giáo viên"}</td>
        <td>${p.mon_thi || "Toán học"}</td>
        <td><span class="chip ${p.dang_hoat_dong ? "normal" : "suspicious"}">${p.dang_hoat_dong ? "Đang mở" : "Đã đóng"}</span></td>
        <td>
          <button class="nut-phu btn-qt-monitor" data-code="${p.ma_phong}" style="padding:4px 10px;font-size:8.5pt;">
            ${icon("monitor")} Giám sát
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-qt-monitor").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = dsPhong.find((x) => x.ma_phong === btn.dataset.code);
        if (p) moGiamSatPhienQT(p);
      });
    });
  } catch (e) {
    console.error(e);
  }
}

// TAB PHÒNG THI
async function renderTabPhongThi(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Toàn bộ phòng thi trong trường</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-pt-qt">${icon("refresh")} ${T("lam_moi")}</button>
      </div>
    </div>
    <div class="page-body">
      <table class="bang">
        <thead>
          <tr><th>MÃ PHÒNG</th><th>TÊN PHIÊN</th><th>GIÁO VIÊN</th><th>MÔN THI</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr>
        </thead>
        <tbody id="tbl-all-rooms-body">
          <tr><td colspan="6" class="phu-de text-center" style="padding:20px;">Đang tải danh sách phòng...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-lam-moi-pt-qt")?.addEventListener("click", () => renderTabPhongThi(container));

  try {
    const d = await rest.phong_cua_truong();
    dsPhong = Array.isArray(d) ? d : (d.phong || []);
    const tbody = document.getElementById("tbl-all-rooms-body");
    if (!tbody) return;

    if (dsPhong.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="phu-de text-center" style="padding:20px;">Chưa có phòng thi nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = dsPhong.map((p) => `
      <tr>
        <td><b style="color:var(--nhan);">${p.ma_phong}</b></td>
        <td>${p.ten_phien}</td>
        <td>${p.ten_giao_vien || "Giáo viên"}</td>
        <td>${p.mon_thi || "Toán học"}</td>
        <td><span class="chip ${p.dang_hoat_dong ? "normal" : "suspicious"}">${p.dang_hoat_dong ? "Đang mở" : "Đã kết thúc"}</span></td>
        <td>
          <button class="nut-phu btn-qt-monitor" data-code="${p.ma_phong}" style="padding:4px 10px;font-size:8.5pt;">
            ${icon("monitor")} Giám sát
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-qt-monitor").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = dsPhong.find((x) => x.ma_phong === btn.dataset.code);
        if (p) moGiamSatPhienQT(p);
      });
    });
  } catch (e) {
    console.error(e);
  }
}

function moGiamSatPhienQT(p) {
  if (luoiDangMo) {
    luoiDangMo.donDep();
    luoiDangMo = null;
  }

  const container = document.getElementById("page-content");
  container.innerHTML = `
    <div class="page-header">
      <div class="flex gap-10" style="align-items:center;">
        <button class="nut-phu" id="btn-back-qt" style="padding:6px 12px;">← Quay lại</button>
        <div class="page-title">${p.ten_phien} <span class="phu-de">(${p.ma_phong} — GV: ${p.ten_giao_vien || "Giáo viên"})</span></div>
      </div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-xuat-pdf-qt">${icon("fileText")} PDF</button>
        <button class="nut-phu" id="btn-xuat-csv-qt">${icon("excel")} CSV</button>
      </div>
    </div>
    <div class="page-body flex-1" style="overflow:hidden;" id="monitor-content-qt"></div>
  `;

  document.getElementById("btn-back-qt")?.addEventListener("click", () => chuyenTab("phong_thi"));

  luoiDangMo = new LuoiGiamSat(rest, ketNoi, p.id || p.phien_id, p.ma_phong, `${p.ten_phien} (GV: ${p.ten_giao_vien})`);
  document.getElementById("monitor-content-qt").appendChild(luoiDangMo.el);

  document.getElementById("btn-xuat-pdf-qt")?.addEventListener("click", async () => {
    try {
      const d = await rest.bao_cao_phien(p.id || p.phien_id);
      xuatPDF(d, `bao_cao_${p.ma_phong}.pdf`);
    } catch (e) { alert(e.message); }
  });
  document.getElementById("btn-xuat-csv-qt")?.addEventListener("click", async () => {
    try {
      const d = await rest.bao_cao_phien(p.id || p.phien_id);
      xuatCSV(d, `bao_cao_${p.ma_phong}.csv`);
    } catch (e) { alert(e.message); }
  });
}

// TAB QUẢN LÝ NGƯỜI DÙNG & TẠO HÀNG LOẠT
async function renderTabNguoiDung(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Quản lý Tài khoản Toàn trường</div>
      <div class="page-actions">
        <button class="btn-primary-glow" id="btn-tao-hang-loat">${icon("plus")} Tạo tài khoản hàng loạt</button>
        <button class="nut-phu" id="btn-lam-moi-users">${icon("refresh")} ${T("lam_moi")}</button>
      </div>
    </div>
    <div class="page-body">
      <div class="panel-card">
        <div class="panel-header">Danh sách người dùng hệ thống</div>
        <div class="panel-body">
          <table class="bang">
            <thead>
              <tr><th>ID</th><th>HỌ VÀ TÊN</th><th>TÊN ĐĂNG NHẬP</th><th>TRƯỜNG</th><th>VAI TRÒ</th></tr>
            </thead>
            <tbody id="tbl-qt-users-body">
              <tr><td colspan="5" class="phu-de text-center" style="padding:20px;">Đang tải danh sách...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-tao-hang-loat")?.addEventListener("click", moHopThoaiTaoHangLoat);
  document.getElementById("btn-lam-moi-users")?.addEventListener("click", () => renderTabNguoiDung(container));

  try {
    const [gvResp, hsResp] = await Promise.all([
      rest.danh_sach_nguoi_dung("giao_vien").catch(() => []),
      rest.danh_sach_nguoi_dung("hoc_sinh").catch(() => []),
    ]);
    const gvs = (gvResp.nguoi_dung || gvResp || []).map((x) => ({ ...x, roleName: "Giáo viên", roleKey: "teacher" }));
    const hss = (hsResp.nguoi_dung || hsResp || []).map((x) => ({ ...x, roleName: "Học sinh", roleKey: "student" }));
    const all = [...gvs, ...hss];

    const tbody = document.getElementById("tbl-qt-users-body");
    if (!tbody) return;

    if (all.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="phu-de text-center" style="padding:20px;">Chưa có tài khoản nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = all.map((u) => `
      <tr>
        <td>#${u.id || "-"}</td>
        <td><b>${u.ho_ten || u.name || "-"}</b></td>
        <td>${u.ten_dang_nhap || u.username || "-"}</td>
        <td>${u.ten_truong || phien.nguoi_dung?.ten_truong || "-"}</td>
        <td><span class="chip ${u.roleKey === "teacher" ? "normal" : "suspicious"}">${u.roleName}</span></td>
      </tr>
    `).join("");
  } catch (e) {
    console.error(e);
  }
}

function moHopThoaiTaoHangLoat() {
  const slot = document.getElementById("modal-slot");
  slot.innerHTML = `
    <div class="overlay-nen" id="overlay-hang-loat">
      <div class="hop-thoai" style="width:580px;">
        <h2 class="tieu-de" style="font-size:14pt;margin-bottom:14px;">Tạo tài khoản hàng loạt (Batch CSV)</h2>

        <div class="login-field">
          <label>Vai trò</label>
          <select id="hl-vai-tro">
            <option value="hoc_sinh">${T("hoc_sinh")}</option>
            <option value="giao_vien">${T("giao_vien")}</option>
          </select>
        </div>

        <div class="login-field">
          <label>Danh sách (Mỗi dòng 1 tài khoản: ten_dang_nhap,mat_khau,ho_ten)</label>
          <textarea id="hl-danh-sach" rows="8" style="font-family:monospace;font-size:9.5pt;" placeholder="hs001,123456,Nguyễn Văn A&#10;hs002,123456,Trần Thị B"></textarea>
        </div>

        <div id="hl-loi" class="login-error"></div>
        <div id="hl-thanh-cong" class="login-error" style="border-color:var(--thanh-cong);color:var(--thanh-cong);background:rgba(16,185,129,0.1);"></div>

        <div class="flex gap-8" style="justify-content:flex-end;margin-top:14px;">
          <button class="nut-phu" id="hl-huy">${T("dong")}</button>
          <button class="btn-primary-glow" id="hl-tao">${icon("plus")} ${T("tao_moi")}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("hl-huy")?.addEventListener("click", () => { slot.innerHTML = ""; });
  document.getElementById("overlay-hang-loat")?.addEventListener("click", (e) => {
    if (e.target.id === "overlay-hang-loat") slot.innerHTML = "";
  });

  document.getElementById("hl-tao")?.addEventListener("click", async () => {
    const vaiTro = document.getElementById("hl-vai-tro").value;
    const raw = document.getElementById("hl-danh-sach").value.trim();
    const loiEl = document.getElementById("hl-loi");
    const okEl = document.getElementById("hl-thanh-cong");
    loiEl.classList.remove("show");
    okEl.classList.remove("show");

    if (!raw) {
      loiEl.textContent = "Vui lòng nhập danh sách tài khoản.";
      loiEl.classList.add("show");
      return;
    }

    const danhSach = raw.split("\n").filter(Boolean).map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      return { ten_dang_nhap: parts[0], mat_khau: parts[1] || "123456", ho_ten: parts[2] || parts[0] };
    });

    const btn = document.getElementById("hl-tao");
    btn.disabled = true;
    try {
      await rest.dang_ky_hang_loat(vaiTro, danhSach);
      okEl.textContent = `Đã tạo thành công ${danhSach.length} tài khoản.`;
      okEl.classList.add("show");
      setTimeout(() => {
        slot.innerHTML = "";
        renderTabNguoiDung(document.getElementById("page-content"));
      }, 1500);
    } catch (e) {
      loiEl.textContent = e.thong_diep || e.message;
      loiEl.classList.add("show");
    } finally {
      btn.disabled = false;
    }
  });
}

// TAB BÁO CÁO, CÀI ĐẶT, NHẬT KÝ
async function renderTabBaoCao(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Báo cáo Tổng hợp Trường</div>
    </div>
    <div class="page-body">
      <div class="panel-card">
        <div class="panel-header">Chọn phòng thi cần xuất báo cáo</div>
        <div class="panel-body">
          <div class="flex gap-10" style="margin-bottom:16px;">
            <select id="select-qt-bc" style="max-width:400px;"></select>
            <button class="btn-primary-glow" id="btn-qt-pdf">${icon("fileText")} Xuất PDF</button>
            <button class="nut-phu" id="btn-qt-csv">${icon("excel")} Xuất CSV</button>
          </div>
          <div id="qt-report-box" class="report-card-container">
            <div class="phu-de text-center" style="padding:40px;">Đang tải thông tin...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const d = await rest.phong_cua_truong();
    dsPhong = Array.isArray(d) ? d : (d.phong || []);
    const select = document.getElementById("select-qt-bc");
    if (!select) return;

    select.innerHTML = dsPhong.map((p) => `<option value="${p.id || p.phien_id}">${p.ma_phong} — ${p.ten_phien} (${p.ten_giao_vien || "GV"})</option>`).join("");

    const loadBc = async (id) => {
      const box = document.getElementById("qt-report-box");
      if (!box || !id) return;
      try {
        const bc = await rest.bao_cao_phien(id);
        const p = bc.phong || {};
        const hs = bc.hoc_sinh || [];
        const vp = bc.vi_pham || [];
        box.innerHTML = `
          <div class="report-title">BÁO CÁO PHÒNG THI</div>
          <div class="report-info-grid">
            <div class="report-info-item"><span class="label">Phiên:</span> <span class="val">${p.ten_phien || "-"}</span></div>
            <div class="report-info-item"><span class="label">Mã:</span> <span class="val">${p.ma_phong || "-"}</span></div>
            <div class="report-info-item"><span class="label">Giáo viên:</span> <span class="val">${p.ten_giao_vien || "-"}</span></div>
            <div class="report-info-item"><span class="label">Thí sinh:</span> <span class="val">${hs.length}</span></div>
          </div>
        `;
      } catch (e) {
        box.innerHTML = `<div class="phu-de text-center">Lỗi tải báo cáo: ${e.message}</div>`;
      }
    };

    select.addEventListener("change", (e) => loadBc(e.target.value));
    if (dsPhong[0]) loadBc(dsPhong[0].id || dsPhong[0].phien_id);

    document.getElementById("btn-qt-pdf")?.addEventListener("click", async () => {
      const id = select.value;
      if (!id) return;
      const bc = await rest.bao_cao_phien(id);
      xuatPDF(bc, `bao_cao_${id}.pdf`);
    });
    document.getElementById("btn-qt-csv")?.addEventListener("click", async () => {
      const id = select.value;
      if (!id) return;
      const bc = await rest.bao_cao_phien(id);
      xuatCSV(bc, `bao_cao_${id}.csv`);
    });
  } catch (e) { console.error(e); }
}

function renderTabCaiDat(container) {
  container.innerHTML = `
    <div class="page-header"><div class="page-title">Cài đặt Quản trị</div></div>
    <div class="page-body" style="max-width:600px;">
      <div class="panel-card">
        <div class="panel-header">Giao diện</div>
        <div class="panel-body flex" style="justify-content:space-between;align-items:center;padding:16px;">
          <span>Chế độ Sáng / Tối</span>
          <button class="nut-phu" id="btn-theme-qt">${icon(layCheDo() === "dark" ? "sun" : "moon")} Đổi giao diện</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("btn-theme-qt")?.addEventListener("click", () => {
    toggleCheDo();
    render();
  });
}

async function renderTabNhatKy(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Nhật ký hoạt động hệ thống</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-log-qt">${icon("refresh")} ${T("lam_moi")}</button>
        <button class="nut-nguy-hiem" id="btn-xoa-log-qt">${icon("trash")} Xóa log</button>
      </div>
    </div>
    <div class="page-body">
      <div class="terminal-box" id="terminal-audit-qt">
        <div class="terminal-line"><span class="log-time">[HỆ THỐNG]</span> Đang tải log...</div>
      </div>
    </div>
  `;

  document.getElementById("btn-lam-moi-log-qt")?.addEventListener("click", () => taiNhatKyQT());
  document.getElementById("btn-xoa-log-qt")?.addEventListener("click", async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa log?")) return;
    await rest.xoa_nhat_ky().catch(() => {});
    taiNhatKyQT();
  });

  taiNhatKyQT();
}

async function taiNhatKyQT() {
  const box = document.getElementById("terminal-audit-qt");
  if (!box) return;
  try {
    const d = await rest.lay_nhat_ky(100);
    dsNhatKy = Array.isArray(d) ? d : (d.nhat_ky || d.logs || []);
    if (dsNhatKy.length === 0) {
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      dsNhatKy = [
        { thoi_gian: now, hanh_dong: "SYSTEM_START", tac_nhan: "admin", ket_qua: "SUCCESS", mo_ta: "Khởi động hệ thống Virtu Proctoring" },
      ];
    }
    box.innerHTML = dsNhatKy.map((l) => {
      const hanhdong = l.hanh_dong || l.su_kien || "LOG";
      const tacNhan = l.tac_nhan || l.hoc_sinh_id || "hệ_thống";
      const moTa = l.mo_ta || l.chi_tiet || "";
      const ketQua = l.ket_qua || "INFO";
      const isSuccess = ketQua.toUpperCase() === "SUCCESS" || ketQua.toUpperCase() === "INFO";
      const tb = l.thiet_bi || {};
      const thietBiStr = tb.ip ? ` | <span style="opacity:0.6;">IP: ${tb.ip} · ${tb.he_dieu_hanh || ""} · ${tb.trinh_duyet || ""}</span>` : "";
      return `
      <div class="terminal-line">
        <span class="log-time">[${l.thoi_gian || ""}]</span>
        <span class="log-tag">[${hanhdong}]</span>
        <span> ${tacNhan} → </span>
        <span class="${isSuccess ? "log-success" : "log-fail"}">${ketQua}</span>
        <span> | <span class="log-info">${moTa}</span>${thietBiStr}</span>
      </div>
    `;
    }).join("");
  } catch (e) {
    box.innerHTML = `<div class="terminal-line log-fail">Lỗi tải nhật ký: ${e.message}</div>`;
  }
}

function dondep() {
  if (luoiDangMo) luoiDangMo.donDep();
  ketNoi?.ngat_ket_noi();
}

window.addEventListener("beforeunload", dondep);

// ---- Khởi động ----
khoiTaoNgonNgu();
apDungCheDoDaLuu();
if (baoVePhien()) {
  khoiTaoKetNoi();
  render();
}
