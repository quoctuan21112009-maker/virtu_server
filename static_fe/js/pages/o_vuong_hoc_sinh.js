/* ================================================================
 * o_vuong_hoc_sinh.js — Ô vuông giám sát 1 học sinh
 * ================================================================ */
import { T, layNgonNgu } from "../core/ngon_ngu.js";
import { TEN_HIEN_THI_NHAN } from "../core/giao_dien_style.js";
import { icon } from "../core/icons.js";

export class OVuongHocSinh {
  /**
   * @param {number} hocSinhId
   * @param {string} hoTen
   * @param {object} callbacks - { onBam, onYeuCauPause, onYeuCauTiepTuc, onYeuCauReset }
   */
  constructor(hocSinhId, hoTen, callbacks = {}) {
    this.hoc_sinh_id = hocSinhId;
    this.ho_ten = hoTen;
    this.nhan_hien_tai = "normal";
    this.diem_hien_tai = 0.0;
    this.con_ket_noi = true;
    this._dangTamDung = false;
    this._cb = callbacks;

    this.el = document.createElement("div");
    this.el.className = "o-vuong";
    this.el.title = hoTen;
    this.el.innerHTML = `
      <div class="avt-frame">
        <span class="avt-icon">${icon("user")}</span>
      </div>
      <div class="info-row">
        <span class="id-lbl">#${hocSinhId}</span>
        <span class="ten-lbl">${this._escape(hoTen)}</span>
        <span class="chip-trang-thai chip normal"></span>
        <span class="icon-am-thanh" title="Phát hiện âm thanh">${icon("sound")}</span>
      </div>
      <div class="btn-row">
        <button class="btn-pause" title="Tạm dừng học sinh này" type="button">${icon("pause")} Tạm dừng</button>
        <button class="btn-reset" title="Yêu cầu hiệu chỉnh lại" type="button">${icon("reset")} Reset</button>
      </div>
    `;

    this._avtFrame = this.el.querySelector(".avt-frame");
    this._chip = this.el.querySelector(".chip-trang-thai");
    this._iconAmThanh = this.el.querySelector(".icon-am-thanh");
    this._nutPause = this.el.querySelector(".btn-pause");
    this._nutReset = this.el.querySelector(".btn-reset");

    this._nutPause.addEventListener("click", (e) => {
      e.stopPropagation();
      this._xuLyPause();
    });
    this._nutReset.addEventListener("click", (e) => {
      e.stopPropagation();
      this._cb.onYeuCauReset?.(this.hoc_sinh_id);
    });
    this.el.addEventListener("click", () => {
      if (this.con_ket_noi) this._cb.onBam?.(this.hoc_sinh_id);
    });

    this._veLai();
  }

  _escape(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  _xuLyPause() {
    if (this._dangTamDung) {
      this._dangTamDung = false;
      this._nutPause.innerHTML = `${icon("pause")} Tạm dừng`;
      this._nutPause.title = "Tạm dừng học sinh này";
      this._cb.onYeuCauTiepTuc?.(this.hoc_sinh_id);
      this._veLai();
    } else {
      this._dangTamDung = true;
      this._nutPause.innerHTML = `${icon("play")} Tiếp tục`;
      this._nutPause.title = "Tiếp tục học sinh này";
      this._chip.className = "chip-trang-thai chip suspicious";
      this._chip.textContent = "TẠM DỪNG";
      this.el.classList.remove("nhay");
      this._cb.onYeuCauPause?.(this.hoc_sinh_id);
    }
  }

  ganNguonVideo(mediaStreamOrUrl) {
    this._avtFrame.innerHTML = "";
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    if (mediaStreamOrUrl instanceof MediaStream) {
      video.srcObject = mediaStreamOrUrl;
    } else {
      video.src = mediaStreamOrUrl;
    }
    this._avtFrame.appendChild(video);
  }

  capNhatTrangThai(nhan, diem) {
    if (this._dangTamDung) return;
    this.nhan_hien_tai = nhan;
    this.diem_hien_tai = diem;
    if (nhan === "cheating") {
      this.el.classList.add("nhay");
    } else {
      this.el.classList.remove("nhay");
      this.hienThiIconAmThanh(false);
    }
    this._veLai();
  }

  hienThiIconAmThanh(hien) {
    this._iconAmThanh.classList.toggle("hien", !!hien);
  }

  datMatKetNoi() {
    this.con_ket_noi = false;
    this.el.classList.add("mat-ket-noi");
    this.el.classList.remove("nhay");
    this._chip.className = "chip-trang-thai chip";
    this._chip.textContent = T("mat_ket_noi");
    this._chip.style.color = "var(--chu-mo)";
  }

  _veLai() {
    if (!this.con_ket_noi) return;
    const nhan = this.nhan_hien_tai;
    const tenHienThi = TEN_HIEN_THI_NHAN[nhan]?.[layNgonNgu()] || TEN_HIEN_THI_NHAN.normal.vi;
    this._chip.className = `chip-trang-thai chip ${nhan}`;
    this._chip.textContent = tenHienThi;
  }
}
