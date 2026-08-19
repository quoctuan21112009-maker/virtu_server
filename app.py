from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import hashlib
import secrets
import os
import json
import base64
import qrcode
from io import BytesIO
from functools import wraps
import logging
from typing import Dict, List, Optional
import uuid

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# CORS Configuration
CORS(app, 
     resources={
         r"/api/*": {
             "origins": ["http://localhost:3000", "http://localhost:5000", "http://127.0.0.1:3000"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "Accept"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600
         }
     })

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)
jwt = JWTManager(app)

# Database mock - trong production nên dùng database thật
# Sử dụng dictionary để lưu dữ liệu
DATABASE = {
    'users': {},
    'phong_thi': {},
    'hoc_sinh': {},
    'vi_pham': {},
    'sessions': {}
}

# Data mẫu cho demo
def init_demo_data():
    """Khởi tạo dữ liệu demo"""
    if not DATABASE['users']:
        # Tạo admin
        admin_id = str(uuid.uuid4())
        DATABASE['users'][admin_id] = {
            'id': admin_id,
            'ten_dang_nhap': 'admin',
            'mat_khau': hashlib.sha256('admin123'.encode()).hexdigest(),
            'ho_ten': 'Quản trị viên',
            'vai_tro': 'admin',
            'ten_truong': 'Đại học ABC',
            'created_at': datetime.now().isoformat()
        }
        
        # Tạo giáo viên
        teacher_id = str(uuid.uuid4())
        DATABASE['users'][teacher_id] = {
            'id': teacher_id,
            'ten_dang_nhap': 'gv1',
            'mat_khau': hashlib.sha256('123456'.encode()).hexdigest(),
            'ho_ten': 'Nguyễn Văn A',
            'vai_tro': 'giao_vien',
            'ten_truong': 'Đại học ABC',
            'created_at': datetime.now().isoformat()
        }
        
        # Tạo học sinh mẫu
        students = [
            ('hs001', 'Trần Văn B'),
            ('hs002', 'Lê Thị C'),
            ('hs003', 'Phạm Văn D'),
            ('hs004', 'Hoàng Thị E'),
        ]
        for username, fullname in students:
            student_id = str(uuid.uuid4())
            DATABASE['users'][student_id] = {
                'id': student_id,
                'ten_dang_nhap': username,
                'mat_khau': hashlib.sha256('123456'.encode()).hexdigest(),
                'ho_ten': fullname,
                'vai_tro': 'hoc_sinh',
                'ten_truong': 'Đại học ABC',
                'created_at': datetime.now().isoformat()
            }

# Decorator kiểm tra quyền
def role_required(allowed_roles: List[str]):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = DATABASE['users'].get(current_user_id)
            if not user or user.get('vai_tro') not in allowed_roles:
                return jsonify({'loi': 'Không có quyền truy cập'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

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

# API Routes
@app.route('/api/dang_nhap', methods=['POST', 'OPTIONS'])
def dang_nhap():
    """Đăng nhập"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        ten_dang_nhap = data.get('ten_dang_nhap')
        mat_khau = data.get('mat_khau')
        
        if not ten_dang_nhap or not mat_khau:
            return jsonify({'loi': 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu'}), 400
        
        # Tìm user
        user = None
        for uid, u in DATABASE['users'].items():
            if u['ten_dang_nhap'] == ten_dang_nhap:
                user = u
                break
        
        if not user:
            return jsonify({'loi': 'Tài khoản không tồn tại'}), 401
        
        # Kiểm tra mật khẩu
        hashed_password = hashlib.sha256(mat_khau.encode()).hexdigest()
        if user['mat_khau'] != hashed_password:
            return jsonify({'loi': 'Mật khẩu không đúng'}), 401
        
        # Tạo token
        access_token = create_access_token(identity=user['id'])
        
        # Lưu session
        session_id = str(uuid.uuid4())
        DATABASE['sessions'][session_id] = {
            'user_id': user['id'],
            'token': access_token,
            'created_at': datetime.now().isoformat()
        }
        
        # Trả về thông tin user (không bao gồm mật khẩu)
        user_info = {k: v for k, v in user.items() if k != 'mat_khau'}
        return jsonify({
            'token': access_token,
            'user': user_info,
            'message': 'Đăng nhập thành công'
        }), 200
        
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
        
        # Kiểm tra tồn tại
        for u in DATABASE['users'].values():
            if u['ten_dang_nhap'] == ten_dang_nhap:
                return jsonify({'loi': 'Tên đăng nhập đã tồn tại'}), 400
        
        # Tạo user mới
        user_id = str(uuid.uuid4())
        DATABASE['users'][user_id] = {
            'id': user_id,
            'ten_dang_nhap': ten_dang_nhap,
            'mat_khau': hashlib.sha256(mat_khau.encode()).hexdigest(),
            'ho_ten': ho_ten,
            'vai_tro': vai_tro,
            'ten_truong': ten_truong,
            'created_at': datetime.now().isoformat()
        }
        
        return jsonify({
            'message': 'Đăng ký thành công',
            'user_id': user_id
        }), 201
        
    except Exception as e:
        logger.error(f"Register error: {str(e)}")
        return jsonify({'loi': f'Lỗi đăng ký: {str(e)}'}), 500

@app.route('/api/dang_ky_hang_loat', methods=['POST', 'OPTIONS'])
@role_required(['admin', 'giao_vien'])
def dang_ky_hang_loat():
    """Đăng ký hàng loạt tài khoản"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        vai_tro = data.get('vai_tro', 'hoc_sinh')
        danh_sach = data.get('danh_sach', [])
        
        if not danh_sach:
            return jsonify({'loi': 'Danh sách trống'}), 400
        
        current_user_id = get_jwt_identity()
        current_user = DATABASE['users'].get(current_user_id)
        ten_truong = current_user.get('ten_truong')
        
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
            exists = any(u['ten_dang_nhap'] == ten_dang_nhap for u in DATABASE['users'].values())
            if exists:
                failed.append({
                    'ten_dang_nhap': ten_dang_nhap,
                    'ly_do': 'Tên đăng nhập đã tồn tại'
                })
                continue
            
            # Tạo user
            user_id = str(uuid.uuid4())
            DATABASE['users'][user_id] = {
                'id': user_id,
                'ten_dang_nhap': ten_dang_nhap,
                'mat_khau': hashlib.sha256(mat_khau.encode()).hexdigest(),
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
@role_required(['admin', 'giao_vien'])
def tao_phong():
    """Tạo phòng thi mới"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        ten_phien = data.get('ten_phien', 'Phiên thi không tên')
        
        current_user_id = get_jwt_identity()
        current_user = DATABASE['users'].get(current_user_id)
        
        room_id = str(uuid.uuid4())
        ma_phong = generate_room_code()
        
        # Tạo QR code với thông tin phòng
        qr_data = f"VIRTU:http://localhost:5000/phong/{ma_phong}"
        qr_base64 = generate_qr_code(qr_data)
        
        phong = {
            'id': room_id,
            'ma_phong': ma_phong,
            'ten_phien': ten_phien,
            'ten_giao_vien': current_user['ho_ten'],
            'giao_vien_id': current_user_id,
            'ten_truong': current_user['ten_truong'],
            'dang_hoat_dong': True,
            'qr_base64': qr_base64,
            'created_at': datetime.now().isoformat(),
            'hoc_sinh': []
        }
        
        DATABASE['phong_thi'][room_id] = phong
        
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
@role_required(['admin', 'giao_vien'])
def dong_phong():
    """Đóng phòng thi"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        data = request.get_json()
        phien_id = data.get('phien_id')
        
        if not phien_id or phien_id not in DATABASE['phong_thi']:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        phong = DATABASE['phong_thi'][phien_id]
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id:
            current_user = DATABASE['users'].get(current_user_id)
            if current_user.get('vai_tro') != 'admin':
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
        for p in DATABASE['phong_thi'].values():
            if p['ma_phong'] == ma_phong:
                phong = p
                break
        
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = DATABASE['users'].get(current_user_id)
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem phòng này'}), 403
        
        # Lấy danh sách học sinh trong phòng
        hoc_sinh_list = []
        for hs_id in phong.get('hoc_sinh', []):
            if hs_id in DATABASE['users']:
                hs = DATABASE['users'][hs_id]
                # Kiểm tra trạng thái
                trang_thai = 'normal'
                diem = 0
                
                # Tính điểm từ vi phạm
                for vp in DATABASE['vi_pham'].values():
                    if vp['phien_id'] == phong['id'] and vp['hoc_sinh_id'] == hs_id:
                        diem += vp.get('diem', 0)
                        if diem >= 10:
                            trang_thai = 'cheating'
                        elif diem >= 5:
                            trang_thai = 'suspicious'
                
                hoc_sinh_list.append({
                    'hoc_sinh_id': hs_id,
                    'ho_ten': hs['ho_ten'],
                    'trang_thai': trang_thai,
                    'diem': diem,
                    'con_ket_noi': True  # Mock, trong thực tế kiểm tra từ WebSocket
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
        current_user = DATABASE['users'].get(current_user_id)
        
        if not current_user:
            return jsonify({'loi': 'Người dùng không tồn tại'}), 404
        
        # Lấy phòng theo trường
        rooms = []
        for p in DATABASE['phong_thi'].values():
            if p['ten_truong'] == current_user['ten_truong']:
                # Nếu là admin thì xem được tất cả, giáo viên chỉ xem được phòng của mình
                if current_user['vai_tro'] == 'admin' or p['giao_vien_id'] == current_user_id:
                    rooms.append(p)
        
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
        if phien_id not in DATABASE['phong_thi']:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = DATABASE['users'].get(current_user_id)
        phong = DATABASE['phong_thi'][phien_id]
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem vi phạm'}), 403
        
        violations = []
        for vp in DATABASE['vi_pham'].values():
            if vp['phien_id'] == phien_id:
                # Lấy thông tin học sinh
                hs = DATABASE['users'].get(vp['hoc_sinh_id'])
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
        if phien_id not in DATABASE['phong_thi']:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = DATABASE['users'].get(current_user_id)
        phong = DATABASE['phong_thi'][phien_id]
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem vi phạm'}), 403
        
        violations = []
        for vp in DATABASE['vi_pham'].values():
            if vp['phien_id'] == phien_id and vp['hoc_sinh_id'] == hoc_sinh_id:
                violations.append(vp)
        
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
        if vi_pham_id not in DATABASE['vi_pham']:
            return jsonify({'loi': 'Vi phạm không tồn tại'}), 404
        
        vp = DATABASE['vi_pham'][vi_pham_id]
        phong = DATABASE['phong_thi'].get(vp['phien_id'])
        
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = DATABASE['users'].get(current_user_id)
        
        # Kiểm tra quyền
        if phong['giao_vien_id'] != current_user_id and current_user.get('vai_tro') != 'admin':
            return jsonify({'loi': 'Không có quyền xem bằng chứng'}), 403
        
        # Tạo dữ liệu demo
        # Trong thực tế, dữ liệu này được lưu trên server hoặc cloud storage
        if vp.get('loai_bang_chung') == 'video':
            # Tạo video demo (màu đen)
            from PIL import Image
            import numpy as np
            
            # Tạo ảnh demo nếu chưa có
            if not vp.get('du_lieu_path'):
                # Tạo ảnh đơn giản với text
                img = Image.new('RGB', (800, 600), color='black')
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(img)
                try:
                    font = ImageFont.truetype("arial.ttf", 30)
                except:
                    font = ImageFont.load_default()
                draw.text((300, 280), f"VP: {vp['id'][:8]}", fill='white', font=font)
                draw.text((300, 320), f"HS: {vp['hoc_sinh_id'][:8]}", fill='white', font=font)
                
                img_byte_arr = BytesIO()
                img.save(img_byte_arr, format='PNG')
                vp['du_lieu_path'] = img_byte_arr.getvalue()
                vp['kich_thuoc_byte'] = len(vp['du_lieu_path'])
        
        # Trả về dữ liệu
        if vp.get('du_lieu_path'):
            return send_file(
                BytesIO(vp['du_lieu_path']),
                mimetype='image/png' if vp.get('loai_bang_chung') == 'image' else 'video/mp4',
                as_attachment=False
            )
        else:
            return jsonify({'loi': 'Không tìm thấy dữ liệu bằng chứng'}), 404
        
    except Exception as e:
        logger.error(f"Download evidence error: {str(e)}")
        return jsonify({'loi': f'Lỗi tải bằng chứng: {str(e)}'}), 500

# Route test CORS
@app.route('/api/test', methods=['GET', 'OPTIONS'])
def test_cors():
    """Test CORS configuration"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    return jsonify({'message': 'CORS is working!', 'status': 'success'}), 200

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'loi': 'Không tìm thấy endpoint'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'loi': 'Lỗi máy chủ nội bộ'}), 500

# Khởi tạo dữ liệu demo
with app.app_context():
    init_demo_data()
    # Thêm dữ liệu vi phạm mẫu
    phong_id = None
    for p_id, p in DATABASE['phong_thi'].items():
        if p['ten_phien'] == 'Phiên thi không tên':
            phong_id = p_id
            break
    
    if phong_id:
        # Thêm học sinh vào phòng
        phong = DATABASE['phong_thi'][phong_id]
        student_ids = [uid for uid, u in DATABASE['users'].items() if u['vai_tro'] == 'hoc_sinh']
        phong['hoc_sinh'] = student_ids[:2]  # Thêm 2 học sinh đầu
        
        # Tạo vi phạm mẫu
        for i, hs_id in enumerate(phong['hoc_sinh']):
            vp_id = str(uuid.uuid4())
            DATABASE['vi_pham'][vp_id] = {
                'id': vp_id,
                'phien_id': phong_id,
                'hoc_sinh_id': hs_id,
                'loai_bang_chung': 'image',
                'ly_do': 'phat_hien_nhieu_nguoi_trong_khung_hinh' if i == 0 else 'diem_rui_ro_vuot_nguong_gian_lan',
                'diem': 3 + i * 2,
                'thoi_gian': datetime.now().isoformat(),
                'kich_thuoc_byte': 20480,
                'du_lieu_path': None
            }

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
