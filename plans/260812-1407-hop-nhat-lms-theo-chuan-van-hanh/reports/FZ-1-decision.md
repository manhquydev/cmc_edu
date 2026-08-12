# FZ-1 — Ghi quyết định đóng băng `cmc-lms`

**Ngày:** 2026-08-12
**Owner files:** `plans/reports/decisions-owner-260812-cau-6-7.md`, `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/plan.md`
**Skill:** `/ak:docs` update — reconcile stateful decision/plan records with owner decision 2026-08-12
**Không commit.** Không sửa file khác.

## Quyết định đã ghi

| | |
|---|---|
| Commit | `031d193` (`031d19360845bf1d4f680ef911e16282d583f69b`) |
| Ngày commit | 2026-08-09 |
| Nhánh | `develop` = `main`, không phân kỳ |
| Ngày chốt | 2026-08-12 |
| Nghĩa vận hành | Từ 12/08 `cmc-lms` ngừng thêm tính năng mới; vẫn sửa lỗi; bản chuẩn port là `031d193` |

## Chỗ đã sửa

### `plans/reports/decisions-owner-260812-cau-6-7.md`

1. **Bối cảnh** — dòng về `cmc-lms` vẫn tiến hóa: giữ ngữ cảnh review, thêm **Đã chốt 12/08** tại `031d193`.
2. **Câu 7** — thêm bảng mốc (commit đầy đủ, ngày commit, hai nhánh không phân kỳ, ngày chốt) + đoạn nghĩa vận hành (ngừng tính năng mới, vẫn sửa lỗi, bản chuẩn port, không tắt hệ cũ).
3. **Bảng giai đoạn Câu 7** — thay "chốt một mốc" bằng neo cụ thể `031d193`.
4. **Ánh xạ kỹ thuật** — Câu 7 ghi mốc `031d193`; cột chặn đổi thành **Đã chốt 12/08 — không còn chặn**.
5. **Việc làm tiếp theo mục 1** — hết "chưa có, cần lấy"; đánh **ĐÃ CHỐT** kèm commit/ngày/nhánh/nghĩa vận hành.
6. **Câu kết** — hết "còn thiếu mốc đóng băng"; ghi port danh tính không còn chờ mục 1.

### `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/plan.md`

Đợt đã đánh số lại 1–5 (nền dữ liệu / bài tập / danh tính / vận hành+gói bán / nhập+cắt chuyển). Sửa theo số mới.

1. **Tiêu đề** `Điều kiện tiên quyết chưa có` → `Điều kiện tiên quyết` (mục 1 và 2 đã chốt).
2. **Bảng tiên quyết mục 1** — gạch ngang + **ĐÃ CHỐT 12/08: commit `031d193`**; cột chặn đợt ~~2, 3~~; ai quyết ✅.
3. **Đoạn "còn bị chặn"** — Đợt 1 vẫn chỉ chờ mục 3; mục 1 hết chặn Đợt 2 và 3. Còn chặn: mục 3b (Bright I.G → Đợt 2/4/5), mục 4–6 (Đợt 4).
4. **Quyết định đã chốt 2026-08-12** — thêm hàng mốc đóng băng.
5. **R1** — giảm thiểu đổi thành đã chốt tại `031d193`; tiên quyết #1 hết chặn.

## Quét nhất quán trong hai file sở hữu

Không còn câu nào nói mốc đóng băng *chưa có*. Các chỗ "chưa có" còn lại không liên quan (không có người dùng thật, Đợt 4 chưa có phase file riêng).

## Chỗ khác (không sửa — ngoài phạm vi)

- `plans/reports/brainstorm-260812-1407-boc-tach-nghiep-vu-merge-lms.md` mục 8 và "Câu hỏi chưa giải quyết" vẫn ghi mốc đóng băng chưa có.
- `phase-02-dot-b-chuoi-domino-bai-tap.md` chỉ hỏi sóng nào *phụ thuộc* mốc; không khẳng định mốc còn thiếu. Sóng 2 (B5/B6) hết chặn về phía freeze.

## Validation

- Đọc lại cả hai file sau khi sửa.
- Grep `đóng băng` / `chưa có` / `chặn từ Đợt` trong đúng hai file sở hữu.
- Không đụng code sản phẩm. Không commit.

Status: DONE
