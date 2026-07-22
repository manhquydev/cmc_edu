# Nghiệm thu hoài nghi — tình trạng thật của CMC EDU v2

**Ngày:** 2026-07-22 · **Commit:** `4237cb5` (main, worktree sạch) · **Người chạy:** Claude Code
**Yêu cầu:** chạy lại `acceptance-report`, nghi ngờ kết quả, tìm cách nghiệm thu chính xác nhất.
**Ảnh chứng cứ:** `plans/reports/assets-260722-acceptance/`

---

## 1. Kết luận một dòng

`acceptance-report` báo **38/38 luồng "built"** — con số đó **đúng nhưng không có nghĩa là hệ thống dùng được**.
Kiểm chứng thật phát hiện **2 luồng nghiệp vụ gãy hoàn toàn trên UI**, trong đó có **luồng tiền cốt lõi (P1-02: tạo phiếu thu học phí)** — không một vai trò nghiệp vụ nào hoàn thành được.

Cả 3 tầng kiểm thử hiện có (acceptance-report, 956 unit test, 21 e2e) **đều mù** trước lỗi này.

---

## 2. Các gate đã chạy lại (bằng chứng thật, không chép báo cáo cũ)

| Gate | Lệnh | Kết quả |
|---|---|---|
| acceptance-report | `pnpm acceptance:report` | 38 luồng, 38 built, 0 partial/missing, 1 orphan (đã triage), 0 unresolved namespace |
| typecheck | `pnpm typecheck` | PASS (exit 0) |
| lint | `pnpm lint` | PASS (exit 0) |
| unit + integration | `pnpm test` (DB `cmc_edu`) | **956/956 pass**, 102/102 file, 251s |
| e2e API-mode | `pnpm --filter @cmc/e2e test` | **20 pass, 1 skipped** (skip: `requestOtpEmail` cần `TEST_OTP_SEAM=1`) |
| e2e UI-mode | `... test --project=ui-chromium` | **6/6 pass** |

**Môi trường:** DB `cmc_edu` trong `cmcv2-prod-postgres-1`, qua socat `localhost:15432` (phải `docker start cmc-test-db-socat` — container này không sống sót qua restart máy). Không đụng `cmc_prod`.

**Một cạm bẫy đã gặp:** chạy `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test` (không `--project`) làm **cả 2 project chạy chung 1 DB**, spec API tạo phiếu thu → spec UI assert "danh sách rỗng" fail. Chạy đúng lệnh tài liệu (`--project=ui-chromium`) thì 6/6 pass. **Đây là lỗi giả do lệnh sai, không phải lỗi sản phẩm** — nhưng nó cho thấy suite UI phụ thuộc trạng thái DB rỗng, dễ đỏ giả trong CI dùng chung DB.

---

## 3. Tại sao "38/38 built" không đáng tin

### 3.1 Tool chỉ kiểm tra **sự tồn tại của tên**, không kiểm tra hành vi

`scripts/acceptance-report/verify.ts:62-69` — một luồng là "built" khi mọi tên trong `expected` xuất hiện trong code:

```
missingTrpc  = expected.trpc.filter(p => !scan.procedures.has(p))
missingRoutes= expected.uiRoutes.filter(r => !scan.uiRoutes.has(r))
status = totalMissing === 0 ? 'built' : ...
```

Không có gì kiểm tra procedure đó **chạy đúng**, ai **gọi được**, hay màn hình có **dùng được**.

### 3.2 Kỳ vọng được suy ra từ chính code → lập luận vòng tròn

`scripts/acceptance-report/flow-manifest.ts:2-4` tự khai:

> "expected.trpc/uiRoutes/models dùng GIÁ TRỊ THẬT đối chiếu trực tiếp scanner output (2026-07-18)"

Tức là danh sách kỳ vọng được chép từ output của scanner. Đối chiếu code với một danh sách lấy từ code thì **luôn khớp**. Nó đo "manifest có bị lệch code không" (hữu ích cho drift), **không** đo "sản phẩm có đúng yêu cầu không".

### 3.3 Manifest không liệt kê procedure phụ trợ mà màn hình thực sự gọi

P1-02 khai `expected.trpc: ['finance.receiptCreate']`. Nhưng màn `/finance/new` thực tế gọi **3 query**: `crm.opportunityGet`, `crm.opportunityLookup`, `classBatch.list`. Lỗ hổng nằm đúng ở query không được khai. Tool không thể thấy thứ nó không được kể.

### 3.4 Kiểm chứng tool bằng mutation test — phần này **tool làm tốt**

| Đột biến | Kỳ vọng | Thực tế |
|---|---|---|
| Đổi tên `finance.refundCreate` → `refundCreateXX` | P1-08 partial + 1 orphan mới | ✅ `37 built, 1 partial`, cảnh báo `finance.refundCreateXX` chưa phân loại |
| Đổi route `path: 'refund'` → `'refundXX'` | P1-08 partial | ✅ `37 built, 1 partial` |
| Khôi phục | 38 built | ✅ `38 built`, worktree sạch |

**Kết luận về tool:** scanner **không nói dối trong phạm vi nó đo**. Vấn đề là phạm vi đó quá hẹp so với chữ "nghiệm thu".

---

## 4. Phát hiện thật (đã kiểm chứng nhiều tầng)

### 🔴 F1 — CRITICAL: Không vai trò nào tạo được phiếu thu học phí (WF P1-02)

**Luồng tiền cốt lõi: tuyển sinh → thu học phí → kích hoạt tài khoản.**

Màn `/finance/new` có trường **"Lớp học" bắt buộc**, options nạp từ `classBatch.list`.

| Vai trò | `classBatch.list` (cần để chọn lớp) | `finance.receiptCreate` |
|---|---|---|
| `sale` | ❌ `Missing permission class.create` | ✅ |
| `giam_doc_kinh_doanh` | ❌ `Missing permission class.create` | ✅ |
| `giam_doc_dao_tao` | ✅ | ❌ `Missing permission finance.receiptCreate` |
| `super_admin` | ✅ | ✅ (không phải vai trò nghiệp vụ) |

**Deadlock:** ai chọn được lớp thì không tạo được phiếu; ai tạo được phiếu thì không chọn được lớp.

**Nguồn gốc (3 điểm, đều cố ý từng phần):**
- `apps/api/src/class/class-batch-router.ts:229` — `list: requirePermission('class', 'create')`
  Comment tại dòng 112-114 giải thích: *"list/get reuse `class.create` rather than inventing a 5th read-only permission the spec does not name"* → quyền **đọc** danh sách lớp bị buộc vào quyền **tạo** lớp.
- `packages/auth/src/index.ts:84` — `'class.create': ['giam_doc_dao_tao']`
- `packages/auth/src/index.ts:64` — `'finance.receiptCreate': ['giam_doc_kinh_doanh', 'sale']` (GĐĐT bị loại có chủ ý theo ADR-B separation of duties)

**Bằng chứng:** UAT trình duyệt thật (vai `sale`) — banner *"Không tải được danh sách lớp — Missing permission class.create"*.
Ảnh: `assets-260722-acceptance/uat-sale-receipt-create-blocked.png`

**Đã loại trừ giả thuyết "do chưa có dữ liệu":** tạo 1 lớp thật (`UATSKE-1EB53E60-UCREA-2026-001`) bằng GĐĐT → GĐĐT `list` thấy `items=1`, `sale` vẫn 403. **Nguyên nhân là quyền, không phải dữ liệu.**

**Vì sao e2e không bắt được:** `apps/e2e/tests/enrollment.spec.ts` dùng `gddt` gọi `classBatch.create` (dòng 45), giữ `classBatch.id` **trong biến JS**, rồi dùng `sale` gọi `receiptCreate` (dòng 66). Test bắc cầu qua chỗ mà người dùng thật không có cầu.

---

### 🟠 F2 — HIGH: Giáo viên không dùng được màn "Nhận xét buổi học" (WF P2-07)

`giao_vien` là actor chính của P2-07. Nav registry hiện menu cho ai có `assessment.draft`
(`apps/admin/src/shell/nav-registry.ts:25`), nhưng trang gọi 3 query đòi `class.create`:
`classBatch.list`, `classSession.list`, `classBatch.listStudents`.

Probe live vai `giao_vien`: cả `classBatch.list` và `classSession.list` → `Missing permission class.create`.

Hệ quả: GV thấy menu → vào → dropdown "Chọn lớp học" **rỗng, không báo lỗi** (khác F1, trang này không có banner) → im lặng bế tắc. Chỉ GĐĐT dùng được màn này, mà GĐĐT không phải người dạy.

**Đã loại trừ "do chưa có dữ liệu":** cùng phép thử ở F1 — có lớp thật, GĐĐT thấy, GV vẫn 403.
Ảnh: `assets-260722-acceptance/uat-gv-session-assessment-blocked.png`

---

### ⚪ F3 — Không phải lỗi: `cockpit.tsx`

Phân tích tĩnh ban đầu cờ đỏ trang Tổng quan (không role nào đủ quyền cho cả 4 query). **Bác bỏ sau khi đọc code**: widget render có điều kiện (`canViewReceipts && <PendingReceiptsCard/>`), query nằm trong component con nên chỉ chạy khi có quyền. Ghi lại để công cụ tương lai không lặp lại cảnh báo giả này.

---

## 5. Ma trận bằng chứng — 38 luồng × tầng kiểm thử

Phương pháp: đối chiếu procedure của mỗi luồng với nội dung file `*.spec.ts` (e2e) và `*.test.ts` (unit).
**Cảnh báo: heuristic khớp tên, không phải bằng chứng hành vi** — dùng để xếp hạng độ tin, không dùng để tuyên bố "đã test".

| Tầng cao nhất chạm tới | Số luồng |
|---|---|
| Có e2e chạm | 32 |
| Chỉ unit | 6 (P1-04, P1-06, P1-08, P3-10, P3-11, P4-04) |
| Chỉ static (không test nào) | 0 |

Procedure không thấy bóng dáng trong bất kỳ test nào: `student.getManyByIds`, `student.resetPassword`, `classBatch.listStudents`, `testAppointment.forOpportunity`.

**Cần chú ý:** P1-08 (huỷ phiếu/hoàn tiền — đụng tiền) chỉ có unit, không có e2e.

---

## 6. Nghiệm thu chính xác nhất trông như thế nào

Xếp theo độ mạnh của bằng chứng — hiện dự án dừng ở tầng 2.

| Tầng | Câu hỏi trả lời được | Trạng thái |
|---|---|---|
| 1. Tên tồn tại | "code có symbol này không?" | ✅ acceptance-report |
| 2. Hàm chạy đúng | "logic đúng với input cho trước?" | ✅ 956 unit + 21 e2e |
| 3. **Vai trò làm được** | "người dùng thật, quyền thật, có hoàn thành nổi không?" | ❌ **trống — F1/F2 nằm ở đây** |
| 4. Dữ liệu đúng sau luồng | "tiền/ghi danh/lương có đúng sổ sau khi chạy?" | ⚠️ một phần trong e2e |
| 5. Người thật xác nhận | "PO ký nghiệm thu" | ❌ chưa |

**Tầng 3 là chỗ rẻ nhất để lấp và đắt nhất khi bỏ qua** — nó bắt đúng lớp lỗi mà cả tầng 1 và 2 mù, vì tầng 1 không biết ai gọi, còn tầng 2 tự cấp quyền cho chính mình.

### Đề xuất nâng cấp `acceptance-report` (3 việc, tăng dần)

1. **Khai báo actor cho từng route** (rẻ, giá trị cao)
   Thêm vào manifest: mỗi `uiRoute` gắn `requiredRole`. Tool tự trích các `trpc.*.useQuery` của page tương ứng, tra `requirePermission` → `PERMISSIONS`, rồi khẳng định: **actor khai báo phải có đủ quyền cho mọi query không điều kiện của màn đó**. Đúng cách này bắt được F1 và F2 tự động, không cần trình duyệt.
   Phải xử lý được conditional mounting (bài học F3): chỉ tính query ở nhánh render vô điều kiện.

2. **Gắn bằng chứng test vào từng luồng** — thay `status: built` bằng `evidence: { static, unit[], e2e[] }`, để "38/38 built" không còn đọc như "38/38 nghiệm thu".

3. **Kiểm thử luồng theo vai trò trong e2e** — cấm test bắc cầu id qua biến giữa 2 role. Mỗi luồng có ít nhất 1 spec đi trọn vẹn bằng **một** phiên đúng vai.

---

## 7. Việc cần làm ngay (không phụ thuộc nâng cấp tool)

| # | Việc | Mức |
|---|---|---|
| 1 | Tách quyền đọc lớp khỏi `class.create` (thêm `class.read`/`class.list` cấp cho sale, GĐKD, GV) — sửa gốc cả F1 và F2 | CRITICAL |
| 2 | Quyết định ai được tạo phiếu thu, rồi làm cho vai đó dùng được trọn màn `/finance/new` | CRITICAL |
| 3 | Bổ sung e2e "một vai đi trọn luồng" cho P1-02 và P2-07 để lỗi không tái phát | HIGH |
| 4 | Bổ sung e2e cho P1-08 (huỷ phiếu/hoàn tiền) — đụng tiền mà chỉ có unit | MEDIUM |
| 5 | Sửa suite UI để không phụ thuộc DB rỗng (dùng facility riêng như spec API) | MEDIUM |

Việc 1 là quyết định thiết kế phân quyền — **cần PO chốt** trước khi sửa, vì nó đụng ADR separation-of-duties.

---

## 8. Dấu vết còn lại của phiên nghiệm thu

- DB test `cmc_edu`: facility `UAT Skeptic 260722` (`fb6c2526-a18e-4e9e-99db-96baa35dfb47`) + 1 course + 1 classBatch + 1 opportunity. **Không xoá** (dọn cascade rủi ro hơn lợi ích). Không đụng `cmc_prod`.
- `cmc-test-db-socat` đang chạy (đã `docker start`).
- Worktree sạch, mọi mutation test đã khôi phục, `acceptance-report/` đã regenerate ở trạng thái đúng.

---

## 9. Câu hỏi chưa có lời giải

1. **Ai được phép tạo phiếu thu?** ADR-B loại GĐĐT khỏi `receiptCreate` để tách trách nhiệm; nhưng chỉ GĐĐT đọc được danh sách lớp. Nới quyền đọc lớp cho sale/GĐKD (khuyến nghị) hay đổi mô hình chọn lớp?
2. **Màn nào khác cũng đang "hiện menu nhưng không dùng được"?** Audit chỉ soi query bị chặn; chưa soi mutation bị chặn sau khi bấm nút.
3. Có nên đưa audit reachability này thành gate CI chặn merge, hay chỉ báo cáo?

### Đã trả lời trong phiên: F1/F2 **chưa từng chạy được**, không phải hồi quy

- `class-batch-router.ts:229` (`list` đòi `class.create`) có từ commit đầu tiên tạo router: `4a742b0` (2026-07-06).
- `receipt-create.tsx` dùng `classBatch.list` từ `c444200` (2026-07-07).

Nghĩa là luồng tiền cốt lõi **chưa bao giờ hoàn thành được qua UI trong suốt ~2 tuần**, xuyên qua mọi lần tuyên bố "P1 hoàn thành". Mọi trạng thái `completed` của các plan chạm P1/P2-07 cần soát lại — chúng được ký dựa trên đúng loại bằng chứng mà báo cáo này chứng minh là không đủ.
