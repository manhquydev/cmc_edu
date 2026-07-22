# Hướng triển khai sau red-team: sửa cái đã biết, rồi đo phần còn lại

**Ngày:** 2026-07-22 · **Commit:** `4237cb5` (main, sạch) · **Loại:** brainstorm điều hướng
**Tiền đề:** 3 báo cáo cùng phiên — nghiệm thu hoài nghi (`...0848`), gốc rễ vòng 1 (`...0908`, đã đính chính), deep-dive vòng 2 (`...1030`)

---

## 1. Quyết định của PO trong phiên này

| # | Quyết định | Hệ quả |
|---|---|---|
| Q1 | **Chưa live**, đang chuẩn bị go-live | F1 khẩn theo nghĩa *chặn go-live*, không phải *đang mất tiền*. Đủ thời gian làm đúng thay vì vá gấp. |
| Q2 | **Hướng C** — sửa cái đã biết, rồi đo phần còn lại | Chia 2 nhịp, không gộp thành một plan khổng lồ |
| Q3 | **Giữ `class.read` gộp 1 quyền** (không tách `classRoster.read`) | Chấp nhận: sale đọc được tên học sinh mọi lớp; GV đọc roster ngoài lớp mình dạy. Bù bằng nav gate. Xem §5. |

---

## 2. Vì sao không kéo plan cũ sang

Plan `260722-0908-acceptance-role-true-evidence` có **29 finding, 27 chưa áp, nền sai** (tiền đề Phase 5/6 bị bác bỏ bằng chứng cứ). Vá 27 finding lên một nền sai đắt hơn viết lại từ chẩn đoán đã sắc.

→ Plan đó nên chuyển **superseded**, giữ lại làm hồ sơ red-team (bảng 29 finding vẫn là tài sản: mỗi mục có `file:line`).

**Những gì từ plan cũ được mang sang:** chẩn đoán Phase 2 (đã được cả 4 reviewer xác nhận đúng từng dòng), và toàn bộ bảng finding làm checklist.

---

## 3. Nhịp A — gỡ 3 lỗi đã biết

**Nguyên tắc: không chạm e2e, không chạm CI, không chạm branch.** Nhịp này verify được bằng probe API + mở màn thật — cách đã chứng minh hoạt động trong phiên brainstorm (tìm ra F1/F2 bằng đúng quy trình đó).

| Việc | Nội dung | Verify |
|---|---|---|
| A1 | Thêm `class.read` cho `sale/GĐKD/GV/GĐĐT`; đổi 4 procedure **đọc** (`classBatch.list/get/listStudents`, `classSession.list`) sang nó. `create`/`assignTeacher` **giữ** `class.create` (chỉ GĐĐT) | Negative: `sale` gọi `classBatch.create` → FORBIDDEN. Positive: `sale` gọi `classBatch.list` → OK |
| A2 | Thêm `permission:` cho nav entry `/admin/classes`; **rà cả 8 nav entry không có gate** | Mở `/admin/classes` bằng `sale` → không thấy menu, vào bằng URL → không render surface quản trị |
| A3 | `/hr/payroll` — thay `user.list` (đòi `user.manage: []`) bằng procedure hẹp trả đúng 4 field `payroll.tsx:416-420` dùng (`id, fullName, employeeCode, position`) | GĐKD mở `/hr/payroll` thấy danh sách nhân viên |
| A4 | Bổ sung `class.read` vào `packages/auth/src/index.test.ts` `ACTIVE_ROLE_MATRIX` | Không có assertion exhaustiveness → quyền mới sẽ land với zero coverage mà CI vẫn xanh (red-team #25) |
| A5 | Cập nhật `docs/14` + comment `class-batch-router.ts:112-114` (đang khai một quyết định vừa bị đảo) | Đọc lại, không còn mô tả sai |

**Rollback đã xác định** (red-team #5): revert 1 commit `packages/auth/src/index.ts` + 4 router; **deploy api và admin cùng lúc** — `PERMISSIONS` được `can()` dùng cả ở browser (`session-context.tsx:35`), Vite bake lúc build. Không migration, không cần invalidate session (cookie mang role, không mang permission).

**Cạm bẫy thứ tự deploy:** deploy API trước → sale/GV không thấy nav entry cho màn vừa mở, dễ bị "sửa" bằng cách nới `class.create` — đúng thứ Q3 cấm.

---

## 4. Nhịp B — đo phần còn lại + dựng nền

Ba việc, làm được song song một phần.

### B1 — Vá `cleanupFacility` (tiền đề bắt buộc)
Cherry-pick từ branch `test/independent-runtime-verification-38-flows` (đã xác minh có thật: thêm `deleteMany` cho `reconciliationFlag/afterSaleCase/parentMeeting/testAppointment/reward/gift/kpiScore/payslip/qualitativeAssessment/sessionEvidence...` kèm residue-count guard).

> ☢️ **Không chạy bất kỳ e2e mới nào tạo `QualitativeAssessment`/`SessionEvidence` trước B1.** Teardown hiện tại ném FK error → rò nguyên facility trên `cmc_edu`, DB dùng chung giữa các phiên/agent.

### B2 — Runtime capture (thứ chính)
Mở từng màn bằng từng vai mà nav mở cho họ, thu mọi request tRPC + status. Bất kỳ `403` = lỗi.

- **Quy mô đã tính:** 19 nav entry có gate + 8 không gate → **62 tổ hợp**, ~2s mỗi lần → **~2 phút**.
- **Hạ tầng có sẵn:** project `ui-chromium`, `mintStaffCookie`, preview server.
- **Rủi ro DB thấp:** capture chỉ điều hướng và đọc, không mutation — nhẹ hơn nhiều so với spec nghiệp vụ.
- **Phép thử chua (bắt buộc):** chạy trên commit **trước nhịp A** → phải tự tìm ra F1 và F2 mà không được mớm. Không đạt → hướng này chưa đủ, dừng lại xét lại thay vì đi tiếp.

### B3 — Cho gate một chỗ để chạy
Hiện `ci.yml` chỉ có typecheck/test/coverage: **không lint, không `acceptance:report`, không e2e**. Và `verify.ts` chưa từng exit non-zero. Nghĩa là mọi gate đề xuất trước đây đều chỉ là chữ trên màn hình.

- Đưa `scripts/` vào lưới typecheck + lint (hiện nằm ngoài `pnpm-workspace`, chạy `tsx` transpile-only).
- Thêm `acceptance:report` vào CI; quyết định chặn merge hay cảnh báo (**câu hỏi còn mở**).

---

## 5. Rủi ro đã biết và được chấp nhận (Q3)

PO chọn giữ `class.read` gộp. Ghi lại để mở lại được khi cần:

- `classBatch.listStudents` trả `fullName` của **trẻ em**; sau A1, `sale` đọc được roster mọi lớp trong cơ sở.
- `giao_vien` đọc được roster **ngoài lớp mình dạy** — rộng hơn `assert-teacher-owns-class.ts` đang áp cho `attendance.listBySession`.
- **Giảm nhẹ trong nhịp A:** nav gate (A2) chặn đường vào UI; RLS `facilityId` vẫn chặn cross-facility.
- **Mở lại khi nào:** có yêu cầu tuân thủ dữ liệu trẻ em, hoặc mở rộng vai `sale` ra ngoài cơ sở hiện tại.

---

## 6. Cái gì **chưa** làm ở đợt này

Đưa vào plan riêng, sau khi B2 cho dữ liệu thật:

- Actor contract (`actorRoles: FlowActor[]` xây trên `ActiveRole`, không phải `Role`) + assertion actor↔permission — hoãn vì assertion trên `expected.trpc` **mù với chính F1/F2**; thiết kế lại sau khi biết dependency thật từ B2.
- Placeholder detection (F7) + họ thứ hai `ComingSoon` → "Đang phát triển".
- Merge branch runtime-verification + cấp lại `proven`.
- Chống bắc cầu id trong spec (một identity mỗi `test()`).
- P2-07 tách 2 chặng staff/LMS — 17 `lmsProcedure` cố ý không kiểm `can()`, nên "một vai đi trọn luồng" bất khả thi như manifest định nghĩa.

---

## 7. Tiêu chí nghiệm thu đợt này

- [ ] `sale` và `GĐKD` tạo được phiếu thu qua UI `/finance/new` trọn vẹn (chọn được lớp, submit thành công)
- [ ] `giao_vien` chọn được lớp ở `/teaching/session-assessment`
- [ ] `GĐKD` thấy danh sách nhân viên ở `/hr/payroll`
- [ ] `sale` gọi `classBatch.create` → FORBIDDEN; `GĐĐT` gọi `finance.receiptCreate` → FORBIDDEN (ADR-B còn nguyên)
- [ ] `sale` không vào được surface quản trị `/admin/classes`
- [ ] `cleanupFacility` vá xong, chạy e2e không để lại facility rò
- [ ] Runtime capture chạy được 62 tổ hợp và **tự tìm ra F1/F2 trên commit trước nhịp A**
- [ ] `scripts/` nằm trong lưới typecheck + lint; CI chạy `acceptance:report`
- [ ] `pnpm typecheck` + `lint` + `test` xanh

---

## 8. Câu hỏi chưa có lời giải

1. Gate mới **chặn merge** hay chỉ cảnh báo?
2. Runtime capture chạy ở đâu — mọi PR (chậm), hay nightly + trước release (rẻ, lỗi lọt lâu hơn)?
3. `/finance/refund` placeholder: sửa cách đếm hay xây nốt màn hoàn tiền?
4. Actor thật của 4 luồng khai `nhan_vien` (P3-01, **P3-02**, P4-01, P4-03) — P3-02 khó nhất vì `manualPunch.resubmit` cố ý không có registry key.
5. Plan `260722-0908` chuyển `superseded` hay `cancelled`?
