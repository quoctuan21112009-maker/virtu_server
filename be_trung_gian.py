# -*- coding: utf-8 -*-

from __future__ import annotations

import os
import sys
import logging
import argparse
import datetime
import numpy as np

import requests
from flask import Flask, request, Response, stream_with_context, send_from_directory, jsonify
from flask_cors import CORS

# Socket.IO proxy (để forward realtime luôn qua BE trung gian)
import socketio as socketio_client_lib
from flask_socketio import SocketIO, emit, disconnect

# ============================================================
# CẤU HÌNH
# ============================================================
DEFAULT_AI_SERVER_URL = "http://localhost:5000"
AI_SERVER_URL = os.environ.get("AI_SERVER_URL", DEFAULT_AI_SERVER_URL).rstrip("/")

TIMEOUT_MAC_DINH = 30  # giây
TIMEOUT_UPLOAD = 60

# ============================================================
# LOGGING & AUDIT TRAIL (NHẬT KÝ VÀ THIẾT BỊ)
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - VIRTU-Web - %(levelname)s - %(message)s",
)
log = logging.getLogger("VIRTU-Web")

NHAT_KY_HE_THONG = []

def parse_thiet_bi_moi_truong(req) -> dict:
    """Phân tích IP, User-Agent, Hệ điều hành, Trình duyệt và Loại thiết bị."""
    ip = req.headers.get("X-Forwarded-For", req.remote_addr or "127.0.0.1").split(",")[0].strip()
    ua_str = req.headers.get("User-Agent", "Unknown")

    os_name = "Không xác định"
    if "Windows" in ua_str:
        os_name = "Windows"
    elif "Mac OS" in ua_str or "Macintosh" in ua_str:
        os_name = "macOS"
    elif "Android" in ua_str:
        os_name = "Android"
    elif "iPhone" in ua_str or "iPad" in ua_str:
        os_name = "iOS"
    elif "Linux" in ua_str:
        os_name = "Linux"

    browser_name = "Trình duyệt khác"
    if "Edg" in ua_str:
        browser_name = "Edge"
    elif "Chrome" in ua_str:
        browser_name = "Chrome"
    elif "Firefox" in ua_str:
        browser_name = "Firefox"
    elif "Safari" in ua_str and "Chrome" not in ua_str:
        browser_name = "Safari"

    device_type = "Máy tính (Desktop)"
    if "Mobile" in ua_str or "Android" in ua_str or "iPhone" in ua_str:
        device_type = "Điện thoại (Mobile)"
    elif "iPad" in ua_str or "Tablet" in ua_str:
        device_type = "Máy tính bảng (Tablet)"

    return {
        "ip": ip,
        "user_agent": ua_str,
        "he_dieu_hanh": os_name,
        "trinh_duyet": browser_name,
        "loai_thiet_bi": device_type,
    }


def ghi_nhat_ky(su_kien: str, ma_phong: str = "", hoc_sinh_id: str = "", diem: float = 0.0, thiet_bi: dict = None, chi_tiet: str = ""):
    """Ghi nhật ký sự kiện hệ thống kèm thông tin môi trường & thiết bị."""
    thoi_gian = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tb = thiet_bi or {}
    mo_ta_text = f"Phòng: {ma_phong or 'Hệ thống'} | IP: {tb.get('ip', '-')} | HĐH: {tb.get('he_dieu_hanh', '-')} ({tb.get('trinh_duyet', '-')}) | {chi_tiet or 'Hoạt động hợp lệ'}"
    entry = {
        "thoi_gian": thoi_gian,
        "su_kien": su_kien,
        "hanh_dong": su_kien,
        "ma_phong": ma_phong,
        "hoc_sinh_id": hoc_sinh_id,
        "tac_nhan": hoc_sinh_id or "hệ_thống",
        "ket_qua": "SUCCESS",
        "diem": round(diem, 2),
        "thiet_bi": tb,
        "chi_tiet": chi_tiet,
        "mo_ta": mo_ta_text,
    }
    NHAT_KY_HE_THONG.insert(0, entry)
    if len(NHAT_KY_HE_THONG) > 500:
        NHAT_KY_HE_THONG.pop()

    log.info(f"[NHẬT KÝ] {su_kien} | Phòng: {ma_phong} | HS: {hoc_sinh_id} | Điểm: {diem:.1f} | IP: {tb.get('ip')} | HĐH: {tb.get('he_dieu_hanh')} | Browser: {tb.get('trinh_duyet')} ({tb.get('loai_thiet_bi')})")


# ============================================================
# THUẬT TOÁN CHỐNG GIÁN LẬN TÍCH HỢP TRỰC TIẾP TRÊN BE WEB
# ============================================================

class BoDoBatThuongEWMA:
    """
    Bộ dò bất thường theo từng chiều, KHÔNG dùng ma trận hiệp phương sai
    đầy đủ (tránh suy biến/nghịch đảo lỗi như v2), gồm 2 pha:

    Pha 1 - HIỆU CHỈNH (hieu_chinh): tính mean/std CỐ ĐỊNH một lần từ
    buffer calibration (không phải EWMA online ngay từ đầu) -> tránh
    lỗi "variance runaway" đã phát hiện ở bản thử trước.

    Pha 2 - CẬP NHẬT (cap_nhat): mean được trôi rất chậm theo EWMA để
    hấp thụ thay đổi hợp lệ trong thời gian dài. std giữ NGUYÊN từ lúc hiệu chỉnh.
    """
    def __init__(self, so_chieu: int, alpha_mean: float = 0.02, eps: float = 1e-3,
                 nguong_dong_bang_thich_nghi: float = 2.0):
        self.so_chieu = so_chieu
        self.alpha_mean = alpha_mean
        self.eps = eps
        self.nguong_dong_bang_thich_nghi = nguong_dong_bang_thich_nghi
        self.mu = None
        self.std = None
        self._buffer = []
        self._da_hieu_chinh = False
        self.ty_le_frame_bi_loai = 0.0

    def nap_frame_hieu_chinh(self, x: np.ndarray):
        self._buffer.append(np.asarray(x, dtype=np.float64))

    def hieu_chinh_xong(self) -> bool:
        return self._da_hieu_chinh

    def hieu_chinh(self):
        X = np.array(self._buffer, dtype=np.float64)  # (N, so_chieu)

        q1 = np.percentile(X, 25, axis=0)
        q3 = np.percentile(X, 75, axis=0)
        iqr = np.maximum(q3 - q1, self.eps)
        can_duoi, can_tren = q1 - 1.5 * iqr, q3 + 1.5 * iqr

        vuot_nguong = (X < can_duoi) | (X > can_tren)          # (N, so_chieu) bool
        ty_le_vuot_moi_frame = vuot_nguong.mean(axis=1)         # (N,)
        mat_na_giu_lai = ty_le_vuot_moi_frame <= 0.30

        so_frame_bi_loai = int((~mat_na_giu_lai).sum())
        X_sach = X[mat_na_giu_lai] if mat_na_giu_lai.sum() >= max(20, len(X) * 0.5) else X
        self.ty_le_frame_bi_loai = so_frame_bi_loai / max(len(X), 1)

        self.mu = X_sach.mean(axis=0)
        self.std = X_sach.std(axis=0) + self.eps
        self._da_hieu_chinh = True
        self._buffer = []

    def can_tu_dong_hieu_chinh_lai(self, nguong: float = 0.30) -> bool:
        return self.ty_le_frame_bi_loai > nguong

    def cap_nhat(self, x: np.ndarray) -> float:
        x = np.asarray(x, dtype=np.float64)
        do_lech = x - self.mu
        z = do_lech / self.std

        cong_mo = np.abs(z) < self.nguong_dong_bang_thich_nghi
        self.mu = np.where(cong_mo, self.mu + self.alpha_mean * do_lech, self.mu)

        return float(np.sqrt(np.mean(np.clip(z, -8.0, 8.0) ** 2)))

    def dat_lai(self):
        self.mu = None
        self.std = None
        self._buffer = []
        self._da_hieu_chinh = False
        self.ty_le_frame_bi_loai = 0.0


def _sigmoid(z: float, nguong: float, do_doc: float = 1.3) -> float:
    return 1.0 / (1.0 + np.exp(-do_doc * (z - nguong)))


def _cong_thich_nghi(c_mat: float, c_than: float, lam: float) -> tuple:
    """Adaptive weight gate (v5)."""
    a, b = lam * c_mat, lam * c_than
    m = max(a, b)
    e_mat, e_than = np.exp(a - m), np.exp(b - m)
    tong = e_mat + e_than
    return 2.0 * e_mat / tong, 2.0 * e_than / tong


class BoBangChungHaiTang:
    """
    Bộ nhớ bằng chứng hai tầng, O(1) bộ nhớ / O(1) tính toán.
    """
    def __init__(self,
                 forget_binh_thuong: float = 0.965,
                 forget_bat_thuong: float = 0.997,
                 he_so_nap: float = 0.05,
                 nguong_kich_hoat: float = 0.35,
                 nguong_nen: float = 0.30,
                 forget_ngan: float = 0.90,
                 gain_ngan: float = 0.45,
                 nguong_xac_nhan: float = 0.20,
                 gain_dai: float = 0.04):
        self.forget_binh_thuong = float(forget_binh_thuong)
        self.forget_bat_thuong = float(forget_bat_thuong)
        self.he_so_nap = float(he_so_nap)
        self.nguong_kich_hoat = float(nguong_kich_hoat)

        self.nguong_nen = float(nguong_nen)
        self.forget_ngan = float(forget_ngan)
        self.gain_ngan = float(gain_ngan)
        self.nguong_xac_nhan = float(nguong_xac_nhan)
        self.gain_dai = float(gain_dai)

        self.e_short = 0.0
        self.e_long = 0.0

    @property
    def c(self) -> float:
        return self.e_long

    @c.setter
    def c(self, value: float):
        self.e_long = float(np.clip(value, 0.0, 1.0))

    def cap_nhat(self, xac_suat_tuc_thoi: float) -> float:
        p = float(np.clip(xac_suat_tuc_thoi, 0.0, 1.0))

        vuot = max(0.0, p - self.nguong_nen)
        bang_chung = vuot * vuot

        self.e_short = (
            self.forget_ngan * self.e_short
            + self.gain_ngan * bang_chung
        )
        self.e_short = float(np.clip(self.e_short, 0.0, 1.0))

        if self.e_short >= self.nguong_xac_nhan:
            self.e_long = (
                self.forget_bat_thuong * self.e_long
                + self.gain_dai * self.e_short
            )
        else:
            self.e_long = self.forget_binh_thuong * self.e_long

        self.e_long = float(np.clip(self.e_long, 0.0, 1.0))
        return self.e_long

    def dat_lai(self):
        self.e_short = 0.0
        self.e_long = 0.0


class _NguongThichNghiTreDongKep:
    def __init__(self, nguong_nghi_van_fallback=40.0, nguong_gian_lan_fallback=70.0,
                 so_frame_calib=100, k1=0.6, k2=3.2,
                 ty_le_tre_sus=0.85, ty_le_tre_cheat=0.9,
                 n_xac_nhan_vao=1, n_xac_nhan_ra=15):
        self.nguong_nghi_van_fallback = nguong_nghi_van_fallback
        self.nguong_gian_lan_fallback = nguong_gian_lan_fallback
        self.so_frame_calib = so_frame_calib
        self.k1, self.k2 = k1, k2
        self.ty_le_tre_sus, self.ty_le_tre_cheat = ty_le_tre_sus, ty_le_tre_cheat
        self.n_xac_nhan_vao, self.n_xac_nhan_ra = n_xac_nhan_vao, n_xac_nhan_ra

        self.san_nghi_van = (nguong_nghi_van_fallback * 0.4, nguong_nghi_van_fallback * 1.6)
        self.san_gian_lan = (nguong_gian_lan_fallback * 0.65, nguong_gian_lan_fallback * 1.3)

        self._reset_trang_thai()

    def _reset_trang_thai(self):
        self._buf = []
        self._da_calib = False
        self._q_med = self._q_mad = None
        self.enter_sus = self.nguong_nghi_van_fallback
        self.exit_sus = self.nguong_nghi_van_fallback
        self.enter_cheat = self.nguong_gian_lan_fallback
        self.exit_cheat = self.nguong_gian_lan_fallback
        self._trang_thai = "normal"
        self._dem_vao = self._dem_ra = 0

    def dat_lai(self):
        self._reset_trang_thai()

    def _cap_nguong_tu_thong_ke(self):
        a_lo, a_hi = self.san_nghi_van
        b_lo, b_hi = self.san_gian_lan
        self.enter_sus = float(np.clip(self._q_med + self.k1 * self._q_mad, a_lo, a_hi))
        self.enter_cheat = float(np.clip(self._q_med + self.k2 * self._q_mad, b_lo, b_hi))
        self.enter_cheat = max(self.enter_cheat, self.enter_sus + 5.0)
        self.exit_sus = self.enter_sus * self.ty_le_tre_sus
        self.exit_cheat = self.enter_cheat * self.ty_le_tre_cheat

    def cap_nhat(self, diem_100: float) -> str:
        if not self._da_calib:
            self._buf.append(diem_100)
            if diem_100 < self.nguong_nghi_van_fallback:
                self._trang_thai = "normal"
            elif diem_100 < self.nguong_gian_lan_fallback:
                self._trang_thai = "suspicious"
            else:
                self._trang_thai = "cheating"

            if len(self._buf) >= self.so_frame_calib:
                x = np.array(self._buf, dtype=np.float64)
                med = float(np.median(x))
                mad = float(np.median(np.abs(x - med))) * 1.4826 + 1e-6
                self._q_med, self._q_mad = med, mad
                self._cap_nguong_tu_thong_ke()
                self._da_calib = True
                self._buf = []
            return self._trang_thai

        if self._trang_thai == "normal":
            chi_bao = 1.0 if diem_100 < self._q_med else 0.0
            self._q_med += 0.01 * (0.5 - chi_bao)
            self._q_mad += 0.01 * (abs(diem_100 - self._q_med) - self._q_mad)
            self._cap_nguong_tu_thong_ke()

        muc_tieu = self._trang_thai
        if self._trang_thai == "normal":
            if diem_100 >= self.enter_cheat:
                muc_tieu = "cheating"
            elif diem_100 >= self.enter_sus:
                muc_tieu = "suspicious"
        elif self._trang_thai == "suspicious":
            if diem_100 >= self.enter_cheat:
                muc_tieu = "cheating"
            elif diem_100 < self.exit_sus:
                muc_tieu = "normal"
        else:  # cheating
            if diem_100 < self.exit_sus:
                muc_tieu = "normal"
            elif diem_100 < self.exit_cheat:
                muc_tieu = "suspicious"

        if muc_tieu == self._trang_thai:
            self._dem_vao = self._dem_ra = 0
            return self._trang_thai

        muc_do = {"normal": 0, "suspicious": 1, "cheating": 2}
        if muc_do[muc_tieu] > muc_do[self._trang_thai]:
            self._dem_vao += 1
            self._dem_ra = 0
            if self._dem_vao >= self.n_xac_nhan_vao:
                self._trang_thai = muc_tieu
                self._dem_vao = 0
        else:
            self._dem_ra += 1
            self._dem_vao = 0
            if self._dem_ra >= self.n_xac_nhan_ra:
                self._trang_thai = muc_tieu
                self._dem_ra = 0

        return self._trang_thai


class SpatialKinematicNormalizer:
    """
    Bộ chuẩn hóa động học không gian (Spatial Kinematic Normalizer).
    Triệt tiêu Global Shift (lệch ghế / xoay người / đổi góc ngồi).
    """
    def __init__(self, nhom_diem=None, so_chieu_diem: int = 2,
                 so_frame_hoc_tham_chieu: int = 30, chi_so_diem_goc=None):
        self.kich_hoat = nhom_diem is not None
        if not self.kich_hoat:
            return

        nhom_diem_arr = np.asarray(nhom_diem, dtype=np.intp)
        if nhom_diem_arr.ndim != 2 or nhom_diem_arr.shape[1] != so_chieu_diem:
            raise ValueError(
                "nhom_diem phải có dạng (so_diem, so_chieu_diem) - "
                f"nhận được shape {nhom_diem_arr.shape} trong khi "
                f"so_chieu_diem={so_chieu_diem}."
            )

        self._nhom_diem_arr = nhom_diem_arr
        self._flat_idx = nhom_diem_arr.reshape(-1)
        self.so_diem = nhom_diem_arr.shape[0]
        self.so_chieu = so_chieu_diem
        self.so_frame_hoc_tham_chieu = int(so_frame_hoc_tham_chieu)
        self.chi_so_diem_goc = chi_so_diem_goc

        self._buffer_tham_chieu = []
        self._tu_the_tham_chieu = None
        self._da_hoc_tham_chieu = False

    def _trich_diem(self, F_t: np.ndarray) -> np.ndarray:
        return F_t[self._nhom_diem_arr]

    def _center(self, P: np.ndarray) -> np.ndarray:
        goc = P.mean(axis=0) if self.chi_so_diem_goc is None else P[self.chi_so_diem_goc]
        return P - goc

    @staticmethod
    def _kabsch_xoay(P: np.ndarray, Q: np.ndarray) -> np.ndarray:
        H = P.T @ Q
        U, _S, Vt = np.linalg.svd(H)
        dau = np.sign(np.linalg.det(Vt.T @ U.T))
        D = np.eye(P.shape[1])
        D[-1, -1] = dau if dau != 0 else 1.0
        R = Vt.T @ D @ U.T
        return R

    def cap_nhat(self, F_t: np.ndarray) -> np.ndarray:
        if not self.kich_hoat:
            return F_t

        F_t = np.array(F_t, dtype=np.float64, copy=True)
        P = self._trich_diem(F_t)
        P_center = self._center(P)

        if not self._da_hoc_tham_chieu:
            self._buffer_tham_chieu.append(P_center)
            if len(self._buffer_tham_chieu) >= self.so_frame_hoc_tham_chieu:
                self._tu_the_tham_chieu = np.mean(
                    np.stack(self._buffer_tham_chieu, axis=0), axis=0)
                self._da_hoc_tham_chieu = True
                self._buffer_tham_chieu = []
            P_chuan = P_center
        else:
            R = self._kabsch_xoay(P_center, self._tu_the_tham_chieu)
            P_chuan = P_center @ R.T

        F_t[self._flat_idx] = P_chuan.reshape(-1)
        return F_t

    def dat_lai(self):
        if not self.kich_hoat:
            return
        self._buffer_tham_chieu = []
        self._tu_the_tham_chieu = None
        self._da_hoc_tham_chieu = False


class SmartHandDetector:
    """Module logic thông minh xử lý thị giác kiểm tra trạng thái tay"""
    def __init__(self):
        pass

    def detect_hand_status(self, F_t: np.ndarray, p_than: float) -> str:
        pose_conf = float(F_t[61]) if len(F_t) > 61 else 1.0
        face_conf = float(F_t[60]) if len(F_t) > 60 else 1.0

        if pose_conf < 0.35 and face_conf > 0.5:
            return "HAND_COVERING_FACE"

        if p_than > 0.85 and pose_conf < 0.6:
            return "HAND_OUT_OF_FRAME"

        return "NORMAL"


class AudioAnalysisModule:
    """Module phân tích âm thanh nhẹ bằng NumPy"""
    def __init__(self, speech_threshold=0.025, noise_threshold=0.01):
        self.speech_threshold = speech_threshold
        self.noise_threshold = noise_threshold

    def phan_tich_am_thanh(self, audio_data) -> str:
        if audio_data is None or len(audio_data) == 0:
            return "AUDIO_NORMAL"

        try:
            audio_arr = np.asarray(audio_data, dtype=np.float32)
            rms = np.sqrt(np.mean(np.square(audio_arr)))
            zcr = np.sum(np.diff(np.sign(audio_arr)) != 0) / max(len(audio_arr), 1)

            if rms > self.speech_threshold and 0.05 < zcr < 0.3:
                return "SPEECH_DETECTED"
            elif rms > self.noise_threshold:
                return "NOISE_ALERT"
        except Exception:
            pass

        return "AUDIO_NORMAL"


class HopNhatChongGianLan:
    CHI_SO_MAT = [6, 7, 8, 9, 10, 11, 14, 23, 24, 25, 26, 27, 28,
                  35, 36, 37, 38, 43, 44, 47, 52, 53]
    CHI_SO_THAN = [0, 1, 2, 3, 4, 5, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22,
                   29, 30, 31, 32, 33, 34, 39, 40, 41, 42, 45, 46, 48, 49, 50, 51, 59]
    IDX_FACE_CONF = 60
    IDX_POSE_CONF = 61

    def __init__(self, so_frame_hieu_chinh: int = 150,
                 nguong_nghi_van: float = 40.0,
                 nguong_gian_lan: float = 70.0,
                 trong_so_mat: float = 0.65,
                 trong_so_than: float = 0.55,
                 nguong_z_mat: float = 2.2,
                 nguong_z_than: float = 3.0,
                 he_so_tang_toc: float = 0.35,
                 he_so_giam_dan: float = 0.10,
                 nguong_dong_bang_mat: float = 1.8,
                 nguong_dong_bang_than: float = 2.2,
                 trong_so_tich_luy: float = 45.0,
                 forget_binh_thuong: float = 0.965,
                 forget_bat_thuong: float = 0.997,
                 he_so_nap_tich_luy: float = 0.05,
                 nguong_kich_hoat_tich_luy: float = 0.35,
                 he_so_nhay_adaptive: float = 4.0,
                 go_loi: bool = False,
                 so_frame_calib_nguong: int = 100,
                 k1_nguong: float = 0.8,
                 ty_le_tre_sus: float = 0.85,
                 ty_le_tre_cheat: float = 0.9,
                 n_xac_nhan_vao: int = 1,
                 n_xac_nhan_ra: int = 15,
                 nhom_diem_khong_gian=None,
                 so_chieu_diem_khong_gian: int = 2,
                 so_frame_hoc_tham_chieu_khong_gian: int = 30,
                 k2_nguong: float = 4.0,
                 chi_so_diem_goc_khong_gian=None):
        self.so_frame_hieu_chinh = so_frame_hieu_chinh
        self.nguong_nghi_van = nguong_nghi_van
        self.nguong_gian_lan = nguong_gian_lan
        self.trong_so_mat = trong_so_mat
        self.trong_so_than = trong_so_than
        self.nguong_z_mat = nguong_z_mat
        self.nguong_z_than = nguong_z_than
        self.he_so_tang_toc = he_so_tang_toc
        self.he_so_giam_dan = he_so_giam_dan
        self.trong_so_tich_luy = trong_so_tich_luy
        self.he_so_nhay_adaptive = he_so_nhay_adaptive
        self.go_loi = go_loi

        self.bo_mat = BoDoBatThuongEWMA(len(self.CHI_SO_MAT), alpha_mean=0.003,
                                         nguong_dong_bang_thich_nghi=nguong_dong_bang_mat)
        self.bo_than = BoDoBatThuongEWMA(len(self.CHI_SO_THAN), alpha_mean=0.02,
                                          nguong_dong_bang_thich_nghi=nguong_dong_bang_than)
        self.bo_tich_luy = BoBangChungHaiTang(
            forget_binh_thuong=forget_binh_thuong,
            forget_bat_thuong=forget_bat_thuong,
            he_so_nap=he_so_nap_tich_luy,
            nguong_kich_hoat=nguong_kich_hoat_tich_luy,
            nguong_nen=0.30,
            forget_ngan=0.90,
            gain_ngan=0.45,
            nguong_xac_nhan=0.20,
            gain_dai=0.04,
        )

        self._bo_nguong = _NguongThichNghiTreDongKep(
            nguong_nghi_van_fallback=nguong_nghi_van,
            nguong_gian_lan_fallback=nguong_gian_lan,
            so_frame_calib=so_frame_calib_nguong,
            k1=k1_nguong, k2=k2_nguong,
            ty_le_tre_sus=ty_le_tre_sus, ty_le_tre_cheat=ty_le_tre_cheat,
            n_xac_nhan_vao=n_xac_nhan_vao, n_xac_nhan_ra=n_xac_nhan_ra,
        )

        self._chuan_hoa_khong_gian = SpatialKinematicNormalizer(
            nhom_diem=nhom_diem_khong_gian,
            so_chieu_diem=so_chieu_diem_khong_gian,
            so_frame_hoc_tham_chieu=so_frame_hoc_tham_chieu_khong_gian,
            chi_so_diem_goc=chi_so_diem_goc_khong_gian,
        )

        self._so_frame_da_thu = 0
        self._diem_hien_thi = 0.0
        self._lan_thu_hieu_chinh = 0
        self.san_sang = False

        self._hand_detector = SmartHandDetector()
        self._audio_module = AudioAnalysisModule()
        self._dem_hard_rule = 0
        self._NGUONG_FRAME_HARD_RULE = 2

    def tien_do_hieu_chinh(self) -> dict:
        da_thu = min(self._so_frame_da_thu, self.so_frame_hieu_chinh)
        canh_bao = None
        if self.san_sang:
            ty_le_mat = self.bo_mat.ty_le_frame_bi_loai
            ty_le_than = self.bo_than.ty_le_frame_bi_loai
            if ty_le_mat > 0.15 or ty_le_than > 0.15:
                canh_bao = (f"Hiệu chỉnh có {ty_le_mat*100:.0f}% (mắt) / "
                            f"{ty_le_than*100:.0f}% (thân) khung hình bất thường bị loại.")
        return {
            'trang_thai': 'GIAM_SAT' if self.san_sang else 'CALIBRATING',
            'so_frame_da_thu': da_thu,
            'so_frame_can': self.so_frame_hieu_chinh,
            'hoan_thanh': self.san_sang,
            'canh_bao_calib': canh_bao,
        }

    def dat_lai(self):
        self.bo_mat.dat_lai()
        self.bo_than.dat_lai()
        self.bo_tich_luy.dat_lai()
        self._bo_nguong.dat_lai()
        self._chuan_hoa_khong_gian.dat_lai()
        self._so_frame_da_thu = 0
        self._diem_hien_thi = 0.0
        self.san_sang = False

    def cap_nhat(self, F_t: np.ndarray, audio_data=None, trang_thai_tay: str = "NORMAL"):
        F_t = np.asarray(F_t, dtype=np.float64)
        F_t = self._chuan_hoa_khong_gian.cap_nhat(F_t)
        self._so_frame_da_thu += 1

        if not self.bo_mat.hieu_chinh_xong():
            self.bo_mat.nap_frame_hieu_chinh(F_t[self.CHI_SO_MAT])
            self.bo_than.nap_frame_hieu_chinh(F_t[self.CHI_SO_THAN])
            if self._so_frame_da_thu >= self.so_frame_hieu_chinh:
                self.bo_mat.hieu_chinh()
                self.bo_than.hieu_chinh()
                if (self.bo_mat.can_tu_dong_hieu_chinh_lai() or self.bo_than.can_tu_dong_hieu_chinh_lai()) \
                        and self._lan_thu_hieu_chinh < 3:
                    self.bo_mat.dat_lai()
                    self.bo_than.dat_lai()
                    self._so_frame_da_thu = 0
                    self._lan_thu_hieu_chinh += 1
                else:
                    self.san_sang = True
            return None

        z_mat = self.bo_mat.cap_nhat(F_t[self.CHI_SO_MAT])
        z_than = self.bo_than.cap_nhat(F_t[self.CHI_SO_THAN])

        p_mat = _sigmoid(z_mat, self.nguong_z_mat)
        p_than = _sigmoid(z_than, self.nguong_z_than)

        he_so_khuech_dai_than = 0.7 + 0.3 * p_mat
        p_than_hieu_dung = p_than * he_so_khuech_dai_than

        face_conf = F_t[self.IDX_FACE_CONF] if len(F_t) > self.IDX_FACE_CONF else 1.0
        pose_conf = F_t[self.IDX_POSE_CONF] if len(F_t) > self.IDX_POSE_CONF else 1.0
        do_tin_cay = float(np.clip(min(face_conf, pose_conf), 0.75, 1.0))

        gate_mat, gate_than = _cong_thich_nghi(
            float(face_conf), float(pose_conf),
            self.he_so_nhay_adaptive)
        w_mat_hieu_dung = self.trong_so_mat * gate_mat
        w_than_hieu_dung = self.trong_so_than * gate_than

        xac_suat_tuc_thoi = (w_mat_hieu_dung * p_mat +
                              w_than_hieu_dung * p_than_hieu_dung) * do_tin_cay
        xac_suat_tuc_thoi = float(np.clip(xac_suat_tuc_thoi, 0.0, 1.0))
        c_t = self.bo_tich_luy.cap_nhat(xac_suat_tuc_thoi)
        e_short = self.bo_tich_luy.e_short
        e_long = self.bo_tich_luy.e_long

        intensity = xac_suat_tuc_thoi
        w_i, w_is, w_l = 0.15, 0.55, 0.30

        risk = (
            w_i * intensity
            + w_is * intensity * e_short
            + w_l * e_long
        )
        risk = float(np.clip(risk, 0.0, 1.0))

        diem_tuc_thoi = float(np.clip(risk * 100.0, 0.0, 100.0))

        if diem_tuc_thoi > self._diem_hien_thi:
            self._diem_hien_thi += self.he_so_tang_toc * (
                diem_tuc_thoi - self._diem_hien_thi
            )
        else:
            he_so_giam_thuc = max(self.he_so_giam_dan, 0.18)
            self._diem_hien_thi += he_so_giam_thuc * (
                diem_tuc_thoi - self._diem_hien_thi
            )

        diem_100 = float(np.clip(self._diem_hien_thi, 0.0, 100.0))
        nhan = self._bo_nguong.cap_nhat(diem_100)

        ly_do_hard_rule = ""
        hand_status = trang_thai_tay
        if hand_status == "NORMAL" and self.san_sang:
            hand_status = self._hand_detector.detect_hand_status(F_t, p_than)

        trang_thai_am_thanh = self._audio_module.phan_tich_am_thanh(audio_data)

        co_nghi_tay = hand_status in ("HAND_OUT_OF_FRAME", "HAND_COVERING_FACE")
        co_nghi_am = trang_thai_am_thanh == "SPEECH_DETECTED"

        if co_nghi_tay and co_nghi_am:
            self._dem_hard_rule += 1
            if self._dem_hard_rule >= self._NGUONG_FRAME_HARD_RULE:
                nhan = "cheating"
                diem_100 = max(diem_100, 90.0)
                self._diem_hien_thi = max(self._diem_hien_thi, 90.0)
                ly_do_hard_rule = f"hard_rule:{hand_status}+{trang_thai_am_thanh}"
        else:
            self._dem_hard_rule = 0

        return {
            "diem_100": round(diem_100, 2),
            "nhan": nhan,
            "ly_do_hard_rule": ly_do_hard_rule,
            "chi_tiet": {
                "z_mat": round(z_mat, 3),
                "z_than": round(z_than, 3),
                "p_mat": round(p_mat, 3),
                "p_than": round(p_than, 3),
                "p_than_hieu_dung": round(p_than_hieu_dung, 3),
                "gate_mat": round(gate_mat, 3),
                "gate_than": round(gate_than, 3),
                "trong_so_mat_hieu_dung": round(w_mat_hieu_dung, 3),
                "trong_so_than_hieu_dung": round(w_than_hieu_dung, 3),
                "do_tin_cay": round(do_tin_cay, 3),
                "c_t_tich_luy": round(c_t, 3),
                "evidence_ngan_han": round(e_short, 3),
                "evidence_dai_han": round(e_long, 3),
                "risk_cuong_do": round(intensity, 3),
                "risk_w_i": w_i,
                "risk_w_is": w_is,
                "risk_w_long": w_l,
                "diem_tuc_thoi": round(diem_tuc_thoi, 2),
                "trang_thai_tay": hand_status,
                "trang_thai_am_thanh": trang_thai_am_thanh,
                "nguong_vao_suspicious": round(self._bo_nguong.enter_sus, 2),
                "nguong_vao_cheating": round(self._bo_nguong.enter_cheat, 2),
                "nguong_ra_suspicious": round(self._bo_nguong.exit_sus, 2),
                "nguong_ra_cheating": round(self._bo_nguong.exit_cheat, 2),
            },
        }


# Dynamic session memory for risk scoring engines
SESSION_ENGINES: dict[tuple[str, str], HopNhatChongGianLan] = {}

# ============================================================
# FLASK APP
# ============================================================
THU_MUC_GOC = os.path.dirname(os.path.abspath(__file__))
THU_MUC_FE = os.path.join(THU_MUC_GOC, "static_fe")

app = Flask(__name__, static_folder=THU_MUC_FE, static_url_path="")
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

HEADER_LOAI_BO_REQUEST = {"host", "content-length", "connection"}
HEADER_LOAI_BO_RESPONSE = {
    "content-encoding", "content-length", "transfer-encoding", "connection",
    "access-control-allow-origin", "access-control-allow-methods",
    "access-control-allow-headers", "access-control-allow-credentials",
}


def _tieu_de_forward_di() -> dict:
    return {
        k: v for k, v in request.headers.items()
        if k.lower() not in HEADER_LOAI_BO_REQUEST
    }


def _tieu_de_forward_ve(resp: requests.Response) -> list:
    return [
        (k, v) for k, v in resp.raw.headers.items()
        if k.lower() not in HEADER_LOAI_BO_RESPONSE
    ]


# ============================================================
# API ENDPOINTS XỬ LÝ TRỰC TIẾP TRÊN BE WEB
# ============================================================

@app.route("/api/cham_diem_rui_ro", methods=["POST", "OPTIONS"])
def api_cham_diem_rui_ro():
    """Chấm điểm rủi ro trực tiếp trên BE web không cần AI Server riêng."""
    if request.method == "OPTIONS":
        return Response(status=204)

    data = request.get_json(force=True, silent=True) or {}
    ma_phong = data.get("ma_phong", "DEFAULT")
    hoc_sinh_id = data.get("hoc_sinh_id", "DEFAULT")
    feature_vector = data.get("feature_vector")
    audio_data = data.get("audio_data", None)
    trang_thai_tay = data.get("trang_thai_tay", "NORMAL")

    if not feature_vector:
        return jsonify({"loi": "Thiếu feature_vector (63 chiều)"}), 400

    key = (str(ma_phong), str(hoc_sinh_id))
    if key not in SESSION_ENGINES:
        SESSION_ENGINES[key] = HopNhatChongGianLan()

    engine = SESSION_ENGINES[key]
    res = engine.cap_nhat(feature_vector, audio_data=audio_data, trang_thai_tay=trang_thai_tay)

    thiet_bi = parse_thiet_bi_moi_truong(request)

    if res is None:
        progress = engine.tien_do_hieu_chinh()
        return jsonify({
            "trang_thai": "CALIBRATING",
            "tien_do": progress,
            "diem_100": 0.0,
            "nhan": "calibrating",
            "thiet_bi": thiet_bi,
        })

    if res["nhan"] in ("suspicious", "cheating") or engine._so_frame_da_thu % 100 == 0:
        ghi_nhat_ky(
            su_kien=f"DANG_GIAM_SAT_{res['nhan'].upper()}",
            ma_phong=ma_phong,
            hoc_sinh_id=hoc_sinh_id,
            diem=res["diem_100"],
            thiet_bi=thiet_bi,
            chi_tiet=res.get("ly_do_hard_rule") or f"nhan={res['nhan']}",
        )

    return jsonify({
        "trang_thai": "OK",
        "diem_100": res["diem_100"],
        "nhan": res["nhan"],
        "ly_do_hard_rule": res["ly_do_hard_rule"],
        "chi_tiet": res["chi_tiet"],
        "thiet_bi": thiet_bi,
    })


@app.route("/api/nhat_ky", methods=["GET"])
def api_lay_nhat_ky():
    """Trả về nhật ký hệ thống kèm thông tin thiết bị và môi trường."""
    gioi_han = request.args.get("gioi_han", 100, type=int)
    thiet_bi_hien_tai = parse_thiet_bi_moi_truong(request)
    return jsonify({
        "nhat_ky": NHAT_KY_HE_THONG[:gioi_han],
        "thiet_bi_yeu_cau": thiet_bi_hien_tai,
    })


@app.route("/api/nhat_ky/xoa", methods=["POST"])
def api_xoa_nhat_ky():
    """Xóa nhật ký hệ thống."""
    global NHAT_KY_HE_THONG
    NHAT_KY_HE_THONG = []
    thiet_bi = parse_thiet_bi_moi_truong(request)
    ghi_nhat_ky("XOA_NHAT_KY", thiet_bi=thiet_bi, chi_tiet="Người dùng yêu cầu xóa log nhật ký")
    return jsonify({"trang_thai": "ok"})


@app.route(
    "/api/<path:duong_dan>",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
def proxy_api(duong_dan: str):
    """
    Forward các API chưa có local handler sang AI_SERVER_URL nếu có,
    hoặc trả phản hồi phù hợp nếu AI Server không chạy.
    """
    if request.method == "OPTIONS":
        return Response(status=204)

    thiet_bi = parse_thiet_bi_moi_truong(request)
    if "dang_nhap" in duong_dan or "tham_gia" in duong_dan:
        ghi_nhat_ky(f"API_{duong_dan.upper()}", thiet_bi=thiet_bi)

    url_dich = f"{AI_SERVER_URL}/api/{duong_dan}"

    try:
        resp = requests.request(
            method=request.method,
            url=url_dich,
            headers=_tieu_de_forward_di(),
            params=request.args,
            data=request.get_data(),
            timeout=TIMEOUT_UPLOAD if "tai_len" in duong_dan or "du_lieu" in duong_dan else TIMEOUT_MAC_DINH,
            stream=True,
        )
    except requests.exceptions.ConnectionError:
        log.warning(f"AI Server tại {AI_SERVER_URL} không phản hồi cho /api/{duong_dan}")
        return jsonify({"loi": f"Server AI ({AI_SERVER_URL}) chưa sẵn sàng, backend web đang hoạt động độc lập."}), 502
    except requests.exceptions.Timeout:
        return jsonify({"loi": "Server AI phản hồi quá chậm (timeout)"}), 504
    except Exception as e:
        return jsonify({"loi": f"Lỗi gateway: {e}"}), 502

    return Response(
        stream_with_context(resp.iter_content(chunk_size=8192)),
        status=resp.status_code,
        headers=_tieu_de_forward_ve(resp),
    )


@app.route("/health")
def health():
    trang_thai_ai = "unknown"
    try:
        r = requests.get(f"{AI_SERVER_URL}/health", timeout=3)
        trang_thai_ai = "ok" if r.status_code < 500 else f"loi_{r.status_code}"
    except Exception:
        trang_thai_ai = "khong_ket_noi_duoc"

    thiet_bi = parse_thiet_bi_moi_truong(request)

    return {
        "gateway": "ok",
        "be_web_algorithm": "integrated",
        "ai_server_url": AI_SERVER_URL,
        "ai_server_trang_thai": trang_thai_ai,
        "thiet_bi_moi_truong": thiet_bi,
    }


# ============================================================
# PHỤC VỤ FRONTEND TĨNH
# ============================================================
@app.route("/")
def fe_trang_chu():
    return send_from_directory(THU_MUC_FE, "index.html")


@app.route("/<path:duong_dan_file>")
def fe_file_tinh(duong_dan_file: str):
    duong_dan_day_du = os.path.join(THU_MUC_FE, duong_dan_file)
    if os.path.isfile(duong_dan_day_du):
        return send_from_directory(THU_MUC_FE, duong_dan_file)
    return send_from_directory(THU_MUC_FE, "index.html")


# ============================================================
# SOCKET.IO REALTIME
# ============================================================
_KET_NOI_UPSTREAM: dict[str, socketio_client_lib.Client] = {}

SU_KIEN_TU_SERVER = [
    "trang_thai_hoc_sinh", "hoc_sinh_vao_phong", "hoc_sinh_mat_ket_noi",
    "vi_pham_moi", "phong_da_dong", "trang_thai_phien", "yeu_cau_reset",
]
SU_KIEN_TU_CLIENT = [
    "vao_phong_giam_sat", "roi_phong_giam_sat", "hoc_sinh_vao", "cap_nhat_trang_thai",
]


@socketio.on("connect")
def khi_ket_noi(auth=None):
    sid = request.sid
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    thiet_bi = parse_thiet_bi_moi_truong(request)
    ghi_nhat_ky("SOCKET_CONNECT", thiet_bi=thiet_bi, chi_tiet=f"Socket SID: {sid}")

    upstream = socketio_client_lib.Client(reconnection=True, reconnection_attempts=3)

    def _dong_goi_forward(ten_su_kien):
        def _handler(data):
            socketio.emit(ten_su_kien, data, room=sid)
        return _handler

    for ten in SU_KIEN_TU_SERVER:
        upstream.on(ten, _dong_goi_forward(ten))

    try:
        upstream.connect(
            AI_SERVER_URL,
            auth={"token": token},
            transports=["websocket"],
            wait_timeout=3,
        )
        _KET_NOI_UPSTREAM[sid] = upstream
        log.info(f"[Socket.IO] FE {sid} <-> AI server: đã nối")
    except Exception:
        log.info(f"[Socket.IO] FE {sid} kết nối trực tiếp BE Web (không cần AI Server)")


@socketio.on("disconnect")
def khi_ngat_ket_noi():
    sid = request.sid
    upstream = _KET_NOI_UPSTREAM.pop(sid, None)
    if upstream:
        try:
            upstream.disconnect()
        except Exception:
            pass
    log.info(f"[Socket.IO] FE {sid}: đã ngắt")


def _dang_ky_forward_tu_client(ten_su_kien):
    @socketio.on(ten_su_kien)
    def _handler(data):
        sid = request.sid
        upstream = _KET_NOI_UPSTREAM.get(sid)
        if upstream and upstream.connected:
            upstream.emit(ten_su_kien, data)
    _handler.__name__ = f"_forward_{ten_su_kien}"
    return _handler


for _ten in SU_KIEN_TU_CLIENT:
    _dang_ky_forward_tu_client(_ten)


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VIRTU BE Web Server (Tích hợp AI Engine)")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=6100)
    parser.add_argument("--prod", action="store_true", help="Chạy bằng gevent WSGIServer (production)")
    args = parser.parse_args()

    log.info(f"VIRTU BE Web Server khởi động tại port {args.port} — Thuật toán chống gian lận đã được tích hợp trực tiếp!")

    if args.prod:
        from gevent import monkey
        monkey.patch_all()
        from gevent.pywsgi import WSGIServer
        from geventwebsocket.handler import WebSocketHandler

        log.info(f"Gevent WSGIServer đang lắng nghe tại {args.host}:{args.port}")
        http_server = WSGIServer((args.host, args.port), app, handler_class=WebSocketHandler)
        http_server.serve_forever()
    else:
        socketio.run(app, host=args.host, port=args.port, debug=True, allow_unsafe_werkzeug=True)
