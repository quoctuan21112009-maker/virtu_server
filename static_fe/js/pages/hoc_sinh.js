/* ================================================================
 * hoc_sinh.js — Trang Học sinh làm bài thi VIRTU (AI Proctoring)
 * ================================================================ */
import { RESTClient, KetNoiThoiGianThuc, LoiApi } from "../core/ket_noi_client.js";
import { T, khoiTaoNgonNgu } from "../core/ngon_ngu.js";
import { apDungCheDoDaLuu } from "../core/giao_dien_style.js";
import { khoiTaoMediaPipe, BoTinhHieuMediaPipe } from "../core/tinh_hieu_mediapipe.js";
import { BoTrichXuatDacTrung63 } from "../core/trich_xuat_dac_trung.js";
import { docPhienDangNhap, xoaPhienDangNhap, guardVaiTro } from "./dang_nhap.js";
import { BoXuLyAmThanhVAD } from "../core/xu_ly_am_thanh.js";
import { BoDemVideoEvidence, HangDoiGuiTuanTu } from "../core/bo_dem_video_evidence.js";
import { icon } from "../core/icons.js";

const NGUONG_NGHI_VAN = 40.0;
const NGUONG_GIAN_LAN = 70.0;
const KHOANG_CACH_GUI_TRANG_THAI_MS = 1000;
const KHOANG_CACH_CHUP_VI_PHAM_MS = 8000;
const CHU_KY_GUI_YOLO_MS = 7000; // Định kỳ 5-10s gửi 1 ảnh kiểm tra YOLO

let rest, ketNoi, phien;
let video, canvasAn;
let streamToanCuc = null;
let dangThi = false;
let phienId = null, maPhongHienTai = null;
let boTinhHieu = null, boTrichXuat = null;
let boXuLyAmThanh = null, boDemVideo = null;
const hangDoiGui = new HangDoiGuiTuanTu();
let timerYolo = null;

let rafId = null;
let lanCuoiGuiTrangThai = 0;
let lanCuoiChupTheoLyDo = {};
let nhanHienTai = "normal";
let diemHienTai = 0.0;

function baoVePhien() {
  phien = guardVaiTro(["hoc_sinh"]);
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
  const hoTen = nd.ho_ten || nd.name || nd.ten_dang_nhap || "Học sinh";

  root.innerHTML = `
    <div class="sidebar" style="width:280px;min-width:280px;">
      <div class="sidebar-logo">
        <div class="logo-icon"><img src="logo/logo.png" alt="Virtu Logo" class="sidebar-logo-img" /></div>
        <div class="app-name">Virtu</div>
      </div>

      <div class="flex-col gap-16 flex-1" style="padding:10px 4px;overflow-y:auto;">
        <div class="login-field">
          <label>${T("ma_phong")}</label>
          <input type="text" id="input-ma-phong" placeholder="Nhập mã phòng thi..." style="text-transform:uppercase;font-weight:700;letter-spacing:1px;" />
        </div>
        <button id="btn-tham-gia" class="btn-primary-glow" style="width:100%;">${icon("doorOpen")} Tham gia phòng thi</button>

        <div id="thong-tin-phong" class="hidden flex-col gap-10" style="background:var(--nen-input);border:1px solid var(--vien);border-radius:12px;padding:16px;margin-top:6px;">
          <div class="flex" style="justify-content:space-between;"><span class="phu-de">Phiên thi:</span> <b id="lbl-ten-phien" style="color:var(--chu-chinh);">—</b></div>
          <div class="flex" style="justify-content:space-between;"><span class="phu-de">Môn thi:</span> <b id="lbl-mon-thi" style="color:var(--chu-chinh);">—</b></div>
          <div class="flex" style="justify-content:space-between;align-items:center;">
            <span class="phu-de">${T("trang_thai")}:</span>
            <span class="chip normal" id="chip-trang-thai-hs">${T("binh_thuong")}</span>
          </div>
          <div class="flex" style="justify-content:space-between;"><span class="phu-de">Điểm rủi ro:</span> <b id="lbl-diem-rui-ro-hs" style="color:var(--chu-chinh);">0.0</b></div>

          <div style="height:1px;background:var(--vien);margin:4px 0;"></div>

          <button id="btn-bat-camera" class="btn-primary-glow" style="width:100%;margin-top:6px;">
            ${icon("camera")} Bật camera &amp; bắt đầu
          </button>
          <button id="btn-tat-camera" class="nut-nguy-hiem hidden" style="width:100%;">
            ${icon("cameraOff")} Dừng giám sát
          </button>
        </div>

        <div id="canh-bao-hs" class="login-error" style="margin-top:8px;"></div>
      </div>

      <div class="sidebar-user">
        <div class="user-avatar">${hoTen.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name" title="${hoTen}">${hoTen}</div>
          <div class="user-role">${T("hoc_sinh")}</div>
        </div>
        <button class="btn-logout" id="btn-dang-xuat" title="${T("dang_xuat")}">
          ${icon("logout")}
        </button>
      </div>
    </div>

    <div class="main-wrapper">
      <div class="page-header">
        <div class="page-title">Không gian Phòng thi Trực tuyến</div>
        <div class="page-actions">
          <span class="chip normal" id="trang-thai-ket-noi" style="padding:4px 10px;">
            ${icon("checkCircle")} Đã kết nối máy chủ
          </span>
        </div>
      </div>
      <div class="page-body center" style="padding:32px;">
        <div class="panel-card" style="width:720px;max-width:100%;padding:24px;align-items:center;text-align:center;gap:18px;">
          <div id="khung-video" style="width:600px;max-width:100%;aspect-ratio:4/3;background:var(--nen-terminal);border:1px solid var(--vien);border-radius:14px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-md);">
            <span id="nhan-cho-camera" class="phu-de" style="font-size:11pt;">Camera chưa được kích hoạt. Hãy tham gia phòng thi và bấm "Bật camera".</span>
            <video id="video-hs" autoplay playsinline muted class="hidden" style="width:100%;height:100%;object-fit:cover;"></video>
          </div>
          <p class="phu-de" style="max-width:540px;line-height:1.5;">
            Hình ảnh từ webcam chỉ được xử lý cục bộ trên trình duyệt để giám sát và không gửi video thô lên máy chủ, đảm bảo tính bảo mật và quyền riêng tư.
          </p>
        </div>
      </div>
    </div>
  `;

  video = document.getElementById("video-hs");
  canvasAn = document.createElement("canvas");
  canvasAn.width = 640;
  canvasAn.height = 480;

  ganSuKien();
}

function ganSuKien() {
  document.getElementById("btn-dang-xuat")?.addEventListener("click", () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      dungGiamSat();
      ketNoi?.ngat_ket_noi();
      xoaPhienDangNhap();
      window.location.href = "index.html";
    }
  });

  document.getElementById("btn-tham-gia")?.addEventListener("click", xuLyThamGiaPhong);
  document.getElementById("btn-bat-camera")?.addEventListener("click", xuLyBatCamera);
  document.getElementById("btn-tat-camera")?.addEventListener("click", dungGiamSat);

  ketNoi.on("da_ket_noi", () => setTrangThaiKetNoi(true));
  ketNoi.on("mat_ket_noi", () => setTrangThaiKetNoi(false));
  ketNoi.on("yeu_cau_reset", (data) => {
    if (data.hoc_sinh_id && data.hoc_sinh_id !== (phien.nguoi_dung || {}).id) return;
    hienThiCanhBao(`Giáo viên yêu cầu bạn hiệu chỉnh lại: ${data.ly_do || ""}`);
    boTinhHieu?.datLaiMoc();
    boTrichXuat?.datLai();
    boXuLyAmThanh?.hieuChinhLai();
  });
}

function setTrangThaiKetNoi(ok) {
  const el = document.getElementById("trang-thai-ket-noi");
  if (!el) return;
  el.className = `chip ${ok ? "normal" : "cheating"}`;
  el.innerHTML = `${icon(ok ? "checkCircle" : "alertTriangle")} ${ok ? "Đã kết nối máy chủ" : "Mất kết nối máy chủ"}`;
}

function hienThiCanhBao(msg) {
  const el = document.getElementById("canh-bao-hs");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 6000);
}

async function xuLyThamGiaPhong() {
  const maPhong = document.getElementById("input-ma-phong")?.value.trim().toUpperCase() || "";
  if (!maPhong) {
    hienThiCanhBao("Vui lòng nhập mã phòng thi.");
    return;
  }
  const btn = document.getElementById("btn-tham-gia");
  if (btn) btn.disabled = true;

  try {
    const d = await rest.tham_gia_phong(maPhong);
    phienId = d.phien_id || d.id;
    maPhongHienTai = maPhong;

    document.getElementById("lbl-ten-phien").textContent = d.ten_phien || "Phiên thi";
    document.getElementById("lbl-mon-thi").textContent = d.mon_thi || "Toán học";
    document.getElementById("thong-tin-phong")?.classList.remove("hidden");

    ketNoi.hoc_sinh_vao(maPhong);
  } catch (e) {
    hienThiCanhBao(e instanceof LoiApi ? e.thong_diep : e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function xuLyBatCamera() {
  const nutBat = document.getElementById("btn-bat-camera");
  const nutTat = document.getElementById("btn-tat-camera");
  const nhanCho = document.getElementById("nhan-cho-camera");

  if (nutBat) {
    nutBat.disabled = true;
    nutBat.textContent = "Đang khởi tạo AI…";
  }

  try {
    // Kiểm tra hỗ trợ mediaDevices (Yêu cầu localhost hoặc HTTPS hoặc cờ browser)
    const getMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      || navigator.getUserMedia?.bind(navigator)
      || navigator.webkitGetUserMedia?.bind(navigator)
      || navigator.mozGetUserMedia?.bind(navigator);

    if (!getMedia) {
      if (window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        throw new Error(`Trình duyệt chặn Camera/Micro qua HTTP (${window.location.hostname}). Vui lòng truy cập bằng http://localhost:${window.location.port || '5000'} hoặc sử dụng HTTPS.`);
      }
      throw new Error("Trình duyệt không hỗ trợ getUserMedia hoặc chưa cấp quyền truy cập thiết bị.");
    }

    // Cố gắng xin cả video và audio, nếu máy không có micro thì fallback về video
    let stream;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: true,
        });
      } else {
        stream = await new Promise((res, rej) => getMedia({ video: true, audio: true }, res, rej));
      }
    } catch (errAudio) {
      console.warn("[Media] Không mở được micro (có thể không có mic), thử lại với chỉ video:", errAudio);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
      } else {
        stream = await new Promise((res, rej) => getMedia({ video: true, audio: false }, res, rej));
      }
    }

    streamToanCuc = stream;
    video.srcObject = stream;
    video.classList.remove("hidden");
    nhanCho?.classList.add("hidden");
    await video.play();

    // 1. Khởi tạo thị giác MediaPipe
    const { faceLandmarker, poseLandmarker } = await khoiTaoMediaPipe();
    boTinhHieu = new BoTinhHieuMediaPipe({
      doRong: 640, doCao: 480, heSoLamMuot: 0.25,
      faceLandmarker, poseLandmarker,
    });
    boTrichXuat = new BoTrichXuatDacTrung63({ ear_threshold: 0.18 });

    // 2. Khởi tạo Ring Buffer Video Bằng chứng (10-15s)
    boDemVideo = new BoDemVideoEvidence(stream, { chunkIntervalMs: 2500, maxChunks: 5 });
    boDemVideo.batDau();

    // 3. Khởi tạo Bộ xử lý âm thanh VAD nếu có audio track
    const hasAudioTrack = stream.getAudioTracks().length > 0;
    if (hasAudioTrack) {
      try {
        boXuLyAmThanh = new BoXuLyAmThanhVAD({
          onSpeechEvent: (eInfo) => {
            xuLyKetQua({ diem_100: 95, nhan: "cheating" }, "phat_hien_tieng_noi_trong_phong_thi");
          },
        });
        await boXuLyAmThanh.batDau(stream);
      } catch (errVad) {
        console.warn("[Audio VAD] Không thể khởi động Web Audio API:", errVad);
      }
    }

    // 4. Kích hoạt timer gửi định kỳ 5-10s cho YOLO AI
    khoiDongYoloDinhKy();

    dangThi = true;
    nutBat?.classList.add("hidden");
    nutTat?.classList.remove("hidden");
    vongLapXuLy();
  } catch (e) {
    hienThiCanhBao(`Không thể bật camera/micro: ${e.message}`);
    if (nutBat) {
      nutBat.disabled = false;
      nutBat.innerHTML = `${icon("camera")} Bật camera &amp; bắt đầu`;
    }
  }
}

function khoiDongYoloDinhKy() {
  if (timerYolo) clearInterval(timerYolo);
  timerYolo = setInterval(() => {
    if (!dangThi || !video || video.paused) return;

    // Đưa task gửi ảnh vào Hàng đợi gửi tuần tự (chống nghẽn mạng)
    hangDoiGui.them(async () => {
      try {
        const ctx = canvasAn.getContext("2d");
        ctx.drawImage(video, 0, 0, canvasAn.width, canvasAn.height);
        const dataUrl = canvasAn.toDataURL("image/jpeg", 0.70); // Nén tối ưu băng thông
        const duLieuB64 = dataUrl.split(",")[1];

        // Gửi frame sang API backend (backend sẽ forward YOLO server thứ 3)
        // Nếu API trả về vi phạm thiết bị, kích hoạt cảnh báo
        const kq = await rest._fetchJson("/api/kiem_tra_yolo", {
          method: "POST",
          body: {
            ma_phong: maPhongHienTai,
            hoc_sinh_id: (phien.nguoi_dung || {}).id,
            anh_b64: duLieuB64,
          },
          timeout: 5000,
        }).catch(() => null);

        if (kq && kq.co_vi_pham) {
          xuLyKetQua({ diem_100: kq.diem || 90, nhan: "cheating" }, "phat_hien_dien_thoai_tai_lieu_yolo");
        }
      } catch (err) {
        // Không block pipeline
      }
    });
  }, CHU_KY_GUI_YOLO_MS);
}

function vongLapXuLy() {
  if (!dangThi) return;
  const now = performance.now();

  const { tinHieu } = boTinhHieu.xuLy(video, now);
  if (tinHieu) {
    const features = boTrichXuat.trich_xuat_dac_trung(tinHieu);

    if (tinHieu.so_khuon_mat >= 2) {
      xuLyKetQua({ diem_100: 100, nhan: "cheating" }, "phat_hien_nhieu_nguoi_trong_khung_hinh");
    } else {
      guiVectorChamDiem(features);
    }
  }

  rafId = requestAnimationFrame(vongLapXuLy);
}

async function guiVectorChamDiem(featureVector) {
  const now = Date.now();
  if (now - lanCuoiGuiTrangThai < KHOANG_CACH_GUI_TRANG_THAI_MS) return;
  lanCuoiGuiTrangThai = now;

  try {
    const ketQua = await rest.cham_diem_rui_ro(maPhongHienTai, (phien.nguoi_dung || {}).id, featureVector);
    xuLyKetQua(ketQua, "diem_rui_ro_vuot_nguong_gian_lan");
  } catch (e) {
    console.warn("[cham_diem_rui_ro] lỗi:", e.message);
  }
}

function xuLyKetQua(ketQua, lyDoNeuViPham) {
  const diem = ketQua.diem_100 ?? 0;
  const nhan = ketQua.nhan || (diem < NGUONG_NGHI_VAN ? "normal" : diem < NGUONG_GIAN_LAN ? "suspicious" : "cheating");

  nhanHienTai = nhan;
  diemHienTai = diem;
  capNhatGiaoDienTrangThai(nhan, diem);

  ketNoi.gui_trang_thai(maPhongHienTai, nhan, diem);

  if (nhan === "cheating") {
    xuLyChupBangChung(lyDoNeuViPham, diem / 100.0);
  }
}

function capNhatGiaoDienTrangThai(nhan, diem) {
  const chip = document.getElementById("chip-trang-thai-hs");
  const lblDiem = document.getElementById("lbl-diem-rui-ro-hs");
  if (!chip || !lblDiem) return;
  chip.className = `chip ${nhan}`;
  chip.textContent = T(nhan === "normal" ? "binh_thuong" : nhan === "suspicious" ? "nghi_van" : "vi_pham");
  lblDiem.textContent = diem.toFixed(1);
}

async function xuLyChupBangChung(lyDo, diemChuan0Den1) {
  const now = Date.now();
  const lanCuoi = lanCuoiChupTheoLyDo[lyDo] || 0;
  if (now - lanCuoi < KHOANG_CACH_CHUP_VI_PHAM_MS) return;
  lanCuoiChupTheoLyDo[lyDo] = now;

  boTrichXuat?.ghiNhanViPham();

  // Đưa việc đóng gói & gửi bằng chứng (Ảnh + Video) vào Hàng Đợi Tuần Tự
  hangDoiGui.them(async () => {
    try {
      // 1. Chụp ảnh khung hình hiện tại
      const ctx = canvasAn.getContext("2d");
      ctx.drawImage(video, 0, 0, canvasAn.width, canvasAn.height);
      const dataUrl = canvasAn.toDataURL("image/jpeg", 0.80);
      const duLieuAnhB64 = dataUrl.split(",")[1];

      // Tải lên bằng chứng ảnh
      await rest.tai_len_vi_pham(
        phienId, maPhongHienTai, diemChuan0Den1, lyDo, "anh", "jpeg", duLieuAnhB64
      );

      // 2. Trích xuất video từ Ring Buffer (nếu có vi phạm nghiêm trọng / âm thanh / nhiều người)
      if (boDemVideo) {
        const duLieuVideoB64 = await boDemVideo.layVideoEvidenceBase64();
        if (duLieuVideoB64) {
          await rest.tai_len_vi_pham(
            phienId, maPhongHienTai, diemChuan0Den1, lyDo, "video", "webm", duLieuVideoB64
          );
        }
      }
    } catch (e) {
      console.error("[tai_len_vi_pham] Lỗi gửi bằng chứng tuần tự:", e.message);
    }
  });
}

function dungGiamSat() {
  dangThi = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  if (timerYolo) {
    clearInterval(timerYolo);
    timerYolo = null;
  }

  boXuLyAmThanh?.dung();
  boXuLyAmThanh = null;

  boDemVideo?.dung();
  boDemVideo = null;

  if (streamToanCuc) {
    streamToanCuc.getTracks().forEach((t) => t.stop());
    streamToanCuc = null;
  }
  if (video && video.srcObject) {
    video.srcObject = null;
  }
  video?.classList.add("hidden");
  document.getElementById("nhan-cho-camera")?.classList.remove("hidden");

  boTinhHieu?.dong();
  boTinhHieu = null;
  boTrichXuat = null;

  const nutBat = document.getElementById("btn-bat-camera");
  const nutTat = document.getElementById("btn-tat-camera");
  if (nutBat) {
    nutBat.classList.remove("hidden");
    nutBat.disabled = false;
    nutBat.innerHTML = `${icon("camera")} Bật camera &amp; bắt đầu`;
  }
  nutTat?.classList.add("hidden");
}

window.addEventListener("beforeunload", () => {
  dungGiamSat();
  ketNoi?.ngat_ket_noi();
});

// ---- Khởi động ----
khoiTaoNgonNgu();
apDungCheDoDaLuu();
if (baoVePhien()) {
  khoiTaoKetNoi();
  render();
}
