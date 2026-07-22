# Vấn đề thật: nguồn sự thật của nghiệm thu đang là trí nhớ người viết

**Ngày:** 2026-07-22 · **Commit:** `4237cb5` · **Loại:** brainstorm deep-dive (vòng 2, sau red-team)
**Tiền đề:** `brainstorm-problem-first-260722-0908-evidence-role-blindness-report.md` (vòng 1, đã đính chính)

---

## 1. Vì sao cần vòng 2

Vòng 1 kết luận *"bằng chứng mù vai trò"* và quy thủ phạm là `super_admin`. Red-team bác bỏ bằng chứng cứ, tôi kiểm lại và **họ đúng**:

- `runtime-evidence.json`: **0/38** verdict thuộc spec dùng `super_admin`. Toàn bộ thuộc spec API dùng **vai nghiệp vụ đúng** (`p1-runtime-proofs.spec.ts:49` → `roles: ['sale']`).
- P1-02 vẫn `proven` vì spec **bắc cầu id**: `createClass(gddtId)` trả `classBatchId`, `sale` dùng thẳng (`:50-63`). `sale` không bao giờ gọi `classBatch.list`.

Sửa một lần nữa thì được gì? Nếu chỉ cấm bắc cầu id, lần sau lỗi sẽ trốn ở chỗ khác. Vòng 2 này đi tìm **tầng dưới cùng**.

---

## 2. Tầng dưới cùng — một phép so sánh đủ chứng minh

| | |
|---|---|
| Manifest khai P1-02 cần | `finance.receiptCreate` — **1 procedure** |
| Màn `/finance/new` thực sự gọi | `classBatch.list`, `crm.opportunityGet`, `crm.opportunityLookup`, `finance.receiptCreate` — **4 procedure** |

*(`flow-manifest.ts` P1-02 `expected.trpc` vs `apps/admin/src/pages/finance/receipt-create.tsx`)*

**Manifest thấy 25% sự thật. F1 sống trong 75% còn lại.**

Điều này giải thích mọi thứ đã xảy ra:

- Vì sao `acceptance-report` báo `built` — nó kiểm 1/1 procedure được khai, đủ 100%.
- Vì sao runtime-proof báo `proven` — nó cũng chỉ chứng minh procedure được khai.
- Vì sao assertion actor↔permission tôi định thêm ở Phase 1 **cũng sẽ mù** — nó so `expected.trpc` với actor, mà `classBatch.list` không có trong `expected.trpc`.

### Phát biểu vấn đề thật

> **Nguồn sự thật về "một luồng cần những gì" là một danh sách người viết tay. Danh sách đó chỉ chứa những gì người viết nghĩ tới. Mọi tầng kiểm tra đều xây trên danh sách ấy — nên không tầng nào bắt được thứ người viết không nghĩ tới. Mà đó chính là nơi lỗi sống.**

Đây không phải lỗi của người viết manifest. Không ai nhớ hết dependency của một màn hình, và dependency đổi mỗi lần sửa UI mà manifest không đổi theo.

**Hệ quả:** thêm bao nhiêu tầng kiểm tra lên trên manifest cũng vô ích. Phải **đảo chiều nguồn sự thật** — máy trích ra cái màn hình *thực sự* cần, thay vì hỏi người.

---

## 3. Vì sao vòng 1 và cả plan vừa viết đều trượt

Cả hai đều mặc nhiên coi manifest là đúng và đi thêm luật lên trên nó:

| Việc đã đề xuất | Bắt được F1 không? | Vì sao |
|---|---|---|
| Siết `actorRoles: Role[]` | ✗ | Sửa *ai* làm, không sửa *cần gì* |
| Assertion actor↔permission trên `expected.trpc` | ✗ | `classBatch.list` không có trong `expected.trpc` |
| Cấm `super_admin` trong spec | ✗ | Verdict vốn không do super_admin cấp |
| Cấm bắc cầu id | ✓ | Nhưng chỉ với luồng đã có spec, và chỉ nếu người viết spec nghĩ tới |
| Placeholder detection | ✗ (bắt F7 thôi) | Vấn đề khác |

Chỉ **một** biện pháp trong plan cũ chạm được F1, và nó vẫn phụ thuộc trí nhớ người viết spec. Đó là lý do plan cần thiết kế lại chứ không vá.

---

## 4. Ba kiến trúc cho nguồn sự thật mới

### A — Trích tĩnh từ code (static extraction)

`route → page component → mọi trpc call (kể cả trong component con) → permission → roles`, bằng ts-morph theo import graph.

- **Được:** chạy trong CI, không cần DB/browser, nhanh, chặn được PR.
- **Mất:** độ chính xác. Phải xử lý component con, custom hook, conditional render (`enabled:`), query trong `useEffect`. Prototype regex của tôi trong phiên này resolve **13/40** màn và dính 2 bug — bản ts-morph sẽ tốt hơn nhiều nhưng vẫn là xấp xỉ.
- **Rủi ro chết người:** âm tính giả im lặng. Scanner sót một nhánh → màn đó không bao giờ được kiểm, và không ai biết.

### B — Ghi nhận runtime (runtime capture) ⭐

Mở từng màn bằng từng vai mà nav mở cho họ, thu **mọi** request tRPC + HTTP status. Bất kỳ `403` nào = lỗi.

- **Được:** chính xác tuyệt đối — đây là *đúng cái màn hình gọi thật*, không xấp xỉ. Bắt được cả lỗi render, lỗi query thiếu, lỗi không thuộc permission. Không cần hiểu AST.
- **Đã được chứng minh khả thi ngay trong phiên này:** tôi làm thủ công đúng quy trình đó với 3 màn và tìm ra F1 + F2. Hạ tầng đã có sẵn: `ui-chromium` project, `mintStaffCookie`, preview server.
- **Quy mô thực tế (đã tính, không ước lượng):** 19 nav entry có permission gate + 8 entry **không có gate nào**; tổng tổ hợp (màn × vai nghiệp vụ vào được) = **62**, ở ~2s mỗi lần mở → **~2,1 phút**. Rẻ hơn nhiều so với cảm giác ban đầu.
- **Phép tính này còn lộ thêm một lỗ:** **8/27 nav entry không có `permission:`** — mọi vai vào được, chặn duy nhất là 403 từ query bên trong. `/admin/classes` là một trong số đó (nền của Security finding #5). 8 màn này là nhóm rủi ro cùng loại F2 và hiện chưa ai rà.
- **Mất:** cần DB + browser nên nặng hơn cho mỗi PR; cần dữ liệu seed đủ để màn không rỗng (màn rỗng có thể giấu lỗi — bài học từ phép thử "tạo lớp thật rồi kiểm lại").

### C — Kết hợp: runtime là nguồn sự thật, tĩnh là gate nhanh ⭐⭐

1. Job runtime (nightly hoặc trước release) mở mọi màn × mọi vai, **sinh ra** bản kê dependency thật cho từng màn và commit vào repo.
2. Gate tĩnh chạy mọi PR: đối chiếu code hiện tại với bản kê đã commit; lệch → fail, buộc chạy lại job runtime.
3. `acceptance-report` đọc bản kê đó thay vì `expected.trpc` viết tay.

- **Được:** độ chính xác của runtime + tốc độ của tĩnh. Bản kê nằm trong git nên diff review được — chính là cách plan `260717-1213` đã chọn cho `runtime-evidence.json` (D7: `proven` yêu cầu `evidence.commit === HEAD`).
- **Mất:** phức tạp nhất; cần kỷ luật giữ bản kê tươi.

---

## 5. Khuyến nghị

**Đi B trước, mở đường lên C. Không làm A một mình.**

Lý do:

- B là thứ **duy nhất** đã được chứng minh bắt được lỗi thật trong dự án này — bằng chính phiên hôm nay, không phải lý thuyết.
- B không cần độ chính xác AST, nên không có kiểu âm tính giả im lặng của A. Với nghiệm thu, *sai kiểu im lặng* là kiểu sai tệ nhất — toàn bộ câu chuyện F1 là một chuỗi âm tính giả im lặng.
- A một mình chỉ tạo cảm giác an toàn mới, cùng bản chất với `38/38 built`.
- C là đích đến, nhưng chỉ có nghĩa sau khi B chạy được và cho thấy bản kê thật trông thế nào.

**Kiểm thử chua nhất cho B (phải chạy trước khi tin nó):** cho B chạy trên commit hiện tại. Nó **phải** tự tìm ra F1 và F2 mà không được mớm. Nếu không tìm ra → B chưa đủ, không đi tiếp.

---

## 6. Việc này thay đổi plan hiện tại thế nào

| Phase cũ | Số phận |
|---|---|
| 1 — Actor contract | **Giữ một phần.** Siết `actorRoles` vẫn đáng (bắt F5/F6/F8, rẻ). Nhưng **bỏ** assertion trên `expected.trpc` — nó mù. |
| 2 — Permission fixes | **Giữ, tách ra ship trước.** F1/F2/F4 là lỗi production đang hỏng thật, không nên chờ tooling. |
| 3 — Placeholder detection | **Giữ, hạ ưu tiên.** Vấn đề riêng, không liên quan gốc rễ. |
| 4 — Role-true e2e | **Thay bằng B.** E2E thủ công từng luồng không mở rộng được; runtime capture phủ mọi màn. |
| 5 — Cấm super_admin | **Bỏ tiền đề cũ.** Giữ lại đúng một mẩu: cấm bắc cầu id trong spec. |
| 6 — Merge branch | **Giữ, làm sau cùng.** Hạ tầng `proveFlow` vẫn dùng được. |

---

## 7. Quyết định của PO trong phiên này

- **Giữ `class.read` gộp 1 quyền** cho 4 vai (không tách `classRoster.read`), chỉ thêm nav gate cho `/admin/classes`. Ghi nhận, không tự đảo. **Đánh đổi đã được nêu và chấp nhận:** `sale` đọc được tên học sinh của mọi lớp trong cơ sở. Nếu sau này có yêu cầu tuân thủ dữ liệu trẻ em, đây là mục cần mở lại đầu tiên.

---

## 7b. Bổ sung sau khi 4 reviewer nộp đủ (đợt 2) — củng cố chẩn đoán

Ba dữ kiện mới **làm mạnh thêm** kết luận ở §2, không đảo nó:

1. **Không gate nào trong plan cũ có thể chặn merge.** `verify.ts` chưa từng exit non-zero (`main()` chỉ `console.warn`), và `ci.yml` chỉ chạy typecheck/test/coverage — **không** chạy `acceptance:report`, **không** lint. Nghĩa là kể cả khi assertion đúng, nó vẫn chỉ là chữ trên màn hình. Bất kỳ giải pháp nào cũng phải sửa `ci.yml`, nếu không chỉ là nghi lễ.
2. **`scripts/` nằm ngoài mọi lưới an toàn** — không typecheck (không có `scripts/tsconfig.json`, ngoài `pnpm-workspace`), không lint (`lint = eslint apps/admin apps/lms`), chạy qua `tsx` transpile-only. Chính công cụ nghiệm thu là thứ ít được kiểm nhất trong repo.
3. **`lmsProcedure` phá giả định "một vai đi trọn luồng".** 17 procedure cố ý không kiểm `can()` (`trpc.ts:240-244`), 2 trong số đó thuộc P2-07 và chỉ gọi được bằng phiên **phụ huynh**. Một luồng có thể hợp lệ mà cần **hai** phiên khác nhau — mô hình "một vai" là quá đơn giản, cần khái niệm "chặng" (leg) trong luồng.

Điểm 3 đặc biệt đáng giá: nó cho thấy ngay cả cách phát biểu vấn đề của tôi ở §2 vẫn còn thô. Câu hỏi nghiệm thu đúng không phải *"vai X có làm nổi luồng Y không"* mà **_"chuỗi vai mà nghiệp vụ quy định, mỗi vai chỉ với quyền của mình, có nối được thành luồng Y không — và mỗi vai có tự lấy được thứ nó cần từ vai trước không?"_** Mắt xích thứ hai chính là chỗ bắc cầu id đang giấu lỗi.

## 8. Câu hỏi chưa có lời giải

1. B cần seed dữ liệu tới đâu để màn không rỗng? Màn rỗng có thể giấu lỗi — đã gặp trong phiên (dropdown rỗng vì thiếu quyền *và* vì thiếu dữ liệu trông giống hệt nhau).
2. Bản kê dependency (phương án C) commit ở dạng nào để diff có nghĩa với người review?
3. Chạy B ở đâu: mọi PR (chậm) hay nightly + trước release (rẻ, nhưng lỗi lọt lâu hơn)?
4. Ba luồng khai `nhan_vien` + P3-02 — actor thật là ai? Vẫn chờ PO.
5. `/finance/refund`: sửa cách đếm hay xây nốt màn?
