// Flow manifest — 38 luồng: 33 WF-code TL25 (P1–P4) + 5 ADMIN (nguồn: code +
// plans/260716-1047-super-admin-completion). TL25 (docs/25-ma-tran-truy-vet-p1.md
// §2) làm mẫu số; expected.trpc/uiRoutes/models dùng GIÁ TRỊ THẬT đối chiếu
// trực tiếp scanner output (2026-07-18) — không chép mù TL25.
//
// Nguyên tắc claim procedure (E1/E7, plan 260718-0423):
// - Procedure chính TL25 nêu + procedure PHỤ mà đúng màn hình/queue của WF đó
//   thực sự gọi (kèm lý do 1 dòng). KHÔNG staple procedure không liên quan.
// - Route giữ đúng actor/guard: ParentOnly→/parent/*, StudentOnly→/student/* (E2).
// - Worker nội bộ (P3-10/11): models-only, không procedure (E3).
// - ADMIN: uiEvidenceSpec KHÔNG BAO GIỜ set — view cross-facility, Safety Gate 5 (E6).
//
// TL25 đã sync 2026-07-18: 5 điểm P1 (P1-02/03/05/09 sửa route, P1-06 xoá claim
// /child/link-request) + drift P2-P4 (xem NOTE từng luồng).

import type { FlowEntry } from './types.js';

export const flows: FlowEntry[] = [
  // ─────────────────────────────── P1 — Tuyển sinh & ghi danh ───────────────────────────────
  {
    id: 'P1-01',
    displayName: 'Quản lý phễu tuyển sinh (O1→O5)',
    cluster: 'P1',
    actorRoles: ['sale'],
    expected: {
      // opportunityGet/List = màn kanban + chi tiết cơ hội (E1).
      trpc: [
        'crm.opportunityCreate',
        'crm.opportunityAdvance',
        'crm.opportunityMarkLost',
        'crm.opportunityLookup',
        'crm.opportunityGet',
        'crm.opportunityList',
        'crm.assignableStaff',
        'crm.opportunityAssign',
      ],
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
      // TL25 đã sync 2026-07-18: route /finance/receipts/new → /finance/new.
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
      // TL25 đã sync 2026-07-18: route /finance/receipts/:id → /finance/:id.
      // receiptGet/List = hàng đợi duyệt của người phê (E1).
      trpc: ['finance.receiptApprove', 'finance.receiptGet', 'finance.receiptList'],
      uiRoutes: ['/finance', '/finance/:id'],
      models: ['Receipt'],
    },
  },
  {
    id: 'P1-04',
    displayName: 'Sinh tài khoản khi thu tiền',
    cluster: 'P1',
    actorRoles: ['he_thong'],
    expected: {
      // Side-effect nội bộ của receiptApprove (provisionFromReceipt) — không procedure/route riêng.
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
      // TL25 đã sync 2026-07-18: /students/:id/enrollments → /admin/students/:id.
      // student.get/lookup/getManyByIds/resetPassword + enrollment.blockLms = màn quản lý
      // học viên /admin/students (chi tiết, tra cứu, reset mật khẩu, chặn LMS) (E1).
      trpc: [
        'enrollment.enroll',
        'finance.receiptApprove',
        'enrollment.blockLms',
        'student.get',
        'student.lookup',
        'student.getManyByIds',
        'student.resetPassword',
      ],
      uiRoutes: ['/admin/students', '/admin/students/:id'],
      models: ['Enrollment', 'Student'],
    },
  },
  {
    id: 'P1-06',
    displayName: 'Liên kết phụ huynh–con',
    cluster: 'P1',
    actorRoles: ['phu_huynh'],
    expected: {
      // TL25 đã sync 2026-07-18: xoá claim LMS /child/link-request (route không tồn tại);
      // hàng đợi xác nhận thật ở /admin/parents. listPendingLinks = hàng đợi duyệt (E1).
      // parentAccount.updateEmail = nhân viên điền/sửa email PH trên cùng màn
      // /admin/parents (điều kiện để PH đăng nhập LMS bằng OTP-email) — E1.
      trpc: [
        'guardian.requestLink',
        'guardian.approveLink',
        'guardian.rejectLink',
        'guardian.listPendingLinks',
        'parentAccount.updateEmail',
      ],
      uiRoutes: ['/admin/parents'],
      models: ['GuardianLinkRequest', 'Guardian', 'ParentAccount'],
    },
  },
  {
    id: 'P1-07',
    displayName: 'Đăng nhập xem con',
    cluster: 'P1',
    actorRoles: ['phu_huynh'],
    expected: {
      // Các biến thể OTP/login khác (loginStudent, requestOtpEmail…) thuộc namespace
      // lmsAuth — đã whitelist hạ tầng auth (E4), không cần claim riêng.
      trpc: ['lmsAuth.requestOtp', 'lmsAuth.verifyOtp', 'enrollment.mine'],
      uiRoutes: ['/login', '/parent/home'],
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
      // TL25 đã sync 2026-07-18: /finance/reconciliation → /ops/recon.
      // reconciliation.* = màn cờ đối soát (E1).
      trpc: ['audit.list', 'reconciliation.listFlags', 'reconciliation.action', 'reconciliation.dismiss'],
      uiRoutes: ['/ops/recon'],
      models: ['ReconciliationFlag'],
    },
  },

  // ─────────────────────────────── P2 — Vận hành lớp học ───────────────────────────────
  {
    id: 'P2-01',
    displayName: 'Tạo lớp tự sinh lịch buổi',
    cluster: 'P2',
    actorRoles: ['giam_doc_dao_tao'],
    expected: {
      // schedule.generateSessions = phần "tự sinh lịch buổi". classSession.* = quản lý buổi
      // trong lớp; course.list/room.* = thực thể nền chọn khi tạo lớp (E1).
      trpc: [
        'classBatch.create',
        'classBatch.get',
        'classBatch.list',
        'classBatch.assignTeacher',
        'classBatch.listStudents',
        'schedule.generateSessions',
        'classSession.list',
        'classSession.addMakeup',
        'classSession.assignUnit',
        'classSession.confirm',
        'classSession.cancel',
        'course.list',
        'room.create',
        'room.list',
      ],
      uiRoutes: ['/admin/classes', '/admin/classes/:id'],
      models: ['ClassBatch', 'ClassSession', 'ScheduleSlot', 'Course', 'Room'],
    },
  },
  {
    id: 'P2-02',
    displayName: 'Điểm danh buổi học',
    cluster: 'P2',
    actorRoles: ['giao_vien'],
    expected: {
      // listBySession = màn điểm danh của 1 buổi; listForChild = lịch sử điểm danh HV (E1).
      trpc: ['attendance.mark', 'attendance.markAll', 'attendance.listBySession', 'attendance.listForChild'],
      uiRoutes: ['/teaching/attendance'],
      models: ['Attendance'],
    },
  },
  {
    id: 'P2-03',
    displayName: 'Mở bài tập theo tiến độ học',
    cluster: 'P2',
    actorRoles: ['hoc_vien'],
    expected: {
      // Luồng LMS học viên (StudentOnly). listForStudent = danh sách bài của HV (E1).
      trpc: ['exercise.openForStudent', 'exercise.listForStudent'],
      uiRoutes: ['/student/home', '/student/exercise/:exerciseId'],
      models: ['Exercise'],
    },
  },
  {
    id: 'P2-04',
    displayName: 'Cung cấp bài tập PDF',
    cluster: 'P2',
    actorRoles: ['giao_vien', 'giam_doc_dao_tao'],
    expected: {
      // TL25 đã sync 2026-07-18: /curriculum/:unitId/exercises → /teaching/exercises
      // (không có prefix /curriculum). exercise.list/close + curriculumUnit.list = màn soạn bài (E1).
      trpc: ['exercise.create', 'exercise.publish', 'exercise.close', 'exercise.list', 'curriculumUnit.list'],
      uiRoutes: ['/teaching/exercises'],
      models: ['Exercise', 'CurriculumUnit'],
    },
  },
  {
    id: 'P2-05',
    displayName: 'Làm bài trên PDF & nộp',
    cluster: 'P2',
    actorRoles: ['hoc_vien'],
    expected: {
      // Luồng LMS học viên (StudentOnly). listForChild = bài đã nộp của HV (E1).
      trpc: ['submission.saveDraft', 'submission.submit', 'submission.listForChild'],
      uiRoutes: ['/student/exercise/:exerciseId'],
      models: ['Submission'],
    },
  },
  {
    id: 'P2-06',
    displayName: 'Chấm bài & cộng sao',
    cluster: 'P2',
    actorRoles: ['giao_vien'],
    expected: {
      // listForGrading = hàng đợi chấm; saveTeacherAnnotation = ghi chú lên PDF (E1).
      trpc: ['submission.grade', 'submission.saveTeacherAnnotation', 'submission.listForGrading'],
      uiRoutes: ['/teaching/grading'],
      models: ['Submission', 'StarTransaction'],
    },
  },
  {
    id: 'P2-07',
    displayName: 'Nhận xét (AI nháp, GV chốt)',
    cluster: 'P2',
    actorRoles: ['agent', 'giao_vien'],
    expected: {
      // TL25 đã sync 2026-07-18: /teaching/report-cards/:id → /admin/report-cards (không :id)
      // + màn soạn /teaching/session-assessment. discard/listBySession/listForChild + reportCard
      // = màn nhận xét & phiếu học tập (E1).
      trpc: [
        'assessment.draftComment',
        'assessment.confirm',
        'assessment.discard',
        'assessment.listBySession',
        'assessment.listForChild',
        'reportCard.getForChild',
      ],
      uiRoutes: ['/teaching/session-assessment', '/admin/report-cards'],
      models: ['QualitativeAssessment', 'FinalGrade'],
    },
  },
  {
    id: 'P2-08',
    displayName: 'Gửi ảnh & tóm tắt buổi cho PH',
    cluster: 'P2',
    actorRoles: ['giao_vien', 'phu_huynh'],
    expected: {
      // TL25 đã sync 2026-07-18: LMS /child/:id → GV soạn ở /teaching/session-evidence,
      // PH xem ảnh ở /parent/evidence/:studentId (ParentOnly — parent-mediated TL08§7, E2).
      // setPhotoConsent = PH cấp quyền xem ảnh con (E1).
      trpc: [
        'sessionEvidence.publish',
        'sessionEvidence.addPhoto',
        'sessionEvidence.upsert',
        'sessionEvidence.getBySession',
        'sessionEvidence.listForChild',
        'guardian.setPhotoConsent',
      ],
      uiRoutes: ['/teaching/session-evidence', '/parent/evidence/:studentId'],
      models: ['SessionEvidence', 'SessionEvidencePhoto'],
    },
  },

  // ─────────────────────────────── P3 — Nhân sự & lương ───────────────────────────────
  {
    id: 'P3-01',
    displayName: 'Chấm công cặp vào/ra mỗi ngày',
    cluster: 'P3',
    actorRoles: ['nhan_vien'],
    expected: {
      trpc: ['checkInOut.punch'],
      uiRoutes: ['/hr/checkin'],
      models: ['TimePunch'],
    },
  },
  {
    id: 'P3-02',
    displayName: 'Duyệt phiếu chấm công offsite',
    cluster: 'P3',
    actorRoles: ['nhan_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['manualPunch.approve', 'manualPunch.reject', 'manualPunch.resubmit', 'manualPunch.list'],
      uiRoutes: ['/hr/checkin'],
      models: ['ManualAttendanceTicket'],
    },
  },
  {
    id: 'P3-03',
    displayName: 'Đăng ký ca làm',
    cluster: 'P3',
    actorRoles: ['sale', 'giao_vien'],
    expected: {
      // shift.cancel = huỷ đăng ký ca của chính mình (E1).
      trpc: ['shift.submit', 'shift.listGroups', 'shift.myRegistrations', 'shift.cancel'],
      uiRoutes: ['/hr/shifts'],
      models: ['ShiftRegistration', 'ShiftRegistrationEntry'],
    },
  },
  {
    id: 'P3-04',
    displayName: 'Duyệt ca',
    cluster: 'P3',
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['shift.approve', 'shift.pendingForApproval'],
      uiRoutes: ['/hr/shifts'],
      models: ['ShiftRegistration'],
    },
  },
  {
    id: 'P3-05',
    displayName: 'Chốt lương tháng theo bậc lương',
    cluster: 'P3',
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: [
        'payslip.assemble',
        'payslip.finalize',
        'payslip.reopen',
        'payslip.my',
        'payslip.getForUser',
        'salaryTier.list',
        'salaryTier.create',
        'salaryTier.update',
        'compensation.assignTier',
        // Staff picker behind both screens — the directors cannot choose an
        // employee without it.
        'user.pickList',
      ],
      uiRoutes: ['/hr/payroll', '/hr/salary-tiers', '/hr/my'],
      models: ['Payslip', 'SalaryTier', 'SalaryRate', 'CompensationPolicy'],
    },
  },
  {
    id: 'P3-06',
    displayName: 'Nộp & duyệt phiếu KPI (auto-score)',
    cluster: 'P3',
    actorRoles: ['sale', 'giao_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['kpi.submitSlip', 'kpi.confirm', 'kpi.override', 'kpi.myScore', 'kpi.list'],
      uiRoutes: ['/hr/kpi', '/hr/my'],
      models: ['KpiScore'],
    },
  },
  {
    id: 'P3-07',
    displayName: 'Từ chối đăng ký ca (kèm lý do)',
    cluster: 'P3',
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['shift.reject'],
      uiRoutes: ['/hr/shifts'],
      models: ['ShiftRegistration'],
    },
  },
  {
    id: 'P3-08',
    displayName: 'Tất toán KPI hàng loạt (branch-scope)',
    cluster: 'P3',
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['kpi.bulkApprove'],
      uiRoutes: ['/hr/kpi'],
      models: ['KpiScore'],
    },
  },
  {
    id: 'P3-09',
    displayName: 'Tính lại điểm KPI tự động',
    cluster: 'P3',
    actorRoles: ['sale', 'giao_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['kpi.refresh'],
      uiRoutes: ['/hr/kpi', '/hr/my'],
      models: ['KpiScore'],
    },
  },
  {
    id: 'P3-10',
    displayName: 'Đánh giá buổi học hoàn thành (session-done)',
    cluster: 'P3',
    actorRoles: ['he_thong'],
    expected: {
      // Worker nội bộ (sweep), không procedure/route trực tiếp — models-only (E3).
      trpc: [],
      uiRoutes: [],
      models: ['ClassSession', 'KpiScore'],
    },
  },
  {
    id: 'P3-11',
    displayName: 'Tự huỷ buổi 0 điểm danh + xếp buổi bù',
    cluster: 'P3',
    actorRoles: ['he_thong'],
    expected: {
      // Worker nội bộ (sweep), không procedure/route trực tiếp — models-only (E3).
      trpc: [],
      uiRoutes: [],
      models: ['ClassSession', 'ScheduleSlot'],
    },
  },

  // ─────────────────────────────── P4 — Đổi quà & chăm sóc PH ───────────────────────────────
  {
    id: 'P4-01',
    displayName: 'Đổi quà bằng sao',
    cluster: 'P4',
    actorRoles: ['hoc_vien', 'nhan_vien'],
    expected: {
      // listForStudent = HV xem quà đổi được (E1).
      trpc: ['rewards.redeem', 'rewards.approve', 'rewards.deliver', 'rewards.reject', 'rewards.list', 'rewards.listForStudent'],
      uiRoutes: ['/admin/engagement/rewards', '/student/gifts'],
      models: ['Reward', 'StarTransaction'],
    },
  },
  {
    id: 'P4-02',
    displayName: 'Cấu hình quà đổi sao',
    cluster: 'P4',
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      // TL25 đã sync 2026-07-18: gift.archive KHÔNG tồn tại → gift.upsert/list.
      trpc: ['gift.upsert', 'gift.list', 'gift.listForStudent'],
      uiRoutes: ['/admin/engagement/gifts', '/admin/engagement/rewards'],
      models: ['Gift'],
    },
  },
  {
    id: 'P4-03',
    displayName: 'Lên lịch & nhắc họp PH',
    cluster: 'P4',
    actorRoles: ['nhan_vien'],
    expected: {
      // TL25 đã sync 2026-07-18: /parent-meetings KHÔNG tồn tại → /crm/post-sale-meeting.
      // GAP: page /crm/post-sale-meeting hiện là EmptyState CHƯA gọi API (crm.routes.tsx) —
      // procedure+model có thật (structural built) nhưng UI chưa dùng được. Xem documented gaps.
      trpc: ['parentMeeting.list', 'parentMeeting.schedule', 'parentMeeting.complete', 'parentMeeting.cancel'],
      uiRoutes: ['/crm/post-sale-meeting'],
      models: ['ParentMeeting'],
    },
  },
  {
    id: 'P4-04',
    displayName: 'Đặt lịch test đầu vào/định kỳ',
    cluster: 'P4',
    actorRoles: ['sale', 'giao_vien'],
    expected: {
      trpc: [
        'testAppointment.forOpportunity',
        'testAppointment.schedule',
        'testAppointment.complete',
        'testAppointment.noShow',
      ],
      uiRoutes: ['/crm/opportunities/:id'],
      // phase-07: entrance appointments now attach to and advance an Opportunity.
      models: ['TestAppointment', 'Opportunity'],
    },
  },
  {
    id: 'P4-05',
    displayName: 'Chăm sóc sau bán',
    cluster: 'P4',
    actorRoles: ['sale', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: [
        'afterSale.list',
        'afterSale.advance',
        'afterSale.create',
        'afterSale.resolve',
        'afterSale.close',
        'student.setLifecycle',
      ],
      uiRoutes: ['/crm/aftersale'],
      models: ['AfterSaleCase'],
    },
  },

  // ─────────────────────────────── ADMIN — Quản trị hệ thống ───────────────────────────────
  // Nguồn: code + plans/260716-1047-super-admin-completion (không có mã WF TL25).
  // CẢ CỤM: uiEvidenceSpec KHÔNG BAO GIỜ set — đều là view cross-facility/super-admin,
  // cấm chụp evidence (Safety Gate 5 plan gốc, E6).
  {
    id: 'ADM-01',
    displayName: 'Quản trị cơ sở',
    cluster: 'ADMIN',
    actorRoles: ['super_admin'],
    expected: {
      trpc: ['facility.create', 'facility.list', 'facility.update'],
      uiRoutes: ['/admin/facilities'],
      models: ['Facility'],
    },
  },
  {
    id: 'ADM-02',
    displayName: 'Quản trị tài khoản nhân sự',
    cluster: 'ADMIN',
    actorRoles: ['super_admin'],
    expected: {
      trpc: ['user.create', 'user.list', 'user.update', 'user.updateRoles'],
      uiRoutes: ['/admin/users'],
      models: ['AppUser'],
    },
  },
  {
    id: 'ADM-03',
    displayName: 'Cấu hình mạng chấm công (IP)',
    cluster: 'ADMIN',
    actorRoles: ['super_admin'],
    expected: {
      trpc: ['facilityNetwork.create', 'facilityNetwork.update', 'facilityNetwork.delete', 'facilityNetwork.list', 'facilityNetwork.detectMyIp'],
      uiRoutes: ['/admin/network-ip'],
      models: ['FacilityNetwork'],
    },
  },
  {
    id: 'ADM-04',
    displayName: 'Nhật ký hệ thống',
    cluster: 'ADMIN',
    actorRoles: ['super_admin'],
    expected: {
      trpc: ['audit.list'],
      uiRoutes: ['/admin/audit-log'],
      models: ['AuditLog'],
    },
  },
  {
    id: 'ADM-05',
    displayName: 'Cấu hình ca làm',
    cluster: 'ADMIN',
    actorRoles: ['super_admin'],
    expected: {
      trpc: ['shift.createGroup', 'shift.createTemplate', 'shift.listGroups', 'compensationPolicy.get', 'compensationPolicy.upsert'],
      uiRoutes: ['/admin/shift-config'],
      models: ['ShiftGroup', 'ShiftTemplate', 'CompensationPolicy'],
    },
  },
];
