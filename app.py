import os
import json
import uuid
import base64
import secrets
import hashlib
from datetime import datetime, timedelta
from io import BytesIO
from functools import wraps
from typing import Dict, List, Optional, Any
import logging

from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, 
    get_jwt_identity, set_access_cookies, unset_jwt_cookies
)
from PIL import Image, ImageDraw
import qrcode

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Khởi tạo Flask app
app = Flask(__name__)

# Cấu hình từ environment variables
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)
app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']
app.config['JWT_COOKIE_SECURE'] = False
app.config['JWT_COOKIE_CSRF_PROTECT'] = False

# Khởi tạo JWT
jwt = JWTManager(app)

# Cấu hình CORS
cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5000')
cors_origins = [origin.strip() for origin in cors_origins.split(',')]

CORS(app, 
     resources={
         r"/api/*": {
             "origins": cors_origins,
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
             "allow_headers": ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600
         }
     })

# ============================================================
# DỮ LIỆU LƯU TRONG BỘ NHỚ (RAM) - HOÀN TOÀN TRỐNG
# ============================================================

# Dữ liệu users: { user_id: { ... } }
USERS = {}

# Dữ liệu phòng thi: { room_id: { ... } }
PHONG_THI = {}

# Dữ liệu vi phạm: { violation_id: { ... } }
VI_PHAM = {}

# Dữ liệu học sinh trong phòng: { room_id: [student_id, ...] }
PHONG_HOC_SINH = {}

# Session tokens: { token: user_id }
SESSIONS = {}

# ============================================================

# Helper functions
def generate_room_code():
    """Tạo mã phòng ngẫu nhiên 6 ký tự"""
    return ''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(6))

def generate_qr_code(data: str):
    """Tạo QR code từ dữ liệu"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()

def hash_password(password: str) -> str:
    """Băm mật khẩu"""
    return hashlib.sha256(password.encode()).hexdigest()

def validate_password(password: str) -> bool:
    """Kiểm tra độ mạnh mật khẩu"""
    return len(password) >= 6

def find_user_by_username(username: str):
    """Tìm user theo tên đăng nhập"""
    for user_id, user in USERS.items():
        if user['ten_dang_nhap'] == username:
            return user_id, user
    return None, None

# ============================================================
# API ROUTES
# ============================================================

@app.route('/api/test', methods=['GET', 'OPTIONS'])
def test_cors():
    """Test CORS configuration"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    return jsonify({
        'message': 'CORS is working!',
        'status': 'success',
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'users': len(USERS),
        'rooms': len(PHONG_THI),
        'violations': len(VI_PHAM),
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/api/dang_nhap', methods=['POST', 'OPTIONS'])
def dang_nhap():
    """Đăng nhập"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'loi': 'Dữ liệu không hợp lệ'}), 400
        
        ten_dang_nhap = data.get('ten_dang_nhap')
        mat_khau = data.get('mat_khau')
        
        if not ten_dang_nhap or not mat_khau:
            return jsonify({'loi': 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu'}), 400
        
        # Tìm user
        user_id, user = find_user_by_username(ten_dang_nhap)
        
        if not user:
            return jsonify({'loi': 'Tài khoản không tồn tại'}), 401
        
        # Kiểm tra mật khẩu
        hashed_password = hash_password(mat_khau)
        if user['mat_khau'] != hashed_password:
            return jsonify({'loi': 'Mật khẩu không đúng'}), 401
        
        # Cập nhật last_login
        user['last_login'] = datetime.now().isoformat()
        
        # Tạo token
        access_token = create_access_token(identity=user_id)
        
        # Lưu session
        SESSIONS[access_token] = user_id
        
        # Trả về thông tin user (không bao gồm mật khẩu)
        user_info = {k: v for k, v in user.items() if k != 'mat_khau'}
        
        response = jsonify({
            'token': access_token,
            'user': user_info,
            'message': 'Đăng nhập thành công'
        })
        
        set_access_cookies(response, access_token)
        return response, 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'loi': f'Lỗi đăng nhập: {str(e)}'}), 500

@app.route('/api/dang_ky', methods=['POST', 'OPTIONS'])
def dang_ky():
    """Đăng ký tài khoản mới"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        ten_dang_nhap = data.get('ten_dang_nhap')
        mat_khau = data.get('mat_khau')
        ho_ten = data.get('ho_ten')
        vai_tro = data.get('vai_tro', 'hoc_sinh')
        ten_truong = data.get('ten_truong')
        
        # Validate
        if not all([ten_dang_nhap, mat_khau, ho_ten, ten_truong]):
            return jsonify({'loi': 'Vui lòng điền đầy đủ thông tin'}), 400
        
        if not validate_password(mat_khau):
            return jsonify({'loi': 'Mật khẩu phải có ít nhất 6 ký tự'}), 400
        
        # Kiểm tra tồn tại
        user_id, _ = find_user_by_username(ten_dang_nhap)
        if user_id:
            return jsonify({'loi': 'Tên đăng nhập đã tồn tại'}), 400
        
        # Tạo user mới
        new_user_id = str(uuid.uuid4())
        USERS[new_user_id] = {
            'id': new_user_id,
            'ten_dang_nhap': ten_dang_nhap,
            'mat_khau': hash_password(mat_khau),
            'ho_ten': ho_ten,
            'vai_tro': vai_tro,
            'ten_truong': ten_truong,
            'created_at': datetime.now().isoformat()
        }
        
        return jsonify({
            'message': 'Đăng ký thành công',
            'user_id': new_user_id
        }), 201
        
    except Exception as e:
        logger.error(f"Register error: {str(e)}")
        return jsonify({'loi': f'Lỗi đăng ký: {str(e)}'}), 500

@app.route('/api/dang_ky_hang_loat', methods=['POST', 'OPTIONS'])
@jwt_required()
def dang_ky_hang_loat():
    """Đăng ký hàng loạt tài khoản"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        if not current_user or current_user['vai_tro'] not in ['admin', 'giao_vien']:
            return jsonify({'loi': 'Không có quyền truy cập'}), 403
        
        data = request.get_json()
        vai_tro = data.get('vai_tro', 'hoc_sinh')
        danh_sach = data.get('danh_sach', [])
        
        if not danh_sach:
            return jsonify({'loi': 'Danh sách trống'}), 400
        
        ten_truong = current_user['ten_truong']
        
        success = []
        failed = []
        
        for item in danh_sach:
            ten_dang_nhap = item.get('ten_dang_nhap')
            ho_ten = item.get('ho_ten')
            mat_khau = item.get('mat_khau') or secrets.token_urlsafe(8)
            
            if not ten_dang_nhap or not ho_ten:
                failed.append({
                    'ten_dang_nhap': ten_dang_nhap,
                    'ly_do': 'Thiếu tên đăng nhập hoặc họ tên'
                })
                continue
            
            # Kiểm tra tồn tại
            user_id, _ = find_user_by_username(ten_dang_nhap)
            if user_id:
                failed.append({
                    'ten_dang_nhap': ten_dang_nhap,
                    'ly_do': 'Tên đăng nhập đã tồn tại'
                })
                continue
            
            # Tạo user
            new_user_id = str(uuid.uuid4())
            USERS[new_user_id] = {
                'id': new_user_id,
                'ten_dang_nhap': ten_dang_nhap,
                'mat_khau': hash_password(mat_khau),
                'ho_ten': ho_ten,
                'vai_tro': vai_tro,
                'ten_truong': ten_truong,
                'created_at': datetime.now().isoformat()
            }
            
            success.append({
                'ten_dang_nhap': ten_dang_nhap,
                'ho_ten': ho_ten,
                'mat_khau': mat_khau
            })
        
        return jsonify({
            'thanh_cong': success,
            'that_bai': failed,
            'message': f'Tạo thành công {len(success)} tài khoản'
        }), 201
        
    except Exception as e:
        logger.error(f"Batch register error: {str(e)}")
        return jsonify({'loi': f'Lỗi đăng ký hàng loạt: {str(e)}'}), 500

@app.route('/api/tao_phong', methods=['POST', 'OPTIONS'])
@jwt_required()
def tao_phong():
    """Tạo phòng thi mới"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        ten_phien = data.get('ten_phien', 'Phiên thi không tên')
        
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        if not current_user or current_user['vai_tro'] not in ['admin', 'giao_vien']:
            return jsonify({'loi': 'Không có quyền tạo phòng'}), 403
        
        room_id = str(uuid.uuid4())
        ma_phong = generate_room_code()
        
        # Tạo QR code với thông tin phòng
        qr_data = f"VIRTU:{ma_phong}"
        qr_base64 = generate_qr_code(qr_data)
        
        PHONG_THI[room_id] = {
            'id': room_id,
            'ma_phong': ma_phong,
            'ten_phien': ten_phien,
            'ten_giao_vien': current_user['ho_ten'],
            'giao_vien_id': current_user_id,
            'ten_truong': current_user['ten_truong'],
            'dang_hoat_dong': True,
            'qr_base64': qr_base64,
            'created_at': datetime.now().isoformat(),
            'settings': {
                'auto_start': False,
                'require_webcam': True,
                'allow_mobile': True
            }
        }
        
        PHONG_HOC_SINH[room_id] = []
        
        return jsonify({
            'id': room_id,
            'ma_phong': ma_phong,
            'qr_base64': qr_base64,
            'message': 'Tạo phòng thi thành công'
        }), 201
        
    except Exception as e:
        logger.error(f"Create room error: {str(e)}")
        return jsonify({'loi': f'Lỗi tạo phòng: {str(e)}'}), 500

@app.route('/api/dong_phong', methods=['POST', 'OPTIONS'])
@jwt_required()
def dong_phong():
    """Đóng phòng thi"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        phien_id = data.get('phien_id')
        
        if not phien_id:
            return jsonify({'loi': 'Thiếu ID phòng thi'}), 400
        
        phong = PHONG_THI.get(phien_id)
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền đóng phòng này'}), 403
        
        phong['dang_hoat_dong'] = False
        phong['closed_at'] = datetime.now().isoformat()
        
        return jsonify({
            'message': 'Đã đóng phòng thi thành công'
        }), 200
        
    except Exception as e:
        logger.error(f"Close room error: {str(e)}")
        return jsonify({'loi': f'Lỗi đóng phòng: {str(e)}'}), 500

@app.route('/api/phong/<ma_phong>', methods=['GET', 'OPTIONS'])
@jwt_required()
def thong_tin_phong(ma_phong):
    """Lấy thông tin chi tiết phòng thi"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        # Tìm phòng theo mã
        phong = None
        phong_id = None
        for rid, p in PHONG_THI.items():
            if p['ma_phong'] == ma_phong:
                phong = p
                phong_id = rid
                break
        
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem phòng này'}), 403
        
        # Lấy danh sách học sinh trong phòng
        hoc_sinh_list = []
        for hs_id in PHONG_HOC_SINH.get(phong_id, []):
            hs = USERS.get(hs_id)
            if hs:
                # Tính điểm từ vi phạm
                diem = 0
                for vp in VI_PHAM.values():
                    if vp['phien_id'] == phong_id and vp['hoc_sinh_id'] == hs_id:
                        diem += vp.get('diem', 0)
                
                trang_thai = 'normal'
                if diem >= 10:
                    trang_thai = 'cheating'
                elif diem >= 5:
                    trang_thai = 'suspicious'
                
                hoc_sinh_list.append({
                    'hoc_sinh_id': hs_id,
                    'ho_ten': hs['ho_ten'],
                    'trang_thai': trang_thai,
                    'diem': diem,
                    'con_ket_noi': True
                })
        
        return jsonify({
            'phong': phong,
            'hoc_sinh': hoc_sinh_list
        }), 200
        
    except Exception as e:
        logger.error(f"Get room info error: {str(e)}")
        return jsonify({'loi': f'Lỗi lấy thông tin phòng: {str(e)}'}), 500

@app.route('/api/phong_cua_truong', methods=['GET', 'OPTIONS'])
@jwt_required()
def phong_cua_truong():
    """Lấy danh sách phòng của trường"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        if not current_user:
            return jsonify({'loi': 'Người dùng không tồn tại'}), 404
        
        # Lấy phòng theo trường
        rooms = []
        for p in PHONG_THI.values():
            if p['ten_truong'] == current_user['ten_truong']:
                if current_user['vai_tro'] == 'admin' or p['giao_vien_id'] == current_user_id:
                    rooms.append(p)
        
        # Sắp xếp theo thời gian tạo mới nhất
        rooms.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return jsonify({'phong': rooms}), 200
        
    except Exception as e:
        logger.error(f"Get school rooms error: {str(e)}")
        return jsonify({'loi': f'Lỗi lấy danh sách phòng: {str(e)}'}), 500

@app.route('/api/vi_pham/<phien_id>', methods=['GET', 'OPTIONS'])
@jwt_required()
def vi_pham_theo_phong(phien_id):
    """Lấy danh sách vi phạm theo phòng"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        phong = PHONG_THI.get(phien_id)
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem vi phạm'}), 403
        
        violations = []
        for vp in VI_PHAM.values():
            if vp['phien_id'] == phien_id:
                # Lấy thông tin học sinh
                hs = USERS.get(vp['hoc_sinh_id'])
                violations.append({
                    'id': vp['id'],
                    'hoc_sinh_id': vp['hoc_sinh_id'],
                    'ho_ten': hs['ho_ten'] if hs else 'Unknown',
                    'loai_bang_chung': vp.get('loai_bang_chung', 'image'),
                    'ly_do': vp.get('ly_do', 'Vi phạm'),
                    'diem': vp.get('diem', 0),
                    'thoi_gian': vp.get('thoi_gian', datetime.now().isoformat()),
                    'kich_thuoc_byte': vp.get('kich_thuoc_byte', 0)
                })
        
        # Sắp xếp theo thời gian mới nhất
        violations.sort(key=lambda x: x.get('thoi_gian', ''), reverse=True)
        
        return jsonify({'vi_pham': violations}), 200
        
    except Exception as e:
        logger.error(f"Get violations error: {str(e)}")
        return jsonify({'loi': f'Lỗi lấy danh sách vi phạm: {str(e)}'}), 500

@app.route('/api/vi_pham/hoc_sinh/<phien_id>/<hoc_sinh_id>', methods=['GET', 'OPTIONS'])
@jwt_required()
def vi_pham_theo_hoc_sinh(phien_id, hoc_sinh_id):
    """Lấy danh sách vi phạm của 1 học sinh trong phòng"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        phong = PHONG_THI.get(phien_id)
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem vi phạm'}), 403
        
        violations = []
        for vp in VI_PHAM.values():
            if vp['phien_id'] == phien_id and vp['hoc_sinh_id'] == hoc_sinh_id:
                violations.append(vp)
        
        # Sắp xếp theo thời gian mới nhất
        violations.sort(key=lambda x: x.get('thoi_gian', ''), reverse=True)
        
        return jsonify({'vi_pham': violations}), 200
        
    except Exception as e:
        logger.error(f"Get student violations error: {str(e)}")
        return jsonify({'loi': f'Lỗi lấy vi phạm học sinh: {str(e)}'}), 500

@app.route('/api/vi_pham/<vi_pham_id>/du_lieu', methods=['GET', 'OPTIONS'])
@jwt_required()
def tai_du_lieu_bang_chung(vi_pham_id):
    """Tải dữ liệu bằng chứng vi phạm"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        vp = VI_PHAM.get(vi_pham_id)
        if not vp:
            return jsonify({'loi': 'Vi phạm không tồn tại'}), 404
        
        phong = PHONG_THI.get(vp['phien_id'])
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = USERS.get(current_user_id)
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem bằng chứng'}), 403
        
        # Tạo ảnh demo nếu chưa có
        if not vp.get('du_lieu_path'):
            img = Image.new('RGB', (800, 600), color=(20, 20, 30))
            draw = ImageDraw.Draw(img)
            
            # Vẽ khung vi phạm
            draw.rectangle([200, 150, 600, 450], outline=(255, 84, 112), width=3)
            draw.text((250, 200), f"VI PHAM: {vp['id'][:8]}", fill=(255, 84, 112))
            draw.text((250, 240), f"HS: {vp['hoc_sinh_id'][:8]}", fill=(255, 201, 74))
            draw.text((250, 280), f"LY DO: {vp.get('ly_do', 'Vi phạm')}", fill=(255, 255, 255))
            draw.text((250, 320), f"DIEM: {vp.get('diem', 0)}", fill=(255, 84, 112))
            draw.text((250, 360), f"THOI GIAN: {vp.get('thoi_gian', 'N/A')}", fill=(200, 200, 200))
            
            img_byte_arr = BytesIO()
            img.save(img_byte_arr, format='PNG')
            vp['du_lieu_path'] = img_byte_arr.getvalue()
            vp['kich_thuoc_byte'] = len(vp['du_lieu_path'])
        
        mimetype = 'image/png' if vp.get('loai_bang_chung') == 'image' else 'video/mp4'
        return send_file(
            BytesIO(vp['du_lieu_path']),
            mimetype=mimetype,
            as_attachment=False
        ), 200
        
    except Exception as e:
        logger.error(f"Download evidence error: {str(e)}")
        return jsonify({'loi': f'Lỗi tải bằng chứng: {str(e)}'}), 500

@app.route('/api/them_vi_pham', methods=['POST', 'OPTIONS'])
@jwt_required()
def them_vi_pham():
    """Thêm vi phạm mới"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        
        phien_id = data.get('phien_id')
        hoc_sinh_id = data.get('hoc_sinh_id')
        loai_bang_chung = data.get('loai_bang_chung', 'image')
        ly_do = data.get('ly_do', 'Vi phạm')
        diem = data.get('diem', 0)
        
        if not phien_id or not hoc_sinh_id:
            return jsonify({'loi': 'Thiếu thông tin phòng hoặc học sinh'}), 400
        
        # Kiểm tra phòng tồn tại
        if phien_id not in PHONG_THI:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        # Kiểm tra học sinh tồn tại
        if hoc_sinh_id not in USERS:
            return jsonify({'loi': 'Học sinh không tồn tại'}), 404
        
        # Tạo vi phạm mới
        vp_id = str(uuid.uuid4())
        VI_PHAM[vp_id] = {
            'id': vp_id,
            'phien_id': phien_id,
            'hoc_sinh_id': hoc_sinh_id,
            'loai_bang_chung': loai_bang_chung,
            'ly_do': ly_do,
            'diem': diem,
            'thoi_gian': datetime.now().isoformat(),
            'kich_thuoc_byte': 0,
            'du_lieu_path': None
        }
        
        return jsonify({
            'message': 'Thêm vi phạm thành công',
            'vi_pham': VI_PHAM[vp_id]
        }), 201
        
    except Exception as e:
        logger.error(f"Add violation error: {str(e)}")
        return jsonify({'loi': f'Lỗi thêm vi phạm: {str(e)}'}), 500

# ============================================================
# KHÔNG CÓ DỮ LIỆU DEMO - HOÀN TOÀN TRỐNG
# ============================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f" Starting Virtu API server on port {port}")
    logger.info(f" Database is EMPTY - no demo data")
    logger.info(f" Users: {len(USERS)}, Rooms: {len(PHONG_THI)}, Violations: {len(VI_PHAM)}")
    app.run(host='0.0.0.0', port=port, debug=False)
