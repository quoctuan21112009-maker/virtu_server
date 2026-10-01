/* ================================================================
 * ngon_ngu.js
 * ================================================================
 * Hệ thống đa ngôn ngữ cho ứng dụng Virtu Web.
 * Hỗ trợ: Tiếng Việt (vi), English (en), 中文 (zh).
 * Chuyển đổi y hệt ngon_ngu.py — dùng localStorage thay cho
 * file config ~/.virtu_config.json.
 *
 * Sử dụng:
 *   import { T, datNgonNgu, layNgonNgu, khoiTaoNgonNgu } from './ngon_ngu.js';
 *   datNgonNgu('en');
 *   console.log(T('dang_nhap'));  // -> "Login"
 * ================================================================ */

const KHOA_LUU = "virtu_ngon_ngu";

let _ngonNguHienTai = "vi";

// ---- Bảng dịch (y hệt TU_DIEN trong ngon_ngu.py) ----
export const TU_DIEN = {
  // ===================== ĐĂNG NHẬP =====================
  dang_nhap: { vi: "Đăng nhập", en: "Login", zh: "登录" },
  dang_ky: { vi: "Đăng ký", en: "Register", zh: "注册" },
  ten_tai_khoan: { vi: "Tên tài khoản", en: "Username", zh: "用户名" },
  mat_khau: { vi: "Mật khẩu", en: "Password", zh: "密码" },
  chao_mung_tro_lai: { vi: "Chào mừng trở lại", en: "Welcome back", zh: "欢迎回来" },
  dia_chi_server: { vi: "ĐỊA CHỈ SERVER", en: "SERVER ADDRESS", zh: "服务器地址" },
  quet_qr: { vi: "Quét QR địa chỉ server", en: "Scan QR for server address", zh: "扫描二维码获取服务器地址" },
  doi_giao_dien_sang: { vi: "Sang chế độ Sáng", en: "Switch to Light mode", zh: "切换到浅色模式" },
  doi_giao_dien_toi: { vi: "Sang chế độ Tối", en: "Switch to Dark mode", zh: "切换到深色模式" },
  tao_tai_khoan: { vi: "Tạo tài khoản", en: "Create account", zh: "创建账号" },
  ten_dang_nhap: { vi: "Tên đăng nhập", en: "Username", zh: "用户名" },
  ho_va_ten: { vi: "Họ và tên đầy đủ", en: "Full name", zh: "姓名" },
  ten_truong: { vi: "Tên trường", en: "School name", zh: "学校名称" },
  dang_ket_noi: { vi: "Đang kết nối…", en: "Connecting…", zh: "连接中…" },
  loi_nhap_du: {
    vi: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.",
    en: "Please enter both username and password.",
    zh: "请输入用户名和密码。",
  },
  loi_thieu_thong_tin: {
    vi: "Vui lòng điền đầy đủ thông tin đăng ký.",
    en: "Please fill in all registration fields.",
    zh: "请填写所有注册信息。",
  },
  loi_ket_noi: { vi: "Không thể kết nối tới server", en: "Cannot connect to server", zh: "无法连接到服务器" },
  tao_tk_thanh_cong: {
    vi: "Tạo tài khoản thành công! Đang đăng nhập…",
    en: "Account created successfully! Logging in…",
    zh: "账号创建成功！正在登录…",
  },
  thanh_cong: { vi: "Thành công", en: "Success", zh: "成功" },
  loi: { vi: "Lỗi", en: "Error", zh: "错误" },
  ghi_chu_dang_nhap: {
    vi: "Nếu gặp sự cố khi đăng nhập, hãy thử khởi động lại ứng dụng.",
    en: "If you have trouble logging in, try restarting the app.",
    zh: "如果登录遇到问题，请尝试重新启动应用。",
  },
  ngon_ngu: { vi: "Ngôn ngữ", en: "Language", zh: "语言" },

  // ===================== VAI TRÒ =====================
  hoc_sinh: { vi: "Học sinh", en: "Student", zh: "学生" },
  giao_vien: { vi: "Giáo viên", en: "Teacher", zh: "教师" },
  quan_tri_vien: { vi: "Quản trị viên", en: "Administrator", zh: "管理员" },

  // ===================== SIDEBAR =====================
  tong_quan: { vi: "Tổng quan", en: "Dashboard", zh: "仪表盘" },
  phien_giam_sat: { vi: "Phiên giám sát", en: "Sessions", zh: "监控会话" },
  phong_thi: { vi: "Phòng thi", en: "Exam rooms", zh: "考场" },
  giam_thi: { vi: "Giám thị", en: "Proctors", zh: "监考员" },
  thi_sinh: { vi: "Thí sinh", en: "Candidates", zh: "考生" },
  bao_cao: { vi: "Báo cáo", en: "Reports", zh: "报告" },
  cai_dat: { vi: "Cài đặt", en: "Settings", zh: "设置" },
  nhat_ky: { vi: "Nhật ký hệ thống", en: "System log", zh: "系统日志" },
  dang_xuat: { vi: "Đăng xuất", en: "Logout", zh: "退出登录" },

  // ===================== GIÁO VIÊN UI =====================
  tao_phien_moi: { vi: "TẠO PHIÊN THI MỚI", en: "CREATE NEW EXAM", zh: "创建新考试" },
  ten_phien_thi: { vi: "Tên phiên thi...", en: "Exam name...", zh: "考试名称..." },
  mon_thi: { vi: "Môn thi", en: "Subject", zh: "科目" },
  phong_so: { vi: "Phòng (số)...", en: "Room (number)...", zh: "考场（编号）..." },
  thoi_gian_thi: { vi: "Thời gian thi", en: "Exam time", zh: "考试时间" },
  tao_moi: { vi: " Tạo mới", en: " Create", zh: " 创建" },
  ma_phong: { vi: "Mã phòng", en: "Room code", zh: "房间代码" },
  giam_sat: { vi: "Giám sát", en: "Monitor", zh: "监控" },
  dong_phong: { vi: "Đóng phòng", en: "Close room", zh: "关闭考场" },
  dong: { vi: "Đóng", en: "Close", zh: "关闭" },
  trang_thai: { vi: "Trạng thái", en: "Status", zh: "状态" },
  dang_dien_ra: { vi: "Đang diễn ra", en: "In progress", zh: "进行中" },
  da_ket_thuc: { vi: "Đã kết thúc", en: "Ended", zh: "已结束" },
  bat_dau_luc: { vi: "Bắt đầu lúc", en: "Started at", zh: "开始时间" },

  // ===================== DANH SÁCH MÔN THI =====================
  toan_hoc: { vi: "Toán học", en: "Mathematics", zh: "数学" },
  vat_ly: { vi: "Vật lý", en: "Physics", zh: "物理" },
  hoa_hoc: { vi: "Hóa học", en: "Chemistry", zh: "化学" },
  sinh_hoc: { vi: "Sinh học", en: "Biology", zh: "生物" },
  lich_su: { vi: "Lịch sử", en: "History", zh: "历史" },
  dia_ly: { vi: "Địa lý", en: "Geography", zh: "地理" },
  tin_hoc: { vi: "Tin học", en: "Informatics", zh: "信息技术" },
  tieng_anh: { vi: "Tiếng Anh", en: "English", zh: "英语" },
  ngu_van: { vi: "Ngữ Văn", en: "Literature", zh: "语文" },

  // ===================== LƯỚI GIÁM SÁT =====================
  binh_thuong: { vi: "Bình thường", en: "Normal", zh: "正常" },
  nghi_van: { vi: "Nghi vấn", en: "Suspicious", zh: "可疑" },
  vi_pham: { vi: "Vi phạm", en: "Cheating", zh: "作弊" },
  mat_ket_noi: { vi: "Mất kết nối", en: "Disconnected", zh: "已断开" },
  sap_xep: { vi: "Sắp xếp", en: "Sort", zh: "排序" },
  che_do_luoi: { vi: "Lưới", en: "Grid", zh: "网格" },
  che_do_danh_sach: { vi: "Danh sách", en: "List", zh: "列表" },

  // ===================== XEM BẰNG CHỨNG =====================
  bang_chung_vi_pham: { vi: "Bằng chứng vi phạm", en: "Violation evidence", zh: "违规证据" },
  danh_sach_su_kien: { vi: "DANH SÁCH SỰ KIỆN", en: "EVENT LIST", zh: "事件列表" },
  bam_de_xem: { vi: "(bấm để xem)", en: "(click to view)", zh: "(点击查看)" },
  xem_truoc: { vi: "XEM TRƯỚC", en: "PREVIEW", zh: "预览" },
  lam_moi: { vi: "Làm mới", en: "Refresh", zh: "刷新" },
  chon_su_kien: {
    vi: "Chọn 1 sự kiện ở danh sách bên trái",
    en: "Select an event from the list on the left",
    zh: "从左侧列表中选择一个事件",
  },
  dang_tai: { vi: "Đang tải…", en: "Loading…", zh: "加载中…" },
  mo_video: { vi: "Mở video bằng trình phát mặc định", en: "Open video with default player", zh: "使用默认播放器打开视频" },
  da_tai_video: { vi: "Đã tải video", en: "Video loaded", zh: "视频已加载" },
  bam_nut_phat: { vi: "Bấm nút bên dưới để phát", en: "Press the button below to play", zh: "按下面的按钮播放" },
  dang_tai_bang_chung: {
    vi: "Đang tải bằng chứng vào bộ nhớ... %v/%m",
    en: "Loading evidence into memory... %v/%m",
    zh: "正在将证据加载到内存... %v/%m",
  },
  da_tai_xong: {
    vi: "Đã tải xong toàn bộ bằng chứng vào bộ nhớ",
    en: "All evidence loaded into memory",
    zh: "所有证据已加载到内存",
  },

  // ===================== ADMIN =====================
  he_thong_giam_sat: {
    vi: "Hệ thống giám sát thi cử AI",
    en: "AI Exam Proctoring System",
    zh: "AI考试监控系统",
  },
  virtu: { vi: "Virtu", en: "Virtu", zh: "Virtu" },
};

// ---- Danh sách ngôn ngữ hỗ trợ ----
export const NGON_NGU_HO_TRO = {
  vi: "Tiếng Việt",
  en: "English",
  zh: "中文",
};

const _nghe = new Set();

export function layNgonNgu() {
  return _ngonNguHienTai;
}

export function datNgonNgu(ma) {
  if (Object.prototype.hasOwnProperty.call(NGON_NGU_HO_TRO, ma)) {
    _ngonNguHienTai = ma;
    _luuNgonNgu(ma);
    _nghe.forEach((cb) => {
      try { cb(ma); } catch (e) { /* ignore */ }
    });
  }
}

export function onDoiNgonNgu(cb) {
  _nghe.add(cb);
  return () => _nghe.delete(cb);
}

export function T(khoa) {
  const muc = TU_DIEN[khoa];
  if (!muc) return khoa;
  return muc[_ngonNguHienTai] || muc.vi || khoa;
}

function _docNgonNguTuConfig() {
  try {
    const raw = localStorage.getItem(KHOA_LUU);
    if (raw) {
      const d = JSON.parse(raw);
      return d.language || "vi";
    }
  } catch (e) { /* ignore */ }
  return "vi";
}

function _luuNgonNgu(ma) {
  try {
    localStorage.setItem(KHOA_LUU, JSON.stringify({ language: ma }));
  } catch (e) { /* ignore */ }
}

export function khoiTaoNgonNgu() {
  _ngonNguHienTai = _docNgonNguTuConfig();
  return _ngonNguHienTai;
}
