// v1 manifest — cụm P1 (9 luồng), theo TL25 (docs/25-ma-tran-truy-vet-p1.md
// §2) làm mẫu số, nhưng expected.trpc/uiRoutes dùng GIÁ TRỊ THẬT đối chiếu
// trực tiếp với code tại thời điểm viết manifest này (2026-07-17) — không
// chép mù TL25, vì TL25 tự thừa nhận có thể lệch (docs/25 header). Chỗ nào
// TL25 khác với code thật được ghi chú NOTE để dev đối chiếu/cập nhật TL25
// sau, KHÔNG che giấu bằng cách chép nguyên docs rồi để verifier báo đỏ giả.
//
// P2/P3/P4/ADMIN thêm dần sau khi v1 chạy — không phải gate ship (phase-01
// step 8, R2-2).

import type { FlowEntry } from './types.js';

export const flows: FlowEntry[] = [
  {
    id: 'P1-01',
    displayName: 'Quản lý phễu tuyển sinh (O1→O5)',
    cluster: 'P1',
    actorRoles: ['sale'],
    expected: {
      trpc: ['crm.opportunityCreate', 'crm.opportunityAdvance', 'crm.opportunityMarkLost', 'crm.opportunityLookup'],
      uiRoutes: ['/crm', '/crm/opportunities/:id'],
      models: ['Opportunity'],
    },
  },
  {
    id: 'P1-02',
    displayName: 'Tạo phiếu học phí từ cơ hội',
    cluster: 'P1',
    actorRoles: ['sale'],
    expected: {
      // NOTE: TL25 ghi route "/finance/receipts/new" — code thật là "/finance/new"
      // (finance.routes.tsx). TL25 cần cập nhật lại theo code.
      trpc: ['finance.receiptCreate'],
      uiRoutes: ['/finance/new'],
      models: ['Receipt'],
    },
  },
  {
    id: 'P1-03',
    displayName: 'Duyệt phiếu kích hoạt học viên',
    cluster: 'P1',
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      // NOTE: TL25 ghi route "/finance/receipts/:id" — code thật là "/finance/:id".
      trpc: ['finance.receiptApprove'],
      uiRoutes: ['/finance/:id'],
      models: ['Receipt'],
    },
  },
  {
    id: 'P1-04',
    displayName: 'Sinh tài khoản khi thu tiền',
    cluster: 'P1',
    actorRoles: ['he_thong'],
    expected: {
      // Side-effect nội bộ của receiptApprove (provisionFromReceipt) — không
      // có tRPC procedure hay UI route riêng (TL25 cũng ghi "internal").
      trpc: [],
      uiRoutes: [],
      models: ['StudentAccount', 'AppUser'],
    },
  },
  {
    id: 'P1-05',
    displayName: 'Kích hoạt ghi danh khi đóng phí',
    cluster: 'P1',
    actorRoles: ['he_thong'],
    expected: {
      trpc: ['enrollment.enroll', 'finance.receiptApprove'],
      // NOTE: TL25 ghi "/students/:id/enrollments" — route thật gần nhất là
      // "/admin/students/:id" (enrollments hiển thị trong tab của trang chi
      // tiết học viên, không phải route riêng).
      uiRoutes: ['/admin/students/:id'],
      models: ['Enrollment'],
    },
  },
  {
    id: 'P1-06',
    displayName: 'Liên kết phụ huynh–con',
    cluster: 'P1',
    actorRoles: ['phu_huynh'],
    expected: {
      trpc: ['guardian.requestLink', 'guardian.approveLink', 'guardian.rejectLink'],
      // NOTE: TL25 ghi thêm LMS "/child/link-request" — không tìm thấy route
      // LMS độc lập cho hành động này trong code hiện tại; chỉ hàng đợi phía
      // admin xác nhận tồn tại. Cần đối chiếu lại TL19§6c hoặc cập nhật TL25.
      uiRoutes: ['/admin/parents'],
      models: ['GuardianLinkRequest', 'Guardian'],
    },
  },
  {
    id: 'P1-07',
    displayName: 'Đăng nhập xem con',
    cluster: 'P1',
    actorRoles: ['phu_huynh'],
    expected: {
      trpc: ['lmsAuth.requestOtp', 'lmsAuth.verifyOtp', 'enrollment.mine'],
      uiRoutes: ['/login'],
      models: ['LoginOtp'],
    },
  },
  {
    id: 'P1-08',
    displayName: 'Huỷ phiếu / hoàn tiền',
    cluster: 'P1',
    actorRoles: ['giam_doc_kinh_doanh'],
    expected: {
      trpc: ['finance.receiptCancel', 'finance.refundCreate'],
      uiRoutes: ['/finance/:id', '/finance/refund'],
      models: ['Receipt', 'RefundRecord'],
    },
  },
  {
    id: 'P1-09',
    displayName: 'Giám sát bất thường tài chính',
    cluster: 'P1',
    actorRoles: ['agent', 'giam_doc_dao_tao'],
    expected: {
      // Read-only qua audit.list (MCP/agent). finance.* không có 1 procedure
      // "recon" riêng — verifier match theo audit.list là đủ cho v1.
      trpc: ['audit.list'],
      // NOTE: TL25 ghi "/finance/reconciliation" — route thật là "/ops/recon"
      // (ops.routes.tsx).
      uiRoutes: ['/ops/recon'],
      models: ['ReconciliationFlag'],
    },
  },
];
