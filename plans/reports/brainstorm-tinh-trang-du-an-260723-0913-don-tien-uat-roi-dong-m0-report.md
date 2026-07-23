# Brainstorm — tình trạng dự án và hướng triển khai tiếp theo

Ngày: 2026-07-23 · Branch `main` (`e477496`) · Vai: Solution Brainstormer
Tiền nhiệm: `plans/reports/brainstorm-actor-manifest-260723-0848-4-luong-nhan-vien-21-unreachable-p4-03-tach-doi-report.md`

## 1. Trạng thái thật, đo chứ không chép

| Hạng mục | Số đo | Nguồn |
|---|---|---|
| typecheck / lint | 27/27 · sạch | đo tại `35d4df0` |
| test | 22/22 task — api **977**, admin **352** | như trên |
| e2e | 20 pass, **0 facility rò** | như trên |
| runtime capture | **102 tổ hợp màn×vai, 0 denied** | plan `260722-1114` |
| Sổ nghiệm thu | **37 built / 1 partial** (P1-08 hoàn tiền — `/finance/refund` là màn giữ chỗ) | `acceptance-report/verification.json` 2026-07-23 |
| actor↔permission audit | **0 findings** (từ 26) | `verification.json:actorAudit` |
| Git tree | sạch, không việc dở dang | `git status` |

**Hai giới hạn phải đọc là "chưa phủ", không phải "sạch":** 26 procedure ngoài tầm registry (owner-check, `lmsProcedure`, public) và 2 cặp (luồng, vai) audit không kết luận được — P3-02 với `sale`/`giao_vien`. Runtime capture cũng mù với gate `canDo()` phía client: màn không gọi gì thì không có request để bắt.

**Plan đang mở:** `260707-2308` (M0 go-live — Phase 1/2/3 xong, **Phase 4 UAT người thật CHƯA CHẠY**) và `260717-1213` (tooling sổ nghiệm thu; Phase 4 đã bị runtime capture thay thế). Toàn bộ M1→M4 trong `docs/project-roadmap.md` đều **"Chưa"**, đều chờ M0 GO.

## 2. Chẩn đoán

**Phần mềm gần như đã xong; cái chưa có là bằng chứng người thật dùng được.**

Từ 2026-07-07 tới nay (16 ngày) repo sinh ra: 977 unit test, 20 e2e spec, 38-flow runtime proof, sổ nghiệm thu tự sinh, runtime capture, actor audit. Tất cả xanh. Trong 16 ngày đó **chưa một nhân viên thật nào đăng nhập Entra thật** — và chính khoảng trống đó là nơi 3 luồng gãy nằm im, được phát hiện bằng **đọc code**, không phải bằng đo.

Rủi ro lớn nhất bây giờ không phải thiếu bằng chứng, mà là **đo thêm một vòng nữa thay vì chạy UAT**. Mỗi công cụ đo mới đều tìm ra thứ gì đó nên luôn *cảm giác* có ích — nhưng 21 unreachable vừa triage xong **không chứa một lỗi quyền nào**. Lợi tức của đo tĩnh đã cạn.

## 3. Các hướng đã cân nhắc

| | Hướng | Đánh giá |
|---|---|---|
| A | Chạy Phase 4 UAT người thật ngay | Đúng đích, nhưng Brevo chưa xác nhận trên host ⇒ tiêu chí email **chắc chắn fail**, mất cả buổi tập hợp người. Runbook §8/§9 còn mâu thuẫn ⇒ người chạy dừng hỏi lại |
| B | Đợt dọn tiền-UAT rồi mới xếp lịch | 5 việc đã biết chính xác, đều là tiền đề của A. Rủi ro duy nhất là để nó phình ra ⇒ đặt trần cứng |
| C | Mở rộng phủ đo (26 ungated + 2 inconclusive) | **Loại.** Audit vừa chứng minh vùng mù không chứa lỗi quyền; runtime capture vẫn không thấy gate client. Đo để yên tâm, không để ship |
| D | Bắt đầu tính năng M2 (lịch họp PH theo lớp) | **Loại.** Sai thứ tự; PO đã chốt hoãn sau go-live 2026-07-23 |

**PO chốt 2026-07-23: B rồi A.** Điều kiện thực tế đã có: **đủ người thật cho từng vai + host prod**.

## 4. Hai đính chính so với đề xuất đầu của tôi

**Bỏ "nâng CI gate `acceptance:report` lên chặn merge".** `ci.yml:88-92` ghi rõ lý do non-blocking và điều kiện nâng: *"vài tuần chạy chứng minh chỉ báo drift thật"*. Gate thêm **2026-07-22 — được 1 ngày**. Nâng bây giờ là đảo một quyết định có lý do mà không có bằng chứng mới.

**Việc nav lớn hơn "một entry rewards".** Đo thật: `/finance/new` **có** nút từ `/finance` (`receipt-list.tsx:133`) ⇒ không cần nav. Nhưng **5 màn chỉ vào được bằng gõ URL**, không nav và không link từ đâu:

| Màn | Quyền cần | Hệ quả |
|---|---|---|
| `/admin/engagement/rewards` | `rewards.manage` | Nằm trong §5 (**P4-01**) — luật §4.3 "vào bằng menu" rỗng nghĩa |
| `/admin/engagement/gifts` | `gift.list` | Nằm trong §5 (**P4-02**) — như trên |
| `/admin/engagement/leaderboard` | (không gate) | Không ai vào được |
| `/admin/courses` | `course.manage` | Không ai vào được |
| `/finance/class-placement` | `enrollment.enroll` (GĐKD/GĐĐT/sale) | Không ai vào được, **và không luồng nào trong manifest khai màn này** |

## 5. Phát hiện phụ

**Sổ nghiệm thu bắt orphan *procedure*, không bắt orphan *route*.** `verification.json.orphans` chỉ có `procedures` — nên `/finance/class-placement`, một màn đã xây mà không luồng nào khai, lọt qua toàn bộ hệ đo. Không thuộc phạm vi đợt này; ghi lại để cân nhắc khi CI gate được nâng.

**`env-check.sh` và `boot-checks.ts` chỉ kiểm biến *có tồn tại*.** Một `BREVO_API_KEY` dính dòng kế tiếp (thiếu newline cuối dòng) vẫn qua **cả hai** — đó đúng là cách lỗi 401 sống sót 12 ngày và giết OTP phụ huynh. Xem B2.

## 6. Quyết định chốt trong phiên

| # | Câu hỏi | Quyết định | Căn cứ |
|---|---|---|---|
| Q1 | Hướng đợt tới | **B rồi A** | PO 2026-07-23 |
| Q2 | `super_admin` trong P3-02 (TL27:47 có, TL25:39 không) | **KHÔNG** — theo TL25 | super_admin là đường thoát hiểm quản trị, không phải vai nghiệp vụ duyệt phiếu; giữ đúng track GĐKD/GĐĐT theo ADR 0043. **Sửa TL27 cho khớp** |
| Q3 | `/finance/class-placement` không lối vào | **Thêm nav cùng đợt B** | Màn đã xây mà không ai vào được thì công xây là bỏ |

## 7. Giải pháp chốt — đợt B (tiền-UAT)

| # | Việc | Điểm chạm | Nghiệm thu |
|---|---|---|---|
| **B1** | Đồng bộ runbook. §8 còn ghi *"🔴 CHẶN — P3-01/P4-03 không có actor hợp lệ"* (sai từ `a754edf`, §5 đã có đủ dòng); §9 còn 3 checkbox đã đóng 2026-07-23 | `docs/runbook-uat-golive.md` | Đọc một mạch không gặp mâu thuẫn nào |
| **B2** | Brevo: kiểm dòng `BREVO_API_KEY=` trên host UAT + gửi 1 email thật. **Thêm** validate ở boot: key chứa xuống dòng/khoảng trắng lạ ⇒ fail | `apps/api/src/boot-checks.ts` + test; vận hành trên host | Boot fail khi key dính dòng; **ảnh hộp thư nhận** (không phải mã 2xx) |
| **B3** | Nav cho 5 màn URL-only: nhóm mới **"Gắn kết"** (gifts · rewards · leaderboard) · **"Khoá học"** vào nhóm Lớp & Học sinh · **"Xếp lớp"** (`enrollment.enroll`) | `apps/admin/src/shell/nav-registry.ts` + `nav-registry.test.ts` | Mỗi vai thấy đúng entry theo quyền; P4-01/P4-02 vào được bằng menu |
| **B4** | Áp Q2: `super_admin` **không** vào P3-02. Sửa TL27:47 cho khớp TL25 | `docs/27-workflow-spec-p3.md` | Hai tài liệu hết mâu thuẫn; §5 không thêm dòng |

**Ngoài phạm vi B (cố ý):** không đụng `packages/auth` — **không nới quyền nào** · không đụng schema · không làm tính năng M2 · không nâng CI gate · không mở rộng phủ đo.

**Trần cứng:** phát sinh ngoài 4 mục trên ⇒ ghi thành nợ, **không** làm trong đợt này.

## 8. Sau B — đợt A (Phase 4 UAT)

Chạy theo `docs/runbook-uat-golive.md` đã đồng bộ. Ba điểm dễ chết:

1. **Bước 0 REDEPLOY bắt buộc.** Image prod đang chạy build **2026-07-18**, trước toàn bộ vá RBAC 22/07. Bỏ bước này ⇒ UAT fail đúng 3 luồng vừa sửa, hoặc tệ hơn: người chạy kết luận "fix không hiệu lực".
2. **`restore-drill.sh` KHÔNG reset `cmc_prod`** — nó có guard cứng từ chối đích đó và in `RESTORE DRILL PASSED` trong khi prod không đổi một dòng. Reset theo §3.1 cách A hoặc B.
3. **Đếm row bằng role `postgres`, không phải `cmc_app`** — RLS FORCE làm `cmc_app` trả count 0 không báo lỗi ⇒ "sạch = sạch" luôn đúng và chốt canh rủi ro duy nhất trở thành vô nghĩa.

## 9. Tiêu chí thành công đợt B

- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm test` xanh; `nav-registry.test.ts` phủ 5 entry mới theo từng vai
- [ ] `pnpm acceptance:report` giữ **37 built / 1 partial**, `actorAudit.findings` vẫn **0** (B không đụng manifest actor)
- [ ] `packages/auth/src/index.ts` **không đổi một dòng**
- [ ] Boot fail có thông báo rõ khi `BREVO_API_KEY` chứa ký tự xuống dòng — có test
- [ ] Gửi 1 email Brevo thật trên host UAT, **có ảnh hộp thư nhận**
- [ ] Đọc `runbook-uat-golive.md` từ đầu tới cuối không gặp mâu thuẫn; §9 chỉ còn gate thật sự chưa đóng
- [ ] TL27 và TL25 khớp nhau về actor P3-02

## 10. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Đợt B phình thành vòng đo thứ N | **Cao** | Trần cứng 4 mục §7; phát sinh ⇒ ghi nợ, không làm |
| Thêm nav làm lộ màn cho vai không có quyền | TB | Mỗi entry gate bằng key đã đo (§4); `nav-registry.test.ts` kiểm theo từng vai; `PermissionGate` ở route vẫn giữ nguyên làm lớp hai |
| Sửa `boot-checks` làm prod không boot được | TB | Chỉ thêm validate **hình dạng** giá trị, không thêm biến bắt buộc; test cả case hợp lệ lẫn dính dòng trước khi redeploy |
| Brevo vẫn fail sau khi sửa vì nguyên nhân khác | TB | B2 chạy **trước** khi tập hợp người; nếu fail thì lùi lịch UAT chứ không lùi giữa buổi |
| Quên bước 0 REDEPLOY khi vào A | **Cao** | B1 để bước 0 ở đầu §3 và giữ nguyên §3.0 giải thích vì sao |

## 11. Câu hỏi chưa giải

1. `/finance/class-placement` thuộc luồng nào trong TL25? Thêm nav xong có cần bổ sung dòng §5 tương ứng không, hay để UAT phát hiện.
2. Sổ nghiệm thu có nên bắt orphan **route** (màn đã xây không luồng nào khai) như đang bắt orphan procedure? — cân nhắc khi CI gate được nâng, không phải bây giờ.
3. UAT `super_admin` (5 luồng ADM-01→05): người thật hay nghiệm bằng ảnh chụp?
4. `/admin/engagement/leaderboard` không có gate quyền nào — thêm nav thì gate bằng key gì?
