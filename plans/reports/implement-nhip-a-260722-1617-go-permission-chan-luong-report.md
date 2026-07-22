# Nhịp A — gỡ 3 lỗi phân quyền chặn luồng (Phase 1–3)

Plan: `plans/260722-1114-go-permission-va-do-runtime/plan.md`
Ngày: 2026-07-22 · Branch `main` · Baseline code `4237cb5` (3 commit sau đó chỉ là chore/docs)

## Kết quả

3 lỗi chặn luồng đã gỡ, chứng minh bằng **test + probe HTTP trên server thật**, không chỉ unit test.

| Lỗi | Trước | Sau |
|---|---|---|
| F1 `/finance/new` | không vai nghiệp vụ nào chọn được lớp ⇒ không thu được học phí | sale/GĐKD gọi `classBatch.list` OK |
| F2 `/teaching/session-assessment` | GV thấy menu, dropdown rỗng im lặng | GV gọi `classBatch.list` + `classSession.list` OK |
| F4 `/hr/payroll` | GĐKD/GĐĐT mở màn nhưng danh sách nhân viên rỗng | `user.pickList` OK cho đúng 2 giám đốc |

## Thay đổi registry

| Key | Roster | Lý do |
|---|---|---|
| `class.read` | GĐKD, GĐĐT, sale, GV | tách **đọc** khỏi **tạo** lớp |
| `classRoster.read` | GV, GĐĐT | `listStudents` trả họ tên trẻ ⇒ hẹp hơn `class.read` (Q3′) |
| `staff.pickList` | GĐKD, GĐĐT | key **riêng**, không mượn quyền tiền (S4) |

`class.create` **không đổi** (vẫn chỉ GĐĐT) — Q5 giữ nguyên. `finance.receiptCreate` không cấp cho GĐĐT — ADR-B giữ nguyên.

## Bằng chứng runtime (probe HTTP, server đọc `dist/`)

Server `tsx src/server.ts` chạy trên DB throwaway, header `x-dev-user`:

```
sale                classBatch.list         200 OK
giao_vien           classBatch.list         200 OK
giam_doc_kinh_doanh classBatch.list         200 OK
giam_doc_dao_tao    classBatch.list         200 OK

sale                classBatch.listStudents 403 FORBIDDEN   ← PII trẻ em, đóng ở tầng API
giam_doc_kinh_doanh classBatch.listStudents 403 FORBIDDEN
giao_vien           classBatch.listStudents 200 OK
giam_doc_dao_tao    classBatch.listStudents 200 OK

sale                user.pickList           403 FORBIDDEN
giao_vien           user.pickList           403 FORBIDDEN
giam_doc_kinh_doanh user.pickList           200 OK
giam_doc_dao_tao    user.pickList           200 OK

sale                classBatch.create       403 FORBIDDEN   ← Q5 giữ
giao_vien           classBatch.assignTeacher 403 FORBIDDEN
giam_doc_dao_tao    finance.receiptCreate   403 FORBIDDEN   ← ADR-B giữ
giam_doc_kinh_doanh finance.receiptCreate   404 NOT_FOUND   ← qua được gate, chết ở business logic (đúng)
```

Đã chạy `pnpm --filter @cmc/auth build` trước khi probe (R3-3: test đọc `src`, server đọc `dist`).

## Việc ngoài kế hoạch — hạ tầng DB test

Plan giả định DB `cmc_edu` qua socat `localhost:15432`. Thực tế trên máy này:
- container `cmc-test-db-socat` **không còn tồn tại**
- DB `cmc_edu` **không tồn tại** trên `cmcv2-prod-postgres-1` (chỉ có `cmc_prod`)
- `cmcv2-prod-postgres-1` đang publish `0.0.0.0:5432` — cùng cluster với dữ liệu trẻ em thật
- `node_modules` chưa cài; Prisma client chưa generate (pnpm 10.24 bỏ qua `pnpm.onlyBuiltDependencies` ⇒ postinstall không chạy)

Đã dùng **`scripts/synthetic-seed-env.sh`** (thẩm quyền có sẵn trong repo) thay vì tự dựng: nó chạy container **riêng** `cmc-synth-pg:55432`, DB `cmc_synth`, và tự từ chối stack `cmcv2-prod-*`. Chọn hướng này thay vì tạo `cmc_edu` trong cluster prod vì nó **triệt tiêu** kịch bản Critical S1 (teardown chạy nhầm URL chạm dữ liệu thật) — cluster test không có dữ liệu thật nào.

Không sửa file `env` của người dùng.

## Ngoài scope plan nhưng đã sửa (có lý do)

1. **`cockpit.tsx:210`** — panel "Lịch dạy hôm nay" chỉ render cho GV nhưng gate bằng `canDo('class','create')` mà GV không bao giờ có ⇒ panel **chưa từng hiện** cho đúng đối tượng. Đổi sang `class.read`.
2. **`assignTeacher` + `create` teacher-resolve** — gộp về `resolveTeacher()`, assert vai `giao_vien` **phía server** (S5). Trước đó gán được `sale` làm giáo viên ⇒ giờ dạy cộng vào payroll/KPI cho người không dạy.
3. **Exhaustiveness cho `ACTIVE_ROLE_MATRIX`** (#25) — thêm 2 assertion: matrix ≡ registry keys, và roster khớp từng key. Trước đó key mới land với zero coverage mà CI vẫn xanh.
4. **`isNavChildVisible` / `visibleNavPathsFor`** tách khỏi `shell.tsx` — để test nav đi qua **đúng** hàm shell chạy, không phải bản sao (chống "test giả" mà plan cảnh báo).
5. **3 nav entry khác** cũng phân loại và gate theo đúng thứ trang gọi: `/teaching/schedule` → `class.read`, `/teaching/session-evidence` → `sessionEvidence.upsert`, `/ops/revenue` → `finance.receiptList`.

## Đổi hợp đồng có chủ đích

- Nhóm nav **"Tài chính & Điều hành"** giờ **biến mất** với vai không có quyền tài chính nào. Trước đây entry `/ops/revenue` không gate nên giữ cả nhóm hiện cho mọi vai. Test cũ khẳng định hành vi cũ — đã sửa test kèm lý do, không nới lỏng.
- `user.pickList` **không** lọc `isActive` (giống `user.list` cũ): nhân viên nghỉ giữa kỳ vẫn phải chốt được bảng lương cuối. Procedure thu hẹp **field**, không thu hẹp **row**.

## Validation

| Gate | Kết quả |
|---|---|
| `pnpm test` | **22/22 task xanh** — api 977, admin 348, ui 45, domain-* … |
| `pnpm typecheck` | 26/26 xanh |
| `pnpm lint` | sạch |
| `pnpm acceptance:report` | 38 luồng, 38 built, **1 orphan (documented), 0 chưa phân loại**, exit 0 — đúng baseline |
| Probe HTTP 4 vai | bảng trên |
| `detect_changes` | 30 symbol, 6 process, risk **HIGH** — đúng dự kiến với thay đổi registry; cả 6 process đều là màn đã sửa có chủ đích |

TDD đã chạy đúng thứ tự: 6 negative **xanh sẵn**, 7 positive **đỏ** (tái hiện F1/F2 thành test đỏ) → sửa → 13 xanh.

## Một điều tra sai hướng, đã tự sửa

`submission/grade.test.ts` (atomic-lock, 2 lượt chấm đồng thời) đỏ sau lần chạy full-suite đầu. Đo lần đầu: **3/3 đỏ có thay đổi, 3/3 xanh khi stash** ⇒ trông như hồi quy do tôi. Bisect chỉ vào đúng 1 dòng `classSession.list` — vô lý, vì file test đó **không gọi** procedure nào của class.

Chạy lại theo kiểu **xen kẽ A/B/A/B** (khử trôi theo thời gian): **cả hai đều xanh**. Kết luận: test này nhạy với tải/timing — nó đòi 2 request **thật sự đua nhau**; khi máy đang tải (ngay sau full suite) chúng **serialize**, lượt hai đọc trạng thái đã `graded` rồi update tiếp ⇒ cả hai thành công **đúng theo logic hiện tại**. Đây là **flaky có sẵn**, không phải hồi quy — và cũng không phải lỗi giả: cùng cơ chế đó nghĩa là lock chỉ chặn khi thực sự có đua.

**Khuyến nghị (chưa làm, ngoài scope):** test này nên ép đua bằng barrier/advisory lock thay vì dựa vào `Promise.allSettled` — hiện nó có thể xanh giả trên CI chậm.

## Rủi ro còn lại

- **Nav gate và page guard là lớp client.** Đã ghi rõ: đường rò PII thật đã đóng ở **tầng API** bằng `classRoster.read`, không dựa vào UI. Phần Phase 2 chỉ giảm bề mặt.
- **GV đọc được roster mọi lớp**, rộng hơn `assert-teacher-owns-class.ts`. Siết theo lớp được phân công là việc riêng nếu có yêu cầu tuân thủ.
- **Chưa deploy.** Khi deploy phải **deploy api và admin cùng lúc** (`PERMISSIONS` được Vite bake vào bundle browser) và **build lại `@cmc/auth`** — revert `src` không đủ.
- 28 call site `canDo()` đã rà hết cho `class.create` (chỉ 1: cockpit). Chưa rà cho các key khác.

## Câu hỏi còn chờ PO

1. Gate `acceptance:report` trong CI: **chặn merge** hay cảnh báo?
2. Runtime capture (Phase 5) chạy **mọi PR** hay **nightly + trước release**?
3. `/finance/refund` là EmptyState nhưng P1-08 đếm `built` — sửa cách đếm hay xây nốt màn?
4. Actor thật của 4 luồng khai `nhan_vien` (P3-01, P3-02, P4-01, P4-03)?
5. Nhóm nav "Tài chính & Điều hành" giờ ẩn hoàn toàn với GV — xác nhận đúng ý sản phẩm?
6. `/finance/class-placement` vẫn **không có nav entry** — vào từ đâu, hay cần thêm entry? (Q4′ nói không cần guard, nhưng vấn đề khám phá chưa giải.)
