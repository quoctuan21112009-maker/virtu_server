/* ================================================================
 * bao_cao.js
 * ================================================================
 * Module hỗ trợ xuất báo cáo phòng thi — CHUYỂN ĐỔI Y HỆT bao_cao.py:
 *   - `xuatPDF(data)`: Tạo file PDF A4 chứa thông tin phòng, danh
 *     sách thí sinh, và các sự kiện vi phạm chi tiết (dùng jsPDF +
 *     AutoTable qua CDN thay cho ReportLab).
 *   - `xuatCSV(data)`: Xuất CSV với BOM UTF-8 (mở thẳng bằng Excel
 *     không lỗi font, tương đương utf-8-sig).
 *
 * Cần nạp qua CDN (xem index.html của trang giáo viên/quản trị):
 *   <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"></script>
 * ================================================================ */

function taiXuong(blob, tenFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = tenFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Xuất báo cáo định dạng PDF sử dụng jsPDF (yêu cầu jsPDF + autotable đã nạp qua CDN).
 * @param {object} data - { phong, hoc_sinh: [], vi_pham: [] }
 * @param {string} tenFile
 */
export function xuatPDF(data, tenFile = "bao_cao_phong_thi.pdf") {
  if (typeof window.jspdf === "undefined") {
    throw new Error("Thư viện jsPDF chưa được nạp. Vui lòng thêm script CDN hoặc chọn xuất CSV.");
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

  const phong = data.phong || {};
  const hocSinh = data.hoc_sinh || [];
  const viPham = data.vi_pham || [];

  const MAU_NHAN = [79, 107, 255];
  const MAU_CHINH = [30, 30, 46];

  // 1. Header Title
  doc.setFontSize(18);
  doc.setTextColor(...MAU_NHAN);
  doc.setFont(undefined, "bold");
  doc.text("BÁO CÁO PHÒNG THI CHỐNG GIAN LẬN (VIRTU)", doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });

  let y = 70;

  // 2. Room Information
  doc.setFontSize(12);
  doc.setTextColor(...MAU_CHINH);
  doc.text("I. Thông tin phòng thi", 30, y);
  y += 10;

  doc.autoTable({
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, textColor: [17, 17, 17] },
    headStyles: { fillColor: [240, 242, 250] },
    body: [
      ["Tên phiên:", phong.ten_phien || "", "Mã phòng:", phong.ma_phong || ""],
      ["Môn thi:", phong.mon_thi || "N/A", "Phòng thi:", phong.phong_thi || "N/A"],
      ["Giám thị:", phong.ten_giao_vien || "", "Trạng thái:", phong.dang_hoat_dong ? "Đang hoạt động" : "Đã đóng"],
      ["Thời gian tạo:", phong.thoi_gian_tao || "", "Thời gian thi:", phong.thoi_gian_thi || ""],
    ],
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 150 }, 2: { cellWidth: 90 }, 3: { cellWidth: 150 } },
  });
  y = doc.lastAutoTable.finalY + 20;

  // 3. Candidates Summary
  doc.text("II. Danh sách học sinh tham gia", 30, y);
  y += 10;

  const mauTheoTrangThai = (tt) => (tt === "suspicious" ? [217, 119, 6] : tt === "cheating" ? [220, 38, 38] : [5, 150, 105]);

  doc.autoTable({
    startY: y,
    head: [["STT", "Họ tên", "Tên đăng nhập", "Trạng thái", "Điểm rủi ro"]],
    body: hocSinh.map((hs, idx) => [
      String(idx + 1), hs.ho_ten || "", hs.ten_dang_nhap || "", (hs.trang_thai || "").toUpperCase(),
      (hs.diem ?? 0).toFixed(2),
    ]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: MAU_NHAN, textColor: 255 },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 3) {
        const hs = hocSinh[hookData.row.index];
        hookData.cell.styles.textColor = mauTheoTrangThai(hs?.trang_thai);
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = doc.lastAutoTable.finalY + 20;

  // 4. Violations
  if (y > doc.internal.pageSize.getHeight() - 100) {
    doc.addPage();
    y = 40;
  }
  doc.text("III. Nhật ký sự kiện vi phạm chi tiết", 30, y);
  y += 10;

  if (viPham.length === 0) {
    doc.setFontSize(9);
    doc.text("Không ghi nhận sự kiện vi phạm nào trong phòng thi này.", 30, y + 14);
  } else {
    doc.autoTable({
      startY: y,
      head: [["STT", "Thời gian", "Học sinh", "Loại", "Lý do", "Rủi ro"]],
      body: viPham.map((vp, idx) => [
        String(idx + 1),
        (vp.thoi_gian || "").slice(0, 19).replace("T", " "),
        vp.ho_ten || "",
        (vp.loai_bang_chung || "").toUpperCase(),
        vp.ly_do || "",
        (vp.diem ?? 0).toFixed(2),
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: MAU_NHAN, textColor: 255 },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 5) {
          const vp = viPham[hookData.row.index];
          hookData.cell.styles.textColor = (vp?.diem ?? 0) >= 0.7 ? [220, 38, 38] : [217, 119, 6];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  doc.save(tenFile);
}

/**
 * Xuất báo cáo định dạng CSV với BOM UTF-8 (tương đương utf-8-sig, mở Excel không lỗi font).
 * @param {object} data - { phong, hoc_sinh: [], vi_pham: [] }
 * @param {string} tenFile
 */
export function xuatCSV(data, tenFile = "bao_cao_phong_thi.csv") {
  const phong = data.phong || {};
  const hocSinh = data.hoc_sinh || [];
  const viPham = data.vi_pham || [];

  const rows = [];
  const escapeCsv = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const dong = (...cells) => rows.push(cells.map(escapeCsv).join(","));

  dong("THÔNG TIN PHÒNG THI");
  dong("Mã phòng", phong.ma_phong || "");
  dong("Tên phiên", phong.ten_phien || "");
  dong("Môn thi", phong.mon_thi || "");
  dong("Phòng thi", phong.phong_thi || "");
  dong("Giám thị", phong.ten_giao_vien || "");
  dong("Thời gian tạo", phong.thoi_gian_tao || "");
  dong("Thời gian thi", phong.thoi_gian_thi || "");
  dong("");

  dong("DANH SÁCH THÍ SINH");
  dong("ID", "Họ tên", "Tên đăng nhập", "Trạng thái", "Điểm rủi ro");
  hocSinh.forEach((hs) => {
    dong(hs.hoc_sinh_id ?? "", hs.ho_ten || "", hs.ten_dang_nhap || "", hs.trang_thai || "", hs.diem ?? 0.0);
  });
  dong("");

  dong("CHI TIẾT CÁC SỰ KIỆN VI PHẠM");
  dong("ID Sự kiện", "Học sinh ID", "Họ tên học sinh", "Thời gian", "Điểm rủi ro", "Lý do", "Loại bằng chứng");
  viPham.forEach((vp) => {
    dong(vp.id ?? "", vp.hoc_sinh_id ?? "", vp.ho_ten || "", vp.thoi_gian || "", vp.diem ?? 0.0, vp.ly_do || "", vp.loai_bang_chung || "");
  });

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  taiXuong(blob, tenFile);
}
