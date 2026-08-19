# 📦 Hướng Dẫn Build & Deploy Virtu Server trên Render

## 1️⃣ Chuẩn Bị Trước Deploy

### Bước 1: Chuẩn Bị Frontend (React)

```bash
# 1. Cài đặt dependencies
npm install

# 2. Build React app ra static files
npm run build
# -> Tạo thư mục 'static_build/' chứa index.html và assets/

# 3. Test chạy frontend server cục bộ
pip install -r requirements.txt
python frontend_server.py --port 8080
# Truy cập http://localhost:8080
```

### Bước 2: Kiểm Tra Cấu Trúc Thư Mục

```
virtu_server/
├── frontend_server.py          # Flask server để serve frontend
├── requirements.txt            # Python dependencies
├── Procfile                    # Hướng dẫn Render cách chạy app
├── runtime.txt                 # Python version
├── render.yaml                 # Cấu hình chi tiết cho Render
├── .env.example               # Mẫu environment variables
├── package.json               # Node dependencies cho React build
├── vite.config.js            # Vite config
├── index.html                 # HTML entry point
├── static_build/              # ⭐ Frontend đã build (PHẢI có trước deploy)
│   ├── index.html
│   └── assets/
│       ├── index-xxxxx.js
│       └── index-xxxxx.css
├── src/
│   ├── main.jsx
│   └── App.jsx                # Your React component
└── node_modules/              # (Không commit, để gitignore)
```

---

## 2️⃣ Deploy lên Render

### Phương Pháp 1: Sử dụng render.yaml (Recommended)

```bash
# 1. Đẩy code lên GitHub
git add .
git commit -m "Build frontend for Render deployment"
git push origin main

# 2. Truy cập Render Dashboard
# https://dashboard.render.com/

# 3. Click "New +" → Blueprint (Render Engine)
# 4. Kết nối GitHub repo
# 5. Render tự động đọc render.yaml và deploy
```

### Phương Pháp 2: Manual Setup trên Render Dashboard

```bash
# 1. Tạo Web Service mới
# - Name: virtu-frontend-server
# - Environment: Python
# - Region: Singapore
# - Plan: Free (hoặc Starter)

# 2. Build Command:
pip install -r requirements.txt

# 3. Start Command:
gunicorn frontend_server:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120

# 4. Environment Variables:
PYTHON_VERSION=3.11.9
FLASK_ENV=production
SECRET_KEY=<generate-value-tự-động>

# 5. Health Check Path: /api/suc_khoe
# (Render sẽ định kỳ kiểm tra health check để đảm bảo app chạy OK)

# 6. Deploy!
```

---

## 3️⃣ Kiểm Tra Deploy

### Sau khi deploy thành công:

```bash
# 1. Truy cập URL của bạn
https://virtu-frontend-server.onrender.com/

# 2. Kiểm tra health check
https://virtu-frontend-server.onrender.com/api/suc_khoe
# Kỳ vọng: {"trang_thai": "ok", "loai": "frontend"}

# 3. Xem logs
# Render Dashboard → Select Service → Logs tab
```

---

## 4️⃣ Troubleshooting

### ❌ "Module not found" hoặc "ModuleNotFoundError"
```bash
# Fix: Cập nhật requirements.txt với các library cần thiết
pip freeze > requirements.txt
git push
# Render sẽ tự động rebuild
```

### ❌ "static_build folder not found"
```bash
# Nguyên nhân: Bạn chưa build frontend
# Fix: 
npm run build
git add static_build/
git commit -m "Add built frontend"
git push
```

### ❌ "Port already in use" hoặc "Failed to start"
```bash
# Check logs ở Render Dashboard
# Đảm bảo: 
# - frontend_server.py exists
# - static_build/index.html exists
# - requirements.txt có Flask và gunicorn
```

### ❌ CORS errors khi frontend gọi API
```bash
# Nếu backend ở server khác, thêm vào backend:
from flask_cors import CORS
CORS(app, origins=["https://virtu-frontend-server.onrender.com"])
```

---

## 5️⃣ Cập Nhật Code Sau Khi Deploy

Khi bạn muốn cập nhật:

```bash
# 1. Chỉnh sửa React component (src/App.jsx)
# 2. Build lại
npm run build

# 3. Push lên GitHub
git add .
git commit -m "Update frontend feature"
git push origin main

# 4. Render tự động rebuild & deploy 🚀
```

---

## 6️⃣ Nâng Cấp Server (Optional)

Nếu cần server luôn online & không sleep:

1. **Render Dashboard** → Select Service
2. **Settings** → **Instance Type**
3. Chọn **Starter** ($7/tháng) thay vì Free
4. Bật **Auto-deploy on code push**

---

## 📝 Ghi Chú Quan Trọng

- **Free Plan**: Render sẽ tự động pause service nếu không có traffic trong 15 phút. Lần truy cập đầu tiên sẽ chậm hơn.
- **Build Command**: Chạy mỗi lần có code push
- **Start Command**: Chạy sau build hoàn tất
- **Health Check**: Render kiểm tra `/api/suc_khoe` để biết server sẵn sàng
- **Logs**: Luôn check Render Logs nếu có lỗi

---

## 🎯 Tóm Tắt Quy Trình

```
1. npm install                    # Cài React dependencies
2. npm run build                  # Build React → static_build/
3. git add . && git commit && git push  # Push lên GitHub
4. Render Dashboard: Deploy từ GitHub  # Render tự build & start
5. Truy cập https://virtu-xxx.onrender.com ✅
```

---

Chúc bạn deploy thành công! 🚀
