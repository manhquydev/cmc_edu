# Đặc tả nguồn — bóc tách `cmc-lms` (2026-08-12)

Sản phẩm của 10 agent đọc song song (`grok` ×5, `pi`, `codex`) trên hai repo.
**Mọi khẳng định kèm `file:dòng`.** Đây là nguồn cho `../plan.md` và các phase.

| File | Nội dung | Repo đọc |
|------|----------|----------|
| `BR1-lop-lich-unit.md` | Lớp / khung lịch / sinh buổi / neo unit / restamp / hủy / cron | `cmc-lms` |
| `BR2-ghidanh-quyen-diemdanh.md` | Ghi danh / dải unit / điểm danh / vòng đời HS / gia đình | `cmc-lms` |
| `BR3-baitap-cham-sao-nhatky.md` | Thư viện bài / phát bài / nộp / chấm / sao / nhật ký buổi | `cmc-lms` |
| `BR4-rang-buoc-erp-an-toan.md` | Ràng buộc BẮT BUỘC: facility+RLS, RBAC, audit, ADR 0041, seam ERP | `cmc_edu` |
| `BR5-no-nghiep-vu-cu-can-go.md` | Nợ nghiệp vụ cũ phải gỡ + **đếm file/test phụ thuộc** | `cmc_edu` |
| `J1-docs-spec.md` | Toàn bộ `docs/` + **10 điểm LỆCH docs↔code** | `cmc-lms` |
| `J2-why-day-hoc.md` | **Vì sao** bỏ buổi bù, vì sao unit theo số buổi | `cmc-lms` journals |
| `J3-why-danh-tinh.md` | **Vì sao** gộp PH/HS, cutover family trên prod | `cmc-lms` journals |
| `J4-su-co-bai-hoc.md` | 13 sự cố production thật + bài học migration | `cmc-lms` journals |

## Cách dùng

- **Trước khi implement một mảng** → đọc BR tương ứng để lấy luật chính xác.
- **Trước khi bỏ / đổi một thứ** → đọc J1 §8 và J2/J3 để biết `cmc-lms` **đã thử rồi bỏ** chưa, và vì sao.
- **Trước khi viết service mới** → đọc BR4, đây là ràng buộc không thương lượng của `cmc_edu`.
- **Trước khi import** → đọc J4 §1 và §3, mỗi dòng là một sự cố có thật.

## Cảnh báo về độ tin cậy

| Nguồn | Lưu ý |
|-------|-------|
| `docs/` của `cmc-lms` | **Có drift** — J1 tìm 10 điểm lệch. `class-unit-spec.md` đáng tin; `project-overview` / `role-matrix` / `README` còn wording "unit theo mùng 1" đã lỗi thời |
| `docs/decisions/` của `cmc-lms` | **Trống** — nguồn "vì sao" thật nằm ở `plans/journals/` |
| BR6 (đối chiếu 310 luật) | **Không lưu ở đây.** Thống kê 15 khớp / 266 lệch / 29 thiếu là **chỉ dấu, không phải phép đo**: nhiều dòng dùng lại cùng một bằng chứng cho các luật khác nhau ⇒ nhóm "lệch" bị thổi phồng. Dùng để cảm nhận quy mô, không dùng để lập kế hoạch chi tiết |

Không nguồn nào ở đây thay thế việc đọc code khi implement.
