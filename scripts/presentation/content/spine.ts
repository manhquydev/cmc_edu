// Main narrative spine — character-driven, ≤ 25 words per beat (title + lines + bridge).

import type { SpineBeat } from '../types.js';

export const spineBeats: SpineBeat[] = [
  {
    id: 'spine-01',
    title: 'Phụ huynh quan tâm',
    lines: ['Sale tư vấn, mời học thử.', 'Cơ hội được ghi trên hệ thống.'],
    diagram: 'journey',
    milestones: [
      { time: 'Sáng', title: 'Phụ huynh gọi / đến', detail: 'Muốn tìm hiểu chương trình' },
      { time: 'Trưa', title: 'Sale tư vấn', detail: 'Gợi ý lớp phù hợp' },
      { time: 'Chiều', title: 'Mời học thử', detail: 'Hẹn lịch test hoặc buổi thử' },
    ],
    bridgeQuestion: 'Khi chốt — tiền bắt đầu ra sao?',
    notes: [
      'Nhấn: mọi cơ hội đều có dấu vết, không phụ thuộc sổ tay.',
      'Không kể cấu trúc 4 cụm — kể một em học sinh.',
      'Câu hỏi hay gặp: "Sale ở nhà có thấy được không?" → có, theo cơ sở.',
    ],
  },
  {
    id: 'spine-02',
    title: 'Chốt — phiếu thu nháp',
    lines: ['Sale lập phiếu thu.', 'Phiếu chỉ là nháp — chưa kích hoạt gì.'],
    diagram: 'before-after',
    before: {
      title: 'Trước đây',
      items: ['Ghi tay / Excel', 'Dễ quên trạng thái', 'Khó truy vết ai lập'],
    },
    after: {
      title: 'Hiện nay',
      items: ['Phiếu nháp trên hệ thống', 'Chưa duyệt = chưa có tài khoản', 'Mọi bước để lại vết'],
    },
    bridgeQuestion: 'Ai được quyền biến nháp thành thật?',
    notes: [
      'Nhấn mạnh từ "nháp" — ban giám đốc hay hỏi "ai bấm là tiền vào?".',
      'Sale không tự duyệt phiếu của mình.',
    ],
  },
  {
    id: 'spine-03',
    title: 'Cổng tiền',
    lines: [
      'Giám đốc Kinh doanh duyệt phiếu.',
      'Vượt ngưỡng cần thêm một mắt kiểm.',
    ],
    diagram: 'control-gate',
    gateOptions: [
      { kind: 'approve', label: 'Duyệt trong thẩm quyền', note: 'Tiền vào sổ ghi' },
      { kind: 'escalate', label: 'Vượt ngưỡng', note: 'Cần mắt thứ hai' },
      { kind: 'return', label: 'Trả lại Sale', note: 'Sai số / thiếu hồ sơ' },
      { kind: 'reject', label: 'Từ chối', note: 'Không thu' },
    ],
    bridgeQuestion: 'Sau khi duyệt — ai ngồi nhập tài khoản?',
    notes: [
      'SoD: người lập ≠ người duyệt.',
      'Nêu ngưỡng nếu bị hỏi; không nhồi số lên slide.',
      'Luồng tiền/lương hay còn mức "chạy thông" — nói thẳng.',
    ],
  },
  {
    id: 'spine-04',
    title: 'Hệ thống tự làm',
    lines: ['Tự tạo tài khoản. Kích hoạt ghi danh. Gửi email.', 'Không ai nhập tay.'],
    diagram: 'swimlane',
    steps: [
      { actor: 'giam_doc_kinh_doanh', action: 'Duyệt phiếu thu' },
      { actor: 'he_thong', action: 'Sinh tài khoản', system: true },
      { actor: 'he_thong', action: 'Kích hoạt ghi danh', system: true },
      { actor: 'he_thong', action: 'Xếp hàng gửi email', system: true },
    ],
    bridgeQuestion: 'Vào lớp — giáo viên làm gì?',
    notes: [
      'Khoảnh khắc wow — để khách thấy tự động hóa thật.',
      'Email có hàng đợi riêng, không mất khi lỗi mạng.',
      'Phụ huynh đổi mật khẩu mặc định lần đầu.',
    ],
  },
  {
    id: 'spine-05',
    title: 'Trong lớp',
    lines: ['Giáo viên điểm danh, giao bài, chấm, cộng sao.', 'Tiến độ học được ghi lại.'],
    diagram: 'journey',
    milestones: [
      { time: 'Đầu buổi', title: 'Điểm danh' },
      { time: 'Giữa buổi', title: 'Giao / làm bài' },
      { time: 'Cuối buổi', title: 'Chấm bài & cộng sao' },
    ],
    bridgeQuestion: 'Phụ huynh ở nhà biết gì?',
    notes: [
      'Không demo live — chỉ sơ đồ.',
      'Sao là đơn vị thưởng nhìn thấy được cho học sinh.',
    ],
  },
  {
    id: 'spine-06',
    title: 'Phụ huynh mở app',
    lines: ['Xem lịch, kết quả, ảnh buổi học.', 'Không hỏi giáo viên từng ngày.'],
    diagram: 'journey',
    milestones: [
      { title: 'Đăng nhập app' },
      { title: 'Xem lịch & điểm danh' },
      { title: 'Xem bài & nhận xét' },
      { title: 'Xem ảnh / tóm tắt buổi' },
    ],
    bridgeQuestion: 'Lương giáo viên chốt ra sao?',
    notes: [
      'Phụ huynh chỉ thấy dữ liệu con mình.',
      'Nhận xét có thể AI soạn nháp, giáo viên chốt.',
    ],
  },
  {
    id: 'spine-07',
    title: 'Công và lương',
    lines: ['Chấm công, ca, KPI, chốt lương.', 'Số liệu lấy từ vận hành hằng ngày.'],
    diagram: 'swimlane',
    steps: [
      { actor: 'giao_vien', action: 'Chấm công · đăng ký ca · nộp KPI' },
      { actor: 'giam_doc_dao_tao', action: 'Duyệt ca · duyệt KPI' },
      { actor: 'giam_doc_kinh_doanh', action: 'Chốt lương tháng' },
      { actor: 'he_thong', action: 'Tính theo bậc & công', system: true },
    ],
    bridgeQuestion: 'Sau khóa — còn chăm sóc nào?',
    notes: [
      'Nhấn: không Excel chấm công tách rời.',
      'Nếu hỏi số liệu kiểm: chỉ rõ tầng "chạy thông" vs "đúng nghiệp vụ".',
    ],
  },
  {
    id: 'spine-08',
    title: 'Vòng sau',
    lines: ['Đổi quà. Họp phụ huynh. Chăm sóc sau bán.'],
    diagram: 'before-after',
    before: {
      title: 'Rời rạc',
      items: ['Nhắc họp bằng chat', 'Đổi quà ngoài sổ', 'CSKH không dấu vết'],
    },
    after: {
      title: 'Trên một hệ thống',
      items: ['Lịch họp & nhắc', 'Đổi quà có số dư sao', 'Cơ hội sau bán được theo dõi'],
    },
    bridgeQuestion: 'Chi tiết từng vai trò — mở bản đồ nhà.',
    notes: [
      'Kết mạch chính — mời hỏi đáp hoặc nhảy bản đồ.',
      'Nhắc UAT người thật chưa chạy nếu bị hỏi "production-ready?".',
    ],
  },
];
