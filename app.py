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
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from PIL import Image, ImageDraw, ImageFont
import qrcode
import numpy as np

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
app.config['JWT_COOKIE_SECURE'] = False  # Đặt True trong production với HTTPS
app.config['JWT_COOKIE_CSRF_PROTECT'] = False

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL or 'sqlite:///virtu.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,
    'pool_recycle': 300,
    'pool_pre_ping': True,
}

# Khởi tạo extensions
db = SQLAlchemy(app)
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

# Models
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ten_dang_nhap = db.Column(db.String(50), unique=True, nullable=False)
    mat_khau = db.Column(db.String(64), nullable=False)
    ho_ten = db.Column(db.String(100), nullable=False)
    vai_tro = db.Column(db.String(20), nullable=False, default='hoc_sinh')
    ten_truong = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    rooms_created = db.relationship('PhongThi', backref='giao_vien', lazy=True, foreign_keys='PhongThi.giao_vien_id')
    violations = db.relationship('ViPham', backref='hoc_sinh', lazy=True, foreign_keys='ViPham.hoc_sinh_id')
    
    def to_dict(self, include_password=False):
        data = {
            'id': self.id,
            'ten_dang_nhap': self.ten_dang_nhap,
            'ho_ten': self.ho_ten,
            'vai_tro': self.vai_tro,
            'ten_truong': self.ten_truong,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_password:
            data['mat_khau'] = self.mat_khau
        return data

class PhongThi(db.Model):
    __tablename__ = 'phong_thi'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ma_phong = db.Column(db.String(6), unique=True, nullable=False)
    ten_phien = db.Column(db.String(200), nullable=False)
    giao_vien_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    ten_truong = db.Column(db.String(100), nullable=False)
    dang_hoat_dong = db.Column(db.Boolean, default=True)
    qr_base64 = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    closed_at = db.Column(db.DateTime)
    max_students = db.Column(db.Integer, default=50)
    settings = db.Column(db.JSON, default={})
    
    # Relationships
    students = db.relationship('User', secondary='phong_hoc_sinh', lazy='dynamic',
                              backref=db.backref('rooms', lazy='dynamic'))
    violations = db.relationship('ViPham', backref='phong', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'ma_phong': self.ma_phong,
            'ten_phien': self.ten_phien,
            'ten_giao_vien': db.session.get(User, self.giao_vien_id).ho_ten if self.giao_vien_id else None,
            'giao_vien_id': self.giao_vien_id,
            'ten_truong': self.ten_truong,
            'dang_hoat_dong': self.dang_hoat_dong,
            'qr_base64': self.qr_base64,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
        }

class PhongHocSinh(db.Model):
    __tablename__ = 'phong_hoc_sinh'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phong_id = db.Column(db.String(36), db.ForeignKey('phong_thi.id'), nullable=False)
    hoc_sinh_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    left_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    phong = db.relationship('PhongThi', backref=db.backref('phong_hoc_sinh', lazy='dynamic'))
    hoc_sinh = db.relationship('User', backref=db.backref('phong_hoc_sinh', lazy='dynamic'))

class ViPham(db.Model):
    __tablename__ = 'vi_pham'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phien_id = db.Column(db.String(36), db.ForeignKey('phong_thi.id'), nullable=False)
    hoc_sinh_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    loai_bang_chung = db.Column(db.String(20), default='image')
    ly_do = db.Column(db.String(100), nullable=False)
    diem = db.Column(db.Float, default=0)
    thoi_gian = db.Column(db.DateTime, default=datetime.utcnow)
    kich_thuoc_byte = db.Column(db.Integer, default=0)
    du_lieu_path = db.Column(db.LargeBinary)
    resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    notes = db.Column(db.Text)
    
    # Relationship
    resolver = db.relationship('User', foreign_keys=[resolved_by])
    
    def to_dict(self):
        hs = db.session.get(User, self.hoc_sinh_id)
        return {
            'id': self.id,
            'phien_id': self.phien_id,
            'hoc_sinh_id': self.hoc_sinh_id,
            'ho_ten': hs.ho_ten if hs else 'Unknown',
            'loai_bang_chung': self.loai_bang_chung,
            'ly_do': self.ly_do,
            'diem': self.diem,
            'thoi_gian': self.thoi_gian.isoformat() if self.thoi_gian else None,
            'kich_thuoc_byte': self.kich_thuoc_byte,
            'resolved': self.resolved,
        }

# Decorator kiểm tra quyền
def role_required(allowed_roles: List[str]):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = db.session.get(User, current_user_id)
            if not user or user.vai_tro not in allowed_roles:
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

def hash_password(password: str) -> str:
    """Băm mật khẩu"""
    return hashlib.sha256(password.encode()).hexdigest()

def validate_password(password: str) -> bool:
    """Kiểm tra độ mạnh mật khẩu"""
    if len(password) < 6:
        return False
    return True

# API Routes
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
    try:
        db.session.execute(text('SELECT 1'))
        db_status = 'healthy'
    except Exception as e:
        db_status = f'unhealthy: {str(e)}'
    
    return jsonify({
        'status': 'healthy',
        'database': db_status,
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
        user = User.query.filter_by(ten_dang_nhap=ten_dang_nhap).first()
        
        if not user:
            return jsonify({'loi': 'Tài khoản không tồn tại'}), 401
        
        # Kiểm tra mật khẩu
        hashed_password = hash_password(mat_khau)
        if user.mat_khau != hashed_password:
            return jsonify({'loi': 'Mật khẩu không đúng'}), 401
        
        # Cập nhật last_login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Tạo token
        access_token = create_access_token(identity=user.id)
        
        response = jsonify({
            'token': access_token,
            'user': user.to_dict(),
            'message': 'Đăng nhập thành công'
        })
        
        # Set cookie nếu cần
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
        if User.query.filter_by(ten_dang_nhap=ten_dang_nhap).first():
            return jsonify({'loi': 'Tên đăng nhập đã tồn tại'}), 400
        
        # Tạo user mới
        user = User(
            ten_dang_nhap=ten_dang_nhap,
            mat_khau=hash_password(mat_khau),
            ho_ten=ho_ten,
            vai_tro=vai_tro,
            ten_truong=ten_truong
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Đăng ký thành công',
            'user_id': user.id
        }), 201
        
    except Exception as e:
        logger.error(f"Register error: {str(e)}")
        db.session.rollback()
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
        current_user = db.session.get(User, current_user_id)
        ten_truong = current_user.ten_truong
        
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
            if User.query.filter_by(ten_dang_nhap=ten_dang_nhap).first():
                failed.append({
                    'ten_dang_nhap': ten_dang_nhap,
                    'ly_do': 'Tên đăng nhập đã tồn tại'
                })
                continue
            
            # Tạo user
            user = User(
                ten_dang_nhap=ten_dang_nhap,
                mat_khau=hash_password(mat_khau),
                ho_ten=ho_ten,
                vai_tro=vai_tro,
                ten_truong=ten_truong
            )
            db.session.add(user)
            
            success.append({
                'ten_dang_nhap': ten_dang_nhap,
                'ho_ten': ho_ten,
                'mat_khau': mat_khau
            })
        
        db.session.commit()
        
        return jsonify({
            'thanh_cong': success,
            'that_bai': failed,
            'message': f'Tạo thành công {len(success)} tài khoản'
        }), 201
        
    except Exception as e:
        logger.error(f"Batch register error: {str(e)}")
        db.session.rollback()
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
        current_user = db.session.get(User, current_user_id)
        
        ma_phong = generate_room_code()
        
        # Tạo QR code với thông tin phòng
        qr_data = f"VIRTU:{ma_phong}"
        qr_base64 = generate_qr_code(qr_data)
        
        phong = PhongThi(
            ma_phong=ma_phong,
            ten_phien=ten_phien,
            giao_vien_id=current_user_id,
            ten_truong=current_user.ten_truong,
            qr_base64=qr_base64,
            settings={
                'auto_start': False,
                'require_webcam': True,
                'allow_mobile': True
            }
        )
        
        db.session.add(phong)
        db.session.commit()
        
        return jsonify({
            'id': phong.id,
            'ma_phong': ma_phong,
            'qr_base64': qr_base64,
            'message': 'Tạo phòng thi thành công'
        }), 201
        
    except Exception as e:
        logger.error(f"Create room error: {str(e)}")
        db.session.rollback()
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
        
        if not phien_id:
            return jsonify({'loi': 'Thiếu ID phòng thi'}), 400
        
        phong = db.session.get(PhongThi, phien_id)
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, current_user_id)
        
        # Kiểm tra quyền
        if phong.giao_vien_id != current_user_id and current_user.vai_tro != 'admin':
            return jsonify({'loi': 'Không có quyền đóng phòng này'}), 403
        
        phong.dang_hoat_dong = False
        phong.closed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Đã đóng phòng thi thành công'
        }), 200
        
    except Exception as e:
        logger.error(f"Close room error: {str(e)}")
        db.session.rollback()
        return jsonify({'loi': f'Lỗi đóng phòng: {str(e)}'}), 500

@app.route('/api/phong/<ma_phong>', methods=['GET', 'OPTIONS'])
@jwt_required()
def thong_tin_phong(ma_phong):
    """Lấy thông tin chi tiết phòng thi"""
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    try:
        phong = PhongThi.query.filter_by(ma_phong=ma_phong).first()
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, current_user_id)
        
        # Kiểm tra quyền
        if phong.giao_vien_id != current_user_id and current_user.vai_tro != 'admin':
            return jsonify({'loi': 'Không có quyền xem phòng này'}), 403
        
        # Lấy danh sách học sinh trong phòng
        phong_hoc_sinh = PhongHocSinh.query.filter_by(
            phong_id=phong.id,
            is_active=True
        ).all()
        
        hoc_sinh_list = []
        for phs in phong_hoc_sinh:
            hs = db.session.get(User, phs.hoc_sinh_id)
            if hs:
                # Tính điểm từ vi phạm
                violations = ViPham.query.filter_by(
                    phien_id=phong.id,
                    hoc_sinh_id=hs.id
                ).all()
                
                diem = sum(v.diem for v in violations)
                
                trang_thai = 'normal'
                if diem >= 10:
                    trang_thai = 'cheating'
                elif diem >= 5:
                    trang_thai = 'suspicious'
                
                hoc_sinh_list.append({
                    'hoc_sinh_id': hs.id,
                    'ho_ten': hs.ho_ten,
                    'trang_thai': trang_thai,
                    'diem': diem,
                    'con_ket_noi': True,
                    'joined_at': phs.joined_at.isoformat() if phs.joined_at else None
                })
        
        return jsonify({
            'phong': phong.to_dict(),
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
        current_user = db.session.get(User, current_user_id)
        
        if not current_user:
            return jsonify({'loi': 'Người dùng không tồn tại'}), 404
        
        # Lấy phòng theo trường
        query = PhongThi.query.filter_by(ten_truong=current_user.ten_truong)
        
        # Nếu không phải admin, chỉ lấy phòng của mình
        if current_user.vai_tro != 'admin':
            query = query.filter_by(giao_vien_id=current_user_id)
        
        rooms = query.order_by(PhongThi.created_at.desc()).all()
        
        return jsonify({
            'phong': [room.to_dict() for room in rooms]
        }), 200
        
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
        phong = db.session.get(PhongThi, phien_id)
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, current_user_id)
        
        # Kiểm tra quyền
        if phong.giao_vien_id != current_user_id and current_user.vai_tro != 'admin':
            return jsonify({'loi': 'Không có quyền xem vi phạm'}), 403
        
        violations = ViPham.query.filter_by(phien_id=phien_id).order_by(
            ViPham.thoi_gian.desc()
        ).all()
        
        return jsonify({
            'vi_pham': [v.to_dict() for v in violations]
        }), 200
        
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
        phong = db.session.get(PhongThi, phien_id)
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, current_user_id)
        
        # Kiểm tra quyền
        if phong.giao_vien_id != current_user_id and current_user.vai_tro != 'admin':
            return jsonify({'loi': 'Không có quyền xem vi phạm'}), 403
        
        violations = ViPham.query.filter_by(
            phien_id=phien_id,
            hoc_sinh_id=hoc_sinh_id
        ).order_by(ViPham.thoi_gian.desc()).all()
        
        return jsonify({
            'vi_pham': [v.to_dict() for v in violations]
        }), 200
        
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
        vp = db.session.get(ViPham, vi_pham_id)
        if not vp:
            return jsonify({'loi': 'Vi phạm không tồn tại'}), 404
        
        phong = db.session.get(PhongThi, vp.phien_id)
        if not phong:
            return jsonify({'loi': 'Phòng thi không tồn tại'}), 404
        
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, current_user_id)
        
        # Kiểm tra quyền
        if phong.giao_vien_id != current_user_id and current_user.vai_tro != 'admin':
            return jsonify({'loi': 'Không có quyền xem bằng chứng'}), 403
        
        # Nếu chưa có dữ liệu, tạo demo
        if not vp.du_lieu_path:
            # Tạo ảnh demo
            img = Image.new('RGB', (800, 600), color=(20, 20, 30))
            draw = ImageDraw.Draw(img)
            
            # Vẽ khung vi phạm
            draw.rectangle([200, 150, 600, 450], outline=(255, 84, 112), width=3)
            draw.text((250, 200), f"VI PHAM: {vp.id[:8]}", fill=(255, 84, 112))
            draw.text((250, 240), f"HS: {vp.hoc_sinh_id[:8]}", fill=(255, 201, 74))
            draw.text((250, 280), f"LY DO: {vp.ly_do}", fill=(255, 255, 255))
            draw.text((250, 320), f"DIEM: {vp.diem}", fill=(255, 84, 112))
            draw.text((250, 360), f"THOI GIAN: {vp.thoi_gian.isoformat() if vp.thoi_gian else 'N/A'}", fill=(200, 200, 200))
            
            img_byte_arr = BytesIO()
            img.save(img_byte_arr, format='PNG')
            vp.du_lieu_path = img_byte_arr.getvalue()
            vp.kich_thuoc_byte = len(vp.du_lieu_path)
            db.session.commit()
        
        # Trả về dữ liệu
        mimetype = 'image/png' if vp.loai_bang_chung == 'image' else 'video/mp4'
        return send_file(
            BytesIO(vp.du_lieu_path),
            mimetype=mimetype,
            as_attachment=False
        ), 200
        
    except Exception as e:
        logger.error(f"Download evidence error: {str(e)}")
        return jsonify({'loi': f'Lỗi tải bằng chứng: {str(e)}'}), 500

@app.route('/api/them_vi_pham', methods=['POST', 'OPTIONS'])
@role_required(['admin', 'giao_vien'])
def them_vi_pham():
    """Thêm vi phạm mới (cho WebSocket real-time)
