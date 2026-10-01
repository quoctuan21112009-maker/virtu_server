/* ================================================================
 * ket_noi_client.js
 * ================================================================
 * Lớp kết nối tới server (may_chu.py) dùng chung cho cả 3 giao diện
 * (học sinh / giáo viên / quản trị) — CHUYỂN ĐỔI Y HỆT ket_noi_client.py.
 *
 *   - `RESTClient`        : gọi REST API qua fetch() — giữ nguyên
 *                            toàn bộ endpoint/field như bản Python.
 *   - `KetNoiThoiGianThuc`: bọc socket.io-client, phát các sự kiện
 *                            tương ứng (dùng EventTarget thay cho
 *                            pyqtSignal) mỗi khi server gửi realtime.
 *
 * Yêu cầu: nạp thư viện socket.io-client qua CDN trước khi dùng
 * module này (xem index.html):
 *   <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
 * ================================================================ */

// ============================================================
// REST
// ============================================================
export class LoiApi extends Error {
  constructor(thongDiep, maLoi = null) {
    super(thongDiep);
    this.thong_diep = thongDiep;
    this.ma_loi = maLoi;
  }
}

export class RESTClient {
  constructor(diaChiServer) {
    this.dia_chi_server = diaChiServer.replace(/\/+$/, "");
    this.token = null;
  }

  _url(duongDan) {
    return `${this.dia_chi_server}${duongDan}`;
  }

  _tieuDe() {
    const h = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async _xuLy(resp) {
    let d;
    try {
      d = await resp.json();
    } catch (e) {
      throw new LoiApi(`Server trả về dữ liệu không hợp lệ (HTTP ${resp.status})`);
    }
    if (resp.status >= 400) {
      throw new LoiApi(d.loi || "Lỗi không xác định", resp.status);
    }
    return d;
  }

  async _fetchJson(duongDan, { method = "GET", body, timeout = 10000, headers } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(this._url(duongDan), {
        method,
        headers: headers || this._tieuDe(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return await this._xuLy(resp);
    } catch (e) {
      if (e.name === "AbortError") throw new LoiApi("Hết thời gian chờ kết nối server");
      if (e instanceof LoiApi) throw e;
      throw new LoiApi(`Lỗi kết nối: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Tài khoản ----
  async dang_ky(ten_dang_nhap, mat_khau, ho_ten, vai_tro, ten_truong) {
    return this._fetchJson("/api/dang_ky", {
      method: "POST",
      body: { ten_dang_nhap, mat_khau, ho_ten, vai_tro, ten_truong },
      headers: { "Content-Type": "application/json" },
    });
  }

  async dang_ky_hang_loat(vai_tro, danh_sach) {
    return this._fetchJson("/api/dang_ky_hang_loat", {
      method: "POST",
      body: { vai_tro, danh_sach },
      timeout: 20000,
    });
  }

  async dang_nhap(ten_dang_nhap, mat_khau) {
    const d = await this._fetchJson("/api/dang_nhap", {
      method: "POST",
      body: { ten_dang_nhap, mat_khau },
      headers: { "Content-Type": "application/json" },
    });
    this.token = d.token;
    return d;
  }

  // ---- Phòng thi ----
  async tao_phong(ten_phien, mon_thi = null, phong_thi = null, thoi_gian_thi = null) {
    return this._fetchJson("/api/tao_phong", {
      method: "POST",
      body: {
        ten_phien, mon_thi, phong_thi, thoi_gian_thi,
        dia_chi_server: this.dia_chi_server,
      },
    });
  }

  async dong_phong(phien_id) {
    return this._fetchJson("/api/dong_phong", { method: "POST", body: { phien_id } });
  }

  async tham_gia_phong(ma_phong) {
    return this._fetchJson("/api/tham_gia_phong", { method: "POST", body: { ma_phong } });
  }

  async thong_tin_phong(ma_phong) {
    return this._fetchJson(`/api/phong/${ma_phong}`);
  }

  async phong_cua_truong() {
    return this._fetchJson("/api/phong_cua_truong");
  }

  async bat_dau_phong(ma_phong) {
    return this._fetchJson(`/api/phong/${ma_phong}/start`, { method: "POST" });
  }

  async tam_dung_phong(ma_phong) {
    return this._fetchJson(`/api/phong/${ma_phong}/pause`, { method: "POST" });
  }

  async reset_hoc_sinh(ma_phong, hoc_sinh_id, ly_do = "") {
    return this._fetchJson(`/api/phong/${ma_phong}/reset/${hoc_sinh_id}`, {
      method: "POST",
      body: { ly_do: ly_do || "Giáo viên yêu cầu đặt lại" },
    });
  }

  async tam_dung_hoc_sinh(ma_phong, hoc_sinh_id) {
    return this._fetchJson(`/api/phong/${ma_phong}/pause/${hoc_sinh_id}`, { method: "POST" });
  }

  async tiep_tuc_hoc_sinh(ma_phong, hoc_sinh_id) {
    return this._fetchJson(`/api/phong/${ma_phong}/resume/${hoc_sinh_id}`, { method: "POST" });
  }

  // ---- Bằng chứng vi phạm ----
  async vi_pham_theo_phong(phien_id) {
    return this._fetchJson(`/api/vi_pham/${phien_id}`);
  }

  async vi_pham_theo_hoc_sinh(phien_id, hoc_sinh_id) {
    return this._fetchJson(`/api/vi_pham/hoc_sinh/${phien_id}/${hoc_sinh_id}`);
  }

  /** Trả về ArrayBuffer (bytes THẬT, đã giải mã ở server) của 1 ảnh/video. */
  async tai_du_lieu_bang_chung(vi_pham_id) {
    const resp = await fetch(this._url(`/api/vi_pham/${vi_pham_id}/du_lieu`), {
      headers: this._tieuDe(),
    });
    if (resp.status >= 400) {
      try {
        const d = await resp.json();
        throw new LoiApi(d.loi || "Lỗi không xác định", resp.status);
      } catch (e) {
        if (e instanceof LoiApi) throw e;
        throw new LoiApi(`Lỗi tải bằng chứng (HTTP ${resp.status})`);
      }
    }
    return resp.arrayBuffer();
  }

  async tai_len_vi_pham(phien_id, ma_phong, diem, ly_do, loai_bang_chung, dinh_dang, du_lieu_b64) {
    return this._fetchJson("/api/tai_len_vi_pham", {
      method: "POST",
      body: {
        phien_id, ma_phong, diem, ly_do,
        loai_bang_chung, dinh_dang, du_lieu_b64,
      },
      timeout: 30000,
    });
  }

  async danh_sach_nguoi_dung(vai_tro) {
    return this._fetchJson(`/api/danh_sach_nguoi_dung?vai_tro=${encodeURIComponent(vai_tro)}`);
  }

  async thong_ke_tong_quan() {
    return this._fetchJson("/api/thong_ke_tong_quan");
  }

  async bao_cao_phien(phien_id) {
    return this._fetchJson(`/api/bao_cao_phien/${phien_id}`);
  }

  async lay_nhat_ky(gioi_han = 100) {
    return this._fetchJson(`/api/nhat_ky?gioi_han=${gioi_han}`);
  }

  async xoa_nhat_ky() {
    return this._fetchJson("/api/nhat_ky/xoa", { method: "POST" });
  }

  // ---- AI Engine (chấm điểm 63 đặc trưng, tính năng bổ sung cho web) ----
  /** Gửi vector 63 chiều lên server để chấm điểm rủi ro (thay cho bo_nap_dong_co_ram.py chạy local). */
  async cham_diem_rui_ro(ma_phong, hoc_sinh_id, feature_vector, nonce = null) {
    return this._fetchJson("/api/cham_diem_rui_ro", {
      method: "POST",
      body: { ma_phong, hoc_sinh_id, feature_vector, nonce },
    });
  }
}

// ============================================================
// SOCKET.IO THỜI GIAN THỰC (chỉ điều khiển/trạng thái, không video)
// ============================================================
/**
 * Thay thế QObject + pyqtSignal bằng EventTarget chuẩn của trình duyệt.
 * Sử dụng: ketNoi.on('vi_pham_moi', (data) => {...})
 *
 * Các sự kiện phát ra (giữ nguyên tên như bản Python):
 *   da_ket_noi, loi_ket_noi, mat_ket_noi,
 *   trang_thai_hoc_sinh, hoc_sinh_vao_phong, hoc_sinh_mat_ket_noi,
 *   vi_pham_moi, phong_da_dong, trang_thai_phien, yeu_cau_reset
 */
export class KetNoiThoiGianThuc extends EventTarget {
  constructor(diaChiServer, token) {
    super();
    this.dia_chi_server = diaChiServer.replace(/\/+$/, "");
    this.token = token;
    this.sio = null;
    this._daDangKy = false;
  }

  _phatSuKien(ten, detail) {
    this.dispatchEvent(new CustomEvent(ten, { detail }));
  }

  /** Đăng ký 1 callback cho 1 sự kiện — tương đương connect() trong PyQt5. */
  on(ten, cb) {
    const handler = (ev) => cb(ev.detail);
    this.addEventListener(ten, handler);
    return handler; // trả về để có thể off()
  }

  off(ten, handler) {
    this.removeEventListener(ten, handler);
  }

  _dangKySuKien() {
    if (this._daDangKy) return;
    this._daDangKy = true;
    this.sio.on("connect", () => this._phatSuKien("da_ket_noi"));
    this.sio.on("disconnect", () => this._phatSuKien("mat_ket_noi"));
    this.sio.on("connect_error", (err) => this._phatSuKien("loi_ket_noi", String(err)));
    this.sio.on("trang_thai_hoc_sinh", (d) => this._phatSuKien("trang_thai_hoc_sinh", d));
    this.sio.on("hoc_sinh_vao_phong", (d) => this._phatSuKien("hoc_sinh_vao_phong", d));
    this.sio.on("hoc_sinh_mat_ket_noi", (d) => this._phatSuKien("hoc_sinh_mat_ket_noi", d));
    this.sio.on("vi_pham_moi", (d) => this._phatSuKien("vi_pham_moi", d));
    this.sio.on("phong_da_dong", (d) => this._phatSuKien("phong_da_dong", d));
    this.sio.on("trang_thai_phien", (d) => this._phatSuKien("trang_thai_phien", d));
    this.sio.on("yeu_cau_reset", (d) => this._phatSuKien("yeu_cau_reset", d));
  }

  /** Kết nối (tương đương ket_noi_nen — socket.io-client tự chạy async, không cần thread riêng). */
  ket_noi_nen() {
    if (typeof io === "undefined") {
      console.error("[KetNoiThoiGianThuc] Thiếu thư viện socket.io-client (nạp qua CDN).");
      this._phatSuKien("loi_ket_noi", "Thiếu thư viện socket.io-client");
      return;
    }
    this.sio = io(this.dia_chi_server, {
      transports: ["websocket"],
      auth: { token: this.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 10000,
    });
    this._dangKySuKien();
  }

  ngat_ket_noi() {
    try {
      if (this.sio && this.sio.connected) this.sio.disconnect();
    } catch (e) { /* ignore */ }
  }

  // ---- Các hàm phát sự kiện lên server ----
  vao_phong_giam_sat(ma_phong) {
    this._phat("vao_phong_giam_sat", { ma_phong });
  }

  roi_phong_giam_sat(ma_phong) {
    this._phat("roi_phong_giam_sat", { ma_phong });
  }

  hoc_sinh_vao(ma_phong) {
    this._phat("hoc_sinh_vao", { ma_phong });
  }

  gui_trang_thai(ma_phong, nhan, diem) {
    this._phat("cap_nhat_trang_thai", { ma_phong, nhan, diem });
  }

  _phat(suKien, duLieu) {
    try {
      if (this.sio && this.sio.connected) this.sio.emit(suKien, duLieu);
    } catch (e) { /* ignore */ }
  }
}
