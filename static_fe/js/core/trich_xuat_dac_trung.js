/* ================================================================
 * trich_xuat_dac_trung.js
 * ================================================================
 * CHUYỂN ĐỔI Y HỆT trich_xuat_dac_trung.py — trích xuất vector 63
 * đặc trưng từ 17 tín hiệu thô MediaPipe, dùng Kalman filter 1 chiều
 * để làm mượt dh/db/gaze trước khi đưa vào các cửa sổ thống kê
 * 1s/3s/5s (giả định 30fps, giống bản gốc).
 * ================================================================ */

// ============= ENUMS & CONSTANTS =============
export const TrangThaiHeThong = Object.freeze({
  HIEU_CHINH: "CALIBRATING",
  THEO_DOI: "GIAM_SAT",
  TAI_HIEU_CHINH: "RECALIBRATING",
});

export class BoDuKalman1Chieu {
  constructor(q = 0.0001, r = 0.1) {
    this.q = q;
    this.r = r;
    this.x = 0.0;
    this.p = 1.0;
    this.initialized = false;
  }

  update(z) {
    if (!this.initialized) {
      this.x = z;
      this.initialized = true;
      return z;
    }
    this.p = this.p + this.q;
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (z - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }

  datLai() {
    this.x = 0.0;
    this.p = 1.0;
    this.initialized = false;
  }
}

// ---- Tiện ích thống kê thay cho numpy ----
function mean(arr) {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}
function std(arr) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) ** 2;
  return Math.sqrt(s / arr.length);
}
function variance(arr) {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) ** 2;
  return s / arr.length;
}
function maxArr(arr) {
  return arr.length === 0 ? 0 : Math.max(...arr);
}
function minArr(arr) {
  return arr.length === 0 ? 0 : Math.min(...arr);
}

/** Deque đơn giản có giới hạn kích thước (thay cho collections.deque(maxlen=...)). */
class DequeGioiHan {
  constructor(maxlen) {
    this.maxlen = maxlen;
    this._arr = [];
  }
  append(v) {
    this._arr.push(v);
    if (this._arr.length > this.maxlen) this._arr.shift();
  }
  clear() {
    this._arr = [];
  }
  toArray() {
    return this._arr;
  }
  get length() {
    return this._arr.length;
  }
  slice(from) {
    // tương đương arr[from:] của Python với from âm
    if (from < 0) return this._arr.slice(this._arr.length + from);
    return this._arr.slice(from);
  }
  get last() {
    return this._arr.length ? this._arr[this._arr.length - 1] : undefined;
  }
}

// ============= FEATURE EXTRACTOR =============
export class BoTrichXuatDacTrung63 {
  constructor(cauHinh = {}) {
    this.cau_hinh = cauHinh || {};
    this.history_window = 150;

    // Histories
    this.head_x_history = new DequeGioiHan(this.history_window);
    this.head_y_history = new DequeGioiHan(this.history_window);
    this.body_x_history = new DequeGioiHan(this.history_window);
    this.body_y_history = new DequeGioiHan(this.history_window);

    this.dh_history = new DequeGioiHan(this.history_window);
    this.db_history = new DequeGioiHan(this.history_window);
    this.ear_history = new DequeGioiHan(this.history_window);
    this.gaze_history = new DequeGioiHan(this.history_window);

    // Kalman filters
    this.kalman_dh = new BoDuKalman1Chieu();
    this.kalman_db = new BoDuKalman1Chieu();
    this.kalman_gaze = new BoDuKalman1Chieu();

    // For velocities
    this.prev_dh = 0;
    this.prev_db = 0;
    this.prev_gaze = 0;
    this.prev_dh_vel = 0;
    this.prev_db_vel = 0;

    // Blink detection (giữ mốc thời gian tính bằng giây, giống time.time())
    this.blink_events = new DequeGioiHan(90);

    // Violation tracking
    this.violation_history = new DequeGioiHan(1800);

    this.session_start = Date.now() / 1000;
  }

  datLai() {
    this.head_x_history.clear();
    this.head_y_history.clear();
    this.body_x_history.clear();
    this.body_y_history.clear();
    this.dh_history.clear();
    this.db_history.clear();
    this.ear_history.clear();
    this.gaze_history.clear();

    this.kalman_dh.datLai();
    this.kalman_db.datLai();
    this.kalman_gaze.datLai();

    this.prev_dh = 0;
    this.prev_db = 0;
    this.prev_gaze = 0;
    this.prev_dh_vel = 0;
    this.prev_db_vel = 0;
  }

  /** Ghi nhận 1 sự kiện vi phạm (để tính violations_1min/5min, time_since_last...). */
  ghiNhanViPham() {
    this.violation_history.append(Date.now() / 1000);
  }

  /**
   * Trích xuất đúng 63 đặc trưng — tham số giữ nguyên tên/thứ tự
   * như trich_xuat_dac_trung() trong bản Python.
   */
  trich_xuat_dac_trung({
    head_x, head_y, head_norm, body_x, body_y, body_norm,
    ear_left, ear_right, ear_avg, gaze_x, gaze_y, gaze_angle,
    dh, db, gaze_dev, face_conf, pose_conf,
  }) {
    const NGUONG_EAR = this.cau_hinh.ear_threshold ?? 0.18;
    const now = Date.now() / 1000;

    // Update histories
    this.head_x_history.append(head_x);
    this.head_y_history.append(head_y);
    this.body_x_history.append(body_x);
    this.body_y_history.append(body_y);

    // Kalman smoothing
    const dh_smooth = this.kalman_dh.update(dh);
    const db_smooth = this.kalman_db.update(db);
    const gaze_smooth = this.kalman_gaze.update(gaze_dev);

    this.dh_history.append(dh_smooth);
    this.db_history.append(db_smooth);
    this.ear_history.append(ear_avg);
    this.gaze_history.append(gaze_smooth);

    // Arrays
    const dh_arr = this.dh_history.length > 0 ? this.dh_history.toArray() : [0];
    const db_arr = this.db_history.length > 0 ? this.db_history.toArray() : [0];
    const ear_arr = this.ear_history.length > 0 ? this.ear_history.toArray() : [0];
    const gaze_arr = this.gaze_history.length > 0 ? this.gaze_history.toArray() : [0];

    // Windows (1s/3s/5s @ 30fps)
    const dh_1s = dh_arr.length >= 30 ? dh_arr.slice(-30) : dh_arr;
    const db_1s = db_arr.length >= 30 ? db_arr.slice(-30) : db_arr;
    const ear_1s = ear_arr.length >= 30 ? ear_arr.slice(-30) : ear_arr;
    const gaze_1s = gaze_arr.length >= 30 ? gaze_arr.slice(-30) : gaze_arr;

    const dh_3s = dh_arr.length >= 90 ? dh_arr.slice(-90) : dh_arr;
    const db_3s = db_arr.length >= 90 ? db_arr.slice(-90) : db_arr;
    const ear_3s = ear_arr.length >= 90 ? ear_arr.slice(-90) : ear_arr;
    const gaze_3s = gaze_arr.length >= 90 ? gaze_arr.slice(-90) : gaze_arr;

    const dh_5s = dh_arr.length >= 150 ? dh_arr.slice(-150) : dh_arr;
    const db_5s = db_arr.length >= 150 ? db_arr.slice(-150) : db_arr;
    const ear_5s = ear_arr.length >= 150 ? ear_arr.slice(-150) : ear_arr;
    const gaze_5s = gaze_arr.length >= 150 ? gaze_arr.slice(-150) : gaze_arr;

    // Velocities
    const dh_vel = dh_smooth - this.prev_dh;
    const db_vel = db_smooth - this.prev_db;
    const gaze_vel = gaze_smooth - this.prev_gaze;

    // Accelerations
    const dh_acc = dh_vel - this.prev_dh_vel;
    const db_acc = db_vel - this.prev_db_vel;

    // Update
    this.prev_dh = dh_smooth;
    this.prev_db = db_smooth;
    this.prev_gaze = gaze_smooth;
    this.prev_dh_vel = dh_vel;
    this.prev_db_vel = db_vel;

    // Patterns
    const head_shake_score = dh_1s.length > 1 ? std(dh_1s) : 0;
    const body_fidget_score = db_1s.length > 1 ? std(db_1s) : 0;

    // Blink rate
    if (ear_avg < NGUONG_EAR) {
      this.blink_events.append(now);
    }
    const blink_rate = this.blink_events.toArray().filter((t) => now - t < 60).length / 60.0;

    // Gaze fixation
    const gaze_mean = gaze_1s.length > 0 ? mean(gaze_1s) : 0;
    const gaze_stable = gaze_1s.length > 0 ? gaze_1s.filter((g) => Math.abs(g - gaze_mean) < 5).length : 0;
    const gaze_fixation_duration = gaze_1s.length > 0 ? gaze_stable / 30.0 : 0;

    // Violations
    const vh = this.violation_history.toArray();
    const violations_1min = vh.filter((v) => now - v < 60).length;
    const violations_5min = vh.filter((v) => now - v < 300).length;

    const time_since_last = vh.length > 0 ? now - vh[vh.length - 1] : 9999;
    const cumulative_violation_time = vh.length * 0.5;

    // Time in session
    const time_in_session = now - this.session_start;

    // Posture stability
    const posture_stability = 1.0 / (1.0 + head_shake_score + body_fidget_score);

    // Data quality
    const data_quality = (face_conf + pose_conf) / 2.0;

    // Build feature vector (63 features) — ĐÚNG THỨ TỰ như bản Python
    const features = [
      // Raw (6)
      head_x, head_y, head_norm,
      body_x, body_y, body_norm,

      // Eye & Gaze (6)
      ear_left, ear_right, ear_avg,
      gaze_x, gaze_y, gaze_angle,

      // Deltas (3)
      dh, db, gaze_dev,

      // 1s stats (14)
      mean(dh_1s), std(dh_1s), maxArr(dh_1s), minArr(dh_1s),
      mean(db_1s), std(db_1s), maxArr(db_1s), minArr(db_1s),
      mean(ear_1s), std(ear_1s), minArr(ear_1s),
      mean(gaze_1s), std(gaze_1s), maxArr(gaze_1s),

      // 3s stats (8)
      mean(dh_3s), std(dh_3s), maxArr(dh_3s),
      mean(db_3s), std(db_3s), maxArr(db_3s),
      mean(ear_3s), std(ear_3s),

      // Gaze 3s (2)
      mean(gaze_3s), std(gaze_3s),

      // 5s stats (4)
      mean(dh_5s), variance(dh_5s),
      mean(db_5s), variance(db_5s),

      // 5s ear & gaze (2)
      mean(ear_5s), mean(gaze_5s),

      // Velocities (3)
      dh_vel, db_vel, gaze_vel,

      // Accelerations (2)
      dh_acc, db_acc,

      // Patterns (2)
      head_shake_score, body_fidget_score,

      // Eye & Gaze patterns (2)
      blink_rate, gaze_fixation_duration,

      // Violations (4)
      violations_1min, violations_5min,
      time_since_last, cumulative_violation_time,

      // Meta (4)
      time_in_session, posture_stability,
      face_conf, pose_conf,

      // Quality (1)
      data_quality,
    ];

    if (features.length !== 63) {
      throw new Error(`Expected 63 features, got ${features.length}`);
    }

    return features;
  }
}
