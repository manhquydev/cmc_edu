# Brainstorm — hướng sau red-team runbook UAT: audit actor↔permission trước, hoàn thiện runbook sau

Ngày: 2026-07-23 · Branch `main` · Nguồn: `plans/reports/from-code-reviewer-to-cook-260722-2022-red-team-uat-runbook-report.md`

## Vấn đề

Red-team runbook UAT trả 4 Critical + 6 High + 5 Medium. 4C+6H đã áp ngay trong phiên `/cook`. Câu hỏi: làm gì tiếp?

Thứ đáng lo **không phải** danh sách còn tồn, mà là **cách H5 được tìm ra**: tình cờ. Reviewer đang review runbook thì vấp phải P2-04 — luồng thứ **4** cùng họ với F1/F2/F4.

Đếm họ bug này: F1 (luồng tiền), F2 (nhận xét buổi học), F4 (chốt lương) — sửa 2026-07-22. F5/P2-04 — lộ khi red-team. **Bốn cái cùng một hình dạng**: manifest khai vai X là actor, registry không cho X gọi procedure nào của luồng.

Không ai biết còn bao nhiêu. Plan `0908` từng ước F8 = "7/38 luồng mâu thuẫn actor↔permission" nhưng **chưa bao giờ kiểm chứng**. Mà UAT tốn **thời gian 7 người** — mỗi idle actor phát hiện *trong* UAT = một vòng lên lịch lại.

## Bốn hướng đã cân

| | Việc | Chi phí | Phán quyết |
|---|---|---|---|
| **B** | Audit actor↔permission toàn manifest | ~2-3h, tĩnh | **Chọn — làm trước** |
| **A** | Áp nốt 5 Medium + đuôi H3/H4/H6 | ~2h | **Chọn — sau B** (§5 phải sửa theo kết quả B) |
| **C** | M5: ẩn menu trỏ màn giữ chỗ | ~30ph | Chọn, xen vào |
| **D** | Rotate Brevo key | — | Việc của PO, không làm được |

### Tự phản biện: B có mâu thuẫn với "đừng xây công cụ đo thứ tư" không?

**Không.** Brainstorm trước bác **B-cũ** (runtime capture cho LMS) vì nó trùng việc UAT làm tốt hơn. B lần này khác về bản chất:

- Là **kiểm tra nhất quán tĩnh** giữa hai thứ repo **đã tự khai** (`actorRoles` ↔ `PERMISSIONS`), không phải phép đo runtime mới.
- Bắt đúng lớp bug mà runtime capture **đã chứng minh là không bắt được**: H5 cho thấy capture báo `0 denied` *chính vì* nav không render nên không phát sinh request.
- Đúng AC #2 mà plan `0908` thiết kế rồi bỏ dở.

## Quyết định (PO chốt 2026-07-23)

| # | Quyết định |
|---|---|
| **D1** | Thứ tự **B → A**, C xen vào |
| **D2** | **P2-04: manifest khai sai actor** — chỉ GĐĐT ra đề bài tập. Sửa `flow-manifest.ts`, **KHÔNG nới `exercise.manage`** |

D2 quan trọng về nguyên tắc: nới quyền để khớp một manifest sai chính là cách money-gate rồi cũng bị nới.

## Kết quả B — audit tìm được gì

`scripts/acceptance-report/actor-audit.ts`, nối vào `pnpm acceptance:report`:

| Loại | Số | Nội dung |
|---|---|---|
| `invalid-actor` | **4** | `nhan_vien` (P3-01, P3-02, P4-01, P4-03) — vai không tồn tại trong `ROLES`. Xác nhận F6 bằng cấu trúc |
| `idle-actor` | **2 → 1** | P2-04/`giao_vien` (**đã sửa**) + **P4-04/`giao_vien` — CHƯA AI BIẾT** |
| `unreachable-procedure` | 21 | 6 luồng (P1-05, P1-06, P1-09, P3-01, P4-01, P4-03) |

**P4-04 là bằng chứng cho cả lập luận chọn B**: `testAppointment.*` cần `testAppointment.manage` = [GĐKD, GĐĐT, sale]; `giao_vien` không có. Cùng họ F1/F2/F4/F5, tìm ra **bằng cấu trúc** chứ không phải tình cờ. Đó là instance thứ **5**.

P1-09/`audit.list` trong nhóm unreachable khớp đúng finding #26 của plan `0908` ("`audit.list` thuộc ADM-04, `/ops/recon` không gọi audit — lỗi trùng lặp manifest").

### Giới hạn phải công bố

**26 procedure ngoài tầm registry** (owner-check, `lmsProcedure`, public) — audit **không kết luận** được về chúng. Im lặng ở nhóm này là "chưa phủ", không phải "sạch". Chính nhóm này từng tạo 6 finding giả cho runtime capture (`manualPunch.list`, `kpi.myScore`).

### Vì sao chưa cho fail CI

Theo quyết định B3 (cảnh báo trước, chặn sau): nợ này **có trước** khi có công cụ đo, bật fatal ngày đầu ⇒ team tắt gate thay vì sửa. Nâng lên exit-code sau khi triage xong 26 finding.

## Kết quả A + C

- **M1**: bổ sung §8d — điều kiện tiên quyết Phase 4 mà bản đầu bỏ sót. Nặng nhất: **Brevo key trả 401 từ 2026-07-10, chưa từng gửi thành công email thật**. Không rotate ⇒ bước 5 chắc chắn fail.
- **§9 siết**: "gửi thật thành công" = **ảnh hộp thư nhận**, không phải 2xx của transport; trần **≤3 dòng "chấp nhận có điều kiện"**, cấm dòng thuộc cụm P1.
- **M2**: §5 thêm cột **Người test / Giờ** ⇒ luật "một vai đi trọn" kiểm chứng được sau khi ký.
- **H6/H4**: §5 thêm cột **Tiền đề**, đổi tên cột thành "Màn của luồng" (không phải màn của vai).
- **M3/M4**: trỏ sang `runbook-deploy.md` thay vì đặc tả lại; ghi rõ trên VPS thật phải dùng `docker exec`.
- **C/M5**: bỏ nav entry "Hoàn tiền" + test khoá. Trước đó GĐKD bấm menu là gặp trang "Tính năng chưa áp dụng" ngay ngày go-live.

## Trạng thái cổng

`pnpm typecheck` 27/27 · `lint` sạch · `pnpm test` 22/22 · `acceptance:report` exit 0 (37 built / 1 partial) · admin 352 test.

## Bước tiếp theo

1. **PO chốt P4-04**: giáo viên có đặt lịch kiểm tra đầu vào không? Không → sửa manifest như P2-04.
2. **PO chốt actor thật** cho 4 luồng `nhan_vien`.
3. **Triage 21 `unreachable-procedure`** — phần lớn là manifest khai actor không đủ (VD P1-06 chỉ khai `phu_huynh` nhưng luồng có bước nhân viên duyệt link).
4. **Rotate Brevo key** — blocker cứng của UAT.
5. Sau đó mới xếp lịch UAT.

## Câu hỏi chưa giải

1. P4-04 / `giao_vien` — manifest sai hay thiếu quyền?
2. Actor thật của P3-01, P3-02, P4-01, P4-03 (`nhan_vien`).
3. 21 unreachable: sửa manifest, sửa quyền, hay chấp nhận có lý do?
4. Khi nào nâng `actor-audit` lên exit-code (chặn CI)?
5. Brevo key đã rotate chưa kể từ 401 ngày 2026-07-10?
