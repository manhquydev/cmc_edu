# Brainstorm Report — Fix P1-07 Login Redirect + Synthetic-Seed Env (mở gate Phase 4)

- Date: 2026-07-18 05:19 · Session: /brainstorm · Status: user điều hướng thẳng vào pipeline plan (chấp nhận khuyến nghị B)
- Predecessors: 260717-1213 (v1 engine, Phase 4 GATED), 260718-0423 (38-flow coverage DONE ff5c401)
- Input: acceptance-report/verification.json @ ff5c401 — 38/38 built, 2 documented gaps, 0 untriaged

## 1. Problem Statement

Tầng sự thật tĩnh đã bão hoà (100% coverage). Toàn bộ 38 luồng dừng ở ◐ "đã xây, chưa chứng minh";
cột ⬤ = 0. Giá trị còn lại duy nhất = tầng bằng chứng động (Phase 4, spec sẵn + red-team 2 vòng),
đang GATED bởi 3 điều kiện: (1) v1 dùng thật với giám đốc — việc của PO, không phải dev;
(2) môi trường DB synthetic-seed — CHƯA tồn tại; (3) ≥1 luồng P1 có UI path pass — chặn bởi
bug thật P1-07.

**Bug P1-07** (đã chẩn đoán sẵn trong lms-login.ui.spec.ts:157-168): server trả
`mustChangePassword: true` đúng, nhưng `apps/lms/src/pages/student/change-password.tsx:30`
bounce về `/student/home` — `if (session && !session.mustChangePassword)` đọc useSession()
context chưa kịp phản ánh session vừa set ở first-render sau navigate(). Race condition UI,
legacy code, pre-Astryx. Đây là bug sản phẩm thật chặn phụ huynh đổi mật khẩu mặc định
(`Cmc2026@`) lần đầu — đáng fix bất kể agenda dashboard.

## 2. Options Evaluated

| # | Option | Verdict |
|---|---|---|
| A | Chỉ fix P1-07 | Đúng nhưng thiếu — env vẫn chặn gate 2 |
| B | A + dựng synthetic-seed env (throwaway DB + sentinel seed.mjs + validate) | **Chọn** — sau đợt này gate 2+3 mở, chỉ còn gate 1 (PO-side); Phase 4 cook thẳng theo spec sẵn |
| C | A+B+implement evidence collector luôn | LOẠI — vi phạm gate 1 mà red-team đã chốt (implement 40% effort trước khi v1 dùng thật) |
| D | Dừng dev, PO dùng thật dashboard trước | Trình tự gate đúng nhưng để bug sản phẩm thật tồn đọng |

## 3. Scope (B)

1. **Fix bug P1-07**: root-cause race useSession-vs-navigate tại change-password.tsx:30
   (hypothesis sẵn — verify trước khi sửa, đúng nguyên tắc prove-before-fix); un-fixme test
   `correct default-password login redirects to mustChangePassword`; chạy UI spec xanh.
   Chú ý: file legacy pre-Astryx — fix tối thiểu race, không nhân tiện migrate UI.
2. **Synthetic-seed env**: sentinel Facility row (`__SYNTHETIC_SEED__`) vào
   `packages/db/prisma/seed.mjs` (spec Safety Gate 3 plan gốc đã chốt V1: sentinel = content
   không phải tên DB); script/quy trình dựng DB throwaway (local postgres, KHÔNG local-sim —
   local-sim chứa cmc_prod thật, CẤM per D6) + validate chạy seed + e2e thử trên env đó.
3. **Gộp**: quyết định 2 documented gaps (course.create, parentAccount.updateEmail) — PO chọn
   thêm WF TL25 hay chấp nhận admin utility (đưa vào validate interview của plan).

## 4. Acceptance Criteria

- Test P1-07 hết `test.fixme`, chạy PASS thật (PLAYWRIGHT_UI=1) — luồng đổi mật khẩu mặc định
  hoạt động end-to-end trên browser
- Không regression: 11 specs e2e cũ + admin/lms UI specs pass nguyên trạng; api tests xanh
- `seed.mjs` plant sentinel; có quy trình lặp lại được (script/README section) dựng DB throwaway
  synthetic-seed; verify sentinel query được qua APP_DATABASE_URL
- KHÔNG đụng local-sim/cmc_prod; KHÔNG implement evidence collector (Phase 4 vẫn gated chờ gate 1)
- Gate status sau đợt: điều kiện 2 ✅, 3 ✅, 1 ⏳ (PO-side)

## 5. Out of Scope

Evidence collector/screenshots (Phase 4 proper — có spec sẵn, cook sau khi gate 1 đạt);
migrate change-password.tsx sang Astryx; sửa OTP blocked-on-comms.

## 6. Risks

- **Fix race sai tầng** (sửa triệu chứng bằng setTimeout thay vì sửa session-context flow) →
  prove root cause bằng response/state capture trước; fix ở nguồn (session context cập nhật
  trước navigate, hoặc đọc mustChangePassword từ login response thay vì context).
- **Legacy file kéo theo refactor lan** → giới hạn diff vào change-password.tsx + điểm set
  session; --tdd giữ hành vi bằng test.
- **Seed.mjs đụng schema constraint Facility** (unique code…) → sentinel dùng field name/marker
  không đụng unique business codes; verify bằng chạy seed thật.

## 7. Next Steps

Pipeline bắt buộc (memory: cmc-plan-pipeline-mandate): `/ck:plan --tdd` (bug fix có test
characterization sẵn làm regression lock — un-fixme trước, fix đến xanh) → red-team → validate
→ lặp đến 0 Critical/High mới. 2 phases dự kiến: (P1) fix bug P1-07 TDD, (P2) synthetic-seed env
+ validate + gate-status update vào plan 260717-1213 phase-04.

## Unresolved Questions

- 2 documented gaps: thêm WF hay chấp nhận utility — đưa vào validate interview.
- DB throwaway đặt ở đâu: postgres container riêng vs database mới trên cùng local postgres
  instance (ngoài local-sim) — quyết trong plan theo ops quirks hiện có.
