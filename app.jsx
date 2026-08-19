import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  LogOut, QrCode, Copy, Plus, RefreshCw, Users, Lock, ShieldAlert,
  ShieldCheck, GraduationCap, UserCog, Video, ImageIcon, X, ChevronRight,
  Minimize2, Clock3, WifiOff, Play, Check, LayoutGrid, ListFilter, Radio,
  Sparkles, School, ScanEye, ArrowLeft, UserPlus2, ClipboardPaste, Trash2,
  KeyRound, Server, Eye, EyeOff, Loader2, AlertTriangle, LogIn, UserPlus,
  Link2, Inbox,
} from "lucide-react";

/* ============================================================
   VIRTU — Web Console (Giáo viên / Quản trị viên)
   Kết nối trực tiếp tới máy chủ Flask thật (may_chu.py) qua REST API.
   Không dùng dữ liệu giả lập — mọi màn hình đọc/ghi dữ liệu thật từ
   server người dùng khai báo lúc đăng nhập.
   ============================================================ */

const LOGO_URI = "data:image/webp;base64,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";

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
:root{
  --bg-void:#07090c; --bg-deep:#0b0f14; --bg-panel:#10151c; --bg-panel-2:#141a22;
  --line:#1e2630; --line-soft:#171e27; --text-hi:#eef2f6; --text-mid:#8b97a7; --text-dim:#4d5866;
  --cyan:#22d3ee; --cyan-dim:rgba(34,211,238,0.14); --green:#34e08a; --amber:#ffc94a; --red:#ff5470; --violet:#9b8cff;
}
.virtu-root{ font-family:'Sora',sans-serif; background:var(--bg-void); color:var(--text-hi); min-height:100vh; position:relative; overflow-x:hidden; }
.virtu-root .mono{ font-family:'JetBrains Mono',monospace; }
.virtu-noise{ position:fixed; inset:0; pointer-events:none; z-index:0; opacity:0.5;
  background-image:
    radial-gradient(circle at 15% 10%, rgba(34,211,238,0.06), transparent 40%),
    radial-gradient(circle at 85% 90%, rgba(155,140,255,0.05), transparent 45%),
    repeating-linear-gradient(180deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px); }
.virtu-scan{ position:fixed; left:0; right:0; height:140px; z-index:0; pointer-events:none;
  background:linear-gradient(180deg, transparent, rgba(34,211,238,0.035), transparent); animation: scanmove 9s linear infinite; }
@keyframes scanmove{ 0%{ top:-140px } 100%{ top:100vh } }
@keyframes fadeUp{ from{ opacity:0; transform:translateY(10px);} to{ opacity:1; transform:translateY(0);} }
@keyframes popIn{ from{ opacity:0; transform:scale(.94);} to{ opacity:1; transform:scale(1);} }
@keyframes slideL{ from{ opacity:0; transform:translateX(16px);} to{ opacity:1; transform:translateX(0);} }
@keyframes pulseRed{ 0%,100%{ box-shadow:0 0 0 0 rgba(255,84,112,0.55), 0 0 18px 2px rgba(255,84,112,0.25) inset; } 50%{ box-shadow:0 0 0 8px rgba(255,84,112,0), 0 0 28px 6px rgba(255,84,112,0.4) inset; } }
@keyframes pulseAmber{ 0%,100%{ box-shadow:0 0 0 0 rgba(255,201,74,0.35); } 50%{ box-shadow:0 0 0 6px rgba(255,201,74,0); } }
@keyframes breathe{ 0%,100%{ opacity:1;} 50%{ opacity:.55;} }
@keyframes barGrow{ from{ transform:scaleX(0);} to{ transform:scaleX(1);} }
@keyframes ring{ 0%{ transform:scale(.6); opacity:.9;} 100%{ transform:scale(1.9); opacity:0;} }
@keyframes spin{ from{ transform:rotate(0);} to{ transform:rotate(360deg);} }
@keyframes floatY{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-8px);} }
.fade-up{ animation: fadeUp .45s cubic-bezier(.2,.8,.2,1) both; }
.pop-in{ animation: popIn .28s cubic-bezier(.2,.8,.2,1) both; }
.slide-l{ animation: slideL .35s cubic-bezier(.2,.8,.2,1) both; }
.spin{ animation: spin 1s linear infinite; }
.btn-primary{ background:linear-gradient(180deg, #29e0ff, #17b8de); color:#03181c; font-weight:700; letter-spacing:.01em;
  transition:transform .15s ease, filter .15s ease, box-shadow .15s ease; box-shadow:0 6px 20px -6px rgba(34,211,238,.55); }
.btn-primary:hover{ filter:brightness(1.08); transform:translateY(-1px); }
.btn-primary:active{ transform:translateY(0px) scale(.98); }
.btn-primary:disabled{ opacity:.55; filter:none; transform:none; cursor:not-allowed; }
.btn-ghost{ background:transparent; border:1px solid var(--line); color:var(--text-mid); transition:all .15s ease; }
.btn-ghost:hover{ border-color:var(--cyan); color:var(--cyan); background:var(--cyan-dim); }
.btn-danger{ background:transparent; border:1px solid rgba(255,84,112,.4); color:var(--red); transition:all .15s ease; }
.btn-danger:hover{ background:rgba(255,84,112,.12); border-color:var(--red); }
.card{ background:linear-gradient(180deg, var(--bg-panel), var(--bg-panel-2)); border:1px solid var(--line); border-radius:16px; }
.input-dark{ background:var(--bg-deep); border:1px solid var(--line); border-radius:10px; color:var(--text-hi); padding:10px 12px; outline:none; transition:border-color .15s; font-size:13.5px; width:100%; }
.input-dark::placeholder{ color:var(--text-dim); }
.input-dark:focus{ border-color:var(--cyan); box-shadow:0 0 0 3px var(--cyan-dim); }
.scrollbar-thin::-webkit-scrollbar{ width:6px; height:6px; }
.scrollbar-thin::-webkit-scrollbar-thumb{ background:#232b36; border-radius:99px; }
.scrollbar-thin::-webkit-scrollbar-track{ background:transparent; }
.tile{ position:relative; border-radius:14px; padding:12px 13px; border:1px solid var(--line); background:var(--bg-panel); cursor:pointer; transition:transform .18s cubic-bezier(.2,.8,.2,1), border-color .2s; }
.tile:hover{ transform:translateY(-2px); }
.tile-normal{ border-color:rgba(52,224,138,.35); }
.tile-suspicious{ border-color:rgba(255,201,74,.45); animation:pulseAmber 2.4s ease-in-out infinite; }
.tile-cheating{ border-color:rgba(255,84,112,.7); animation:pulseRed 1.15s ease-in-out infinite; }
.tile-offline{ opacity:.45; filter:grayscale(1); }
.dot-ring{ position:relative; width:8px; height:8px; }
.dot-ring::before{ content:''; position:absolute; inset:0; border-radius:99px; background:currentColor; }
.dot-ring::after{ content:''; position:absolute; inset:-4px; border-radius:99px; border:1px solid currentColor; animation: ring 1.6s ease-out infinite; }
.role-pill{ transition:all .25s cubic-bezier(.2,.8,.2,1); }
.progress-track{ background:var(--bg-deep); border:1px solid var(--line); border-radius:99px; overflow:hidden; }
.progress-fill{ transform-origin:left; animation:barGrow .6s cubic-bezier(.2,.8,.2,1) both; }
.tab-underline{ position:relative; }
.tab-underline::after{ content:''; position:absolute; left:0; right:0; bottom:-1px; height:2px; background:var(--cyan); transform:scaleX(0); transition:transform .25s cubic-bezier(.2,.8,.2,1); }
.tab-underline.active::after{ transform:scaleX(1); }
`;

/* ---------------- REST client thật, gọi may_chu.py ---------------- */

class LoiApi extends Error {
  constructor(thongDiep, maLoi) { super(thongDiep); this.thongDiep = thongDiep; this.maLoi = maLoi; }
}

class RESTClient {
  constructor(diaChiServer, token = null) {
    this.diaChiServer = diaChiServer.replace(/\/+$/, "");
    this.token = token;
  }
  _url(p) { return `${this.diaChiServer}${p}`; }
  _headers(json = true) {
    const h = {};
    if (json) h["Content-Type"] = "application/json";
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }
  async _xuLy(resp) {
    let d;
    try { d = await resp.json(); }
    catch { throw new LoiApi(`Server trả về dữ liệu không hợp lệ (HTTP ${resp.status})`); }
    if (resp.status >= 400) throw new LoiApi(d.loi || "Lỗi không xác định", resp.status);
    return d;
  }
  async dangNhap(ten_dang_nhap, mat_khau) {
    const r = await fetch(this._url("/api/dang_nhap"), { method: "POST", headers: this._headers(), body: JSON.stringify({ ten_dang_nhap, mat_khau }) });
    const d = await this._xuLy(r);
    this.token = d.token;
    return d;
  }
  async dangKy(ten_dang_nhap, mat_khau, ho_ten, vai_tro, ten_truong) {
    const r = await fetch(this._url("/api/dang_ky"), { method: "POST", headers: this._headers(), body: JSON.stringify({ ten_dang_nhap, mat_khau, ho_ten, vai_tro, ten_truong }) });
    return this._xuLy(r);
  }
  async dangKyHangLoat(vai_tro, danh_sach) {
    const r = await fetch(this._url("/api/dang_ky_hang_loat"), { method: "POST", headers: this._headers(), body: JSON.stringify({ vai_tro, danh_sach }) });
    return this._xuLy(r);
  }
  async taoPhong(ten_phien) {
    const r = await fetch(this._url("/api/tao_phong"), { method: "POST", headers: this._headers(), body: JSON.stringify({ ten_phien, dia_chi_server: this.diaChiServer }) });
    return this._xuLy(r);
  }
  async dongPhong(phien_id) {
    const r = await fetch(this._url("/api/dong_phong"), { method: "POST", headers: this._headers(), body: JSON.stringify({ phien_id }) });
    return this._xuLy(r);
  }
  async thongTinPhong(ma_phong) {
    const r = await fetch(this._url(`/api/phong/${ma_phong}`), { headers: this._headers() });
    return this._xuLy(r);
  }
  async phongCuaTruong() {
    const r = await fetch(this._url("/api/phong_cua_truong"), { headers: this._headers() });
    return this._xuLy(r);
  }
  async viPhamTheoPhong(phien_id) {
    const r = await fetch(this._url(`/api/vi_pham/${phien_id}`), { headers: this._headers() });
    return this._xuLy(r);
  }
  async viPhamTheoHocSinh(phien_id, hoc_sinh_id) {
    const r = await fetch(this._url(`/api/vi_pham/hoc_sinh/${phien_id}/${hoc_sinh_id}`), { headers: this._headers() });
    return this._xuLy(r);
  }
  async taiDuLieuBangChung(vi_pham_id) {
    const r = await fetch(this._url(`/api/vi_pham/${vi_pham_id}/du_lieu`), { headers: this._headers(false) });
    if (r.status >= 400) {
      try { const d = await r.json(); throw new LoiApi(d.loi || "Lỗi không xác định", r.status); }
      catch (e) { if (e instanceof LoiApi) throw e; throw new LoiApi(`Lỗi tải bằng chứng (HTTP ${r.status})`); }
    }
    return r.blob();
  }
}

const STATUS_META = {
  normal: { label: "BÌNH THƯỜNG", color: "var(--green)", tile: "tile-normal", icon: ShieldCheck },
  suspicious: { label: "NGHI VẤN", color: "var(--amber)", tile: "tile-suspicious", icon: ShieldAlert },
  cheating: { label: "GIAN LẬN", color: "var(--red)", tile: "tile-cheating", icon: ShieldAlert },
};
const LY_DO_HIEN_THI = {
  diem_rui_ro_vuot_nguong_gian_lan: "Điểm hành vi vượt ngưỡng",
  phat_hien_nhieu_nguoi_trong_khung_hinh: "Phát hiện ≥2 người trong khung hình",
};
const VAI_TRO_HIEN_THI = { hoc_sinh: "Học sinh", giao_vien: "Giáo viên", admin: "Quản trị viên" };

/* ============================================================
   Banner lỗi dùng chung
   ============================================================ */
function BannerLoi({ thongDiep, onDong }) {
  if (!thongDiep) return null;
  return (
    <div className="pop-in flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[rgba(255,84,112,.4)] bg-[rgba(255,84,112,.08)] text-[12px] text-[var(--red)]">
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">{thongDiep}</span>
      {onDong && <button onClick={onDong} className="shrink-0 opacity-70 hover:opacity-100"><X size={13} /></button>}
    </div>
  );
}

/* ============================================================
   Đăng nhập / Đăng ký
   ============================================================ */
function ManHinhDangNhap({ onDangNhapThanhCong }) {
  const [server, setServer] = useState("http://localhost:5000");
  const [tab, setTab] = useState("dang_nhap");
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");
  const [hienMk, setHienMk] = useState(false);

  const [ten, setTen] = useState("");
  const [mk, setMk] = useState("");

  const [rTen, setRTen] = useState("");
  const [rMk, setRMk] = useState("");
  const [rHoTen, setRHoTen] = useState("");
  const [rVaiTro, setRVaiTro] = useState("giao_vien");
  const [rTruong, setRTruong] = useState("");

  const diaChi = () => {
    let d = server.trim();
    if (!d) return "";
    if (!/^https?:\/\//i.test(d)) d = "http://" + d;
    return d;
  };

  const xuLyDangNhap = async (e) => {
    e.preventDefault();
    setLoi("");
    if (!ten.trim() || !mk) { setLoi("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu."); return; }
    setDangTai(true);
    try {
      const rest = new RESTClient(diaChi());
      const d = await rest.dangNhap(ten.trim(), mk);
      onDangNhapThanhCong(rest, d.user);
    } catch (e2) {
      setLoi(e2.thongDiep || `Không thể kết nối tới máy chủ: ${e2.message}`);
    } finally { setDangTai(false); }
  };

  const xuLyDangKy = async (e) => {
    e.preventDefault();
    setLoi("");
    if (!rTen.trim() || !rMk || !rHoTen.trim() || !rTruong.trim()) { setLoi("Vui lòng điền đầy đủ thông tin đăng ký."); return; }
    setDangTai(true);
    try {
      const rest = new RESTClient(diaChi());
      await rest.dangKy(rTen.trim(), rMk, rHoTen.trim(), rVaiTro, rTruong.trim());
      const d = await rest.dangNhap(rTen.trim(), rMk);
      onDangNhapThanhCong(rest, d.user);
    } catch (e2) {
      setLoi(e2.thongDiep || `Không thể kết nối tới máy chủ: ${e2.message}`);
    } finally { setDangTai(false); }
  };

  return (
    <div className="virtu-root flex items-center justify-center p-4">
      <style>{GLOBAL_CSS}</style>
      <div className="virtu-noise" />
      <div className="virtu-scan" />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-6 fade-up">
          <img src={LOGO_URI} alt="Virtu" className="w-16 h-16 mb-3" style={{ animation: "floatY 4s ease-in-out infinite", filter: "drop-shadow(0 8px 24px rgba(34,211,238,.35))" }} />
          <div className="text-[22px] font-extrabold tracking-tight">VIRTU</div>
          <div className="text-[11px] text-[var(--text-dim)] mono tracking-wider mt-0.5">HỆ THỐNG GIÁM SÁT THI CỬ AI</div>
        </div>

        <div className="card p-5 fade-up" style={{ animationDelay: "80ms" }}>
          <label className="text-[11px] font-semibold text-[var(--text-mid)] mb-1.5 flex items-center gap-1.5"><Server size={11} /> Địa chỉ máy chủ</label>
          <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="http://localhost:5000" className="input-dark mono mb-5" />

          <div className="flex items-center gap-5 mb-5 border-b border-[var(--line)]">
            <button onClick={() => { setTab("dang_nhap"); setLoi(""); }} className={`tab-underline ${tab === "dang_nhap" && "active"} pb-2.5 text-[13px] font-semibold flex items-center gap-1.5 ${tab === "dang_nhap" ? "text-[var(--text-hi)]" : "text-[var(--text-dim)]"}`}>
              <LogIn size={13} /> Đăng nhập
            </button>
            <button onClick={() => { setTab("dang_ky"); setLoi(""); }} className={`tab-underline ${tab === "dang_ky" && "active"} pb-2.5 text-[13px] font-semibold flex items-center gap-1.5 ${tab === "dang_ky" ? "text-[var(--text-hi)]" : "text-[var(--text-dim)]"}`}>
              <UserPlus size={13} /> Đăng ký
            </button>
          </div>

          {tab === "dang_nhap" ? (
            <form onSubmit={xuLyDangNhap} className="space-y-3">
              <div>
                <label className="text-[11px] text-[var(--text-mid)] mb-1 block">Tên đăng nhập</label>
                <input value={ten} onChange={(e) => setTen(e.target.value)} className="input-dark" placeholder="Tên tài khoản" autoFocus />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-mid)] mb-1 block">Mật khẩu</label>
                <div className="relative">
                  <input type={hienMk ? "text" : "password"} value={mk} onChange={(e) => setMk(e.target.value)} className="input-dark pr-10" placeholder="Mật khẩu" />
                  <button type="button" onClick={() => setHienMk((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-mid)]">
                    {hienMk ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <BannerLoi thongDiep={loi} />
              <button disabled={dangTai} type="submit" className="btn-primary w-full py-2.5 rounded-lg text-[13px] flex items-center justify-center gap-2 mt-1">
                {dangTai ? <Loader2 size={14} className="spin" /> : <LogIn size={14} />} {dangTai ? "Đang kết nối..." : "Đăng nhập"}
              </button>
            </form>
          ) : (
            <form onSubmit={xuLyDangKy} className="space-y-3">
              <div>
                <label className="text-[11px] text-[var(--text-mid)] mb-1 block">Tên đăng nhập</label>
                <input value={rTen} onChange={(e) => setRTen(e.target.value)} className="input-dark" placeholder="Tên tài khoản" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-mid)] mb-1 block">Mật khẩu</label>
                <input type={hienMk ? "text" : "password"} value={rMk} onChange={(e) => setRMk(e.target.value)} className="input-dark" placeholder="Mật khẩu" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-mid)] mb-1 block">Họ tên</label>
                <input value={rHoTen} onChange={(e) => setRHoTen(e.target.value)} className="input-dark" placeholder="Họ và tên đầy đủ" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-mid)] mb-1 block">Vai trò</label>
                <div className="flex gap-1.5">
                  {Object.entries(VAI_TRO_HIEN_THI).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setRVaiTro(k)}
                      className={`role-pill flex-1 py-2 rounded-lg text-[11.5px] font-semibold border ${rVaiTro === k ? "bg-[var(--cyan-dim)] border-[var(--cyan)] text-[var(--cyan)]" : "border-[var(--line)] text-[var(--text-mid)]"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-mid)] mb-1 block">Trường</label>
                <input value={rTruong} onChange={(e) => setRTruong(e.target.value)} className="input-dark" placeholder="Tên trường" />
              </div>
              <BannerLoi thongDiep={loi} />
              <button disabled={dangTai} type="submit" className="btn-primary w-full py-2.5 rounded-lg text-[13px] flex items-center justify-center gap-2 mt-1">
                {dangTai ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />} {dangTai ? "Đang tạo..." : "Tạo tài khoản"}
              </button>
            </form>
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-4 text-[10.5px] text-[var(--text-dim)]">
          <Link2 size={11} /> Kết nối trực tiếp tới API của máy chủ Virtu (may_chu.py)
        </div>
      </div>
    </div>
  );
}

/* ---------------- QR thật do server trả về ---------------- */
function QRThat({ base64, size = 176 }) {
  if (!base64) return (
    <div style={{ width: size, height: size }} className="rounded-xl border border-dashed border-[var(--line)] flex items-center justify-center text-[10.5px] text-[var(--text-dim)] text-center px-4">
      Server không trả về mã QR
    </div>
  );
  return <img src={`data:image/png;base64,${base64}`} alt="QR phòng thi" width={size} height={size} style={{ borderRadius: 10, background: "#fff", padding: 8, boxSizing: "content-box" }} />;
}

/* ============================================================
   Ô vuông học sinh
   ============================================================ */
function OVuongHocSinh({ hs, onClick }) {
  const meta = STATUS_META[hs.trang_thai] || STATUS_META.normal;
  const Icon = meta.icon;
  if (hs.con_ket_noi === false) {
    return (
      <div className="tile tile-offline">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] mono text-[var(--text-dim)]">#{String(hs.hoc_sinh_id).slice(-3)}</span>
          <WifiOff size={13} className="text-[var(--text-dim)]" />
        </div>
        <div className="text-[13px] font-semibold truncate">{hs.ho_ten}</div>
        <div className="text-[11px] text-[var(--text-dim)] mt-1">MẤT KẾT NỐI</div>
      </div>
    );
  }
  const diem = Number(hs.diem || 0);
  return (
    <button onClick={onClick} className={`tile ${meta.tile} text-left w-full`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] mono text-[var(--text-dim)]">#{String(hs.hoc_sinh_id).slice(-3)}</span>
        <span className="dot-ring" style={{ color: meta.color }} />
      </div>
      <div className="text-[13px] font-semibold truncate pr-1">{hs.ho_ten}</div>
      <div className="flex items-center gap-1.5 mt-2" style={{ color: meta.color }}>
        <Icon size={13} />
        <span className="text-[10.5px] font-bold tracking-wide">{meta.label}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="progress-track h-1.5 flex-1">
          <div className="progress-fill h-full rounded-full" style={{ width: `${Math.min(100, diem)}%`, background: meta.color }} />
        </div>
        <span className="mono text-[10.5px] text-[var(--text-mid)] w-7 text-right">{diem.toFixed(0)}</span>
      </div>
    </button>
  );
}

/* ============================================================
   Nhật ký vi phạm
   ============================================================ */
function NhatKyViPham({ items, dangTai }) {
  return (
    <div className="card p-3.5 h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Radio size={14} className="text-[var(--red)]" style={{ animation: "breathe 1.6s ease-in-out infinite" }} />
        <h3 className="text-[13px] font-bold tracking-wide">NHẬT KÝ VI PHẠM</h3>
        {dangTai && <Loader2 size={12} className="spin text-[var(--text-dim)]" />}
        <span className="ml-auto mono text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--bg-deep)] border border-[var(--line)] text-[var(--text-mid)]">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 pr-1 min-h-0">
        {items.length === 0 && !dangTai && (
          <div className="flex flex-col items-center gap-2 text-[12px] text-[var(--text-dim)] text-center py-10">
            <Inbox size={20} /> Chưa có vi phạm nào được ghi nhận.
          </div>
        )}
        {items.map((v, i) => (
          <div key={v.id ?? i} className="slide-l flex items-start gap-2.5 p-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--bg-deep)]">
            <div className="mt-0.5 shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(255,84,112,.12)" }}>
              {v.loai_bang_chung === "video" ? <Video size={12} className="text-[var(--red)]" /> : <ImageIcon size={12} className="text-[var(--red)]" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate">{v.ho_ten}</div>
              <div className="text-[10.5px] text-[var(--text-mid)] truncate">{LY_DO_HIEN_THI[v.ly_do] || v.ly_do}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="mono text-[10px] text-[var(--red)]">điểm {Number(v.diem || 0).toFixed(1)}</span>
                {v.thoi_gian && <><span className="text-[10px] text-[var(--text-dim)]">·</span>
                <span className="mono text-[10px] text-[var(--text-dim)]">{String(v.thoi_gian).replace("T", " ").slice(0, 19)}</span></>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Modal: xem bằng chứng vi phạm 1 học sinh (dữ liệu thật, giải mã ở server)
   ============================================================ */
function HopThoaiXemBangChung({ rest, phienId, hocSinhId, hoTen, onClose }) {
  const [ds, setDs] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [chon, setChon] = useState(null);
  const [urlXemTruoc, setUrlXemTruoc] = useState(null);
  const [dangTaiNoiDung, setDangTaiNoiDung] = useState(false);
  const urlRef = useRef(null);

  const taiDanhSach = useCallback(async () => {
    setDangTai(true); setLoi("");
    try {
      const d = await rest.viPhamTheoHocSinh(phienId, hocSinhId);
      setDs(d.vi_pham || []);
    } catch (e) { setLoi(e.thongDiep || `Không tải được danh sách: ${e.message}`); }
    finally { setDangTai(false); }
  }, [rest, phienId, hocSinhId]);

  useEffect(() => { taiDanhSach(); }, [taiDanhSach]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const chonMuc = async (v) => {
    setChon(v); setDangTaiNoiDung(true); setLoi("");
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setUrlXemTruoc(null);
    try {
      const blob = await rest.taiDuLieuBangChung(v.id);
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setUrlXemTruoc(u);
    } catch (e) { setLoi(e.thongDiep || `Không tải được dữ liệu: ${e.message}`); }
    finally { setDangTaiNoiDung(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(4,6,9,0.72)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="pop-in card w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-[var(--line)]">
          <div className="w-9 h-9 rounded-lg bg-[var(--cyan-dim)] flex items-center justify-center"><ScanEye size={17} className="text-[var(--cyan)]" /></div>
          <div>
            <div className="text-[14px] font-bold">Bằng chứng vi phạm</div>
            <div className="text-[11.5px] text-[var(--text-mid)]">{hoTen}</div>
          </div>
          <button onClick={taiDanhSach} className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center btn-ghost"><RefreshCw size={13} className={dangTai ? "spin" : ""} /></button>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center btn-ghost"><X size={15} /></button>
        </div>
        {loi && <div className="p-3"><BannerLoi thongDiep={loi} onDong={() => setLoi("")} /></div>}
        <div className="grid grid-cols-5 max-h-[62vh]">
          <div className="col-span-2 border-r border-[var(--line)] overflow-y-auto scrollbar-thin p-2 space-y-1.5">
            {dangTai && <div className="flex justify-center py-8"><Loader2 size={18} className="spin text-[var(--text-dim)]" /></div>}
            {!dangTai && ds.length === 0 && <div className="text-[12px] text-[var(--text-dim)] p-4 text-center">Chưa có vi phạm nào.</div>}
            {ds.map((v) => (
              <button key={v.id} onClick={() => chonMuc(v)}
                className={`w-full text-left p-2.5 rounded-xl border transition-colors ${chon?.id === v.id ? "border-[var(--cyan)] bg-[var(--cyan-dim)]" : "border-[var(--line-soft)] hover:border-[var(--line)]"}`}>
                <div className="flex items-center gap-2 text-[11.5px] font-semibold">
                  {v.loai_bang_chung === "video" ? <Video size={12} className="text-[var(--text-mid)]" /> : <ImageIcon size={12} className="text-[var(--text-mid)]" />}
                  {String(v.thoi_gian || "").replace("T", " ").slice(0, 19)}
                </div>
                <div className="text-[10.5px] text-[var(--text-mid)] mt-1">{LY_DO_HIEN_THI[v.ly_do] || v.ly_do}</div>
                <div className="mono text-[10px] text-[var(--red)] mt-1">điểm {Number(v.diem || 0).toFixed(1)} · {Math.round((v.kich_thuoc_byte || 0) / 1024)} KB</div>
              </button>
            ))}
          </div>
          <div className="col-span-3 p-4 flex flex-col">
            <div className="text-[11.5px] text-[var(--text-mid)] mb-2">Xem trước (dữ liệu giải mã trực tiếp từ server):</div>
            {!chon && <div className="flex-1 flex items-center justify-center text-[12px] text-[var(--text-dim)]">Chọn 1 sự kiện bên trái</div>}
            {chon && dangTaiNoiDung && <div className="flex-1 flex items-center justify-center"><Loader2 size={22} className="spin text-[var(--text-dim)]" /></div>}
            {chon && !dangTaiNoiDung && urlXemTruoc && (
              chon.loai_bang_chung === "video" ? (
                <video src={urlXemTruoc} controls className="flex-1 w-full rounded-xl border border-[var(--line)] bg-black" style={{ maxHeight: 380 }} />
              ) : (
                <img src={urlXemTruoc} alt="Bằng chứng" className="flex-1 w-full object-contain rounded-xl border border-[var(--line)] bg-black" style={{ maxHeight: 380 }} />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Modal: tạo phòng thi mới (mã + QR thật từ server)
   ============================================================ */
function HopThoaiTaoPhong({ rest, onClose, onCreated }) {
  const [ten, setTen] = useState("");
  const [ketQua, setKetQua] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");
  const [daSaoChep, setDaSaoChep] = useState(false);

  const taoPhongThi = async () => {
    setLoi(""); setDangTai(true);
    try {
      const d = await rest.taoPhong(ten.trim() || "Phiên thi không tên");
      setKetQua(d);
      onCreated && onCreated();
    } catch (e) { setLoi(e.thongDiep || `Không thể tạo phòng: ${e.message}`); }
    finally { setDangTai(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(4,6,9,0.72)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="pop-in card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        {!ketQua ? (
          <>
            <div className="flex items-center gap-2 mb-4"><Plus size={16} className="text-[var(--cyan)]" /><h3 className="text-[14px] font-bold">Tạo phòng thi mới</h3></div>
            <label className="text-[11.5px] text-[var(--text-mid)] block mb-1.5">Tên phiên thi</label>
            <input autoFocus value={ten} onChange={(e) => setTen(e.target.value)} placeholder="VD: Kiểm tra giữa kỳ — Toán 12A1"
              className="input-dark mb-3" onKeyDown={(e) => e.key === "Enter" && taoPhongThi()} />
            <div className="mb-3"><BannerLoi thongDiep={loi} onDong={() => setLoi("")} /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-semibold">Hủy</button>
              <button disabled={dangTai} onClick={taoPhongThi} className="btn-primary px-4 py-2 rounded-lg text-[12.5px] flex items-center gap-2">
                {dangTai && <Loader2 size={13} className="spin" />} Tạo phòng
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="text-[12px] text-[var(--text-mid)] mb-1">Đã tạo phòng thi</div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="mono text-[26px] font-bold tracking-[0.15em] text-[var(--cyan)]">{ketQua.ma_phong}</span>
              <button onClick={() => { navigator.clipboard?.writeText(ketQua.ma_phong); setDaSaoChep(true); setTimeout(() => setDaSaoChep(false), 1400); }}
                className="w-8 h-8 rounded-lg btn-ghost flex items-center justify-center">
                {daSaoChep ? <Check size={14} className="text-[var(--green)]" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex justify-center mb-4"><QRThat base64={ketQua.qr_base64} /></div>
            <p className="text-[11.5px] text-[var(--text-mid)] mb-4">Đọc mã này hoặc cho học sinh quét QR để vào phòng.</p>
            <button onClick={onClose} className="btn-primary w-full py-2.5 rounded-lg text-[12.5px]">Đóng</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Modal: tạo tài khoản hàng loạt (gọi API thật)
   ============================================================ */
function HopThoaiTaoHangLoat({ rest, onClose }) {
  const [vaiTro, setVaiTro] = useState("hoc_sinh");
  const [rows, setRows] = useState([{ ten: "", ho_ten: "", mk: "" }, { ten: "", ho_ten: "", mk: "" }, { ten: "", ho_ten: "", mk: "" }]);
  const [dan, setDan] = useState("");
  const [ketQua, setKetQua] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");

  const nhapTuDan = () => {
    const lines = dan.split("\n").map((l) => l.split(",").map((p) => p.trim())).filter((p) => p[0]);
    setRows((r) => [...r.filter((x) => x.ten || x.ho_ten), ...lines.map(([ten, ho_ten]) => ({ ten: ten || "", ho_ten: ho_ten || "", mk: "" }))]);
    setDan("");
  };

  const taoHangLoat = async () => {
    const danhSach = rows
      .filter((r) => r.ten.trim() || r.ho_ten.trim())
      .map((r) => { const o = { ten_dang_nhap: r.ten.trim(), ho_ten: r.ho_ten.trim() }; if (r.mk.trim()) o.mat_khau = r.mk.trim(); return o; });
    if (!danhSach.length) { setLoi("Vui lòng nhập ít nhất 1 tài khoản."); return; }
    setLoi(""); setDangTai(true);
    try {
      const kq = await rest.dangKyHangLoat(vaiTro, danhSach);
      setKetQua(kq);
    } catch (e) { setLoi(e.thongDiep || `Lỗi kết nối: ${e.message}`); }
    finally { setDangTai(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(4,6,9,0.72)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="pop-in card w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1"><UserPlus2 size={16} className="text-[var(--cyan)]" /><h3 className="text-[14px] font-bold">Tạo tài khoản hàng loạt</h3></div>
        {!ketQua ? (
          <>
            <p className="text-[11.5px] text-[var(--text-mid)] mb-4">Dán danh sách (mỗi dòng: tên đăng nhập, họ tên) hoặc thêm thủ công. Để trống mật khẩu sẽ tự sinh.</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11.5px] text-[var(--text-mid)]">Vai trò:</span>
              {["hoc_sinh", "giao_vien"].map((v) => (
                <button key={v} onClick={() => setVaiTro(v)}
                  className={`role-pill px-3 py-1.5 rounded-full text-[11.5px] font-semibold border ${vaiTro === v ? "bg-[var(--cyan-dim)] border-[var(--cyan)] text-[var(--cyan)]" : "border-[var(--line)] text-[var(--text-mid)]"}`}>
                  {VAI_TRO_HIEN_THI[v]}
                </button>
              ))}
            </div>
            <textarea value={dan} onChange={(e) => setDan(e.target.value)} placeholder={"hs001, Nguyễn Văn A\nhs002, Trần Thị B"} className="input-dark h-20 mb-2 resize-none" />
            <button onClick={nhapTuDan} className="btn-ghost px-3 py-1.5 rounded-lg text-[11.5px] font-semibold mb-4 flex items-center gap-1.5"><ClipboardPaste size={12} /> Nhập vào bảng</button>
            <div className="space-y-1.5 mb-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2">
                  <input className="input-dark" placeholder="Tên đăng nhập" value={r.ten} onChange={(e) => setRows((rs) => rs.map((x, xi) => xi === i ? { ...x, ten: e.target.value } : x))} />
                  <input className="input-dark" placeholder="Họ tên" value={r.ho_ten} onChange={(e) => setRows((rs) => rs.map((x, xi) => xi === i ? { ...x, ho_ten: e.target.value } : x))} />
                  <input className="input-dark" placeholder="Mật khẩu (để trống)" value={r.mk} onChange={(e) => setRows((rs) => rs.map((x, xi) => xi === i ? { ...x, mk: e.target.value } : x))} />
                  <button onClick={() => setRows((rs) => rs.filter((_, xi) => xi !== i))} className="w-9 h-9 rounded-lg btn-danger flex items-center justify-center"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setRows((r) => [...r, { ten: "", ho_ten: "", mk: "" }])} className="btn-ghost px-3 py-1.5 rounded-lg text-[11.5px] font-semibold mb-3 flex items-center gap-1.5"><Plus size={12} /> Thêm dòng</button>
            <div className="mb-3"><BannerLoi thongDiep={loi} onDong={() => setLoi("")} /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-semibold">Hủy</button>
              <button disabled={dangTai} onClick={taoHangLoat} className="btn-primary px-4 py-2 rounded-lg text-[12.5px] flex items-center gap-2">
                {dangTai && <Loader2 size={13} className="spin" />} Tạo hàng loạt
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 my-3 text-[12px] text-[var(--green)]"><Check size={14} /> Đã tạo {(ketQua.thanh_cong || []).length} tài khoản — lưu lại ngay, mật khẩu chỉ hiện 1 lần.</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin pr-1">
              {(ketQua.thanh_cong || []).map((k, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--line-soft)] bg-[var(--bg-deep)]">
                  <div><div className="text-[12px] font-semibold">{k.ten_dang_nhap}</div><div className="text-[10.5px] text-[var(--text-mid)]">{k.ho_ten}</div></div>
                  <div className="flex items-center gap-1.5 mono text-[11.5px] text-[var(--cyan)]"><KeyRound size={12} />{k.mat_khau}</div>
                </div>
              ))}
            </div>
            {(ketQua.that_bai || []).length > 0 && (
              <div className="mt-4">
                <div className="text-[11.5px] font-semibold text-[var(--amber)] mb-1.5">{ketQua.that_bai.length} dòng thất bại:</div>
                {ketQua.that_bai.map((t, i) => (
                  <div key={i} className="text-[11px] text-[var(--text-mid)]">• {t.ten_dang_nhap || "?"} — {t.ly_do}</div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="btn-primary w-full py-2.5 rounded-lg text-[12.5px] mt-4">Đóng</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Lưới giám sát — đọc dữ liệu thật, cập nhật gần-thời-gian-thực
   bằng polling REST (không dùng socket.io vì môi trường xem trước
   chỉ cho phép fetch thuần; nếu bạn triển khai app này ở dự án thật,
   có thể thay updateInterval bằng socket.io-client để tức thời hơn).
   ============================================================ */
const KHOANG_POLL_MS = 3000;

function LuoiGiamSat({ rest, phong }) {
  const [hocSinh, setHocSinh] = useState([]);
  const [viPham, setViPham] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [chonHs, setChonHs] = useState(null);
  const daHuy = useRef(false);

  const taiDuLieu = useCallback(async (lanDau = false) => {
    if (lanDau) setDangTai(true);
    try {
      const [ttPhong, vp] = await Promise.all([
        rest.thongTinPhong(phong.ma_phong),
        rest.viPhamTheoPhong(phong.id),
      ]);
      if (daHuy.current) return;
      setHocSinh(ttPhong.hoc_sinh || []);
      setViPham(vp.vi_pham || []);
      setLoi("");
    } catch (e) {
      if (!daHuy.current) setLoi(e.thongDiep || `Mất kết nối tới máy chủ: ${e.message}`);
    } finally { if (lanDau && !daHuy.current) setDangTai(false); }
  }, [rest, phong.ma_phong, phong.id]);

  useEffect(() => {
    daHuy.current = false;
    taiDuLieu(true);
    const iv = phong.dang_hoat_dong !== false ? setInterval(() => taiDuLieu(false), KHOANG_POLL_MS) : null;
    return () => { daHuy.current = true; if (iv) clearInterval(iv); };
  }, [taiDuLieu, phong.dang_hoat_dong]);

  return (
    <div className="grid grid-cols-[1fr,300px] gap-4 h-full min-h-0">
      <div className="card p-4 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-1 shrink-0">
          <LayoutGrid size={14} className="text-[var(--cyan)]" />
          <span className="text-[13px] font-bold">Phòng: <span className="mono text-[var(--cyan)]">{phong.ma_phong}</span></span>
          <span className="text-[11.5px] text-[var(--text-mid)] truncate">— {phong.ten_phien}</span>
          {dangTai && <Loader2 size={13} className="spin text-[var(--text-dim)]" />}
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${phong.dang_hoat_dong ? "text-[var(--green)] bg-[rgba(52,224,138,.12)]" : "text-[var(--text-dim)] bg-[var(--bg-deep)]"}`}>
            {phong.dang_hoat_dong ? "ĐANG MỞ" : "ĐÃ ĐÓNG"}
          </span>
        </div>
        <div className="text-[11px] text-[var(--text-dim)] mb-3 shrink-0">Bấm vào ô học sinh để xem ảnh/video vi phạm đã ghi nhận · tự cập nhật mỗi {KHOANG_POLL_MS / 1000}s</div>
        {loi && <div className="mb-3 shrink-0"><BannerLoi thongDiep={loi} /></div>}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {dangTai ? (
            <div className="flex items-center justify-center h-full"><Loader2 size={22} className="spin text-[var(--text-dim)]" /></div>
          ) : hocSinh.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[12px] text-[var(--text-dim)]"><Users size={20} /> Chưa có học sinh nào vào phòng.</div>
          ) : (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
              {hocSinh.map((hs, i) => (
                <div key={hs.hoc_sinh_id} className="fade-up" style={{ animationDelay: `${i * 22}ms` }}>
                  <OVuongHocSinh hs={hs} onClick={() => setChonHs(hs)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <NhatKyViPham items={viPham} dangTai={dangTai} />
      {chonHs && (
        <HopThoaiXemBangChung rest={rest} phienId={phong.id} hocSinhId={chonHs.hoc_sinh_id} hoTen={chonHs.ho_ten} onClose={() => setChonHs(null)} />
      )}
    </div>
  );
}

/* ============================================================
   Thanh điều hướng chính
   ============================================================ */
function Topbar({ user, onDangXuat }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  const vaiTroLabel = VAI_TRO_HIEN_THI[user.vai_tro] || user.vai_tro;
  const RoleIcon = user.vai_tro === "admin" ? UserCog : GraduationCap;
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--line)]" style={{ background: "rgba(11,15,20,0.7)", backdropFilter: "blur(10px)" }}>
      <div className="flex items-center gap-2.5">
        <img src={LOGO_URI} alt="Virtu" className="w-9 h-9" />
        <div>
          <div className="text-[15px] font-extrabold tracking-tight leading-none">VIRTU</div>
          <div className="text-[9.5px] text-[var(--text-dim)] tracking-wider mono">GIÁM SÁT THI CỬ · AI</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-4 px-3 py-1.5 rounded-full border border-[var(--line)] bg-[var(--bg-deep)] text-[12px] font-semibold text-[var(--text-mid)]">
        <RoleIcon size={13} className="text-[var(--cyan)]" /> {vaiTroLabel}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-[var(--text-mid)] mono"><Clock3 size={13} /> {now.toLocaleTimeString("vi-VN")}</div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--green)]"><span className="dot-ring" /> ĐÃ KẾT NỐI</div>
        <div className="w-px h-6 bg-[var(--line)]" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: "var(--cyan-dim)", color: "var(--cyan)" }}>
            {(user.ho_ten || "?").split(" ").slice(-1)[0][0]}
          </div>
          <div className="hidden md:block leading-tight">
            <div className="text-[12px] font-semibold">{user.ho_ten}</div>
            <div className="text-[10px] text-[var(--text-dim)]">{user.ten_truong}</div>
          </div>
        </div>
        <button onClick={onDangXuat} className="w-8 h-8 rounded-lg btn-danger flex items-center justify-center" title="Đăng xuất"><LogOut size={14} /></button>
      </div>
    </div>
  );
}

/* ============================================================
   Giáo viên
   ============================================================ */
function GiaoVienView({ rest, user }) {
  const [rooms, setRooms] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [phongDangMo, setPhongDangMo] = useState(null);
  const [showTaoPhong, setShowTaoPhong] = useState(false);
  const [showHangLoat, setShowHangLoat] = useState(false);

  const taiDanhSachPhong = useCallback(async () => {
    setDangTai(true); setLoi("");
    try {
      const d = await rest.phongCuaTruong();
      const ds = d.phong || [];
      setRooms(ds);
      setPhongDangMo((cur) => cur ? (ds.find((r) => r.id === cur.id) || null) : null);
    } catch (e) { setLoi(e.thongDiep || `Không thể tải danh sách: ${e.message}`); }
    finally { setDangTai(false); }
  }, [rest]);

  useEffect(() => { taiDanhSachPhong(); }, [taiDanhSachPhong]);

  const dongPhong = async (p) => {
    try { await rest.dongPhong(p.id); taiDanhSachPhong(); }
    catch (e) { setLoi(e.thongDiep || `Không thể đóng phòng: ${e.message}`); }
  };

  return (
    <div className="grid grid-cols-[300px,1fr] gap-4 p-4 flex-1 min-h-0">
      <div className="card p-4 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--cyan-dim)" }}><GraduationCap size={16} className="text-[var(--cyan)]" /></div>
          <div><div className="text-[13px] font-bold">{user.ho_ten}</div><div className="text-[10.5px] text-[var(--text-dim)]">{user.ten_truong}</div></div>
        </div>
        <button onClick={() => setShowTaoPhong(true)} className="btn-primary rounded-xl py-2.5 text-[12.5px] flex items-center justify-center gap-2 mb-2.5"><Plus size={14} /> Tạo phòng thi mới</button>
        <button onClick={() => setShowHangLoat(true)} className="btn-ghost rounded-xl py-2 text-[12px] font-semibold flex items-center justify-center gap-2 mb-5"><Users size={13} /> Tạo tài khoản hàng loạt</button>

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wide text-[var(--text-mid)]">CÁC PHÒNG CỦA TÔI</span>
          <button onClick={taiDanhSachPhong} className="w-6 h-6 rounded btn-ghost flex items-center justify-center"><RefreshCw size={11} className={dangTai ? "spin" : ""} /></button>
        </div>
        {loi && <div className="mb-2"><BannerLoi thongDiep={loi} onDong={() => setLoi("")} /></div>}
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 min-h-0">
          {dangTai && rooms.length === 0 && <div className="flex justify-center py-8"><Loader2 size={18} className="spin text-[var(--text-dim)]" /></div>}
          {!dangTai && rooms.length === 0 && <div className="text-[11.5px] text-[var(--text-dim)] text-center py-8">Chưa có phòng thi nào. Hãy tạo mới!</div>}
          {rooms.map((r) => (
            <button key={r.id} onClick={() => r.dang_hoat_dong && setPhongDangMo(r)}
              className={`w-full text-left p-2.5 rounded-xl border transition-colors ${phongDangMo?.id === r.id ? "border-[var(--cyan)] bg-[var(--cyan-dim)]" : "border-[var(--line-soft)] hover:border-[var(--line)]"} ${!r.dang_hoat_dong && "opacity-55"}`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${r.dang_hoat_dong ? "bg-[var(--green)]" : "bg-[var(--text-dim)]"}`} />
                <span className="mono text-[11px] font-bold">{r.ma_phong}</span>
                <ChevronRight size={12} className="ml-auto text-[var(--text-dim)]" />
              </div>
              <div className="text-[12px] mt-1 truncate">{r.ten_phien}</div>
              <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{r.dang_hoat_dong ? "Đang mở" : "Đã đóng"}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex flex-col">
        {phongDangMo ? (
          <>
            <div className="flex items-center justify-end mb-3 shrink-0">
              <button onClick={() => dongPhong(phongDangMo)} className="btn-danger px-3.5 py-1.5 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5"><Lock size={12} /> Đóng phòng thi</button>
            </div>
            <div className="flex-1 min-h-0"><LuoiGiamSat rest={rest} phong={phongDangMo} /></div>
          </>
        ) : (
          <div className="card flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <Sparkles size={26} className="text-[var(--text-dim)]" />
            <div className="text-[13px] text-[var(--text-mid)]">Tạo phòng thi mới hoặc chọn 1 phòng đang mở ở danh sách bên trái</div>
          </div>
        )}
      </div>

      {showTaoPhong && <HopThoaiTaoPhong rest={rest} onClose={() => setShowTaoPhong(false)} onCreated={taiDanhSachPhong} />}
      {showHangLoat && <HopThoaiTaoHangLoat rest={rest} onClose={() => setShowHangLoat(false)} />}
    </div>
  );
}

/* ============================================================
   Quản trị viên
   ============================================================ */
function QuanTriView({ rest, user }) {
  const [rooms, setRooms] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [phongDangMo, setPhongDangMo] = useState(null);
  const [showHangLoat, setShowHangLoat] = useState(false);
  const [locTrangThai, setLocTrangThai] = useState("tat_ca");

  const taiDanhSachPhong = useCallback(async () => {
    setDangTai(true); setLoi("");
    try {
      const d = await rest.phongCuaTruong();
      const ds = d.phong || [];
      setRooms(ds);
      setPhongDangMo((cur) => cur ? (ds.find((r) => r.id === cur.id) || null) : null);
    } catch (e) { setLoi(e.thongDiep || `Không thể tải danh sách: ${e.message}`); }
    finally { setDangTai(false); }
  }, [rest]);

  useEffect(() => { taiDanhSachPhong(); }, [taiDanhSachPhong]);
  useEffect(() => { const iv = setInterval(taiDanhSachPhong, 12000); return () => clearInterval(iv); }, [taiDanhSachPhong]);

  const soLieu = useMemo(() => {
    const dangMo = rooms.filter((r) => r.dang_hoat_dong);
    const daDong = rooms.filter((r) => !r.dang_hoat_dong);
    return { dangMo: dangMo.length, daDong: daDong.length, tongCong: rooms.length };
  }, [rooms]);

  const filtered = rooms.filter((r) => locTrangThai === "tat_ca" ? true : locTrangThai === "mo" ? r.dang_hoat_dong : !r.dang_hoat_dong);

  return (
    <div className="p-4 flex-1 min-h-0 flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          { label: "Phòng đang mở", value: soLieu.dangMo, Icon: LayoutGrid, color: "var(--cyan)" },
          { label: "Phòng đã đóng", value: soLieu.daDong, Icon: Lock, color: "var(--text-mid)" },
          { label: "Tổng số phòng", value: soLieu.tongCong, Icon: School, color: "var(--violet)" },
        ].map(({ label, value, Icon, color }, i) => (
          <div key={label} className="card p-3.5 fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between mb-2"><Icon size={15} style={{ color }} /><span className="mono text-[20px] font-bold">{value}</span></div>
            <div className="text-[11px] text-[var(--text-mid)]">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[380px,1fr] gap-4 flex-1 min-h-0">
        <div className="card p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2"><School size={14} className="text-[var(--cyan)]" /><span className="text-[12.5px] font-bold">TOÀN BỘ PHÒNG THI</span></div>
            <button onClick={() => setShowHangLoat(true)} className="btn-ghost px-2.5 py-1 rounded-lg text-[10.5px] font-semibold flex items-center gap-1"><Users size={11} /> Hàng loạt</button>
          </div>
          <div className="flex items-center gap-1.5 mb-3 shrink-0">
            {[["tat_ca", "Tất cả"], ["mo", "Đang mở"], ["dong", "Đã đóng"]].map(([k, l]) => (
              <button key={k} onClick={() => setLocTrangThai(k)}
                className={`role-pill px-2.5 py-1 rounded-full text-[10.5px] font-semibold border ${locTrangThai === k ? "bg-[var(--cyan-dim)] border-[var(--cyan)] text-[var(--cyan)]" : "border-[var(--line)] text-[var(--text-mid)]"}`}>{l}</button>
            ))}
            <button onClick={taiDanhSachPhong} className="ml-auto w-6 h-6 rounded btn-ghost flex items-center justify-center"><RefreshCw size={11} className={dangTai ? "spin" : ""} /></button>
          </div>
          {loi && <div className="mb-2"><BannerLoi thongDiep={loi} onDong={() => setLoi("")} /></div>}
          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 min-h-0">
            {dangTai && rooms.length === 0 && <div className="flex justify-center py-8"><Loader2 size={18} className="spin text-[var(--text-dim)]" /></div>}
            {!dangTai && filtered.length === 0 && <div className="text-[11.5px] text-[var(--text-dim)] text-center py-8">Không có phòng nào phù hợp.</div>}
            {filtered.map((r) => (
              <button key={r.id} onClick={() => r.dang_hoat_dong && setPhongDangMo(r)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${phongDangMo?.id === r.id ? "border-[var(--cyan)] bg-[var(--cyan-dim)]" : "border-[var(--line-soft)] hover:border-[var(--line)]"} ${!r.dang_hoat_dong && "opacity-55"}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.dang_hoat_dong ? "bg-[var(--green)]" : "bg-[var(--text-dim)]"}`} />
                  <span className="mono text-[11px] font-bold">{r.ma_phong}</span>
                </div>
                <div className="text-[12px] mt-1 truncate">{r.ten_phien}</div>
                <div className="text-[10px] text-[var(--text-dim)] mt-0.5">GV: {r.ten_giao_vien}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0">
          {phongDangMo ? <LuoiGiamSat rest={rest} phong={phongDangMo} /> : (
            <div className="card h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <ListFilter size={26} className="text-[var(--text-dim)]" />
              <div className="text-[13px] text-[var(--text-mid)]">Nhấp vào 1 phòng đang mở ở danh sách bên trái để giám sát chi tiết</div>
            </div>
          )}
        </div>
      </div>
      {showHangLoat && <HopThoaiTaoHangLoat rest={rest} onClose={() => setShowHangLoat(false)} />}
    </div>
  );
}

/* ============================================================
   Vai trò không hỗ trợ trên web (học sinh dùng app riêng)
   ============================================================ */
function ManHinhKhongHoTro({ user, onDangXuat }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
      <img src={LOGO_URI} alt="Virtu" className="w-14 h-14 opacity-80" />
      <div>
        <div className="text-[15px] font-bold mb-1">Tài khoản "{VAI_TRO_HIEN_THI[user.vai_tro] || user.vai_tro}" chưa được hỗ trợ ở giao diện Web</div>
        <div className="text-[12.5px] text-[var(--text-mid)] max-w-md">Console web hiện chỉ phục vụ Giáo viên và Quản trị viên. Học sinh vui lòng dùng ứng dụng Virtu Client (desktop) để vào phòng thi.</div>
      </div>
      <button onClick={onDangXuat} className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-2"><ArrowLeft size={13} /> Quay lại đăng nhập</button>
    </div>
  );
}

/* ============================================================
   App gốc
   ============================================================ */
export default function App() {
  const [rest, setRest] = useState(null);
  const [user, setUser] = useState(null);

  const dangNhapThanhCong = (restClient, thongTinUser) => { setRest(restClient); setUser(thongTinUser); };
  const dangXuat = () => { setRest(null); setUser(null); };

  if (!rest || !user) return <ManHinhDangNhap onDangNhapThanhCong={dangNhapThanhCong} />;

  return (
    <div className="virtu-root flex flex-col">
      <style>{GLOBAL_CSS}</style>
      <div className="virtu-noise" />
      <div className="virtu-scan" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Topbar user={user} onDangXuat={dangXuat} />
        {user.vai_tro === "giao_vien" && <GiaoVienView rest={rest} user={user} />}
        {user.vai_tro === "admin" && <QuanTriView rest={rest} user={user} />}
        {user.vai_tro === "hoc_sinh" && <ManHinhKhongHoTro user={user} onDangXuat={dangXuat} />}
      </div>
    </div>
  );
}
