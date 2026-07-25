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
    // Journey chứng minh đường THẤT BẠI của phễu: sale tạo cơ hội → mở màn chi
    // tiết (opportunityGet) → đánh dấu mất kèm lý do (opportunityMarkLost). Khác
    // crm-receipt (chỉ create + advance rồi rời board). Phủ hẹp có chủ ý:
    // assign (assignableStaff + opportunityAssign) chỉ hiện với vai quản lý
    // (isManager=GĐKD) và cần nhân sự assignable thật → để lại đợt sau.
    journey: 'apps/e2e/tests/journeys/crm-opportunity-lost.journey.ui.spec.ts',
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
    // Phase 5 (plan 260723-1422): sale advances a real Opportunity to
    // O4_TESTED on /crm (ADR-B funnel), then creates the receipt from its own
    // "Ghi danh"/"Tạo phiếu thu" link — drives finance.receiptCreate at
    // /finance/new directly, the exact intersection this flow's `expected`
    // block claims. NOT finance-receipt.journey.ui.spec.ts (Phase 4/F1): that
    // journey reaches /finance/new via the Xếp lớp screen's inline link
    // instead of the CRM funnel this flow's own displayName names, and its
    // trpc/uiRoute surface is the same set P1-03 below already claims.
    journey: 'apps/e2e/tests/journeys/crm-receipt.journey.ui.spec.ts',
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
    // Phase 5 (plan 260723-1422): drives finance.receiptApprove/receiptGet/
    // receiptList for real, PLUS the negation this flow's own displayName is
    // built around — sale gets a real permission-denied screen on its own
    // receipt, never the approve action; a different giam_doc_kinh_doanh
    // finds it (findInList, never a smuggled id) and approves it. NOT
    // finance-receipt.journey.ui.spec.ts (Phase 4/F1) — that journey proves
    // the same create/approve/notify mechanics (plus an email-outbox 'sent'
    // check this flow's `expected` block does not itself claim) but has no
    // distinct intersection with any OTHER flow once P1-02/P1-03 are wired to
    // the two journeys above/below — see this phase's own report for that
    // open question.
    journey: 'apps/e2e/tests/journeys/receipt-approve-negation.journey.ui.spec.ts',
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
    // Journey chứng minh trọn vòng đời tài khoản học sinh do provisioning sinh
    // ra: đăng nhập mật khẩu mặc định → bị giữ ở cổng đổi mật khẩu → phụ huynh
    // đặt lại → đăng nhập mật khẩu mới. Khớp H2: P1-04 chỉ khai models
    // (StudentAccount), journey tạo và kích hoạt đúng model đó qua UI thật.
    journey: 'apps/e2e/tests/journeys/lms-student-activation.journey.ui.spec.ts',
  },
  {
    id: 'P1-05',
    displayName: 'Kích hoạt ghi danh khi đóng phí',
    cluster: 'P1',
    // Kích hoạt ghi danh là side-effect của duyệt phiếu, nhưng luồng còn gồm các
    // thao tác người làm trên màn quản lý học viên (duyệt phiếu, chặn LMS, đặt lại
    // mật khẩu). Khai mỗi `he_thong` khiến chúng thành việc không ai làm được.
    actorRoles: ['he_thong', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
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
    // Phase 5 (plan 260723-1422): a receipt-approval cycle activates a
    // student's first Enrollment, then sale looks the now-active student up
    // by NAME (student.lookup, /admin/students's own search key) on Xếp lớp
    // and places them into a SECOND class via a real enrollment.enroll click
    // — real intersection with enrollment.enroll + finance.receiptApprove +
    // student.lookup + both uiRoutes. `enrollment.blockLms`/`student.get`/
    // `student.getManyByIds`/`student.resetPassword` have no admin UI
    // consumer today (grepped `apps/admin/src`) — a real manifest/UI drift
    // this journey does not paper over, documented in its own header.
    journey: 'apps/e2e/tests/journeys/enrollment-second-class.journey.ui.spec.ts',
  },
  {
    id: 'P1-06',
    displayName: 'Liên kết phụ huynh–con',
    cluster: 'P1',
    // Phụ huynh gửi yêu cầu liên kết, nhưng người DUYỆT là nhân sự trên màn
    // /admin/parents — phụ huynh không tự duyệt yêu cầu của chính mình.
    // `guardian.approveLink` cố ý mở cho cả 4 vai.
    actorRoles: ['phu_huynh', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
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
      // Sửa 2026-07-24: khai cũ (`requestOtp`/`verifyOtp`/`enrollment.mine`) không
      // procedure nào được UI gọi — màn đăng nhập phụ huynh dùng BIẾN THỂ EMAIL
      // (`login.tsx:51,61`). Kiểm chứng: `rg "lmsAuth\.requestOtp\b" apps/lms/src`
      // → 0 matches; `rg "enrollment\.mine" apps/lms/src` → 0 matches.
      // `enrollment.mine` chuyển sang DOCUMENTED_GAPS trong verify.ts vì nó là
      // capability thật nhưng chưa màn nào gọi.
      trpc: ['lmsAuth.requestOtpEmail', 'lmsAuth.verifyOtpEmail'],
      uiRoutes: ['/login', '/parent/home'],
      models: ['LoginOtp'],
    },
    journey: 'apps/e2e/tests/journeys/lms-parent-otp-login.journey.ui.spec.ts',
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
    // Không có đường UI cho CẢ hai thao tác — không viết journey được (triage
    // 2026-07-24, tự kiểm lại 2026-07-25). Bằng chứng:
    //   rg "trpc\.finance\.receiptCancel\b" apps/admin/src apps/lms/src → 0 matches
    //   rg "trpc\.finance\.refundCreate\b"  apps/admin/src apps/lms/src → 0 matches
    //   refund.tsx không gọi tRPC nào — là EmptyState "Tính năng chưa áp dụng".
    // Entry nav /finance/refund đã bị gỡ CÓ CHỦ Ý (nav-registry.ts, mục "Hoàn
    // tiền": màn chưa xây → không để GĐKD bấm vào trang trống ngày go-live).
    // Chờ plan sửa xây màn; khi đó gắn journey + khôi phục entry.
    statusReason: {
      code: 'no-ui-path',
      detail:
        'Huỷ + hoàn tiền chưa có màn UI: rg receiptCancel/refundCreate trong apps/admin+lms = 0 matches; ' +
        '/finance/refund là EmptyState, entry nav gỡ chủ ý (nav-registry.ts).',
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
      // `audit.list` đã bỏ khỏi luồng này (2026-07-23): đo thực tế nó CHỈ được gọi ở
      // apps/admin/src/pages/admin/audit-log.tsx — tức màn /admin/audit-log thuộc
      // ADM-04. Màn /ops/recon của luồng này chỉ gọi reconciliation.*.
      trpc: ['reconciliation.listFlags', 'reconciliation.action', 'reconciliation.dismiss'],
      uiRoutes: ['/ops/recon'],
      models: ['ReconciliationFlag'],
    },
    // Journey: sale tạo phiếu >20M → GĐĐT (second-eye) duyệt → worker recon
    // sinh cờ exceeds_threshold → GĐKD mở /ops/recon THẤY cờ. Dùng rule 2
    // (exceeds_threshold) vì rule 1 (self_approved) KHÔNG chạy được qua UI:
    // canApprove=notSelf ẩn nút duyệt với chính người tạo (finance/router.ts) →
    // một người không tự tạo-rồi-tự-duyệt trên màn được. Phủ hẹp có chủ ý:
    // journey drive listFlags (màn /ops/recon load cờ) + chứng minh vòng
    // phát-hiện→hiển-thị; action/dismiss chưa drive (H2 hợp lệ, phủ hẹp).
    journey: 'apps/e2e/tests/journeys/recon-exceeds-threshold.journey.ui.spec.ts',
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
    // Không màn nào tạo lớp / tự sinh lịch buổi qua UI (tự kiểm 2026-07-25):
    //   rg "classBatch\.create|schedule\.generateSessions|course\.create" apps/admin/src apps/lms/src → 0 matches
    // /admin/classes chỉ LIỆT KÊ + xem chi tiết; không có form tạo. Seed lớp
    // (seedClassBatch) chính là cơ chế P2-01 tồn tại để chứng minh (auto sinh
    // buổi) → user V5 chốt: dữ liệu trơ thì seed, cơ chế thì không → không viết
    // journey. Chờ plan sửa xây màn tạo lớp.
    statusReason: {
      code: 'no-ui-path',
      detail: 'Không có UI tạo lớp/sinh lịch: rg classBatch.create|schedule.generateSessions apps/admin+lms = 0; /admin/classes chỉ xem.',
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
    // Màn điểm danh CÓ trong nav (GV) nhưng đòi `?session=<id>` mà KHÔNG link
    // in-app nào mang theo — vào từ menu là gặp empty-state "Vui lòng cung cấp
    // ?session". Tự kiểm 2026-07-25: rg "attendance\?session=" apps/admin/src →
    // chỉ có trong *.test.tsx, không có trong mã nguồn màn. User V5 từ chối S2
    // (cho journey goto thẳng ?session) → không tới được trạng thái dùng được
    // bằng menu → no-ui-path. Chờ plan sửa thêm session-picker / link mang session.
    statusReason: {
      code: 'no-ui-path',
      detail: 'Màn điểm danh đòi ?session= nhưng không link in-app nào mang theo (rg attendance?session= chỉ ở test); S2 goto bị từ chối.',
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
    // "Mở bài theo tiến độ" cần gán unit vào buổi để mở tier cho học viên —
    // không màn nào làm việc đó. Tự kiểm 2026-07-25: rg
    // "classSession\.assignUnit|assignUnit" apps/admin/src apps/lms/src → 0
    // matches (curriculumUnitId chỉ xuất hiện ở FORM tạo bài — thuộc P2-04,
    // không phải gán vào buổi). User V5 từ chối S3 (seed session→unit) vì đó là
    // cơ chế open-tier chính P2-03 phải chứng minh → no-ui-path.
    statusReason: {
      code: 'no-ui-path',
      detail: 'Open-tier (gán unit vào buổi) không có UI: rg classSession.assignUnit apps/admin+lms = 0; S3 seed session→unit bị từ chối.',
    },
  },
  {
    id: 'P2-04',
    displayName: 'Cung cấp bài tập PDF',
    cluster: 'P2',
    // PO chốt 2026-07-22: chỉ GĐĐT ra đề bài tập. `giao_vien` từng được khai là
    // actor nhưng cả 5 procedure của luồng đều gate `exercise.manage` (GĐĐT-only)
    // — giáo viên không gọi được gì, cũng không thấy menu. Sửa manifest cho đúng
    // thực tế thay vì nới quyền.
    actorRoles: ['giam_doc_dao_tao'],
    expected: {
      // TL25 đã sync 2026-07-18: /curriculum/:unitId/exercises → /teaching/exercises
      // (không có prefix /curriculum). exercise.list/close + curriculumUnit.list = màn soạn bài (E1).
      trpc: ['exercise.create', 'exercise.publish', 'exercise.close', 'exercise.list', 'curriculumUnit.list'],
      uiRoutes: ['/teaching/exercises'],
      models: ['Exercise', 'CurriculumUnit'],
    },
    // Journey: GĐĐT tạo bài tập (chọn unit từ curriculumUnit.list + loại + UPLOAD
    // PDF thật qua /upload/exercise-pdf) → Publish → Đóng. Drive đủ 5 procedure
    // khai (create/publish/close/list/curriculumUnit.list) + exercise.manage
    // (upload). Unit seed unique (dữ liệu trơ, user đã duyệt seed loại này) để
    // nhận diện đúng row. Vòng draft→published→closed đọc lại từ row là bằng
    // chứng sống.
    journey: 'apps/e2e/tests/journeys/exercise-publish-close.journey.ui.spec.ts',
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
    // Học viên chỉ nộp được khi bài đã mở (open-tier) — mà open-tier không có UI
    // (xem P2-03). Seed submission (S4, đã duyệt) là để CHẤM ở P2-06, không
    // chứng minh được thao tác NỘP của học viên (đó chính là cơ chế P2-05). Nên
    // P2-05 no-ui-path tới khi open-tier có màn (plan sửa).
    statusReason: {
      code: 'no-ui-path',
      detail: 'Nộp bài phụ thuộc open-tier (P2-03) không có UI; seed submission (S4) chỉ phục vụ chấm P2-06, không chứng minh thao tác nộp.',
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
    // Journey: GV mở /teaching/grading (chỉ thấy bài của lớp mình sở hữu —
    // ownership filter server), chấm bài nộp → bài rời hàng đợi ungraded.
    // PHỦ 2/3 procedure khai: drive submission.grade + submission.listForGrading
    // qua UI thật. KHÔNG drive submission.saveTeacherAnnotation (ghi chú PDF —
    // ngoài đường của journey này). KHÔNG assert cộng-sao qua UI: màn grading
    // không có view bài đã chấm và banner "⭐ +1 sao" transient (refetch
    // unmount), nên StarTransaction chỉ chạy (side-effect của grade) chứ journey
    // không kiểm — luật cộng-sao-lần-đầu do server-test phủ
    // (attendance-grading.spec.ts). "proven" ở đây = đường chấm của GV chạy
    // thật, KHÔNG phải toàn bộ bề mặt khai. saveTeacherAnnotation + đuôi cộng-sao
    // là ứng viên mở rộng đợt sau.
    journey: 'apps/e2e/tests/journeys/grading-submission.journey.ui.spec.ts',
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
    // Phase 5 (plan 260723-1422, F2 regression — one of the 3 flows dead 16
    // days, docs/codebase-summary.md): teacher reaches this exact route via
    // real menuNav ('Giảng dạy' -> 'Nhận xét buổi học') and reads a non-empty
    // present roster — the uiRoute intersection with this flow's `expected`
    // block is exact and exclusive (no other flow entry lists
    // `/teaching/session-assessment`). The journey's own real trpc call is
    // `attendance.listBySession`/gate `attendance.mark` (this screen's actual
    // roster source, per its own header's incident finding), not this flow's
    // listed `assessment.*` procedures — a real, documented manifest/UI
    // naming drift (the roster read and the qualitative-comment write share
    // one screen but different procedures), not a wrong-flow attachment.
    journey: 'apps/e2e/tests/journeys/session-assessment-roster.journey.ui.spec.ts',
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
    // Journey NỬA GV: GV chọn lớp mình sở hữu + buổi → viết tóm tắt (upsert) →
    // UPLOAD ảnh thật (/upload/session-photo) → công bố. Drive sessionEvidence.
    // upsert/addPhoto/publish + classBatch.list/classSession.list qua UI thật;
    // ảnh load-bearing ("Ảnh đã upload (1)"). PHỦ HẸP có chủ ý: nửa phụ huynh
    // (listForChild, guardian.setPhotoConsent, /parent/evidence/:studentId) là
    // journey xuyên app — thuộc Phase 8 (đuôi LMS), chưa drive ở đây.
    journey: 'apps/e2e/tests/journeys/session-evidence-publish.journey.ui.spec.ts',
  },

  // ─────────────────────────────── P3 — Nhân sự & lương ───────────────────────────────
  {
    id: 'P3-01',
    displayName: 'Chấm công cặp vào/ra mỗi ngày',
    cluster: 'P3',
    // "nhân viên" trong TL25 nghĩa là nhân sự nói chung, không phải một vai —
    // `checkIn.punch` mở cho cả 4 vai đang hoạt động, ai cũng phải chấm công.
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
    expected: {
      trpc: ['checkInOut.punch'],
      uiRoutes: ['/hr/checkin'],
      models: ['TimePunch'],
    },
    // Phase 5 (plan 260723-1422): giao_vien reaches /hr/checkin via real
    // menuNav ('Nhân sự' -> 'Chấm công') and records a real punch — direct
    // 1:1 intersection with this flow's only trpc + only route.
    journey: 'apps/e2e/tests/journeys/checkin-punch.journey.ui.spec.ts',
  },
  {
    id: 'P3-02',
    displayName: 'Duyệt phiếu chấm công offsite',
    cluster: 'P3',
    // Gửi lại phiếu bị từ chối là owner-check (checkin/router.ts), không phải
    // một vai cố định: chủ phiếu tự gửi lại. Phiếu do GĐ sở hữu chỉ super_admin
    // duyệt được, nên tập chạy được thực tế là sale/giáo viên; GĐ ở đây là bên duyệt.
    actorRoles: ['sale', 'giao_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['manualPunch.approve', 'manualPunch.reject', 'manualPunch.resubmit', 'manualPunch.list'],
      uiRoutes: ['/hr/checkin'],
      models: ['ManualAttendanceTicket'],
    },
    // Phase 5 (plan 260723-1422): sale punches offsite (real ticket via
    // checkInOut.punch's own ensureDayTicket side effect — manualPunch.create
    // no longer exists, ADR 0043), drives manualPunch.list (both scopes) +
    // manualPunch.approve for real, PLUS the negation this flow's own note
    // describes — giam_doc_dao_tao's own inbox query never matches a
    // sale-track ticket (findInList.assertAbsent, checked against the real
    // `appUser.roles hasSome trackRoles` filter in checkin/router.ts, read in
    // full before wiring this).
    journey: 'apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts',
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
    // Phase 5 (plan 260723-1422, F4 regression — one of the 3 flows dead 16
    // days): a staff member created via the real /admin/users super_admin UI
    // shows up as a non-empty row on /hr/payroll's real `user.pickList` —
    // direct intersection with this flow's `user.pickList` + `/hr/payroll`.
    journey: 'apps/e2e/tests/journeys/payroll-roster.journey.ui.spec.ts',
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
    // Journey: NV (sale) mở /hr/my → bấm "Tính lại" (kpi.refresh, self-target,
    // không guard ngày-3) → thẻ điểm KPI thay banner "Chưa có phiếu KPI". Drive
    // kpi.refresh qua UI thật. NV là AppUser seed thật để ctx.subject có row
    // chấm điểm. Chuyển empty-state → thẻ điểm là bằng chứng sống.
    journey: 'apps/e2e/tests/journeys/kpi-refresh-my.journey.ui.spec.ts',
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
    // Worker `he_thong` chạy trong vòng lặp process — không procedure/route/UI
    // call-site. Tự kiểm 2026-07-25: rg "runDoneSweep|runCancelSweep"
    // apps/admin/src apps/lms/src → 0 matches. Không journey UI nào drive được
    // (user duyệt: no-ui-path, spec API-level thuộc plan sau). `evaluateSessionDone`
    // còn từ chối khi now < endTime → cần dữ liệu quá khứ.
    statusReason: {
      code: 'no-ui-path',
      detail: 'Worker nội bộ, không procedure/route/UI: rg runDoneSweep|runCancelSweep apps/admin+lms = 0; spec API-level thuộc plan sau.',
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
    // Worker `he_thong` (cancel-sweep) — cùng loại P3-10. Tự kiểm 2026-07-25:
    // rg "runDoneSweep|runCancelSweep" apps/admin/src apps/lms/src → 0 matches.
    // Cancel-sweep cần `endTime + 24h` → dữ liệu quá khứ; không journey UI nào
    // drive được (user duyệt: no-ui-path, spec API-level thuộc plan sau).
    statusReason: {
      code: 'no-ui-path',
      detail: 'Worker nội bộ (cancel-sweep), không UI: rg runDoneSweep|runCancelSweep apps/admin+lms = 0; cần dữ liệu quá khứ (+24h); spec API-level plan sau.',
    },
  },

  // ─────────────────────────────── P4 — Đổi quà & chăm sóc PH ───────────────────────────────
  {
    id: 'P4-01',
    displayName: 'Đổi quà bằng sao',
    cluster: 'P4',
    // Học viên đổi thưởng; nhân sự duyệt/giao — `rewards.manage`.
    actorRoles: ['hoc_vien', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
    expected: {
      // listForStudent = HV xem quà đổi được (E1).
      trpc: ['rewards.redeem', 'rewards.approve', 'rewards.deliver', 'rewards.reject', 'rewards.list', 'rewards.listForStudent'],
      uiRoutes: ['/admin/engagement/rewards', '/student/gifts'],
      models: ['Reward', 'StarTransaction'],
    },
    // Phase 5 (plan 260723-1422): admin-side half of this flow (`rewards.redeem`
    // is `hoc_vien`/LMS-only, explicitly out of scope here) — sale approves
    // then delivers a pending redemption on the real /admin/engagement/rewards
    // queue via menuNav ('Gắn kết' -> 'Đổi thưởng'), direct intersection with
    // rewards.approve/deliver/list + the admin uiRoute.
    journey: 'apps/e2e/tests/journeys/rewards-redeem-approval.journey.ui.spec.ts',
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
    // Phase 5 (plan 260723-1422): GĐKD creates a gift via the real "Thêm
    // phần thưởng" form on /admin/engagement/gifts (gift.upsert — direct
    // intersection), PLUS the negation this flow's own note is built
    // around — sale never sees the "Quà tặng" child entry in its own
    // side-nav (menuNav.assertEntryAbsent, verified against `gift.upsert`'s
    // real permission list in packages/auth/src/index.ts).
    journey: 'apps/e2e/tests/journeys/gift-config-nav.journey.ui.spec.ts',
  },
  {
    id: 'P4-03',
    displayName: 'Lên lịch & nhắc họp PH',
    cluster: 'P4',
    // Đây là họp CHĂM SÓC SAU BÁN theo từng học sinh (màn /crm/post-sale-meeting),
    // gate `parentMeeting.manage`. Lịch họp phụ huynh theo LỚP, có nhắc, cho giáo
    // viên xem để chuẩn bị là tính năng KHÁC và chưa xây: ParentMeeting không có
    // liên kết lớp, và cột nhắc đã bị bỏ. Backlog sau go-live (PO chốt 2026-07-23).
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
    expected: {
      // TL25 đã sync 2026-07-18: /parent-meetings KHÔNG tồn tại → /crm/post-sale-meeting.
      // ~~GAP: page là EmptyState chưa gọi API~~ — SAI TỪ 2026-07-23: màn đã được
      // wire (commit 5408ad2), post-sale-meeting.tsx gọi parentMeeting.list ở :65 và
      // dùng đủ schedule/complete/cancel. Chú thích cũ mô tả trạng thái đã hết hạn.
      trpc: ['parentMeeting.list', 'parentMeeting.schedule', 'parentMeeting.complete', 'parentMeeting.cancel'],
      uiRoutes: ['/crm/post-sale-meeting'],
      models: ['ParentMeeting'],
    },
  },
  {
    id: 'P4-04',
    displayName: 'Đặt lịch test đầu vào/định kỳ',
    cluster: 'P4',
    // PO chốt 2026-07-23: giáo viên chỉ làm việc đã được xếp sẵn, không đặt lịch
    // kiểm tra đầu vào. Mọi procedure của luồng gate `testAppointment.manage`,
    // vốn không cấp cho giáo viên — manifest khai sai actor, không phải thiếu quyền.
    actorRoles: ['sale'],
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
    // Journey: super_admin tạo cơ sở (dialog Thêm cơ sở) → sửa tên (click row →
    // dialog Sửa tên). Drive đủ 3/3 procedure (create/list/update) qua UI thật.
    // Không có facility.delete (T3) → afterAll xoá cơ sở tạo ra qua
    // deleteFacilityByCode (privileged), không để rác — đã xác minh 0 leak.
    journey: 'apps/e2e/tests/journeys/facility-admin-crud.journey.ui.spec.ts',
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
    // Journey: super_admin tạo tài khoản nhân sự (form Thêm nhân viên) → gán vai
    // trò qua modal Roles (MultiSelector). Drive 3/4 procedure: user.create,
    // user.list, user.updateRoles. `user.update` (setter managerId) KHÔNG có UI
    // — drift THẬT của ADM-02: rg "user\.update\b" apps/admin/src → 0 matches
    // (khác user.updateRoles có UI). Không journey nào drive được; ghi sổ bàn
    // giao. Chuyển badge vai trò từ vắng→hiện là bằng chứng sống.
    journey: 'apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts',
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
    // Journey: super_admin thêm dải IP (self-detect + nhập CIDR) → sửa nhãn →
    // xoá. Drive đủ 5/5 procedure (create/detectMyIp/list/update/delete) qua UI
    // thật. KHÔNG bấm "Bật" (T2): dải ĐANG BẬT làm punch báo offsite → hỏng
    // P3-01; dải tạo ra luôn ở trạng thái tắt rồi bị xoá. Vòng thêm→sửa→xoá đọc
    // lại từ row là bằng chứng sống.
    journey: 'apps/e2e/tests/journeys/network-ip-config.journey.ui.spec.ts',
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
    // Journey: HAI super_admin mỗi người làm 1 hành động có audit
    // (facilityNetwork.create ghi actor=userId). Lọc "Người thực hiện" theo actor
    // A → entry A HIỆN, entry B VẮNG. Chứng minh bộ lọc thật sự cô lập theo actor
    // (không chỉ là entry mới nhất của A nổi lên đầu — audit.list sort desc,
    // không scope facility). Drive audit.list qua UI thật.
    journey: 'apps/e2e/tests/journeys/audit-log-view.journey.ui.spec.ts',
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
    // Journey: super_admin tạo nhóm ca → thêm mẫu ca vào đúng nhóm đó (form
    // per-group) → tab "Chính sách phạt" lưu 2 mức phạt. Drive đủ 5/5 procedure
    // (createGroup/listGroups/createTemplate/compensationPolicy.get/upsert) qua
    // UI thật. Nhóm seed sẵn nên nhận diện nhóm của run bằng tên unique; mẫu ca
    // hiện trên card + banner "Đã lưu chính sách phạt." là bằng chứng sống.
    journey: 'apps/e2e/tests/journeys/shift-config-admin.journey.ui.spec.ts',
  },
];
