/* ================================================================
 * xem_bang_chung_vi_pham.js — Dialog xem bằng chứng vi phạm
 * ================================================================ */
import { LoiApi } from "../core/ket_noi_client.js";
import { T } from "../core/ngon_ngu.js";
import { icon } from "../core/icons.js";

const TEN_LY_DO_HIEN_THI = {
  diem_rui_ro_vuot_nguong_gian_lan: "Điểm hành vi vượt ngưỡng gian lận",
  phat_hien_nhieu_nguoi_trong_khung_hinh: "Phát hiện >=2 người trong khung hình",
  phat_hien_tieng_noi_trong_phong_thi: "Phát hiện tiếng nói trong phòng thi (Audio VAD)",
  phat_hien_dien_thoai_tai_lieu_yolo: "Phát hiện điện thoại / tài liệu (YOLO AI)",
  khong_thay_khuon_mat: "Không nhận diện được khuôn mặt thí sinh",
  quay_dau_khoi_man_hinh: "Nghi vấn quay đầu / nhìn sang hướng khác",
};

export class HopThoaiXemBangChung {
  constructor(rest, phienId, hocSinhId, hoTen, { onDong } = {}) {
    this.rest = rest;
    this.phien_id = phienId;
    this.hoc_sinh_id = hocSinhId;
    this.ho_ten = hoTen;
    this._onDong = onDong;

    this._cache = new Map(); // vi_pham_id -> Blob
    this._objectUrls = new Map(); // vi_pham_id -> Object URL
    this._dsViPham = [];
    this._dangTaiNgam = false;
    this._huyTaiNgam = false;

    this._layoutDialog();
    this._taiDanhSach();
  }

  _layoutDialog() {
    this.overlay = document.createElement("div");
    this.overlay.className = "overlay-nen";
    this.overlay.innerHTML = `
      <div class="hop-thoai" style="width:920px;">
        <div class="flex-col gap-16">
          <div class="flex" style="justify-content:space-between;align-items:center;">
            <h2 class="tieu-de" style="font-size:14pt;">Bằng chứng vi phạm — <b>${this._escape(this.ho_ten)}</b></h2>
            <button class="nut-icon" id="btn-close-bc-top">${icon("close")}</button>
          </div>

          <div id="thanh-tien-do" class="progress hidden" style="height:14px;border-radius:6px;background:var(--nen-input);overflow:hidden;position:relative;">
            <div class="chunk" style="width:0%;height:100%;background:linear-gradient(90deg,var(--nhan),var(--gradient-2));transition:width .2s;"></div>
            <div class="label" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:7.5pt;font-weight:700;color:#fff;">0/0</div>
          </div>

          <div class="flex gap-16" style="height:440px;">
            <div class="flex-col gap-8" style="width:340px;">
              <span style="font-size:8pt;font-weight:700;color:var(--chu-mo);letter-spacing:1px;">DANH SÁCH SỰ KIỆN</span>
              <div id="ds-su-kien" class="danh-sach scroll-y flex-1" style="background:var(--nen-input);border:1px solid var(--vien);border-radius:10px;padding:6px;"></div>
              <button class="nut-phu" id="btn-lam-moi-bc">${icon("refresh")} ${T("lam_moi")}</button>
            </div>

            <div class="flex-col gap-8 flex-1">
              <span style="font-size:8pt;font-weight:700;color:var(--chu-mo);letter-spacing:1px;">XEM TRƯỚC BẰNG CHỨNG</span>

              <div id="the-thong-tin" class="hidden" style="padding:10px 14px;background:var(--nen-input);border:1px solid var(--vien);border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                <span id="lbl-thoi-gian" class="phu-de">Thời gian: —</span>
                <span id="lbl-diem-rui-ro" style="font-weight:700;color:var(--nguy-hiem);">Mức độ rủi ro: —</span>
              </div>

              <div id="khung-xem-truoc" class="flex-1 center" style="background:var(--nen-terminal);border:1px solid var(--vien);border-radius:12px;color:var(--chu-mo);overflow:hidden;display:flex;position:relative;">
                <span id="nhan-xem-truoc">Chọn 1 sự kiện ở danh sách bên trái để xem chi tiết</span>
                <img id="anh-xem-truoc" class="hidden" style="max-width:100%;max-height:100%;object-fit:contain;" />
                <video id="video-xem-truoc" class="hidden" controls style="max-width:100%;max-height:100%;"></video>
              </div>

              <button id="btn-mo-video" class="hidden btn-primary-glow" style="min-height:38px;">Mở video bằng cửa sổ riêng</button>
            </div>
          </div>

          <div class="flex gap-8" style="justify-content:flex-end;">
            <button class="nut-phu" id="btn-dong-bc">${T("dong")}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.overlay.querySelector("#btn-dong-bc").addEventListener("click", () => this.dong());
    this.overlay.querySelector("#btn-close-bc-top").addEventListener("click", () => this.dong());
    this.overlay.querySelector("#btn-lam-moi-bc").addEventListener("click", () => this._taiDanhSach());
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.dong();
    });
  }

  _escape(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async _taiDanhSach() {
    const dsEl = this.overlay.querySelector("#ds-su-kien");
    dsEl.innerHTML = "";
    this._cache.clear();
    this._huyTaiNgam = true;

    let d;
    try {
      d = await this.rest.vi_pham_theo_hoc_sinh(this.phien_id, this.hoc_sinh_id);
    } catch (e) {
      dsEl.innerHTML = `<div class="phu-de text-center" style="padding:20px;">Không tải được danh sách: ${e.thong_diep || e.message}</div>`;
      return;
    }

    const ds = d.vi_pham || [];
    this._dsViPham = ds;
    if (ds.length === 0) {
      dsEl.innerHTML = `<div class="phu-de text-center" style="padding:20px;">Chưa có vi phạm nào được ghi nhận.</div>`;
      return;
    }

    ds.forEach((v) => {
      const lyDoHienThi = TEN_LY_DO_HIEN_THI[v.ly_do] || v.ly_do;
      const loai = v.loai_bang_chung === "anh" ? "Ảnh" : "Video";
      const kichThuocKb = (v.kich_thuoc_byte || 1024) / 1024;
      const thoiGian = (v.thoi_gian || "").replace("T", " ").slice(0, 19);
      const isHigh = (v.diem || 0) >= 0.7 || (v.diem || 0) >= 70;
      let badgeLoai = `<span class="chip ${chipClass}">[${loai}]</span>`;
      if (v.ly_do === "phat_hien_tieng_noi_trong_phong_thi") {
        badgeLoai = `<span class="chip cheating" style="display:inline-flex;align-items:center;gap:4px;">${icon("mic")} Audio</span>`;
      } else if (v.ly_do === "phat_hien_dien_thoai_tai_lieu_yolo") {
        badgeLoai = `<span class="chip cheating" style="display:inline-flex;align-items:center;gap:4px;">${icon("smartphone")} YOLO</span>`;
      } else if (v.loai_bang_chung === "video") {
        badgeLoai = `<span class="chip cheating" style="display:inline-flex;align-items:center;gap:4px;">${icon("videoCamera")} Video</span>`;
      }

      const muc = document.createElement("div");
      muc.className = "muc";
      muc.style.padding = "8px 10px";
      muc.style.borderBottom = "1px solid var(--vien)";
      muc.style.cursor = "pointer";
      muc.innerHTML = `
        <div class="flex" style="justify-content:space-between;align-items:center;">
          ${badgeLoai}
          <span style="font-size:8pt;color:var(--chu-mo);">${thoiGian.slice(11)}</span>
        </div>
        <div style="font-size:8.5pt;font-weight:600;margin-top:4px;color:var(--chu-chinh);">${lyDoHienThi}</div>
        <div class="flex" style="justify-content:space-between;font-size:8pt;color:var(--chu-phu);margin-top:2px;">
          <span>Rủi ro: <b style="color:${colorDiem};">${Number(v.diem || 0).toFixed(1)}</b></span>
          <span>${kichThuocKb.toFixed(0)} KB</span>
        </div>
      `;
      muc.addEventListener("click", () => {
        dsEl.querySelectorAll(".muc").forEach((m) => m.classList.remove("chon"));
        muc.classList.add("chon");
        this._khiChonMuc(v);
      });
      dsEl.appendChild(muc);
    });

    this._batDauTaiNgam(ds);
  }

  _batDauTaiNgam(ds) {
    this._huyTaiNgam = false;
    const progEl = this.overlay.querySelector("#thanh-tien-do");
    const chunkEl = progEl.querySelector(".chunk");
    const labelEl = progEl.querySelector(".label");
    progEl.classList.remove("hidden");
    chunkEl.style.width = "0%";

    const tong = ds.length;
    let daTai = 0;

    const taiTuanTu = async () => {
      for (const v of ds) {
        if (this._huyTaiNgam) return;
        try {
          const buf = await this.rest.tai_du_lieu_bang_chung(v.id);
          if (this._huyTaiNgam) return;
          const mime = v.loai_bang_chung === "anh" ? "image/jpeg" : "video/mp4";
          this._cache.set(v.id, new Blob([buf], { type: mime }));
        } catch (e) {
          console.error(`[LỖI] Không tải được vi phạm #${v.id}:`, e);
        }
        daTai += 1;
        chunkEl.style.width = `${(daTai / tong) * 100}%`;
        labelEl.textContent = `Đang nạp vào bộ nhớ: ${daTai}/${tong}`;
      }
      if (!this._huyTaiNgam) {
        labelEl.textContent = "Đã nạp toàn bộ bằng chứng vào RAM";
        chunkEl.style.width = "100%";
        setTimeout(() => progEl.classList.add("hidden"), 2000);
      }
    };

    taiTuanTu();
  }

  async _khiChonMuc(v) {
    const nutMoVideo = this.overlay.querySelector("#btn-mo-video");
    const nhanXemTruoc = this.overlay.querySelector("#nhan-xem-truoc");
    const anhXemTruoc = this.overlay.querySelector("#anh-xem-truoc");
    const videoXemTruoc = this.overlay.querySelector("#video-xem-truoc");
    const theThongTin = this.overlay.querySelector("#the-thong-tin");

    nutMoVideo.classList.add("hidden");
    anhXemTruoc.classList.add("hidden");
    videoXemTruoc.classList.add("hidden");
    nhanXemTruoc.classList.remove("hidden");
    nhanXemTruoc.textContent = "Đang tải dữ liệu...";
    theThongTin.classList.remove("hidden");

    const thoiGian = (v.thoi_gian || "").replace("T", " ").slice(0, 19);
    this.overlay.querySelector("#lbl-thoi-gian").textContent = `Thời gian: ${thoiGian}`;
    this.overlay.querySelector("#lbl-diem-rui-ro").textContent = `Mức độ rủi ro: ${Number(v.diem || 0).toFixed(1)}`;

    let blob = this._cache.get(v.id);
    if (!blob) {
      try {
        const buf = await this.rest.tai_du_lieu_bang_chung(v.id);
        const mime = v.loai_bang_chung === "anh" ? "image/jpeg" : "video/mp4";
        blob = new Blob([buf], { type: mime });
        this._cache.set(v.id, blob);
      } catch (e) {
        nhanXemTruoc.textContent = e instanceof LoiApi ? e.thong_diep : `Lỗi tải: ${e.message}`;
        return;
      }
    }

    this._hienThiDuLieu(v, blob);
  }

  _hienThiDuLieu(v, blob) {
    const nutMoVideo = this.overlay.querySelector("#btn-mo-video");
    const nhanXemTruoc = this.overlay.querySelector("#nhan-xem-truoc");
    const anhXemTruoc = this.overlay.querySelector("#anh-xem-truoc");
    const videoXemTruoc = this.overlay.querySelector("#video-xem-truoc");

    if (this._objectUrls.has(v.id)) {
      URL.revokeObjectURL(this._objectUrls.get(v.id));
    }
    const url = URL.createObjectURL(blob);
    this._objectUrls.set(v.id, url);

    if (v.loai_bang_chung === "anh") {
      nhanXemTruoc.classList.add("hidden");
      anhXemTruoc.src = url;
      anhXemTruoc.classList.remove("hidden");
      videoXemTruoc.classList.add("hidden");
    } else {
      nhanXemTruoc.classList.add("hidden");
      videoXemTruoc.src = url;
      videoXemTruoc.classList.remove("hidden");
      anhXemTruoc.classList.add("hidden");

      nutMoVideo.classList.remove("hidden");
      nutMoVideo.onclick = () => window.open(url, "_blank");
    }
  }

  dong() {
    this._huyTaiNgam = true;
    this._cache.clear();
    this._objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this._objectUrls.clear();
    this.overlay.remove();
    this._onDong?.();
  }

  show() {}

  raise_() {
    this.overlay.style.zIndex = 1001;
  }
}
