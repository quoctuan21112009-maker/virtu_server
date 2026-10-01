# VIRTU — BE Trung Gian (Gateway CORS) + Frontend gộp chung

Gói này gồm **1 server Flask duy nhất** vừa phục vụ Frontend (thư mục
`static_fe/`, chính là `virtu-web`) vừa làm gateway CORS, để bạn chỉ
cần chạy **một lệnh, một cổng** là dùng được toàn bộ hệ thống:

```
Trình duyệt --http://<ip>:5000--> be_trung_gian.py --+--> phục vụ FE (HTML/CSS/JS tĩnh)
                                                       +--> forward /api/* sang Server AI thật
                                                       +--> forward Socket.IO 2 chiều
```

Vai trò của lớp `be_trung_gian.py`:

1. Bật CORS đầy đủ → hết lỗi `OPTIONS 200` nhưng `POST` không gửi được.
2. Nhận JSON hoặc file từ FE → forward nguyên xi sang Server AI thật.
3. Trả response (JSON, hoặc bytes ảnh/video) ngược lại cho FE.
4. Forward luôn Socket.IO 2 chiều (realtime) qua cùng 1 cổng.
5. **Phục vụ luôn toàn bộ file tĩnh của Frontend** (`static_fe/`) —
   không cần chạy `python -m http.server` riêng nữa.

BE trung gian **không lưu database, không chấm điểm AI** — chỉ là
gateway CORS + file server tĩnh.

## Cài đặt

```bash
cd virtu-be-trunggian
pip install -r requirements.txt
```

## Chạy

```bash
# Trỏ tới địa chỉ Server AI/Server tổng thật của bạn:
export AI_SERVER_URL="http://192.168.1.50:6000"

# Dev:
python be_trung_gian.py --port 5000

# Production (gevent, giống may_chu.py gốc):
python be_trung_gian.py --port 5000 --prod
```

Nếu không set `AI_SERVER_URL`, mặc định trỏ `http://localhost:6000`
(sửa `DEFAULT_AI_SERVER_URL` trong `be_trung_gian.py` nếu muốn đổi
mặc định).

## Phía Frontend (đã gộp sẵn trong static_fe/)

Sau khi chạy server, mở thẳng trình duyệt:

```
http://<ip-may-chay-server>:5000/
```

sẽ vào ngay trang đăng nhập (`static_fe/index.html`). Các trang khác
(`hoc_sinh.html`, `giao_vien.html`, `quan_tri.html`) cũng được phục vụ
tự động ở cùng cổng đó.

Ở ô **"ĐỊA CHỈ SERVER"** trên trang đăng nhập, nhập **địa chỉ của
chính server này** (ví dụ `http://192.168.1.10:5000` — cùng cổng bạn
vừa mở trình duyệt), **KHÔNG phải** địa chỉ Server AI thật — vì FE
luôn gọi thẳng vào giá trị đó.

```
Trình duyệt --http://<ip>:5000--> be_trung_gian.py --+--> static_fe/ (HTML/CSS/JS)
                                                       +--> forward /api/* --> Server AI thật (:6000)
```

Nếu muốn cập nhật giao diện, chỉ cần sửa file trong `static_fe/` rồi
tải lại trang — không cần khởi động lại server (trừ khi bạn sửa
`be_trung_gian.py`).

## Kiểm tra nhanh

```bash
curl http://localhost:5000/health
```

Trả về:
```json
{
  "gateway": "ok",
  "ai_server_url": "http://192.168.1.50:6000",
  "ai_server_trang_thai": "ok"
}
```

Nếu `ai_server_trang_thai` là `khong_ket_noi_duoc` → kiểm tra lại
`AI_SERVER_URL` hoặc Server AI thật có đang chạy không.

## Cơ chế forward

- **REST**: mọi request tới `/api/<path>` được forward nguyên method,
  query string, headers (trừ `Host`, `Content-Length`...), và **raw
  body** (JSON hay file base64/multipart đều đi qua nguyên vẹn, không
  parse lại) sang `AI_SERVER_URL/api/<path>`.
- **Socket.IO**: mỗi kết nối FE mở kèm 1 client nối sang AI server
  thật, forward 2 chiều đúng tên toàn bộ sự kiện đã thống nhất với FE
  (`trang_thai_hoc_sinh`, `vi_pham_moi`, `yeu_cau_reset`,
  `vao_phong_giam_sat`, `cap_nhat_trang_thai`...).

## Nếu AI Server thật đã tự bật CORS rồi

Vẫn nên giữ lớp gateway này nếu bạn muốn:
- Một điểm vào (entrypoint) cố định cho FE, tách biệt khỏi hạ tầng AI.
- Ẩn địa chỉ thật của Server AI khỏi trình duyệt người dùng.
- Dễ thêm rate-limit/logging/cache về sau mà không đụng vào AI server.

Nếu không cần các lợi ích trên và AI Server thật đã tự cấu hình CORS
đúng, bạn có thể bỏ qua lớp này và cho FE gọi thẳng — chỉ cần đảm bảo
AI Server trả đủ header `Access-Control-Allow-Origin`,
`Access-Control-Allow-Methods`, `Access-Control-Allow-Headers` trên
cả response OPTIONS lẫn response thật (POST/GET...).
