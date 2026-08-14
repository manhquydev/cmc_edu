const ROLES = [
  {
    id: "super_admin",
    label: "Super admin",
    person: "Nguyễn Minh Quân",
    initials: "MQ",
    greeting: "Xin chào · Super admin",
    cta: "+ Cơ sở mới",
    nav: [
      {
        label: "Tổng quan",
        items: [
          { id: "cockpit", label: "Tổng quan", icon: "grid", current: true },
          { id: "audit", label: "Nhật ký audit", icon: "list" },
          { id: "alerts", label: "Cảnh báo hệ thống", icon: "bell" },
        ],
      },
      {
        label: "Mạng lưới",
        items: [
          { id: "facilities", label: "Cơ sở", icon: "building" },
          { id: "users", label: "Người dùng", icon: "users" },
          { id: "roles", label: "Phân quyền", icon: "shield" },
        ],
      },
      {
        label: "Hệ thống",
        items: [
          { id: "config", label: "Cấu hình", icon: "settings" },
          { id: "finance", label: "Tài chính", icon: "receipt" },
        ],
      },
    ],
    tabs: ["Tổng quan", "Cơ sở", "Người dùng", "Audit", "Tài chính"],
    metrics: [
      { label: "Cơ sở đang hoạt động", value: "12", delta: "Trong 3 mạng", tone: null },
      {
        label: "Phiếu chờ duyệt (toàn mạng)",
        value: "18",
        delta: "5 vượt ngưỡng 20 triệu",
        attention: "danger",
        tone: "down",
      },
      { label: "Người dùng active 7 ngày", value: "246", delta: "+14 so với tuần trước", tone: "up" },
    ],
    columns: ["Mã", "Việc cần làm", "Giá trị", "Trạng thái", "Hạn"],
    rows: [
      {
        code: "PT-08421",
        title: "Duyệt phiếu thu — Trần Gia Bảo",
        meta: "Cơ sở Quận 1 · Sale: Lê Thu Trang",
        amount: "24.500.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "PT-08418",
        title: "Duyệt phiếu thu — Phạm Khánh An",
        meta: "Cơ sở Tân Bình · Sale: Hoàng Minh",
        amount: "8.900.000 đ",
        status: { label: "Chờ duyệt", tone: "brand" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "AUD-11902",
        title: "Xem thay đổi phân quyền cơ sở Thủ Đức",
        meta: "Actor: giam_doc_kinh_doanh · 14 thao tác",
        amount: "—",
        status: { label: "Audit", tone: "neutral" },
        due: { label: "14:20", tone: null },
      },
      {
        code: "FAC-0007",
        title: "Kích hoạt cơ sở Bình Thạnh (sandbox)",
        meta: "IP mạng chờ xác nhận · 2 admin tạm",
        amount: "—",
        status: { label: "Chờ SA", tone: "warning" },
        due: { label: "Mai", tone: null },
      },
      {
        code: "USR-3381",
        title: "Gỡ quyền sale khỏi tài khoản đã nghỉ",
        meta: "user: sale.q3@cmcedu.vn",
        amount: "—",
        status: { label: "SoD", tone: "info" },
        due: { label: "Tuần này", tone: null },
      },
      {
        code: "PT-08405",
        title: "Duyệt phiếu thu — Ngô Nhật Minh",
        meta: "Cơ sở Quận 7 · Sale: Đỗ Lan",
        amount: "32.000.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Quá hạn", tone: "danger" },
      },
      {
        code: "CFG-044",
        title: "Cập nhật ngưỡng mắt thứ hai mạng miền Nam",
        meta: "Hiện 20.000.000 đ · đề xuất 25.000.000 đ",
        amount: "—",
        status: { label: "Cấu hình", tone: "neutral" },
        due: { label: "Không hạn", tone: null },
      },
      {
        code: "PT-08399",
        title: "Duyệt phiếu thu — Vũ Bảo Ngọc",
        meta: "Cơ sở Hà Đông",
        amount: "6.200.000 đ",
        status: { label: "Chờ duyệt", tone: "brand" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "AUD-11888",
        title: "Rà soát hoàn tiền RF-0211",
        meta: "RefundRecord append-only · GĐKD đã tạo",
        amount: "4.500.000 đ",
        status: { label: "Audit", tone: "neutral" },
        due: { label: "Hôm qua", tone: null },
      },
      {
        code: "USR-3370",
        title: "Gán GĐĐT tạm thời cho cơ sở Đà Nẵng",
        meta: "Nghỉ phép 10 ngày · cần quyền grantUnits",
        amount: "—",
        status: { label: "Người dùng", tone: "info" },
        due: { label: "Mai", tone: null },
      },
    ],
    funnel: {
      title: "Phiếu thu theo trạng thái",
      link: "Mở tài chính",
      stages: [
        { label: "Nháp chờ duyệt", count: 18, pct: 100, emphasize: true },
        { label: "Vượt ngưỡng", count: 5, pct: 28, emphasize: true },
        { label: "Đã duyệt hôm nay", count: 11, pct: 61 },
        { label: "Hoàn tiền tháng này", count: 3, pct: 17 },
        { label: "Audit mở", count: 7, pct: 39 },
      ],
    },
    side: {
      title: "Cơ sở cần chú ý",
      items: [
        { time: "Q1", title: "Quận 1", meta: "6 phiếu chờ · 2 vượt ngưỡng" },
        { time: "TB", title: "Tân Bình", meta: "4 phiếu chờ · mạng ổn" },
        { time: "Q7", title: "Quận 7", meta: "1 vượt ngưỡng · sale thiếu" },
        { time: "ĐN", title: "Đà Nẵng", meta: "GĐĐT nghỉ · chờ gán tạm" },
      ],
    },
  },
  {
    id: "giam_doc_kinh_doanh",
    label: "Giám đốc kinh doanh",
    person: "Lê Hoàng Anh",
    initials: "HA",
    greeting: "Xin chào · Giám đốc kinh doanh",
    cta: "+ Tạo phiếu thu",
    nav: [
      {
        label: "Tổng quan",
        items: [
          { id: "cockpit", label: "Tổng quan", icon: "grid", current: true },
          { id: "crm-report", label: "Báo cáo CRM", icon: "chart" },
          { id: "alerts", label: "Nhắc việc", icon: "bell" },
        ],
      },
      {
        label: "Tuyển sinh",
        items: [
          { id: "crm", label: "CRM", icon: "target" },
          { id: "receipts", label: "Phiếu thu", icon: "receipt" },
          { id: "refunds", label: "Hoàn tiền", icon: "refund" },
          { id: "placement", label: "Xếp lớp", icon: "layers" },
        ],
      },
      {
        label: "Nhân sự",
        items: [
          { id: "hr", label: "Nhân sự", icon: "users" },
          { id: "payroll", label: "Lương", icon: "pay" },
        ],
      },
    ],
    tabs: ["Tổng quan", "Phiếu thu", "CRM", "Hoàn tiền", "Báo cáo"],
    metrics: [
      {
        label: "Phiếu thu chờ duyệt",
        value: "9",
        delta: "3 vượt ngưỡng 20 triệu",
        attention: "danger",
        tone: "down",
      },
      { label: "Cơ hội O4 sẵn sàng", value: "14", delta: "Trong facility hiện tại", tone: "up" },
      { label: "Doanh thu duyệt hôm nay", value: "86.4tr", delta: "+12% so với hôm qua", tone: "up" },
    ],
    columns: ["Mã", "Việc cần làm", "Giá trị", "Trạng thái", "Hạn"],
    rows: [
      {
        code: "PT-08421",
        title: "Duyệt phiếu thu — Trần Gia Bảo",
        meta: "Sale: Lê Thu Trang · IELTS Foundation",
        amount: "24.500.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "PT-08418",
        title: "Duyệt phiếu thu — Phạm Khánh An",
        meta: "Sale: Hoàng Minh · TOEIC 550+",
        amount: "8.900.000 đ",
        status: { label: "Chờ duyệt", tone: "brand" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "PT-08405",
        title: "Duyệt phiếu thu — Ngô Nhật Minh",
        meta: "Sale: Đỗ Lan · Cambridge A2",
        amount: "32.000.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Quá hạn", tone: "danger" },
      },
      {
        code: "RF-0211",
        title: "Tạo hoàn tiền — Vũ Bảo Ngọc",
        meta: "Lý do: chuyển cơ sở · cần ledger mới",
        amount: "4.500.000 đ",
        status: { label: "Hoàn tiền", tone: "warning" },
        due: { label: "Mai", tone: null },
      },
      {
        code: "O4-9912",
        title: "Gán sale theo dõi — cơ hội Nguyễn Hà My",
        meta: "O4_TESTED · chưa có owner",
        amount: "—",
        status: { label: "CRM", tone: "info" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "PT-08399",
        title: "Duyệt phiếu thu — Đặng Minh Khang",
        meta: "Sale: Lê Thu Trang",
        amount: "6.200.000 đ",
        status: { label: "Chờ duyệt", tone: "brand" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "PT-08390",
        title: "Duyệt phiếu thu — Hồ Lan Anh",
        meta: "Sale: Hoàng Minh",
        amount: "11.800.000 đ",
        status: { label: "Chờ duyệt", tone: "brand" },
        due: { label: "Mai", tone: null },
      },
      {
        code: "O5-2201",
        title: "Xác nhận xếp lớp sau ghi danh — Bùi Nhật",
        meta: "Đã duyệt phiếu · chờ lớp phù hợp trình độ",
        amount: "9.600.000 đ",
        status: { label: "Xếp lớp", tone: "success" },
        due: { label: "Tuần này", tone: null },
      },
      {
        code: "PT-08377",
        title: "Duyệt phiếu thu — Mai Thanh Tùng",
        meta: "Sale: Đỗ Lan · vượt ngưỡng",
        amount: "21.000.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "CRM-441",
        title: "Rà soát cơ hội quá hạn follow-up của team",
        meta: "12 quá hạn · 7 hôm nay",
        amount: "—",
        status: { label: "Nhắc việc", tone: "warning" },
        due: { label: "Hôm nay", tone: "warning" },
      },
    ],
    funnel: {
      title: "Pipeline O1 → O5",
      link: "Mở CRM",
      stages: [
        { label: "O1 · Tiếp cận", count: 42, pct: 100 },
        { label: "O2 · Đã liên hệ", count: 31, pct: 74 },
        { label: "O3 · Đặt lịch KT", count: 22, pct: 52 },
        { label: "O4 · Đã kiểm tra", count: 14, pct: 33, emphasize: true },
        { label: "O5 · Đã ghi danh", count: 9, pct: 21 },
      ],
    },
    side: {
      title: "Sale cần hỗ trợ",
      items: [
        { time: "LTT", title: "Lê Thu Trang", meta: "5 O4 · 2 phiếu vượt ngưỡng" },
        { time: "HM", title: "Hoàng Minh", meta: "4 nhắc quá hạn" },
        { time: "ĐL", title: "Đỗ Lan", meta: "1 vượt ngưỡng chờ bạn" },
        { time: "Team", title: "Cả team", meta: "12 follow-up quá hạn" },
      ],
    },
  },
  {
    id: "giam_doc_dao_tao",
    label: "Giám đốc đào tạo",
    person: "Trần Mỹ Duyên",
    initials: "MD",
    greeting: "Xin chào · Giám đốc đào tạo",
    cta: "+ Cấp đơn vị LMS",
    nav: [
      {
        label: "Tổng quan",
        items: [
          { id: "cockpit", label: "Tổng quan", icon: "grid", current: true },
          { id: "quality", label: "Chất lượng dạy", icon: "chart" },
          { id: "alerts", label: "Cảnh báo lớp", icon: "bell" },
        ],
      },
      {
        label: "Đào tạo",
        items: [
          { id: "classes", label: "Lớp học", icon: "layers" },
          { id: "grading", label: "Chấm bài", icon: "edit" },
          { id: "units", label: "Cấp đơn vị LMS", icon: "grant" },
          { id: "attendance", label: "Điểm danh", icon: "check" },
        ],
      },
      {
        label: "Tài chính",
        items: [
          { id: "receipts", label: "Phiếu thu (mắt 2)", icon: "receipt" },
          { id: "block", label: "Khóa LMS", icon: "shield" },
        ],
      },
    ],
    tabs: ["Tổng quan", "Phiếu thu", "Lớp học", "Chấm bài", "Đơn vị LMS"],
    metrics: [
      {
        label: "Phiếu cần mắt thứ hai",
        value: "5",
        delta: "Ngưỡng 20.000.000 đ",
        attention: "danger",
        tone: "down",
      },
      {
        label: "Bài chờ chấm",
        value: "27",
        delta: "8 quá 48 giờ",
        attention: "warning",
        tone: "down",
      },
      { label: "Lớp đang trong kỳ", value: "16", delta: "3 thiếu giáo viên chủ nhiệm", tone: null },
    ],
    columns: ["Mã", "Việc cần làm", "Giá trị", "Trạng thái", "Hạn"],
    rows: [
      {
        code: "PT-08421",
        title: "Mắt thứ hai — Trần Gia Bảo",
        meta: "GĐKD đã duyệt sơ bộ · cần GĐĐT",
        amount: "24.500.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "PT-08405",
        title: "Mắt thứ hai — Ngô Nhật Minh",
        meta: "Cambridge A2 · 32 triệu",
        amount: "32.000.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Quá hạn", tone: "danger" },
      },
      {
        code: "UNT-118",
        title: "Cấp đơn vị LMS — lớp IELTS-24A",
        meta: "12 học viên · thiếu 4 tuần content",
        amount: "—",
        status: { label: "grantUnits", tone: "brand" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "GRD-902",
        title: "Rà soát bài chờ quá hạn — GV Nguyễn Hữu",
        meta: "8 bài > 48 giờ",
        amount: "—",
        status: { label: "Chất lượng", tone: "warning" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "CLS-IELTS24B",
        title: "Gán giáo viên chủ nhiệm thay thế",
        meta: "GV nghỉ ốm · buổi tối T3/T5",
        amount: "—",
        status: { label: "Lớp học", tone: "info" },
        due: { label: "Mai", tone: null },
      },
      {
        code: "PT-08377",
        title: "Mắt thứ hai — Mai Thanh Tùng",
        meta: "21.000.000 đ",
        amount: "21.000.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "BLK-044",
        title: "Xem xét khóa LMS — học viên nợ phí",
        meta: "enrollment.blockLms · cơ sở Q1",
        amount: "—",
        status: { label: "Khóa LMS", tone: "danger" },
        due: { label: "Tuần này", tone: null },
      },
      {
        code: "ATT-331",
        title: "Đối chiếu điểm danh thiếu bằng chứng buổi",
        meta: "3 buổi không có session evidence",
        amount: "—",
        status: { label: "Nhật ký", tone: "warning" },
        due: { label: "Mai", tone: null },
      },
      {
        code: "UNT-109",
        title: "Gia hạn đơn vị LMS — TOEIC-09C",
        meta: "Hết hạn 18/08",
        amount: "—",
        status: { label: "grantUnits", tone: "brand" },
        due: { label: "18/08", tone: "warning" },
      },
      {
        code: "PT-08412",
        title: "Mắt thứ hai — Lê Minh Châu",
        meta: "27.800.000 đ · GĐKD chờ bạn",
        amount: "27.800.000 đ",
        status: { label: "Vượt ngưỡng", tone: "danger" },
        due: { label: "Hôm nay", tone: "warning" },
      },
    ],
    funnel: {
      title: "Chất lượng tuần này",
      link: "Mở lớp học",
      stages: [
        { label: "Buổi đã điểm danh", count: 48, pct: 100 },
        { label: "Có nhật ký buổi", count: 41, pct: 85 },
        { label: "Bài đã chấm", count: 63, pct: 70 },
        { label: "Bài chờ > 48 giờ", count: 8, pct: 18, emphasize: true },
        { label: "Lớp thiếu GVCN", count: 3, pct: 12, emphasize: true },
      ],
    },
    side: {
      title: "Lịch dạy cần mắt",
      items: [
        { time: "17:30", title: "IELTS-24A", meta: "Thiếu nhật ký buổi hôm qua" },
        { time: "18:45", title: "TOEIC-09C", meta: "Đơn vị LMS sắp hết" },
        { time: "19:00", title: "CAM-A2", meta: "GV nghỉ · cần thay" },
        { time: "Tối", title: "3 lớp", meta: "Chưa có session evidence" },
      ],
    },
  },
  {
    id: "sale",
    label: "Sale",
    person: "Lê Thu Trang",
    initials: "TT",
    greeting: "Xin chào · Sale",
    cta: "+ Cơ hội mới",
    nav: [
      {
        label: "Tổng quan",
        items: [
          { id: "cockpit", label: "Tổng quan", icon: "grid", current: true },
          { id: "due", label: "Nhắc việc", icon: "bell" },
          { id: "report", label: "Báo cáo của tôi", icon: "chart" },
        ],
      },
      {
        label: "Tuyển sinh",
        items: [
          { id: "crm", label: "CRM", icon: "target" },
          { id: "enroll", label: "Ghi danh / phiếu nháp", icon: "receipt" },
          { id: "placement", label: "Xếp lớp", icon: "layers" },
          { id: "rewards", label: "Đổi thưởng", icon: "trophy" },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { id: "checkin", label: "Chấm công", icon: "clock" },
          { id: "my", label: "Của tôi", icon: "user" },
        ],
      },
    ],
    tabs: ["Tổng quan", "Nhắc việc", "O4 ghi danh", "CRM", "Xếp lớp"],
    metrics: [
      {
        label: "Nhắc việc quá hạn",
        value: "4",
        delta: "Ưu tiên gọi lại hôm nay",
        attention: "danger",
        tone: "down",
      },
      {
        label: "Nhắc việc hôm nay",
        value: "6",
        delta: "3 đã có ghi chú nextAction",
        attention: "warning",
        tone: null,
      },
      {
        label: "O4 sẵn sàng ghi danh",
        value: "5",
        delta: "Sale không xem được danh sách phiếu đã duyệt",
        tone: "up",
        attention: "success",
      },
    ],
    columns: ["Mã", "Việc cần làm", "Liên hệ", "Trạng thái", "Hạn"],
    rows: [
      {
        code: "DUE-118",
        title: "Gọi lại — Nguyễn Hà My",
        meta: "nextAction: gửi học phí IELTS",
        amount: "0901 234 567",
        status: { label: "Quá hạn", tone: "danger" },
        due: { label: "Quá hạn", tone: "danger" },
      },
      {
        code: "DUE-121",
        title: "Nhắc lịch KT — Trần Quốc Bảo",
        meta: "O3_TEST_SCHEDULED · 15:00 hôm nay",
        amount: "0912 888 221",
        status: { label: "Hôm nay", tone: "warning" },
        due: { label: "15:00", tone: "warning" },
      },
      {
        code: "O4-9918",
        title: "Ghi danh — Phạm Khánh An",
        meta: "O4_TESTED · tạo phiếu nháp",
        amount: "0988 112 334",
        status: { label: "O4", tone: "success" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "O4-9901",
        title: "Ghi danh — Hồ Lan Anh",
        meta: "O4_TESTED · đã có đề xuất lớp",
        amount: "0977 445 661",
        status: { label: "O4", tone: "success" },
        due: { label: "Mai", tone: null },
      },
      {
        code: "DUE-130",
        title: "Follow-up — Đặng Minh Khang",
        meta: "Phụ huynh chờ so sánh học phí",
        amount: "0933 221 009",
        status: { label: "Hôm nay", tone: "warning" },
        due: { label: "17:30", tone: "warning" },
      },
      {
        code: "O4-9888",
        title: "Ghi danh — Mai Thanh Tùng",
        meta: "O4_TESTED · cần xếp lớp tối",
        amount: "0966 778 112",
        status: { label: "O4", tone: "success" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "DUE-099",
        title: "Gọi lại — Vũ Bảo Ngọc",
        meta: "Mất liên lạc 3 ngày",
        amount: "0909 111 222",
        status: { label: "Quá hạn", tone: "danger" },
        due: { label: "Quá hạn", tone: "danger" },
      },
      {
        code: "PLC-044",
        title: "Xếp lớp sau ghi danh — Bùi Nhật",
        meta: "Phiếu đã được GĐ duyệt · bạn không xem được mã phiếu",
        amount: "—",
        status: { label: "Xếp lớp", tone: "info" },
        due: { label: "Tuần này", tone: null },
      },
      {
        code: "O4-9870",
        title: "Ghi danh — Ngô Nhật Minh",
        meta: "O4_TESTED · phụ huynh đã đồng ý",
        amount: "0944 556 778",
        status: { label: "O4", tone: "success" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "DUE-140",
        title: "Nhắc — Lê Minh Châu",
        meta: "Gửi brochure Cambridge",
        amount: "0922 334 556",
        status: { label: "Sắp tới", tone: "neutral" },
        due: { label: "Mai", tone: null },
      },
    ],
    funnel: {
      title: "Pipeline của tôi O1 → O5",
      link: "Mở CRM",
      stages: [
        { label: "O1 · Tiếp cận", count: 18, pct: 100 },
        { label: "O2 · Đã liên hệ", count: 14, pct: 78 },
        { label: "O3 · Đặt lịch KT", count: 9, pct: 50 },
        { label: "O4 · Đã kiểm tra", count: 5, pct: 28, emphasize: true },
        { label: "O5 · Đã ghi danh", count: 3, pct: 17 },
      ],
    },
    side: {
      title: "Lịch hôm nay",
      items: [
        { time: "09:30", title: "Tư vấn phụ huynh", meta: "Nguyễn Hà My · phòng 2.1" },
        { time: "15:00", title: "Kiểm tra đầu vào", meta: "Trần Quốc Bảo · phòng KT" },
        { time: "17:30", title: "Gọi follow-up", meta: "Đặng Minh Khang" },
        { time: "18:00", title: "Chấm công ra", meta: "Ca chiều" },
      ],
    },
  },
  {
    id: "giao_vien",
    label: "Giáo viên",
    person: "Nguyễn Hữu Phúc",
    initials: "HP",
    greeting: "Xin chào · Giáo viên",
    cta: "+ Điểm danh",
    nav: [
      {
        label: "Tổng quan",
        items: [
          { id: "cockpit", label: "Tổng quan", icon: "grid", current: true },
          { id: "schedule", label: "Lịch dạy", icon: "calendar" },
          { id: "alerts", label: "Nhắc buổi", icon: "bell" },
        ],
      },
      {
        label: "Giảng dạy",
        items: [
          { id: "attendance", label: "Điểm danh", icon: "check" },
          { id: "grading", label: "Chấm bài", icon: "edit" },
          { id: "evidence", label: "Nhật ký buổi học", icon: "camera" },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          { id: "checkin", label: "Chấm công", icon: "clock" },
          { id: "my", label: "Của tôi", icon: "user" },
        ],
      },
    ],
    tabs: ["Tổng quan", "Chấm bài", "Điểm danh", "Nhật ký", "Lịch dạy"],
    metrics: [
      {
        label: "Bài chờ chấm",
        value: "11",
        delta: "3 nộp hôm qua",
        attention: "warning",
        tone: "down",
      },
      { label: "Buổi dạy hôm nay", value: "3", delta: "17:30 · 18:45 · 20:00", tone: null },
      { label: "Nhật ký buổi thiếu", value: "2", delta: "Tuần này", attention: "warning", tone: null },
    ],
    columns: ["Mã", "Việc cần làm", "Lớp / HS", "Trạng thái", "Hạn"],
    rows: [
      {
        code: "SUB-4401",
        title: "Chấm bài — Writing Task 1",
        meta: "Học viên: Trần Gia Bảo",
        amount: "IELTS-24A",
        status: { label: "Chờ chấm", tone: "warning" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "SUB-4398",
        title: "Chấm bài — Reading set 3",
        meta: "Học viên: Phạm Khánh An",
        amount: "IELTS-24A",
        status: { label: "Chờ chấm", tone: "warning" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "ATT-778",
        title: "Điểm danh buổi tối",
        meta: "Phòng 3.2 · 18 học viên",
        amount: "TOEIC-09C",
        status: { label: "Sắp tới", tone: "info" },
        due: { label: "17:30", tone: null },
      },
      {
        code: "EVI-221",
        title: "Bổ sung nhật ký buổi hôm qua",
        meta: "Thiếu ảnh / ghi chú cuối buổi",
        amount: "CAM-A2",
        status: { label: "Thiếu", tone: "danger" },
        due: { label: "Quá hạn", tone: "danger" },
      },
      {
        code: "SUB-4380",
        title: "Chấm bài — Listening part 2",
        meta: "Học viên: Hồ Lan Anh",
        amount: "TOEIC-09C",
        status: { label: "Chờ chấm", tone: "warning" },
        due: { label: "Mai", tone: null },
      },
      {
        code: "ATT-779",
        title: "Điểm danh buổi tối muộn",
        meta: "Phòng 1.1",
        amount: "IELTS-24B",
        status: { label: "Sắp tới", tone: "info" },
        due: { label: "20:00", tone: null },
      },
      {
        code: "SUB-4371",
        title: "Chấm bài — Speaking rehearsal",
        meta: "Học viên: Đặng Minh Khang",
        amount: "IELTS-24A",
        status: { label: "Chờ chấm", tone: "warning" },
        due: { label: "Hôm nay", tone: "warning" },
      },
      {
        code: "HR-901",
        title: "Chấm công vào ca chiều",
        meta: "Ca 16:30–21:00",
        amount: "—",
        status: { label: "Chấm công", tone: "neutral" },
        due: { label: "16:30", tone: null },
      },
      {
        code: "EVI-218",
        title: "Nhật ký buổi — thiếu chữ ký phụ đạo",
        meta: "Buổi T3 tuần trước",
        amount: "IELTS-24B",
        status: { label: "Thiếu", tone: "danger" },
        due: { label: "Tuần này", tone: null },
      },
      {
        code: "SUB-4360",
        title: "Chấm bài — Grammar quiz",
        meta: "Học viên: Mai Thanh Tùng",
        amount: "CAM-A2",
        status: { label: "Chờ chấm", tone: "warning" },
        due: { label: "Mai", tone: null },
      },
    ],
    funnel: {
      title: "Lớp đang trong kỳ",
      link: "Xem lịch đầy đủ",
      stages: [
        { label: "IELTS-24A", count: 18, pct: 100, emphasize: true },
        { label: "IELTS-24B", count: 16, pct: 89 },
        { label: "TOEIC-09C", count: 20, pct: 100 },
        { label: "CAM-A2", count: 14, pct: 78 },
        { label: "Buổi hôm nay", count: 3, pct: 30, emphasize: true },
      ],
    },
    side: {
      title: "Lịch dạy hôm nay",
      items: [
        { time: "17:30", title: "TOEIC-09C", meta: "Phòng 3.2 · Điểm danh" },
        { time: "18:45", title: "IELTS-24A", meta: "Phòng 2.1 · Writing" },
        { time: "20:00", title: "IELTS-24B", meta: "Phòng 1.1 · Speaking" },
        { time: "21:00", title: "Chấm công ra", meta: "Ca chiều" },
      ],
    },
  },
];

const ICONS = {
  grid: `<path d="M3 3h4v4H3V3Zm6 0h4v4H9V3ZM3 9h4v4H3V9Zm6 0h4v4H9V9Z" stroke="currentColor" stroke-width="1.4" fill="none"/>`,
  list: `<path d="M3 4h10M3 8h10M3 12h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  bell: `<path d="M8 2.8a3.2 3.2 0 0 0-3.2 3.2v2.1c0 .6-.2 1.1-.6 1.5L3.2 11h9.6l-1-1.4c-.4-.4-.6-1-.6-1.5V6A3.2 3.2 0 0 0 8 2.8ZM6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  building: `<path d="M3 13V4l5-1.5L13 4v9M6 13v-3h4v3" stroke="currentColor" stroke-width="1.4" fill="none"/>`,
  users: `<path d="M5.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5 1.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM2.5 13c.4-2 1.9-3 3-3s2.6 1 3 3M9 10.2c1.1 0 2.4.8 2.8 2.3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  shield: `<path d="M8 2.5 13 4.5v3.2c0 3.2-2.1 5.3-5 6.3-2.9-1-5-3.1-5-6.3V4.5L8 2.5Z" stroke="currentColor" stroke-width="1.4" fill="none"/>`,
  settings: `<path d="M6.7 2.8h2.6l.4 1.5 1.4.8 1.5-.3 1.3 2.2-1.1 1.1v1.6l1.1 1.1-1.3 2.2-1.5-.3-1.4.8-.4 1.5H6.7l-.4-1.5-1.4-.8-1.5.3L2.1 10.6l1.1-1.1V7.9L2.1 6.8 3.4 4.6l1.5.3 1.4-.8.4-1.5ZM8 10.2A2.2 2.2 0 1 0 8 5.8a2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" stroke-width="1.2" fill="none"/>`,
  receipt: `<path d="M4 2.5h8v11l-1.2-.8-1.2.8-1.2-.8-1.2.8-1.2-.8-1.2.8v-11Zm2.5 3h3M6.5 8h3M6.5 10.5h2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  chart: `<path d="M3 12.5V8.5M7 12.5V4.5M11 12.5V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  target: `<circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>`,
  refund: `<path d="M5 7H3.5A4.5 4.5 0 1 0 8 3.5M5 7 3.2 5.2M5 7 3.2 8.8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  layers: `<path d="M8 2.5 13.5 5.5 8 8.5 2.5 5.5 8 2.5Zm-5.5 5L8 10.8l5.5-3.3M2.5 11.5 8 14.8l5.5-3.3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/>`,
  pay: `<path d="M2.5 5h11v7h-11V5Zm0 2h11M5 10.5h2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  edit: `<path d="M9.5 3.5 12.5 6.5 6 13H3v-3L9.5 3.5Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>`,
  grant: `<path d="M8 2.5v7M5 6l3 3.5L11 6M3 13h10" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  check: `<path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  calendar: `<path d="M4 3.5h8v10H4v-10Zm0 3h8M6 2.5v2M10 2.5v2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  camera: `<path d="M3 5.5h2l1-1.5h4l1 1.5h2v7H3v-7Zm5 6a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" stroke-width="1.3" fill="none"/>`,
  clock: `<circle cx="8" cy="8" r="5.2" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3.2l2 1.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  user: `<path d="M8 7.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM3.5 13c.5-2.2 2.2-3.3 4.5-3.3S11.5 10.8 12.5 13" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  trophy: `<path d="M5 3.5h6v2.2a3 3 0 0 1-6 0V3.5Zm-1.5 0H2.5v1a2 2 0 0 0 2 2M12.5 3.5h1.5v1a2 2 0 0 1-2 2M6.5 10.5h3V13h-3v-2.5Z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/>`,
};

function icon(name) {
  return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name] ?? ICONS.grid}</svg>`;
}

function $(id) {
  return document.getElementById(id);
}

function formatToday() {
  const d = new Date();
  return d.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function renderNav(role) {
  $("nav").innerHTML = role.nav
    .map(
      (group) => `
      <div class="nav-group">
        <div class="nav-group-label">${group.label}</div>
        <ul class="nav-list">
          ${group.items
            .map(
              (item) => `
            <li>
              <button type="button" class="nav-item" ${item.current ? 'aria-current="page"' : ""}>
                ${icon(item.icon)}
                <span>${item.label}</span>
              </button>
            </li>`,
            )
            .join("")}
        </ul>
      </div>`,
    )
    .join("");
}

function renderTabs(role) {
  $("tabs").innerHTML = role.tabs
    .map(
      (tab, i) => `
    <button type="button" class="tab" role="tab" aria-selected="${i === 0}" id="tab-${i}">
      ${tab}
    </button>`,
    )
    .join("");
}

function renderMetrics(role) {
  $("metrics").innerHTML = role.metrics
    .map(
      (m) => `
    <article class="metric">
      <p class="metric-label">
        ${m.attention ? `<span class="metric-dot" data-tone="${m.attention}" aria-hidden="true"></span>` : ""}
        ${m.label}
      </p>
      <p class="metric-value">${m.value}</p>
      <p class="metric-delta" ${m.tone ? `data-tone="${m.tone}"` : ""}>${m.delta}</p>
    </article>`,
    )
    .join("");
}

function hideToastSoon() {
  window.clearTimeout(hideToastSoon.timer);
  hideToastSoon.timer = window.setTimeout(() => {
    $("toast")?.setAttribute("data-open", "false");
  }, 8000);
}

function openQueueRow(row, tr) {
  document.querySelectorAll(".data-table tbody tr[aria-current='true']").forEach((el) => {
    el.removeAttribute("aria-current");
  });
  tr?.setAttribute("aria-current", "true");
  $("toast-kicker").textContent = row.code;
  $("toast-title").textContent = row.title;
  $("toast-meta").textContent = `${row.meta} · ${row.status.label} · ${row.due.label}`;
  $("toast").setAttribute("data-open", "true");
  hideToastSoon();
}

function bindQueueRows(role) {
  $("table-body").querySelectorAll("tr[data-row-index]").forEach((tr) => {
    const index = Number(tr.dataset.rowIndex);
    const row = role.rows[index];
    if (!row) return;
    tr.addEventListener("click", () => openQueueRow(row, tr));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openQueueRow(row, tr);
      }
    });
  });
}

function renderTable(role) {
  const [c0, c1, c2, c3, c4] = role.columns;
  $("table-head").innerHTML = `
    <tr>
      <th scope="col" class="col-code">${c0}</th>
      <th scope="col" class="col-title">${c1}</th>
      <th scope="col" class="col-amount">${c2}</th>
      <th scope="col" class="col-status">${c3}</th>
      <th scope="col" class="col-due">${c4}</th>
    </tr>`;

  if (!role.rows.length) {
    $("table-body").innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty">
            <h3>Không có việc chờ xử lý</h3>
            <p>Khi có việc thuộc vai trò này, danh sách sẽ hiện tại đây.</p>
            <button type="button" class="btn btn-primary">${role.cta}</button>
          </div>
        </td>
      </tr>`;
    return;
  }

  $("table-body").innerHTML = role.rows
    .map(
      (row, index) => `
    <tr tabindex="0" data-row-index="${index}" aria-label="Mở ${row.title}">
      <td class="col-code">${row.code}</td>
      <td class="col-title">
        <span class="row-title">${row.title}</span>
        <span class="row-meta">${row.meta}</span>
      </td>
      <td class="col-amount">${row.amount}</td>
      <td class="col-status"><span class="badge" data-tone="${row.status.tone}">${row.status.label}</span></td>
      <td class="col-due" ${row.due.tone ? `data-tone="${row.due.tone}"` : ""}>${row.due.label}</td>
    </tr>`,
    )
    .join("");
  bindQueueRows(role);
}

function renderFunnel(role) {
  $("funnel-title").textContent = role.funnel.title;
  $("funnel-link").textContent = role.funnel.link;
  $("funnel").innerHTML = role.funnel.stages
    .map(
      (s, i) => `
    <li class="funnel-row" ${s.emphasize ? 'data-emphasize="true"' : ""}>
      <span class="funnel-index" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
      <div class="funnel-stage">
        <span class="funnel-label">${s.label}</span>
        <div class="funnel-trap" aria-hidden="true"></div>
      </div>
      <span class="funnel-count">${s.count}</span>
    </li>`,
    )
    .join("");
}

function renderSide(role) {
  $("side-title").textContent = role.side.title;
  $("side-list").innerHTML = role.side.items
    .map(
      (item) => `
    <li class="side-item">
      <div class="side-time">${item.time}</div>
      <div>
        <div class="side-title">${item.title}</div>
        <div class="side-meta">${item.meta}</div>
      </div>
    </li>`,
    )
    .join("");
}

function applyRole(roleId) {
  const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
  document.title = `CMC EDU — Tổng quan · ${role.label}`;
  $("subtitle").textContent = role.greeting;
  $("user-name").textContent = role.person;
  $("user-role").textContent = role.label;
  $("avatar").textContent = role.initials;
  $("primary-cta").textContent = role.cta;
  $("queue-count").textContent = String(role.rows.length);
  renderNav(role);
  renderTabs(role);
  renderMetrics(role);
  renderTable(role);
  renderFunnel(role);
  renderSide(role);
  const url = new URL(window.location.href);
  url.searchParams.set("role", role.id);
  history.replaceState(null, "", url);
}

function init() {
  const select = $("role-select");
  select.innerHTML = ROLES.map((r) => `<option value="${r.id}">${r.label}</option>`).join("");
  const today = $("today");
  today.textContent = formatToday();
  today.dateTime = new Date().toISOString().slice(0, 10);

  const params = new URLSearchParams(window.location.search);
  const initial = params.get("role") || "giam_doc_kinh_doanh";
  select.value = ROLES.some((r) => r.id === initial) ? initial : "giam_doc_kinh_doanh";
  applyRole(select.value);

  select.addEventListener("change", () => applyRole(select.value));

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.querySelector(".search-trigger")?.focus();
    }
  });
}

init();
