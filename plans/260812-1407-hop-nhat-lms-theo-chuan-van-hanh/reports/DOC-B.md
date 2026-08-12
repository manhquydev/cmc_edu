# DOC-B — Sửa TL26 / TL25 / TL29 khớp code (không buổi bù, Tier A only)

**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Skill:** `/ak:docs` (update)  
**Owned files only:**  
- `docs/26-workflow-spec-p2.md`  
- `docs/25-ma-tran-truy-vet-p1.md`  
- `docs/29-test-plan.md`  

**Không** sửa code · **Không** commit · **Không** đụng file docs khác.

Brief: `/tmp/.../scratchpad/BRIEF-DOCS.md` (buổi bù gỡ 2026-08-12; open-tier chỉ Tier A; gap-aware unit axis).

---

## Thay đổi theo file

### 1. `docs/26-workflow-spec-p2.md` (WF-P2)

| Chỗ (trước) | Việc làm |
|-------------|----------|
| WF-P2-01 Exceptions ~L36–37: buổi bù `isMakeup` + Tier B | Thay bằng **không còn buổi bù**; ghi lý do restamp + ngày **2026-08-12**; hướng dẫn học bù ngoài hệ / thêm slot tuần |
| WF-P2-02 Exceptions ~L66: buổi bù → Tier B | Thay bằng **không còn nhánh buổi bù / Tier B** (gỡ 2026-08-12); mở bài chỉ Tier A |
| WF-P2-03 swimlane ~L87–88: Tier A + Tier B | Sơ đồ **chỉ Tier A**; blockquote ghi chú **2026-08-12** cấm implement lại Tier B |
| WF-P2-03 happy path ~L92–95 | Chỉ `published` + Tier A + lifecycle |
| WF-P2-03 exceptions + acceptance ~L95–103 | Bỏ tiêu chí “buổi bù mở riêng HS”; giữ vết “từng có, đã gỡ 2026-08-12” |
| Rules/ADR WF-P2-03 | ADR 0038: Tier A còn hiệu lực; Tier B gỡ 2026-08-12 |

### 2. `docs/25-ma-tran-truy-vet-p1.md`

| Chỗ (trước) | Việc làm |
|-------------|----------|
| P3-11 ~L48: “Tự huỷ … + **xếp buổi bù nối đuôi**” | Đổi story: **tự huỷ 0 điểm danh + restamp unit (không xếp buổi bù — gỡ nối đuôi 2026-08-12)** |
| §3b ADR 0038 ~L72: “mở bài tập **Tier A/B**” | **Tier A; Tier B gỡ 2026-08-12** |

### 3. `docs/29-test-plan.md` (kế hoạch kiểm thử — bắt buộc đổi yêu cầu test)

| Chỗ (trước) | Việc làm |
|-------------|----------|
| §1 Unit ~L13: `exercise-open` Tier A/B | Tier A + **tiến trình unit trên trục có lỗ hổng** |
| §1 Integration ~L14 | Thêm restamp/grant trên trục gapped (Bright I.G) |
| §2 coverage ~L22: “đủ Tier A/B” | Tier A, cancelled, reserved; **trục unit có lỗ hổng thật**; ghi gap-aware 2026-08-12 |
| §4 ~L46: “buổi bù mở riêng HS” | **Tier A only**; **không** viết lại test Tier B; thêm hàng **unit progression (trục gapped)** với yêu cầu restamp/grant/roster/cancel trên Bright I.G (lỗ 40/44/48/52/56) |

---

## Nguyên tắc áp dụng (từ brief)

- Spec đang hiệu lực → **sửa thành sự thật**, không để yêu cầu chết.
- Giữ vết “từng có buổi bù / Tier B” + **ngày gỡ 2026-08-12** để người sau không revive.
- TL29 là **test plan** → bỏ hoàn toàn yêu cầu test Tier B; thay bằng test **gap-aware** (khớp suite `bright-ig-gaps.int.test.ts`).

---

## File **ngoài ownership** vẫn lệch (ghi nhận, không sửa)

| File | Vấn đề gợi ý |
|------|----------------|
| `docs/19-quy-tac-nghiep-vu-chi-tiet.md` | Vẫn mô tả Tier B buổi bù |
| `docs/20-quy-tac-nghiep-vu-van-hanh.md` | Auto-cancel + xếp buổi bù nối đuôi |
| `docs/22-adr-rule-chi-code-0038-0041.md` / ADR 0038 | Cần **đánh dấu gỡ**, không rewrite lịch sử (brief: ADR) |
| `docs/decisions/0038-*.md` | Tương tự ADR |
| `docs/10-data-model-v2.md` | Còn `makeupForSessionId` |
| `scripts/acceptance-report/flow-manifest.ts` | Còn `classSession.addMakeup`, displayName P3 buổi bù *(code/scripts — không thuộc docs task này)* |

---

## Verification

- Chỉ 3 file trên có diff trong phạm vi task.
- `rg` trên 3 file: mọi nhắc “buổi bù / Tier B” còn lại đều là **ghi chú gỡ 2026-08-12** hoặc “không còn…”, không còn yêu cầu implement/test Tier B.

---

## Status: DONE

| File | Chỗ đã sửa |
|------|------------|
| `docs/26-workflow-spec-p2.md` | L35–37 (WF-P2-01 edge); L65–68 (WF-P2-02 edge); L85–110 (WF-P2-03 swimlane, note 2026-08-12, happy path, exceptions, ADR, acceptance) |
| `docs/25-ma-tran-truy-vet-p1.md` | L48 (P3-11 story); L72 (ADR 0038 label) |
| `docs/29-test-plan.md` | L13–14 (kim tự tháp); L22 (coverage); L46–47 (bất biến exercise-open + hàng unit progression gapped) |
