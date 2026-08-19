# -*- coding: utf-8 -*-
"""
frontend_server.py
================================================================
Server Flask RIÊNG, chỉ dùng để serve giao diện React (Web Console
Giáo viên / Quản trị viên) sau khi đã build ra file tĩnh (HTML/JS/CSS).

File này KHÔNG đụng gì tới may_chu.py (server API/SocketIO của bạn).
Frontend sau khi build sẽ gọi API sang may_chu.py qua HTTP(S) như bình
thường (person nhập địa chỉ server ở màn hình đăng nhập) -> vì 2 server
khác domain/port nhau nên phải bật CORS ở may_chu.py (đã hướng dẫn ở
file cors_config.py trước đó). File frontend_server.py này không cần
tự gọi API nào cả, nó chỉ trả về file tĩnh.

--------------------------------------------------------------
CÁCH DÙNG
--------------------------------------------------------------
1) Build frontend ra thư mục tĩnh (ví dụ dùng Vite):

    npm create vite@latest virtu-web -- --template react
    cd virtu-web
    npm install
    # thay src/App.jsx bằng file React bạn đã có (component App ở trên)
    npm run build
    # -> sinh ra thư mục "dist/" chứa index.html, assets/...

2) Copy toàn bộ nội dung thư mục "dist/" vào cùng thư mục với
   frontend_server.py, đặt tên là "static_build":

    frontend_server.py
    static_build/
        index.html
        assets/
            index-xxxx.js
            index-xxxx.css

3) Chạy thử cục bộ:

    pip install -r requirements_frontend.txt
    python frontend_server.py --port 8080

4) Deploy lên Render y như hướng dẫn trước (Procfile riêng, xem
   Procfile_frontend / render_frontend.yaml đính kèm).

--------------------------------------------------------------
VÌ SAO CÓ CORS Ở ĐÂY DÙ CHỈ SERVE FILE TĨNH?
--------------------------------------------------------------
Bản thân việc serve HTML/JS tĩnh không cần CORS. Nhưng nếu sau này bạn
thêm bất kỳ route API nhỏ nào vào chính file frontend_server.py này
(ví dụ 1 route health-check, hoặc 1 route proxy gọi hộ sang may_chu.py
để giấu địa chỉ server thật), thì các route đó vẫn cần CORS. Nên mình
cấu hình sẵn CORS ở đây luôn để bạn không bị vướng khi mở rộng sau này.
"""

import argparse
import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

THU_MUC_GOC = os.path.dirname(os.path.abspath(__file__))
THU_MUC_BUILD = os.path.join(THU_MUC_GOC, "static_build")

app = Flask(__name__, static_folder=THU_MUC_BUILD, static_url_path="")

# Cho phép mọi origin gọi tới các route (nếu sau này bạn thêm API ở đây).
# Khi đã có domain cố định, nên đổi origins="*" thành domain thật để an toàn hơn.
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)


@app.route("/api/suc_khoe")
def suc_khoe():
    """Route healthcheck cho Render biết server frontend đã sẵn sàng."""
    return jsonify({"trang_thai": "ok", "loai": "frontend"}), 200


@app.route("/", defaults={"duong_dan": ""})
@app.route("/<path:duong_dan>")
def serve_react(duong_dan):
    """
    Trả file tĩnh nếu tồn tại (JS, CSS, ảnh...), ngược lại luôn trả về
    index.html để React Router (nếu có) tự xử lý điều hướng phía client
    (kỹ thuật "SPA fallback" - bắt buộc phải có, nếu không refresh trang
    con sẽ bị lỗi 404).
    """
    duong_dan_day_du = os.path.join(THU_MUC_BUILD, duong_dan)
    if duong_dan and os.path.exists(duong_dan_day_du):
        return send_from_directory(THU_MUC_BUILD, duong_dan)
    return send_from_directory(THU_MUC_BUILD, "index.html")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve frontend React của Virtu")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)))
    args = parser.parse_args()

    if not os.path.isdir(THU_MUC_BUILD):
        print(f"⚠ CẢNH BÁO: chưa thấy thư mục '{THU_MUC_BUILD}'.")
        print("  Hãy build frontend (npm run build) rồi copy thư mục dist/ "
              "thành 'static_build' cạnh file frontend_server.py này.")

    print(f"✓ Frontend server chạy tại http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
