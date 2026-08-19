# -*- coding: utf-8 -*-
"""
cors_config.py
================
Cấu hình CORS cho server Virtu (may_chu.py) khi deploy trên Render.

CÁCH DÙNG trong may_chu.py:

    from flask import Flask
    from cors_config import cau_hinh_cors

    app = Flask(__name__)
    cau_hinh_cors(app)   # <-- thêm dòng này ngay sau khi tạo app

Lỗi CORS phổ biến khi build trên Render thường do:
1. Frontend gọi qua HTTPS (Render luôn HTTPS) nhưng lại thiếu header
   Access-Control-Allow-Origin ở response.
2. Không xử lý preflight request (OPTIONS) -> trình duyệt chặn trước
   khi request thật (POST/GET) được gửi đi.
3. Có Authorization header (Bearer token) nhưng CORS không cho phép
   header đó -> lỗi "Request header field authorization is not allowed".
4. Trả lỗi (400/401/...) nhưng response lỗi đó KHÔNG có header CORS
   -> trình duyệt hiển thị "CORS error" dù thực chất là lỗi logic.

File này xử lý toàn bộ 4 vấn đề trên bằng flask-cors, đồng thời thêm
một after_request fallback để đảm bảo MỌI response (kể cả lỗi 4xx/5xx)
đều có header CORS.
"""

import os
from flask_cors import CORS


def _danh_sach_origin_cho_phep():
    """
    Đọc danh sách origin được phép từ biến môi trường ALLOWED_ORIGINS
    (phân tách bằng dấu phẩy), nếu không có thì mặc định cho phép tất cả (*)
    -- phù hợp khi bạn chưa biết trước domain frontend (ví dụ khi test
    trên claude.ai artifact, Vercel preview URL, v.v.)

    Khi đã có domain frontend cố định, nên set biến môi trường trên Render:
        ALLOWED_ORIGINS=https://ten-app-cua-ban.vercel.app,https://virtu.edu.vn
    để bảo mật hơn thay vì dùng "*".
    """
    raw = os.environ.get("ALLOWED_ORIGINS", "").strip()
    if not raw:
        return "*"
    return [o.strip() for o in raw.split(",") if o.strip()]


def cau_hinh_cors(app):
    """Gắn CORS vào app Flask. Gọi ngay sau khi tạo `app = Flask(__name__)`."""

    origins = _danh_sach_origin_cho_phep()

    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=False,  # đang dùng Bearer token, không dùng cookie -> để False
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Content-Disposition"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        max_age=86400,  # cache preflight 1 ngày, giảm số lần browser gửi OPTIONS
    )

    # --- Fallback: đảm bảo mọi response (kể cả lỗi 4xx/5xx, kể cả route
    # không khớp resources ở trên) đều có header CORS, tránh trường hợp
    # Flask trả lỗi trước khi flask-cors kịp gắn header ---
    @app.after_request
    def _them_header_cors(response):
        origin = _origin_thuc_te(origins)
        if origin:
            response.headers.setdefault("Access-Control-Allow-Origin", origin)
            response.headers.setdefault("Vary", "Origin")
            response.headers.setdefault(
                "Access-Control-Allow-Headers", "Content-Type, Authorization"
            )
            response.headers.setdefault(
                "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
            )
        return response

    return app


def _origin_thuc_te(origins):
    if origins == "*":
        return "*"
    # nếu là danh sách cụ thể, mặc định trả origin đầu tiên cho fallback
    # (trường hợp chính flask-cors đã xử lý đúng origin theo request rồi,
    # đoạn này chỉ là lưới an toàn cho lỗi 4xx/5xx hiếm gặp)
    return origins[0] if origins else None
