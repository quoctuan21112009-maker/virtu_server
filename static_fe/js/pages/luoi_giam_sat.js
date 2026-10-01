/* ================================================================
 * luoi_giam_sat.js — Widget Lưới Giám Sát Phòng Thi Realtime
 * ================================================================ */
import { OVuongHocSinh } from "./o_vuong_hoc_sinh.js";
import { HopThoaiXemBangChung } from "./xem_bang_chung_vi_pham.js";
import { T } from "../core/ngon_ngu.js";
import { icon } from "../core/icons.js";

const TEN_LY_DO_HIEN_THI = {
  diem_rui_ro_vuot_nguong_gian_lan: "điểm hành vi vượt ngưỡng",
  phat_hien_nhieu_nguoi_trong_khung_hinh: "phát hiện ≥2 người trong khung hình",
};

export class LuoiGiamSat {
  constructor(rest, ketNoi, phienId, maPhong, tenPhien = "") {
    this.rest = rest;
    this.ket_noi = ketNoi;
    this.phien_id = phienId;
    this.ma_phong = maPhong;
    this.ten_phien = tenPhien;

    this.o_vuong = new Map(); // hoc_sinh_id -> OVuongHocSinh
    this._dialogDangMo = new Map(); // hoc_sinh_id -> HopThoaiXemBangChung
    this._handlers = [];

    this.el = document.createElement("div");
    this.el.className = "luoi-giam-sat-wrap";
    this._layout();
    this._ketNoiRealtime();
    this._taiDanhSachBanDau();
    this._taiViPhamBanDau();
  }

  _layout() {
    this.el.innerHTML = `
      <div class="luoi-cot-trai">
        <div class="flex" style="justify-content:space-between;align-items:center;">
          <span class="phu-de">Bấm vào ô học sinh để xem chi tiết ảnh/video bằng chứng</span>
          <div class="legend-row">
            <span class="chip normal">● Bình thường</span>
            <span class="chip suspicious">● Nghi vấn</span>
            <span class="chip cheating">● Gian lận</span>
          </div>
        </div>
        <div class="luoi-scroll">
          <div class="luoi-grid" id="luoi-grid"></div>
        </div>
      </div>
      <div class="khung-phai">
        <div class="panel-header" style="padding:0 0 10px 0;border-bottom:1px solid var(--vien);">
          <span>Nhật ký vi phạm phòng</span>
        </div>
        <div id="ds-nhat-ky" class="danh-sach scroll-y flex-1" style="background:var(--nen-input);border:1px solid var(--vien);border-radius:10px;padding:6px;">
          <div class="phu-de text-center" style="padding:20px;">Chưa ghi nhận vi phạm.</div>
        </div>
      </div>
    `;
    this._luoiGrid = this.el.querySelector("#luoi-grid");
    this._dsNhatKy = this.el.querySelector("#ds-nhat-ky");
  }

  _on(ten, cb) {
    const h = this.ket_noi.on(ten, cb);
    this._handlers.push([ten, h]);
  }

  _ketNoiRealtime() {
    this.ket_noi.vao_phong_giam_sat(this.ma_phong);
    this._on("trang_thai_hoc_sinh", (d) => this._khiCapNhatTrangThai(d));
    this._on("hoc_sinh_vao_phong", (d) => this._khiHocSinhVao(d));
    this._on("hoc_sinh_mat_ket_noi", (d) => this._khiHocSinhMatKetNoi(d));
    this._on("vi_pham_moi", (d) => this._khiCoViPham(d));
  }

  donDep() {
    this.ket_noi.roi_phong_giam_sat(this.ma_phong);
    this._handlers.forEach(([ten, h]) => this.ket_noi.off(ten, h));
    this._handlers = [];
    this._dialogDangMo.forEach((dlg) => dlg.dong());
    this._dialogDangMo.clear();
  }

  async _taiDanhSachBanDau() {
    let thongTin;
    try {
      thongTin = await this.rest.thong_tin_phong(this.ma_phong);
    } catch (e) {
      return;
    }
    (thongTin.hoc_sinh || []).forEach((hs) => {
      const o = this._themOVuong(hs.hoc_sinh_id || hs.id, hs.ho_ten);
      o.capNhatTrangThai(hs.trang_thai || "normal", hs.diem || 0.0);
      if (hs.con_ket_noi === false) o.datMatKetNoi();
    });
  }

  async _taiViPhamBanDau() {
    let ds;
    try {
      ds = await this.rest.vi_pham_theo_phong(this.phien_id);
    } catch (e) {
      return;
    }
    const items = [...(ds.vi_pham || [])].reverse();
    if (items.length > 0) this._dsNhatKy.innerHTML = "";
    items.forEach((v) => {
      this._themDongViPham(v.ho_ten, v.diem, v.ly_do, v.loai_bang_chung || "anh");
    });
  }

  _themOVuong(hocSinhId, hoTen) {
    if (this.o_vuong.has(hocSinhId)) return this.o_vuong.get(hocSinhId);
    const o = new OVuongHocSinh(hocSinhId, hoTen, {
      onBam: (id) => this._khiBamOVuong(id),
      onYeuCauPause: (id) => this._khiPauseHocSinh(id),
      onYeuCauTiepTuc: (id) => this._khiTiepTucHocSinh(id),
      onYeuCauReset: (id) => this._khiResetHocSinh(id),
    });
    this._luoiGrid.appendChild(o.el);
    this.o_vuong.set(hocSinhId, o);
    return o;
  }

  _khiHocSinhVao(data) {
    this._themOVuong(data.hoc_sinh_id || data.id, data.ho_ten || `HS-${data.hoc_sinh_id || data.id}`);
  }

  _khiCapNhatTrangThai(data) {
    const hocSinhId = data.hoc_sinh_id || data.id;
    const o = this._themOVuong(hocSinhId, data.ho_ten || `HS-${hocSinhId}`);
    o.capNhatTrangThai(data.nhan || "normal", parseFloat(data.diem || 0));
  }

  _khiHocSinhMatKetNoi(data) {
    const o = this.o_vuong.get(data.hoc_sinh_id || data.id);
    if (o) o.datMatKetNoi();
  }

  _khiCoViPham(data) {
    const lyDo = data.ly_do || "";
    this._themDongViPham(data.ho_ten || "?", data.diem || 0, lyDo, data.loai_bang_chung || "anh");
    if (lyDo.includes("SPEECH_DETECTED") || lyDo.includes("tieng_on")) {
      const o = this._themOVuong(data.hoc_sinh_id || data.id, data.ho_ten || "?");
      o.hienThiIconAmThanh(true);
    }
  }

  _themDongViPham(hoTen, diem, lyDo, loaiBangChung = "anh") {
    const lyDoHienThi = TEN_LY_DO_HIEN_THI[lyDo] || lyDo;
    if (this._dsNhatKy.querySelector(".text-center")) {
      this._dsNhatKy.innerHTML = "";
    }
    const item = document.createElement("div");
    item.className = "feed-item";
    item.style.marginBottom = "6px";
    item.innerHTML = `<b>${hoTen}</b> — Điểm: <span class="feed-score">${Number(diem).toFixed(1)}</span><br><span style="color:var(--chu-phu);font-size:8pt;">${lyDoHienThi}</span>`;
    this._dsNhatKy.insertBefore(item, this._dsNhatKy.firstChild);
  }

  _khiBamOVuong(hocSinhId) {
    const o = this.o_vuong.get(hocSinhId);
    if (!o) return;
    if (this._dialogDangMo.has(hocSinhId)) {
      this._dialogDangMo.get(hocSinhId).raise_();
      return;
    }
    const dlg = new HopThoaiXemBangChung(this.rest, this.phien_id, hocSinhId, o.ho_ten, {
      onDong: () => this._dialogDangMo.delete(hocSinhId),
    });
    this._dialogDangMo.set(hocSinhId, dlg);
    dlg.show();
  }

  async _khiPauseHocSinh(hocSinhId) {
    try {
      await this.rest.tam_dung_hoc_sinh(this.ma_phong, hocSinhId);
    } catch (e) {
      alert(`Không thể tạm dừng:\n${e.thong_diep || e.message}`);
    }
  }

  async _khiTiepTucHocSinh(hocSinhId) {
    try {
      await this.rest.tiep_tuc_hoc_sinh(this.ma_phong, hocSinhId);
    } catch (e) {
      alert(`Không thể tiếp tục:\n${e.thong_diep || e.message}`);
    }
  }

  async _khiResetHocSinh(hocSinhId) {
    try {
      await this.rest.reset_hoc_sinh(this.ma_phong, hocSinhId, "Giáo viên yêu cầu hiệu chỉnh lại");
    } catch (e) {
      alert(`Không thể reset:\n${e.thong_diep || e.message}`);
    }
  }
}
