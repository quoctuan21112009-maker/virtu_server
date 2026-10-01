/* ================================================================
 * tinh_hieu_mediapipe.js
 * ================================================================
 * Lớp cầu nối giữa MediaPipe Tasks Vision (Google, chạy trên trình
 * duyệt qua WASM) và BoTrichXuatDacTrung63 (trich_xuat_dac_trung.js).
 * CHUYỂN ĐỔI Y HỆT tinh_hieu_mediapipe.py, dùng:
 *   - FaceLandmarker (thay cho mediapipe.solutions.face_mesh),
 *     maxFaces=3, output_facial_transformation_matrixes=false,
 *     có iris landmark khi dùng model "face_landmarker" (đã bao gồm
 *     468 điểm + 10 điểm iris tương đương refine_landmarks=True).
 *   - PoseLandmarker (thay cho mediapipe.solutions.pose), lấy 2 vai
 *     (index 11, 12) để tính body_x/body_y/body_norm.
 *
 * Trả về đúng 17 tín hiệu đầu vào cho trich_xuat_dac_trung():
 *   head_x, head_y, head_norm,
 *   body_x, body_y, body_norm,
 *   ear_left, ear_right, ear_avg,
 *   gaze_x, gaze_y, gaze_angle,
 *   dh, db, gaze_dev,
 *   face_conf, pose_conf
 * (+ so_khuon_mat, dùng riêng cho luật cứng ">=2 người -> cheating",
 *   y hệt bản Python).
 *
 * Cần nạp qua CDN (xem index.html):
 *   <script type="module">
 *     import { FilesetResolver, FaceLandmarker, PoseLandmarker }
 *       from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
 *   </script>
 * Model Google chính thức (tải qua CDN Google Storage, không tự lưu bản quyền):
 *   face_landmarker: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
 *   pose_landmarker: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
 * ================================================================ */

// Landmark index (MediaPipe FaceLandmarker — cùng thứ tự 468 điểm FaceMesh)
const MAT_TRAI = [33, 160, 158, 133, 153, 144]; // 6 điểm EAR mắt trái
const MAT_PHAI = [362, 385, 387, 263, 373, 380]; // 6 điểm EAR mắt phải
const IRIS_TRAI = 468;
const IRIS_PHAI = 473;
const GOC_MAT_TRAI = [33, 133]; // (ngoài, trong)
const GOC_MAT_PHAI = [362, 263];
const MUI = 1;
const VAI_TRAI_POSE = 11;
const VAI_PHAI_POSE = 12;

function khoangCach(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function tinhEAR(lmMat, w, h) {
  const pts = lmMat.map((p) => [p.x * w, p.y * h]);
  const [p1, p2, p3, p4, p5, p6] = pts;
  const doc = khoangCach(p2, p6) + khoangCach(p3, p5);
  const ngang = 2.0 * khoangCach(p1, p4);
  return ngang > 1e-6 ? doc / ngang : 0.0;
}

export class BoTinhHieuMediaPipe {
  /**
   * @param {object} opts
   * @param {number} opts.doRong - chiều rộng khung hình xử lý
   * @param {number} opts.doCao - chiều cao khung hình xử lý
   * @param {number} opts.heSoLamMuot - hệ số EMA làm mượt (0..1), càng nhỏ càng mượt
   * @param {object} opts.faceLandmarker - instance FaceLandmarker đã khởi tạo
   * @param {object} opts.poseLandmarker - instance PoseLandmarker đã khởi tạo
   */
  constructor({ doRong = 640, doCao = 480, heSoLamMuot = 0.25, faceLandmarker, poseLandmarker }) {
    this.do_rong = doRong;
    this.do_cao = doCao;
    this._duongCheoNua = Math.hypot(doRong, doCao) / 2.0;
    this.he_so_lam_muot = heSoLamMuot;

    this.faceLandmarker = faceLandmarker;
    this.poseLandmarker = poseLandmarker;

    this._mocHead = null;
    this._mocBody = null;
    this._emaHead = null;
    this._emaBody = null;
  }

  datLaiMoc() {
    this._mocHead = null;
    this._mocBody = null;
    this._emaHead = null;
    this._emaBody = null;
  }

  _lamMuot(emaCu, giaTriMoi) {
    if (emaCu === null) return giaTriMoi;
    const a = this.he_so_lam_muot;
    return [emaCu[0] * (1 - a) + giaTriMoi[0] * a, emaCu[1] * (1 - a) + giaTriMoi[1] * a];
  }

  /**
   * Xử lý 1 khung hình (HTMLVideoElement / HTMLCanvasElement / ImageBitmap).
   * @param {number} timestampMs - mốc thời gian (performance.now() hoặc video.currentTime*1000)
   * @returns {{ tinHieu: object|null }} tinHieu = null nếu không phát hiện được mặt.
   */
  xuLy(videoFrame, timestampMs) {
    const w = this.do_rong;
    const h = this.do_cao;

    const ketQuaFace = this.faceLandmarker.detectForVideo(videoFrame, timestampMs);
    const ketQuaPose = this.poseLandmarker
      ? this.poseLandmarker.detectForVideo(videoFrame, timestampMs)
      : null;

    if (!ketQuaFace || !ketQuaFace.faceLandmarks || ketQuaFace.faceLandmarks.length === 0) {
      return { tinHieu: null };
    }

    const lm = ketQuaFace.faceLandmarks[0];
    const cx = w / 2.0;
    const cy = h / 2.0;

    // ---- Head (EMA để loại nhiễu jitter landmark) ----
    const muiPxTho = [lm[MUI].x * w, lm[MUI].y * h];
    this._emaHead = this._lamMuot(this._emaHead, muiPxTho);
    const muiPx = this._emaHead;
    const head_x = muiPx[0] - cx;
    const head_y = muiPx[1] - cy;
    const head_norm = khoangCach(muiPx, [cx, cy]) / this._duongCheoNua;

    // ---- Body (Pose, có thể vắng), cũng làm mượt EMA ----
    let body_x, body_y, body_norm, pose_conf = 0.0;
    const poseLandmarks =
      ketQuaPose && ketQuaPose.landmarks && ketQuaPose.landmarks.length > 0
        ? ketQuaPose.landmarks[0]
        : null;

    if (poseLandmarks) {
      const vaiT = poseLandmarks[VAI_TRAI_POSE];
      const vaiP = poseLandmarks[VAI_PHAI_POSE];
      const bodyPxTho = [((vaiT.x + vaiP.x) / 2.0) * w, ((vaiT.y + vaiP.y) / 2.0) * h];
      this._emaBody = this._lamMuot(this._emaBody, bodyPxTho);
      const bodyPx = this._emaBody;
      body_x = bodyPx[0] - cx;
      body_y = bodyPx[1] - cy;
      body_norm = khoangCach(bodyPx, [cx, cy]) / this._duongCheoNua;
      const visT = vaiT.visibility ?? 1.0;
      const visP = vaiP.visibility ?? 1.0;
      pose_conf = Math.min(Math.max((visT + visP) / 2.0, 0.0), 1.0);
    } else {
      body_x = head_x;
      body_y = head_y;
      body_norm = head_norm; // fallback
    }

    // ---- EAR ----
    const earTrai = tinhEAR(MAT_TRAI.map((i) => lm[i]), w, h);
    const earPhai = tinhEAR(MAT_PHAI.map((i) => lm[i]), w, h);
    const ear_avg = (earTrai + earPhai) / 2.0;

    // ---- Gaze (iris lệch khỏi tâm hốc mắt) ----
    let gaze_x = 0.0;
    let gaze_y = 0.0;
    try {
      const irisT = [lm[IRIS_TRAI].x * w, lm[IRIS_TRAI].y * h];
      const irisP = [lm[IRIS_PHAI].x * w, lm[IRIS_PHAI].y * h];
      const gocTNgoai = [lm[GOC_MAT_TRAI[0]].x * w, lm[GOC_MAT_TRAI[0]].y * h];
      const gocTTrong = [lm[GOC_MAT_TRAI[1]].x * w, lm[GOC_MAT_TRAI[1]].y * h];
      const gocPNgoai = [lm[GOC_MAT_PHAI[0]].x * w, lm[GOC_MAT_PHAI[0]].y * h];
      const gocPTrong = [lm[GOC_MAT_PHAI[1]].x * w, lm[GOC_MAT_PHAI[1]].y * h];

      const tamHocT = [(gocTNgoai[0] + gocTTrong[0]) / 2.0, (gocTNgoai[1] + gocTTrong[1]) / 2.0];
      const tamHocP = [(gocPNgoai[0] + gocPTrong[0]) / 2.0, (gocPNgoai[1] + gocPTrong[1]) / 2.0];
      const rongHocT = Math.max(khoangCach(gocTNgoai, gocTTrong), 1e-6);
      const rongHocP = Math.max(khoangCach(gocPNgoai, gocPTrong), 1e-6);

      const lechT = [(irisT[0] - tamHocT[0]) / rongHocT, (irisT[1] - tamHocT[1]) / rongHocT];
      const lechP = [(irisP[0] - tamHocP[0]) / rongHocP, (irisP[1] - tamHocP[1]) / rongHocP];

      gaze_x = ((lechT[0] + lechP[0]) / 2.0) * 100.0;
      gaze_y = ((lechT[1] + lechP[1]) / 2.0) * 100.0;
    } catch (e) {
      gaze_x = 0.0;
      gaze_y = 0.0;
    }

    const gaze_angle = (Math.atan2(gaze_y, gaze_x) * 180) / Math.PI;
    const gaze_dev = Math.hypot(gaze_x, gaze_y);

    // ---- dh, db: độ lệch so với mốc baseline ----
    if (this._mocHead === null) {
      this._mocHead = [head_x, head_y];
      this._mocBody = [body_x, body_y];
    }
    const dh = khoangCach([head_x, head_y], this._mocHead);
    const db = khoangCach([body_x, body_y], this._mocBody);

    const face_conf = 1.0; // FaceLandmarker không trả visibility -> có landmark là coi như tin cậy đủ
    const so_khuon_mat = ketQuaFace.faceLandmarks.length;

    const tinHieu = {
      head_x, head_y, head_norm,
      body_x, body_y, body_norm,
      ear_left: earTrai, ear_right: earPhai, ear_avg,
      gaze_x, gaze_y, gaze_angle,
      dh, db, gaze_dev,
      face_conf, pose_conf,
      so_khuon_mat,
    };

    return { tinHieu, ketQuaFace, ketQuaPose };
  }

  dong() {
    try { this.faceLandmarker?.close(); } catch (e) { /* ignore */ }
    try { this.poseLandmarker?.close(); } catch (e) { /* ignore */ }
  }
}

/**
 * Khởi tạo FaceLandmarker + PoseLandmarker từ CDN Google (MediaPipe Tasks Vision).
 * Gọi 1 lần khi bắt đầu phiên thi (giao diện học sinh).
 */
export async function khoiTaoMediaPipe({
  visionWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  faceModelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  poseModelUrl = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  runningMode = "VIDEO",
} = {}) {
  const visionModule = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
  );
  const { FilesetResolver, FaceLandmarker, PoseLandmarker } = visionModule;

  const filesetResolver = await FilesetResolver.forVisionTasks(visionWasmUrl);

  const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: faceModelUrl, delegate: "GPU" },
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode,
    numFaces: 3,
  });

  const poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: poseModelUrl, delegate: "GPU" },
    runningMode,
    numPoses: 1,
  });

  return { faceLandmarker, poseLandmarker };
}
