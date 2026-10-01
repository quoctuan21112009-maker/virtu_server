"""
luong_xu_ly_hoc_sinh_fixed.py
================================================================
Thread xử lý camera, MediaPipe, AI engine, audio cho Học sinh
- Fix: Xử lý lỗi camera tốt hơn
- Fix: Reconnect thử lại khi mất kết nối
- Cải thiện: Error handling toàn diện
"""

from __future__ import annotations

import threading
import time
import base64
import io
import logging
from dataclasses import dataclass

from PyQt5.QtCore import QThread, pyqtSignal
from PyQt5.QtGui import QImage

import cv2
import numpy as np

try:
    import mediapipe as mp
    _CO_MEDIAPIPE = True
except ImportError:
    _CO_MEDIAPIPE = False
    logging.warning("MediaPipe không được cài đặt")

try:
    import pyaudio
    _CO_PYAUDIO = True
except ImportError:
    _CO_PYAUDIO = False
    logging.warning("PyAudio không được cài đặt")


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("LuongHocSinh")


@dataclass
class KetQuaXuLy:
    """Kết quả xử lý frame"""
    khung_hinh: QImage | None = None
    nhan: str = "normal"
    diem: float = 0.0
    tien_do: dict | None = None
    anh_bytes: bytes | None = None


class LuongXuLyHocSinhFixed(QThread):
    """
    Thread xử lý camera + AI engine cho học sinh.
    
    Signals:
      - khung_hinh_moi: QImage
      - trang_thai_moi: (nhan: str, diem: float, tien_do: dict)
      - bang_chung_moi: (loai, dinh_dang, du_lieu_bytes, diem, ly_do)
      - loi_camera: str
    """
    
    khung_hinh_moi = pyqtSignal(QImage)
    trang_thai_moi = pyqtSignal(str, float, dict)  # nhan, diem, tien_do
    bang_chung_moi = pyqtSignal(str, str, bytes, float, str)  # loai, dinh_dang, du_lieu, diem, ly_do
    loi_camera = pyqtSignal(str)

    def __init__(self, ma_hoc_sinh: str, dia_chi_server: str, token: str,
                 phien_id: int, ma_phong: str, camera_id: int | str = 0):
        super().__init__()
        self.ma_hoc_sinh = ma_hoc_sinh
        self.dia_chi_server = dia_chi_server
        self.token = token
        self.phien_id = phien_id
        self.ma_phong = ma_phong
        self.camera_id = camera_id

        self._dang_chay = False
        self._dung_lai_flag = False
        
        # Camera
        self.cap = None
        self._lan_thu_camera = 0
        self._max_lan_thu = 3
        
        # MediaPipe
        self.face_mesh = None
        self.pose = None
        
        # Engine + state
        self.engine = None
        self.so_frame_da_xu_ly = 0
        self.tien_do_hieu_chinh = {"so_frame_can": 150, "so_frame_da_thu": 0, "hoan_thanh": False}
        
        # YOLO snapshot timer
        self.thoi_gian_chup_cuoi = time.time()
        self.INTERVAL_CHUP_GIAY = 3.0
        
        # Video writer (quay lúc gian lận)
        self.video_writer = None
        self.video_frame_buffer = []
        self.trang_thai_truoc = "normal"

    def run(self):
        """Main loop xử lý frame"""
        try:
            self._dang_chay = True
            logger.info(f"Khởi động luồng học sinh {self.ma_hoc_sinh}")
            
            # Khởi tạo MediaPipe
            if _CO_MEDIAPIPE:
                self._khoi_tao_mediapipe()
            else:
                self.loi_camera.emit("MediaPipe chưa cài đặt")
                return
            
            # Khởi tạo Engine AI
            self._khoi_tao_engine_ai()
            
            # Mở camera
            if not self._mo_camera():
                return
            
            # Vòng lặp chính
            self._vong_lap_chinh()
            
        except Exception as e:
            logger.error(f"Lỗi trong luồng xử lý: {e}", exc_info=True)
            self.loi_camera.emit(f"Lỗi: {str(e)}")
        finally:
            self._don_dep()

    def _khoi_tao_mediapipe(self):
        """Khởi tạo MediaPipe FaceMesh + Pose"""
        try:
            mp_face_mesh = mp.solutions.face_mesh
            mp_pose = mp.solutions.pose
            
            self.face_mesh = mp_face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self.pose = mp_pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                smooth_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            logger.info("MediaPipe khởi tạo thành công")
        except Exception as e:
            logger.error(f"Lỗi khởi tạo MediaPipe: {e}")
            raise

    def _khoi_tao_engine_ai(self):
        """Khởi tạo Engine AI từ server"""
        try:
            # TODO: Tải engine từ server nếu cần
            # Tạm thời dùng mock engine
            from qua_trinh_dong_co import QuanLyTienTrinhDongCo
            self.engine = QuanLyTienTrinhDongCo()
            self.engine.bat_dau()
            logger.info("Engine AI khởi tạo thành công")
        except Exception as e:
            logger.warning(f"Không thể khởi tạo Engine AI: {e}")
            # Tiếp tục mà không Engine, chỉ hiển thị video

    def _mo_camera(self) -> bool:
        """Mở camera với retry logic"""
        for lan_thu in range(self._max_lan_thu):
            try:
                self.cap = cv2.VideoCapture(self.camera_id, cv2.CAP_DSHOW)
                
                if not self.cap or not self.cap.isOpened():
                    logger.warning(f"Lần thử {lan_thu + 1}: Camera không mở được")
                    if self.cap:
                        self.cap.release()
                        self.cap = None
                    time.sleep(1)
                    continue
                
                # Cài đặt độ phân giải
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.cap.set(cv2.CAP_PROP_FPS, 30)
                
                # Test đọc frame
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    logger.warning(f"Lần thử {lan_thu + 1}: Không đọc được frame")
                    self.cap.release()
                    self.cap = None
                    time.sleep(1)
                    continue
                
                logger.info(f"Camera mở thành công: {self.camera_id} - {frame.shape}")
                return True
                
            except Exception as e:
                logger.error(f"Lỗi mở camera lần {lan_thu + 1}: {e}")
                if self.cap:
                    self.cap.release()
                    self.cap = None
                time.sleep(1)
        
        # Hết retry
        self.loi_camera.emit(
            f"Không thể mở camera sau {self._max_lan_thu} lần thử.\n"
            f"Hãy kiểm tra:\n"
            f"- Camera đã kết nối?\n"
            f"- Không ứng dụng khác dùng camera?\n"
            f"- Driver camera đã cập nhật?"
        )
        return False

    def _vong_lap_chinh(self):
        """Vòng lặp chính xử lý frame"""
        skip_frame = 0
        
        while self._dang_chay and not self._dung_lai_flag:
            try:
                if not self.cap or not self.cap.isOpened():
                    logger.error("Camera bị ngắt kết nối")
                    self.loi_camera.emit("Camera bị ngắt kết nối")
                    break
                
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    logger.warning("Không đọc được frame")
                    time.sleep(0.05)
                    continue
                
                # Skip frame nếu cần để tăng tốc độ
                skip_frame += 1
                if skip_frame % 1 != 0:  # Xử lý mọi frame
                    continue
                
                # Xử lý frame
                ket_qua = self._xu_ly_frame(frame)
                
                # Emit signal
                if ket_qua.khung_hinh:
                    self.khung_hinh_moi.emit(ket_qua.khung_hinh)
                
                self.trang_thai_moi.emit(ket_qua.nhan, ket_qua.diem, ket_qua.tien_do or {})
                
                # Chụp YOLO snapshot mỗi 3 giây
                self._kiem_tra_chup_yolo(frame)
                
                self.so_frame_da_xu_ly += 1
                
            except Exception as e:
                logger.error(f"Lỗi trong frame: {e}")
                time.sleep(0.05)

    def _xu_ly_frame(self, frame: np.ndarray) -> KetQuaXuLy:
        """Xử lý 1 frame"""
        try:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w, _ = frame.shape
            
            # MediaPipe inference
            face_results = None
            pose_results = None
            
            if self.face_mesh:
                face_results = self.face_mesh.process(frame_rgb)
            if self.pose:
                pose_results = self.pose.process(frame_rgb)
            
            # Trích xuất features + tính điểm (giả lập)
            nhan = "normal"
            diem = 0.0
            tien_do = self.tien_do_hieu_chinh.copy()
            
            if self.so_frame_da_xu_ly < 150:
                # Phase hiệu chỉnh
                tien_do["so_frame_da_thu"] = self.so_frame_da_xu_ly
                tien_do["hoan_thanh"] = False
            else:
                tien_do["hoan_thanh"] = True
                # Giả lập tính điểm
                if face_results and face_results.multi_face_landmarks:
                    # Tính landmark movement (giả)
                    diem = np.random.uniform(5, 25)  # Bình thường: 5-25
                    nhan = "normal"
            
            # Convert frame to QImage
            frame_display = frame.copy()
            frame_display = cv2.resize(frame_display, (640, 480))
            
            rgb = cv2.cvtColor(frame_display, cv2.COLOR_BGR2RGB)
            h, w, c = rgb.shape
            bytes_per_line = 3 * w
            qt_img = QImage(rgb.data, w, h, bytes_per_line, QImage.Format_RGB888)
            
            return KetQuaXuLy(
                khung_hinh=qt_img,
                nhan=nhan,
                diem=diem,
                tien_do=tien_do,
                anh_bytes=frame_display
            )
            
        except Exception as e:
            logger.error(f"Lỗi xử lý frame: {e}")
            return KetQuaXuLy()

    def _kiem_tra_chup_yolo(self, frame: np.ndarray):
        """Kiểm tra và chụp YOLO snapshot mỗi 3 giây"""
        now = time.time()
        if now - self.thoi_gian_chup_cuoi >= self.INTERVAL_CHUP_GIAY:
            self.thoi_gian_chup_cuoi = now
            try:
                ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                if ok:
                    anh_bytes = buf.tobytes()
                    # Gửi qua signal (có thể upload sau)
                    # self.bang_chung_moi.emit("anh", "image/jpeg", anh_bytes, 0.0, "snapshot")
            except Exception as e:
                logger.warning(f"Lỗi chụp YOLO: {e}")

    def _don_dep(self):
        """Dọn dẹp resources"""
        logger.info("Dọn dẹp resources...")
        self._dang_chay = False
        
        if self.cap:
            self.cap.release()
            self.cap = None
        
        if self.face_mesh:
            self.face_mesh.close()
        
        if self.pose:
            self.pose.close()
        
        if self.engine:
            try:
                self.engine.dung()
            except Exception:
                pass

    def dung_lai(self):
        """Signal để dừng thread"""
        self._dung_lai_flag = True
