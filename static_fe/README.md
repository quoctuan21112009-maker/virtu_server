# VIRTU Web — Frontend giám sát thi cử AI

Bản chuyển đổi **frontend web** thay thế 100% giao diện PyQt5 gốc
(`giao_dien_dang_nhap.py`, `giao_dien_hoc_sinh.py`, `giao_dien_giao_vien.py`,
`giao_dien_quan_tri.py`...) — giữ nguyên **y hệt tên endpoint, field,
event Socket.IO, logic 63-đặc-trưng** để cắm thẳng vào backend hiện có
của bạn mà không cần sửa REST API.

Không cần build tool (Vite/Webpack...) — chạy thẳng bằng ES Modules
qua 1 static server bất kỳ.

## 1. Cấu trúc thư mục

```
virtu-web/
├── index.html            # Trang đăng nhập/đăng ký
├── hoc_sinh.html          # Trang học sinh (webcam + AI + gửi vi phạm)
├── giao_vien.html         # Trang giáo viên (tạo phòng + giám sát)
├── quan_tri.html          # Trang quản trị (toàn trường + tạo hàng loạt)
├── css/
│   ├── theme.css          # Design system (từ giao_dien_style.py)
│   ├── layout.css         # Bố cục header/sidebar/lưới giám sát
│   └── dang_nhap.css      # Riêng cho trang đăng nhập
└── js/
    ├── core/
    │   ├── ket_noi_client.js       # RESTClient + KetNoiThoiGianThuc (Socket.IO)
    │   ├── ngon_ngu.js              # Đa ngôn ngữ vi/en/zh
    │   ├── giao_dien_style.js       # Theme dark/light + màu theo nhãn
    │   ├── tinh_hieu_mediapipe.js   # 17 tín hiệu thô từ MediaPipe Tasks Vision (Google)
    │   ├── trich_xuat_dac_trung.js  # 63 đặc trưng + Kalman filter
    │   └── bao_cao.js               # Xuất PDF/CSV
    └── pages/
        ├── dang_nhap.js
        ├── hoc_sinh.js
        ├── giao_vien.js
        ├── quan_tri.js
        ├── luoi_giam_sat.js         # Lưới ô vuông giám sát (dùng chung GV/QT)
        ├── o_vuong_hoc_sinh.js      # 1 ô học sinh trong lưới
        └── xem_bang_chung_vi_pham.js # Dialog xem ảnh/video vi phạm
```

## 2. Chạy thử cục bộ

Do dùng ES Modules (`import`/`export`), bạn cần chạy qua HTTP server,
không mở trực tiếp bằng `file://`:

```bash
cd virtu-web
python3 -m http.server 8080
# hoặc: npx serve .
```

Mở `http://localhost:8080/index.html`.

## 3. Những gì backend của bạn cần cung cấp

### 3.1. REST API — giữ nguyên y hệt `ket_noi_client.py`

| Hàm JS (`RESTClient`)         | Method | Endpoint                                      |
|--------------------------------|--------|------------------------------------------------|
| `dang_ky`                       | POST   | `/api/dang_ky`                                 |
| `dang_ky_hang_loat`             | POST   | `/api/dang_ky_hang_loat`                       |
| `dang_nhap`                     | POST   | `/api/dang_nhap`                               |
| `tao_phong`                     | POST   | `/api/tao_phong`                               |
| `dong_phong`                    | POST   | `/api/dong_phong`                              |
| `tham_gia_phong`                | POST   | `/api/tham_gia_phong`                          |
| `thong_tin_phong`               | GET    | `/api/phong/{ma_phong}`                        |
| `phong_cua_truong`              | GET    | `/api/phong_cua_truong`                        |
| `bat_dau_phong`                 | POST   | `/api/phong/{ma_phong}/start`                  |
| `tam_dung_phong`                | POST   | `/api/phong/{ma_phong}/pause`                  |
| `reset_hoc_sinh`                | POST   | `/api/phong/{ma_phong}/reset/{hoc_sinh_id}`    |
| `tam_dung_hoc_sinh`             | POST   | `/api/phong/{ma_phong}/pause/{hoc_sinh_id}`    |
| `tiep_tuc_hoc_sinh`             | POST   | `/api/phong/{ma_phong}/resume/{hoc_sinh_id}`   |
| `vi_pham_theo_phong`            | GET    | `/api/vi_pham/{phien_id}`                      |
| `vi_pham_theo_hoc_sinh`         | GET    | `/api/vi_pham/hoc_sinh/{phien_id}/{hoc_sinh_id}` |
| `tai_du_lieu_bang_chung`        | GET    | `/api/vi_pham/{vi_pham_id}/du_lieu`            |
| `tai_len_vi_pham`               | POST   | `/api/tai_len_vi_pham`                         |
| `danh_sach_nguoi_dung`          | GET    | `/api/danh_sach_nguoi_dung?vai_tro=...`        |
| `thong_ke_tong_quan`            | GET    | `/api/thong_ke_tong_quan`                      |
| `bao_cao_phien`                 | GET    | `/api/bao_cao_phien/{phien_id}`                |
| `lay_nhat_ky`                   | GET    | `/api/nhat_ky?gioi_han=...`                    |
| `xoa_nhat_ky`                   | POST   | `/api/nhat_ky/xoa`                             |

Tất cả field request/response giữ **nguyên tên tiếng Việt không dấu**
như bản Python (`ten_dang_nhap`, `mat_khau`, `ho_ten`, `vai_tro`,
`ten_truong`, `ma_phong`, `phien_id`, `hoc_sinh_id`, `diem`, `ly_do`,
`loai_bang_chung`, `dinh_dang`, `du_lieu_b64`...).

### 3.2. API mới — chấm điểm rủi ro (thay cho `bo_nap_dong_co_ram.py`)

Vì AI Engine (`HopNhatChongGianLan`) trước đây chạy trong RAM của
máy client (nạp qua Fernet từ server), ở bản web tôi **chuyển việc
chấm điểm sang server** — trình duyệt chỉ trích xuất và gửi **vector
63 chiều**:

```
POST /api/cham_diem_rui_ro
Body: {
  "ma_phong": "ABC123",
  "hoc_sinh_id": 42,
  "feature_vector": [0.1, 0.2, ..., /* đúng 63 số thực */],
  "nonce": null
}
Response: {
  "diem_100": 73.5,
  "nhan": "cheating"   // "normal" | "suspicious" | "cheating"
}
```

Nếu bạn muốn giữ nguyên chữ ký/attestation như `bo_nap_dong_co_ram.py`
(`cap_nhat(feature_vector, nonce, secret_key)`), có thể mở rộng field
`nonce`/`secret_key` mà không cần đổi phía frontend — chỉ cần thêm
tham số vào `rest.cham_diem_rui_ro()` trong `hoc_sinh.js`.

> **Đổi tên endpoint**: nếu backend bạn dùng tên khác, chỉ cần sửa
> đúng 1 chỗ trong `js/core/ket_noi_client.js` (hàm `cham_diem_rui_ro`).

### 3.3. Socket.IO — giữ nguyên toàn bộ tên event như `ket_noi_client.py`

**Server → Client:**
`trang_thai_hoc_sinh`, `hoc_sinh_vao_phong`, `hoc_sinh_mat_ket_noi`,
`vi_pham_moi`, `phong_da_dong`, `trang_thai_phien`, `yeu_cau_reset`

**Client → Server:**
`vao_phong_giam_sat`, `roi_phong_giam_sat`, `hoc_sinh_vao`,
`cap_nhat_trang_thai`

Xác thực qua `auth: { token }` khi connect (giống `dia_chi_server` +
`Authorization: Bearer <token>` ở REST).

## 4. MediaPipe — dùng bản Google chính thức (Tasks Vision, web)

`js/core/tinh_hieu_mediapipe.js` dùng:
- **FaceLandmarker** (thay `mediapipe.solutions.face_mesh`, có iris
  landmark 468-477 tương đương `refine_landmarks=True`), `numFaces: 3`.
- **PoseLandmarker** (thay `mediapipe.solutions.pose`), lấy landmark
  vai 11/12 để tính `body_x/body_y/body_norm`.

Model tải trực tiếp từ Google Cloud Storage (không cần tự host):
```
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

Toàn bộ pipeline 17 tín hiệu → 63 đặc trưng chạy **ngay trên trình
duyệt học sinh** (giống tinh thần "AI Subprocess Isolation" của
`qua_trinh_dong_co.py`, nhưng ở web là main thread vì tính toán nhẹ,
thuần JS/toán học — không có bottleneck như xử lý ảnh).

## 5. Những phần bạn (backend) cần tự triển khai thêm

- [ ] Chấm điểm rủi ro nhận vector 63 chiều → JSON `{diem_100, nhan}`
      (endpoint `/api/cham_diem_rui_ro`, xem mục 3.2).
- [ ] Giải mã `du_lieu_b64` (base64) khi nhận `/api/tai_len_vi_pham`,
      lưu file, trả về bytes thật ở `/api/vi_pham/{id}/du_lieu`.
- [ ] Ký số Ed25519 bằng chứng (nếu vẫn muốn giữ tính năng của
      `ky_so_vi_pham.py`) — có thể làm ở phía server khi nhận ảnh,
      hoặc thêm Web Crypto API (`crypto.subtle`) ở `hoc_sinh.js` nếu
      cần ký ngay tại client (Ed25519 hiện được hỗ trợ native trên
      Chrome/Edge mới, cần polyfill cho Firefox/Safari cũ).
- [ ] CORS: bật CORS cho origin của trang web tĩnh này trên server
      Flask/FastAPI (do REST + Socket.IO gọi cross-origin).

## 6. Ghi chú khác biệt so với bản desktop

| Bản desktop (PyQt5)                              | Bản web                                                |
|---------------------------------------------------|----------------------------------------------------------|
| `bo_nap_dong_co_ram.py` nạp engine vào RAM client  | Server chấm điểm qua `/api/cham_diem_rui_ro`             |
| `qua_trinh_dong_co.py` (multiprocessing)           | Vòng lặp `requestAnimationFrame` trên main thread          |
| `khay_he_thong.py` (system tray)                   | Không áp dụng cho web (trình duyệt không có khay hệ thống)|
| localStorage config (`~/.virtu_config.json`)       | `localStorage`/`sessionStorage` trình duyệt               |
| Ký số Ed25519 client                               | Để trống — cắm thêm nếu cần (xem mục 5)                   |

## 7. Đa ngôn ngữ & Theme

- 3 ngôn ngữ: Tiếng Việt / English / 中文 — lưu trong `localStorage`.
- 2 theme: Dark (mặc định) / Light — lưu trong `localStorage`, áp
  dụng qua `data-theme` trên thẻ `<html>`.
