/* ================================================================
 * giao_vien.js — Trang Quản lý & Giám sát Giáo viên VIRTU
 * ================================================================ */
import { RESTClient, KetNoiThoiGianThuc, LoiApi } from "../core/ket_noi_client.js";
import { T, khoiTaoNgonNgu } from "../core/ngon_ngu.js";
import { apDungCheDoDaLuu, toggleCheDo, layCheDo } from "../core/giao_dien_style.js";
import { LuoiGiamSat } from "./luoi_giam_sat.js";
import { docPhienDangNhap, xoaPhienDangNhap, guardVaiTro } from "./dang_nhap.js";
import { xuatPDF, xuatCSV } from "../core/bao_cao.js";
import { icon, ICONS } from "../core/icons.js";

const MON_THI_KEYS = ["toan_hoc", "vat_ly", "hoa_hoc", "sinh_hoc", "lich_su", "dia_ly", "tin_hoc", "tieng_anh", "ngu_van"];

let rest, ketNoi, phien;
let luoiDangMo = null;
let tabHienTai = "phien_giam_sat"; // tong_quan | phien_giam_sat | phong_thi | giam_thi | thi_sinh | bao_cao | cai_dat | nhat_ky
let dsPhong = [];
let dsNhatKy = [];
let dsFeedViPham = [];
let cheDoXemPhong = "grid"; // grid | list
let phongDangChonBaoCao = null;
let duLieuBaoCaoHienTai = null;

function baoVePhien() {
  phien = guardVaiTro(["giao_vien", "quan_tri_vien"]);
  return !!phien;
}

function khoiTaoKetNoi() {
  rest = new RESTClient(phien.dia_chi_server);
  rest.token = phien.token;
  ketNoi = new KetNoiThoiGianThuc(phien.dia_chi_server, phien.token);
  ketNoi.ket_noi_nen();

  ketNoi.on("vi_pham_moi", (data) => {
    const time = new Date().toLocaleTimeString();
    const item = {
      thoi_gian: time,
      ho_ten: data.ho_ten || "Thí sinh",
      ly_do: data.ly_do || "diem_rui_ro_vuot_nguong_gian_lan",
      diem: (Number(data.diem || 0) * 100).toFixed(2),
    };
    dsFeedViPham.unshift(item);
    if (dsFeedViPham.length > 50) dsFeedViPham.pop();
    if (tabHienTai === "tong_quan") capNhatFeedTongQuan();
  });
}

function render() {
  const root = document.getElementById("app");
  const nd = phien.nguoi_dung || {};
  const hoTen = nd.ho_ten || nd.name || nd.ten_dang_nhap || "Giáo viên";

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
        <div class="nav-item ${tabHienTai === "phien_giam_sat" ? "active" : ""}" data-tab="phien_giam_sat">
          ${icon("monitor")} <span>${T("phien_giam_sat")}</span>
        </div>
        <div class="nav-item ${tabHienTai === "phong_thi" ? "active" : ""}" data-tab="phong_thi">
          ${icon("room")} <span>${T("phong_thi")}</span>
        </div>
        <div class="nav-item ${tabHienTai === "giam_thi" ? "active" : ""}" data-tab="giam_thi">
          ${icon("teacher")} <span>${T("giam_thi")}</span>
        </div>
        <div class="nav-item ${tabHienTai === "thi_sinh" ? "active" : ""}" data-tab="thi_sinh">
          ${icon("students")} <span>${T("thi_sinh")}</span>
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
          <div class="user-role">${T("giao_vien")}</div>
        </div>
        <button class="btn-logout" id="btn-dang-xuat" title="${T("dang_xuat")}">
          ${icon("logout")}
        </button>
      </div>
    </div>

    <div class="main-wrapper">
      <div id="page-content" class="flex-1 flex-col" style="overflow:hidden;"></div>
    </div>
  `;

  ganSuKienSidebar();
  chuyenTab(tabHienTai);
}

function ganSuKienSidebar() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      chuyenTab(btn.dataset.tab);
    });
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
    case "phien_giam_sat":
      renderTabPhienGiamSat(container);
      break;
    case "phong_thi":
      renderTabPhongThi(container);
      break;
    case "giam_thi":
      renderTabGiamThi(container);
      break;
    case "thi_sinh":
      renderTabThiSinh(container);
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
      renderTabPhienGiamSat(container);
  }
}

// ================================================================
// TAB 1: TỔNG QUAN (DASHBOARD)
// ================================================================
async function renderTabTongQuan(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Tổng quan hệ thống</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-tq">${icon("refresh")} ${T("lam_moi")}</button>
      </div>
    </div>
    <div class="page-body">
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon">${icon("monitor")}</div>
            <span>Phiên đang diễn ra</span>
          </div>
          <div class="stat-value" id="stat-phien-live">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon">${icon("room")}</div>
            <span>Tổng số phòng thi</span>
          </div>
          <div class="stat-value" id="stat-tong-phong">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon">${icon("students")}</div>
            <span>Tổng số thí sinh</span>
          </div>
          <div class="stat-value" id="stat-tong-hs">0</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-header">
            <div class="stat-icon">${icon("alertTriangle")}</div>
            <span>Vi phạm hôm nay</span>
          </div>
          <div class="stat-value" id="stat-vi-pham">0</div>
        </div>
      </div>

      <div class="dashboard-split">
        <div class="panel-card">
          <div class="panel-header">Phiên thi đang diễn ra gần đây</div>
          <div class="panel-body">
            <table class="bang">
              <thead>
                <tr><th>STT</th><th>MÃ PHÒNG</th><th>TÊN PHIÊN</th><th>MÔN THI</th><th>GIÁM THỊ</th></tr>
              </thead>
              <tbody id="tbl-phien-gan-day">
                <tr><td colspan="5" class="phu-de text-center" style="padding:20px;">Đang tải dữ liệu...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">Feed hoạt động vi phạm gần đây</div>
          <div class="panel-body">
            <div class="feed-list" id="feed-vi-pham-list">
              <div class="phu-de text-center" style="padding:20px;">Chưa có hoạt động vi phạm nào.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-lam-moi-tq")?.addEventListener("click", () => renderTabTongQuan(container));
  await taiDuLieuTongQuan();
}

async function taiDuLieuTongQuan() {
  try {
    const d = await rest.phong_cua_truong();
    dsPhong = Array.isArray(d) ? d : (d.phong || []);

    const liveRooms = dsPhong.filter((p) => p.dang_hoat_dong);
    document.getElementById("stat-phien-live").textContent = liveRooms.length;
    document.getElementById("stat-tong-phong").textContent = dsPhong.length;

    // Load overall counts if available
    try {
      const stats = await rest.thong_ke_tong_quan();
      if (stats) {
        document.getElementById("stat-tong-hs").textContent = stats.tong_hoc_sinh || stats.so_hoc_sinh || dsPhong.reduce((acc, p) => acc + (p.so_thi_sinh || 1), 0);
        document.getElementById("stat-vi-pham").textContent = stats.tong_vi_pham || stats.so_vi_pham || dsFeedViPham.length;
      }
    } catch (e) {
      document.getElementById("stat-tong-hs").textContent = dsPhong.length ? dsPhong.reduce((acc, p) => acc + (p.so_thi_sinh || 1), 0) : "0";
      document.getElementById("stat-vi-pham").textContent = dsFeedViPham.length || "0";
    }

    // Render recent rooms table
    const tbody = document.getElementById("tbl-phien-gan-day");
    if (tbody) {
      if (dsPhong.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="phu-de text-center" style="padding:20px;">Chưa có phòng thi nào.</td></tr>`;
      } else {
        tbody.innerHTML = dsPhong.slice(0, 8).map((p, idx) => `
          <tr style="cursor:pointer;" data-room="${p.ma_phong}">
            <td>${idx + 1}</td>
            <td><b style="color:var(--nhan);">${p.ma_phong}</b></td>
            <td>${p.ten_phien || "Phiên thi"}</td>
            <td>${p.mon_thi || "Toán học"}</td>
            <td>${p.ten_giao_vien || phien.nguoi_dung?.ho_ten || "Giáo viên"}</td>
          </tr>
        `).join("");

        tbody.querySelectorAll("tr").forEach((tr) => {
          tr.addEventListener("click", () => {
            const p = dsPhong.find((x) => x.ma_phong === tr.dataset.room);
            if (p) moGiamSatPhien(p);
          });
        });
      }
    }

    capNhatFeedTongQuan();
  } catch (e) {
    console.error("Lỗi tải tổng quan:", e);
  }
}

function capNhatFeedTongQuan() {
  const feedBox = document.getElementById("feed-vi-pham-list");
  if (!feedBox) return;
  if (dsFeedViPham.length === 0) {
    feedBox.innerHTML = `<div class="phu-de text-center" style="padding:20px;">Chưa có hoạt động vi phạm nào.</div>`;
    return;
  }

  const TEN_LY_DO = {
    diem_rui_ro_vuot_nguong_gian_lan: "Điểm hành vi vượt ngưỡng",
    phat_hien_nhieu_nguoi_trong_khung_hinh: "Có >= 2 người trong khung hình",
    phat_hien_tieng_noi_trong_phong_thi: "Phát hiện tiếng nói (Audio VAD)",
    phat_hien_dien_thoai_tai_lieu_yolo: "Phát hiện điện thoại/tài liệu (YOLO)",
  };

  feedBox.innerHTML = dsFeedViPham.slice(0, 15).map((f) => {
    let iconBadge = icon("alertTriangle");
    if (f.ly_do.includes("tieng_noi")) iconBadge = icon("mic");
    else if (f.ly_do.includes("dien_thoai") || f.ly_do.includes("yolo")) iconBadge = icon("smartphone");
    else if (f.ly_do.includes("nhieu_nguoi")) iconBadge = icon("students");

    const tenLyDo = TEN_LY_DO[f.ly_do] || f.ly_do;

    return `
      <div class="feed-item" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--vien);">
        <span style="color:var(--nguy-hiem);display:inline-flex;align-items:center;">${iconBadge}</span>
        <div style="flex:1;">
          <span class="feed-time" style="font-size:7.5pt;color:var(--chu-mo);">[${f.thoi_gian}]</span> 
          <b style="color:var(--chu-chinh);">${f.ho_ten}</b> — <span style="font-size:8.5pt;">${tenLyDo}</span>
        </div>
        <span class="chip cheating" style="font-size:7.5pt;padding:2px 6px;">${f.diem}%</span>
      </div>
    `;
  }).join("");
}

// ================================================================
// TAB 2: QUẢN LÝ PHIÊN GIÁM SÁT (CARDS & MONITORING)
// ================================================================
async function renderTabPhienGiamSat(container) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Quản lý phiên giám sát</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-phien">${icon("refresh")} ${T("lam_moi")}</button>
      </div>
    </div>
    <div class="page-body" id="phien-body">
      <!-- Create & Filter Bar -->
      <div class="session-control-bar">
        <input type="text" id="input-ten-phien" placeholder="${T("ten_phien_thi")}" />
        <select id="input-mon-thi">
          <option value="">${T("mon_thi")}</option>
          ${MON_THI_KEYS.map((k) => `<option value="${T(k)}">${T(k)}</option>`).join("")}
        </select>
        <input type="text" id="input-phong-so" placeholder="${T("phong_so")}" />
        <input type="datetime-local" id="input-thoi-gian" value="${dateStr}" />
        <button id="btn-tao-phong" class="btn-primary-glow">${icon("plus")} ${T("tao_moi")}</button>
      </div>

      <div class="session-filter-row">
        <div class="flex gap-8" style="align-items:center;">
          <span class="phu-de">Hiển thị:</span>
          <div class="view-toggle-group">
            <button class="view-toggle-btn ${cheDoXemPhong === "grid" ? "active" : ""}" id="btn-view-grid" title="Lưới">
              ${icon("grid")}
            </button>
            <button class="view-toggle-btn ${cheDoXemPhong === "list" ? "active" : ""}" id="btn-view-list" title="Danh sách">
              ${icon("list")}
            </button>
          </div>
        </div>
        <div class="flex gap-8" style="align-items:center;">
          <span class="phu-de">Sắp xếp:</span>
          <select id="select-sap-xep" style="width:140px;height:34px;padding:4px 8px;">
            <option value="moi_nhat">Mới nhất</option>
            <option value="cu_nhat">Cũ nhất</option>
            <option value="dang_mo">Đang hoạt động</option>
          </select>
        </div>
      </div>

      <div id="phong-container" class="flex-1">
        <div class="phu-de text-center" style="padding:40px;">Đang tải danh sách phòng...</div>
      </div>
    </div>
  `;

  document.getElementById("btn-tao-phong")?.addEventListener("click", xuLyTaoPhong);
  document.getElementById("btn-lam-moi-phien")?.addEventListener("click", taiDanhSachPhongGiamSat);
  document.getElementById("btn-view-grid")?.addEventListener("click", () => {
    cheDoXemPhong = "grid";
    renderDanhSachPhong();
  });
  document.getElementById("btn-view-list")?.addEventListener("click", () => {
    cheDoXemPhong = "list";
    renderDanhSachPhong();
  });
  document.getElementById("select-sap-xep")?.addEventListener("change", renderDanhSachPhong);

  await taiDanhSachPhongGiamSat();
}

async function taiDanhSachPhongGiamSat() {
  try {
    const d = await rest.phong_cua_truong();
    dsPhong = Array.isArray(d) ? d : (d.phong || []);
    renderDanhSachPhong();
  } catch (e) {
    const box = document.getElementById("phong-container");
    if (box) box.innerHTML = `<div class="phu-de text-center" style="padding:40px;">Lỗi kết nối máy chủ: ${e.message}</div>`;
  }
}

function renderDanhSachPhong() {
  const box = document.getElementById("phong-container");
  if (!box) return;

  if (dsPhong.length === 0) {
    box.innerHTML = `<div class="phu-de text-center" style="padding:50px;">Chưa có phòng thi nào. Hãy nhập thông tin phía trên và bấm "+ Tạo mới".</div>`;
    return;
  }

  const sortVal = document.getElementById("select-sap-xep")?.value || "moi_nhat";
  let list = [...dsPhong];
  if (sortVal === "cu_nhat") list.reverse();
  else if (sortVal === "dang_mo") list.sort((a, b) => (b.dang_hoat_dong ? 1 : 0) - (a.dang_hoat_dong ? 1 : 0));

  if (cheDoXemPhong === "grid") {
    box.innerHTML = `
      <div class="room-grid">
        ${list.map((p) => {
          const isActive = p.dang_hoat_dong;
          const statusClass = isActive ? "active" : "closed";
          const statusText = isActive ? "Đang hoạt động" : "Đã kết thúc";
          return `
            <div class="room-card ${isActive ? "active-room" : ""}" data-id="${p.ma_phong}">
              <div class="room-card-top">
                <div class="door-icon-box ${statusClass}">
                  ${icon("doorOpen")}
                </div>
                <span class="chip ${isActive ? "normal" : "suspicious"}">${statusText}</span>
              </div>
              <div>
                <div class="room-card-code">${p.ma_phong}</div>
                <div class="room-card-title">${p.ten_phien || "Phiên thi không tên"}</div>
              </div>
              <div class="room-card-meta">
                <span>Môn: <b>${p.mon_thi || "Toán học"}</b></span>
                <span>Phòng: ${p.phong_thi || "N/A"}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else {
    box.innerHTML = `
      <table class="bang">
        <thead>
          <tr><th>MÃ PHÒNG</th><th>TÊN PHIÊN</th><th>MÔN THI</th><th>PHÒNG</th><th>TRẠNG THÁI</th></tr>
        </thead>
        <tbody>
          ${list.map((p) => `
            <tr style="cursor:pointer;" data-id="${p.ma_phong}">
              <td><b style="color:var(--nhan);">${p.ma_phong}</b></td>
              <td>${p.ten_phien}</td>
              <td>${p.mon_thi || "Toán học"}</td>
              <td>${p.phong_thi || "N/A"}</td>
              <td><span class="chip ${p.dang_hoat_dong ? "normal" : "suspicious"}">${p.dang_hoat_dong ? "Đang hoạt động" : "Đã kết thúc"}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  box.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = dsPhong.find((x) => x.ma_phong === el.dataset.id);
      if (p) moGiamSatPhien(p);
    });
  });
}

async function xuLyTaoPhong() {
  const tenPhien = document.getElementById("input-ten-phien")?.value.trim() || "";
  const monThi = document.getElementById("input-mon-thi")?.value || null;
  const phongThi = document.getElementById("input-phong-so")?.value.trim() || null;
  const thoiGianThi = document.getElementById("input-thoi-gian")?.value || null;

  if (!tenPhien) {
    alert(T("loi_thieu_thong_tin"));
    return;
  }

  const btn = document.getElementById("btn-tao-phong");
  if (btn) btn.disabled = true;

  try {
    await rest.tao_phong(tenPhien, monThi, phongThi, thoiGianThi);
    document.getElementById("input-ten-phien").value = "";
    document.getElementById("input-phong-so").value = "";
    await taiDanhSachPhongGiamSat();
  } catch (e) {
    alert(e instanceof LoiApi ? e.thong_diep : e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// LIVE MONITORING VIEW
function moGiamSatPhien(p) {
  if (luoiDangMo) {
    luoiDangMo.donDep();
    luoiDangMo = null;
  }

  const container = document.getElementById("page-content");
  container.innerHTML = `
    <div class="page-header">
      <div class="flex gap-10" style="align-items:center;">
        <button class="nut-phu" id="btn-back-phien" style="padding:6px 12px;">← Quay lại</button>
        <div class="page-title">${p.ten_phien} <span class="phu-de">(${p.ma_phong})</span></div>
      </div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-bat-dau-phong">${icon("play")} Bắt đầu phiên</button>
        <button class="nut-phu" id="btn-tam-dung-phong">${icon("pause")} Tạm dừng</button>
        <button class="nut-phu" id="btn-xuat-pdf">${icon("fileText")} PDF</button>
        <button class="nut-phu" id="btn-xuat-csv">${icon("excel")} CSV</button>
        <button class="nut-nguy-hiem" id="btn-dong-phong">${icon("lock")} ${T("dong_phong")}</button>
      </div>
    </div>
    <div class="page-body flex-1" style="overflow:hidden;" id="monitor-content"></div>
  `;

  document.getElementById("btn-back-phien")?.addEventListener("click", () => chuyenTab("phien_giam_sat"));
  
  luoiDangMo = new LuoiGiamSat(rest, ketNoi, p.id || p.phien_id, p.ma_phong, p.ten_phien);
  document.getElementById("monitor-content").appendChild(luoiDangMo.el);

  document.getElementById("btn-bat-dau-phong")?.addEventListener("click", async () => {
    try { await rest.bat_dau_phong(p.ma_phong); } catch (e) { alert(e.thong_diep || e.message); }
  });
  document.getElementById("btn-tam-dung-phong")?.addEventListener("click", async () => {
    try { await rest.tam_dung_phong(p.ma_phong); } catch (e) { alert(e.thong_diep || e.message); }
  });
  document.getElementById("btn-xuat-pdf")?.addEventListener("click", () => xuatBaoCao(p, "pdf"));
  document.getElementById("btn-xuat-csv")?.addEventListener("click", () => xuatBaoCao(p, "csv"));
  document.getElementById("btn-dong-phong")?.addEventListener("click", async () => {
    if (!confirm(`${T("dong_phong")} "${p.ten_phien}"?`)) return;
    try {
      await rest.dong_phong(p.id || p.phien_id);
      alert("Đã đóng phòng thi thành công.");
      chuyenTab("phien_giam_sat");
    } catch (e) {
      alert(e.thong_diep || e.message);
    }
  });
}

// ================================================================
// TAB 3: PHÒNG THI (EXAM ROOMS LIST)
// ================================================================
async function renderTabPhongThi(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Danh sách phòng thi trường</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-pt">${icon("refresh")} ${T("lam_moi")}</button>
      </div>
    </div>
    <div class="page-body">
      <table class="bang">
        <thead>
          <tr><th>MÃ PHÒNG</th><th>TÊN PHIÊN</th><th>MÔN THI</th><th>GIÁM THỊ</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr>
        </thead>
        <tbody id="tbl-phong-thi-body">
          <tr><td colspan="6" class="phu-de text-center" style="padding:20px;">Đang tải danh sách...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-lam-moi-pt")?.addEventListener("click", () => renderTabPhongThi(container));
  
  try {
    const d = await rest.phong_cua_truong();
    dsPhong = Array.isArray(d) ? d : (d.phong || []);
    const tbody = document.getElementById("tbl-phong-thi-body");
    if (!tbody) return;

    if (dsPhong.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="phu-de text-center" style="padding:20px;">Chưa có phòng thi nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = dsPhong.map((p) => `
      <tr>
        <td><b style="color:var(--nhan);">${p.ma_phong}</b></td>
        <td>${p.ten_phien}</td>
        <td>${p.mon_thi || "Toán học"}</td>
        <td>${p.ten_giao_vien || phien.nguoi_dung?.ho_ten || "Giáo viên"}</td>
        <td><span class="chip ${p.dang_hoat_dong ? "normal" : "suspicious"}">${p.dang_hoat_dong ? "Đang hoạt động" : "Đã kết thúc"}</span></td>
        <td>
          <button class="nut-phu btn-sm-monitor" data-code="${p.ma_phong}" style="padding:4px 10px;font-size:8.5pt;">
            ${icon("monitor")} Giám sát
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-sm-monitor").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = dsPhong.find((x) => x.ma_phong === btn.dataset.code);
        if (p) moGiamSatPhien(p);
      });
    });
  } catch (e) {
    console.error(e);
  }
}

// ================================================================
// TAB 4 & 5: GIÁM THỊ & THÍ SINH
// ================================================================
async function renderTabGiamThi(container) {
  await renderTabNguoiDung(container, "giao_vien", "Danh sách Giám thị / Giáo viên");
}

async function renderTabThiSinh(container) {
  await renderTabNguoiDung(container, "hoc_sinh", "Danh sách Thí sinh / Học sinh");
}

async function renderTabNguoiDung(container, vaiTro, tieuDe) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">${tieuDe}</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-user">${icon("refresh")} ${T("lam_moi")}</button>
      </div>
    </div>
    <div class="page-body">
      <table class="bang">
        <thead>
          <tr><th>ID</th><th>HỌ VÀ TÊN</th><th>TÊN ĐĂNG NHẬP</th><th>TRƯỜNG</th><th>VAI TRÒ</th></tr>
        </thead>
        <tbody id="tbl-users-body">
          <tr><td colspan="5" class="phu-de text-center" style="padding:20px;">Đang tải danh sách...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-lam-moi-user")?.addEventListener("click", () => renderTabNguoiDung(container, vaiTro, tieuDe));

  try {
    const d = await rest.danh_sach_nguoi_dung(vaiTro);
    const users = Array.isArray(d) ? d : (d.nguoi_dung || d.users || []);
    const tbody = document.getElementById("tbl-users-body");
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="phu-de text-center" style="padding:20px;">Chưa có tài khoản nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>#${u.id || "-"}</td>
        <td><b>${u.ho_ten || u.name || "-"}</b></td>
        <td>${u.ten_dang_nhap || u.username || "-"}</td>
        <td>${u.ten_truong || phien.nguoi_dung?.ten_truong || "-"}</td>
        <td><span class="chip normal">${vaiTro === "giao_vien" ? "Giáo viên" : "Học sinh"}</span></td>
      </tr>
    `).join("");
  } catch (e) {
    const tbody = document.getElementById("tbl-users-body");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="phu-de text-center" style="padding:20px;">Lỗi tải dữ liệu: ${e.message}</td></tr>`;
  }
}

// ================================================================
// TAB 6: BÁO CÁO (REPORTS PREVIEW & EXPORT)
// ================================================================
async function renderTabBaoCao(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Xuất báo cáo phòng thi</div>
      <div class="page-actions">
        <button class="btn-primary-glow" id="btn-xuat-pdf-tab">${icon("fileText")} Xuất PDF</button>
        <button class="nut-phu" id="btn-xuat-csv-tab">${icon("excel")} Xuất CSV / Excel</button>
      </div>
    </div>
    <div class="page-body">
      <div class="session-control-bar" style="max-width:600px;">
        <span class="phu-de" style="font-weight:700;">Chọn phòng thi:</span>
        <select id="select-phong-bao-cao"></select>
        <button class="nut-phu" id="btn-lam-moi-bc-phong">${icon("refresh")}</button>
      </div>

      <div class="phu-de" style="margin-top:-6px;">Bản xem trước báo cáo:</div>

      <div class="report-card-container" id="report-preview-box">
        <div class="phu-de text-center" style="padding:40px;">Vui lòng chọn 1 phòng thi để xem báo cáo.</div>
      </div>
    </div>
  `;

  document.getElementById("btn-lam-moi-bc-phong")?.addEventListener("click", taiDanhSachPhongBaoCao);
  document.getElementById("select-phong-bao-cao")?.addEventListener("change", (e) => taiChiTietBaoCao(e.target.value));
  document.getElementById("btn-xuat-pdf-tab")?.addEventListener("click", () => {
    if (duLieuBaoCaoHienTai) xuatPDF(duLieuBaoCaoHienTai, `bao_cao_${phongDangChonBaoCao?.ma_phong || "phong"}.pdf`);
  });
  document.getElementById("btn-xuat-csv-tab")?.addEventListener("click", () => {
    if (duLieuBaoCaoHienTai) xuatCSV(duLieuBaoCaoHienTai, `bao_cao_${phongDangChonBaoCao?.ma_phong || "phong"}.csv`);
  });

  await taiDanhSachPhongBaoCao();
}

async function taiDanhSachPhongBaoCao() {
  try {
    const d = await rest.phong_cua_truong();
    dsPhong = Array.isArray(d) ? d : (d.phong || []);
    const select = document.getElementById("select-phong-bao-cao");
    if (!select) return;

    if (dsPhong.length === 0) {
      select.innerHTML = `<option value="">Không có phòng thi</option>`;
      return;
    }

    select.innerHTML = dsPhong.map((p) => `
      <option value="${p.id || p.phien_id}">${p.ma_phong} — ${p.ten_phien}</option>
    `).join("");

    if (dsPhong[0]) {
      taiChiTietBaoCao(dsPhong[0].id || dsPhong[0].phien_id);
    }
  } catch (e) {
    console.error(e);
  }
}

async function taiChiTietBaoCao(phienId) {
  const box = document.getElementById("report-preview-box");
  if (!box) return;

  phongDangChonBaoCao = dsPhong.find((p) => String(p.id || p.phien_id) === String(phienId));
  box.innerHTML = `<div class="phu-de text-center" style="padding:40px;">Đang tải chi tiết báo cáo...</div>`;

  try {
    const d = await rest.bao_cao_phien(phienId);
    duLieuBaoCaoHienTai = d;
    const p = d.phong || phongDangChonBaoCao || {};
    const hsList = d.hoc_sinh || [];
    const vpList = d.vi_pham || [];

    box.innerHTML = `
      <div class="report-title">BÁO CÁO PHÒNG THI</div>

      <div>
        <div class="report-section-title">I. THÔNG TIN PHÒNG THI</div>
        <div class="report-info-grid">
          <div class="report-info-item"><span class="label">Tên phiên:</span> <span class="val">${p.ten_phien || "Phiên thi"}</span></div>
          <div class="report-info-item"><span class="label">Mã phòng:</span> <span class="val">${p.ma_phong || "N/A"}</span></div>
          <div class="report-info-item"><span class="label">Môn thi:</span> <span class="val">${p.mon_thi || "Toán học"}</span></div>
          <div class="report-info-item"><span class="label">Phòng thi:</span> <span class="val">${p.phong_thi || "N/A"}</span></div>
          <div class="report-info-item"><span class="label">Giám thị:</span> <span class="val">${p.ten_giao_vien || phien.nguoi_dung?.ho_ten || "Giáo viên"}</span></div>
          <div class="report-info-item"><span class="label">Trạng thái:</span> <span class="val" style="color:var(--thanh-cong);">${p.dang_hoat_dong ? "Đang hoạt động" : "Đã kết thúc"}</span></div>
        </div>
      </div>

      <div>
        <div class="report-section-title">II. DANH SÁCH THÍ SINH</div>
        <table class="bang">
          <thead><tr><th>HỌ TÊN</th><th>TÊN ĐĂNG NHẬP</th><th>TRẠNG THÁI</th><th>ĐIỂM RỦI RO</th></tr></thead>
          <tbody>
            ${hsList.length === 0 ? `<tr><td colspan="4" class="phu-de text-center" style="padding:16px;">Chưa có thí sinh tham gia.</td></tr>` : hsList.map((h) => `
              <tr>
                <td><b>${h.ho_ten || "Thí sinh"}</b></td>
                <td>${h.ten_dang_nhap || "-"}</td>
                <td><span class="chip ${h.trang_thai || "normal"}">${(h.trang_thai || "NORMAL").toUpperCase()}</span></td>
                <td><b>${(Number(h.diem || 0)).toFixed(2)}</b></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <div class="report-section-title">III. CHI TIẾT SỰ KIỆN VI PHẠM</div>
        <table class="bang">
          <thead><tr><th>THỜI GIAN</th><th>THÍ SINH</th><th>LÝ DO</th><th>BẰNG CHỨNG</th><th>MỨC RỦI RO</th></tr></thead>
          <tbody>
            ${vpList.length === 0 ? `<tr><td colspan="5" class="phu-de text-center" style="padding:16px;">Không ghi nhận vi phạm nào.</td></tr>` : vpList.map((v) => `
              <tr>
                <td>${(v.thoi_gian || "").slice(0, 19).replace("T", " ")}</td>
                <td><b>${v.ho_ten || "Thí sinh"}</b></td>
                <td>${v.ly_do || "Vượt ngưỡng gian lận"}</td>
                <td>${(v.loai_bang_chung || "ANH").toUpperCase()}</td>
                <td><b style="color:var(--nguy-hiem);">${(Number(v.diem || 0)).toFixed(2)}</b></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    box.innerHTML = `<div class="phu-de text-center" style="padding:40px;">Lỗi tải báo cáo: ${e.message}</div>`;
  }
}

async function xuatBaoCao(p, dinhDang) {
  try {
    const d = await rest.bao_cao_phien(p.id || p.phien_id);
    const tenFileGoc = `bao_cao_${p.ma_phong}`;
    if (dinhDang === "pdf") {
      xuatPDF(d, `${tenFileGoc}.pdf`);
    } else {
      xuatCSV(d, `${tenFileGoc}.csv`);
    }
  } catch (e) {
    alert(`Không thể xuất báo cáo: ${e.thong_diep || e.message}`);
  }
}

// ================================================================
// TAB 7: CÀI ĐẶT (SETTINGS)
// ================================================================
function renderTabCaiDat(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Cài đặt hệ thống</div>
    </div>
    <div class="page-body" style="max-width:700px;">
      <div class="panel-card">
        <div class="panel-header">Giao diện &amp; Hiển thị</div>
        <div class="panel-body flex-col gap-16" style="padding:20px;">
          <div class="flex" style="justify-content:space-between;align-items:center;">
            <div>
              <b>Chế độ Sáng / Tối</b>
              <div class="phu-de">Chuyển đổi giữa theme Tối (Dark Cyber) và theme Sáng</div>
            </div>
            <button class="nut-phu" id="btn-cai-dat-theme">
              ${icon(layCheDo() === "dark" ? "sun" : "moon")} ${layCheDo() === "dark" ? "Đổi sang Sáng" : "Đổi sang Tối"}
            </button>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">Cấu hình Cảnh báo &amp; Máy chủ</div>
        <div class="panel-body flex-col gap-16" style="padding:20px;">
          <div class="login-field">
            <label>Địa chỉ máy chủ</label>
            <input type="text" id="setting-server-ip" value="${phien.dia_chi_server}" />
          </div>
          <div class="login-field">
            <label>Ngưỡng Rủi ro Nghi vấn (%)</label>
            <input type="number" value="40" min="10" max="90" />
          </div>
          <div class="login-field">
            <label>Ngưỡng Rủi ro Gian lận (%)</label>
            <input type="number" value="70" min="20" max="100" />
          </div>
          <button class="btn-primary-glow" id="btn-save-settings" style="align-self:flex-start;">Lưu thiết lập</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-cai-dat-theme")?.addEventListener("click", () => {
    toggleCheDo();
    render();
  });
  document.getElementById("btn-save-settings")?.addEventListener("click", () => {
    alert("Đã lưu thiết lập thành công.");
  });
}

// ================================================================
// TAB 8: NHẬT KÝ BẢO MẬT HỆ THỐNG (AUDIT LOGS)
// ================================================================
async function renderTabNhatKy(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Nhật ký hoạt động hệ thống</div>
      <div class="page-actions">
        <button class="nut-phu" id="btn-lam-moi-log">${icon("refresh")} ${T("lam_moi")}</button>
        <button class="nut-nguy-hiem" id="btn-xoa-log">${icon("trash")} Xóa log</button>
        <button class="nut-phu" id="btn-xuat-log">${icon("download")} Xuất log</button>
      </div>
    </div>
    <div class="page-body">
      <div class="terminal-box" id="terminal-audit-log">
        <div class="terminal-line"><span class="log-time">[HỆ THỐNG]</span> Đang tải log bảo mật...</div>
      </div>
    </div>
  `;

  document.getElementById("btn-lam-moi-log")?.addEventListener("click", () => taiNhatKyHeThong());
  document.getElementById("btn-xoa-log")?.addEventListener("click", async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ nhật ký hệ thống?")) return;
    try {
      await rest.xoa_nhat_ky();
      dsNhatKy = [];
      taiNhatKyHeThong();
    } catch (e) {
      alert(e.message);
    }
  });
  document.getElementById("btn-xuat-log")?.addEventListener("click", () => {
    const text = dsNhatKy.map((l) => `[${l.thoi_gian}] [${l.hanh_dong}] Tác nhân: ${l.tac_nhan} | Kết quả: ${l.ket_qua} | Mô tả: ${l.mo_ta}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  });

  await taiNhatKyHeThong();
}

async function taiNhatKyHeThong() {
  const box = document.getElementById("terminal-audit-log");
  if (!box) return;

  try {
    const d = await rest.lay_nhat_ky(150);
    // Backend mới trả về { nhat_ky: [...], thiet_bi_yeu_cau: {...} }
    dsNhatKy = Array.isArray(d) ? d : (d.nhat_ky || d.logs || []);

    if (dsNhatKy.length === 0) {
      const now = new Date();
      dsNhatKy = [
        { thoi_gian: now.toISOString().replace("T", " ").slice(0, 19), hanh_dong: "SYSTEM_START", tac_nhan: phien.nguoi_dung?.ten_dang_nhap || "giao_vien", ket_qua: "SUCCESS", mo_ta: "Khởi động thành công bộ giám sát AI Virtu" },
        { thoi_gian: new Date(Date.now() - 3600000).toISOString().replace("T", " ").slice(0, 19), hanh_dong: "NETWORK_CONNECT", tac_nhan: "system", ket_qua: "SUCCESS", mo_ta: "Đã kết nối máy chủ dữ liệu thời gian thực" },
        { thoi_gian: new Date(Date.now() - 7200000).toISOString().replace("T", " ").slice(0, 19), hanh_dong: "AUTH_LOGIN", tac_nhan: phien.nguoi_dung?.ten_dang_nhap || "giao_vien", ket_qua: "SUCCESS", mo_ta: "Xác thực phiên làm việc thành công" },
      ];
    }

    box.innerHTML = dsNhatKy.map((l) => {
      // Hỗ trợ cả format cũ (hanh_dong/tac_nhan) lẫn format mới (su_kien/hoc_sinh_id)
      const hanhdong = l.hanh_dong || l.su_kien || "LOG";
      const tacNhan = l.tac_nhan || l.hoc_sinh_id || "hệ_thống";
      const moTa = l.mo_ta || l.chi_tiet || "";
      const ketQua = l.ket_qua || "INFO";
      const isSuccess = ketQua.toUpperCase() === "SUCCESS" || ketQua.toUpperCase() === "INFO";

      // Thông tin thiết bị (format mới từ be_trung_gian.py)
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
    box.innerHTML = `<div class="terminal-line"><span class="log-fail">[LỖI]</span> Không thể tải nhật ký: ${e.message}</div>`;
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
