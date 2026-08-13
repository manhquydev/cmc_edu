# Phân xử validate — 4 vòng song song, 2026-08-13

Bốn góc: nhất quán toàn kế hoạch · khả thi kỹ thuật A1 · cổng nghiệm thu có đo được không ·
đủ chưa để mở khoá Đợt 5.

**Kết luận chung của cả bốn:** `DONE_WITH_CONCERNS`. Câu trả lời cho *"đủ để mở hai nhánh song
song hôm nay chưa?"* là **chưa** — và đó là kết luận đúng. Bản kế hoạch đã được sửa theo bên dưới.

---

## Đã sửa

| # | Validate chỉ ra | Đã làm gì |
|---|---|---|
| 1 | `plan.md` giao việc vòng đời cho **A2**, nhưng vòng đời nằm ở **A4** | Sửa bảng trộn nhánh; A2 chỉ còn trạng thái lớp |
| 2 | Bảng "file cả hai làn đều sửa" **thiếu 6 file** | Bổ sung đủ: `lms-auth/router.ts`, `lms-auth/login.test.ts`, `exercise/open-tier.ts`, `enrollment/router.ts`, `packages/auth/src/index.ts`, `provisioning/provision-from-receipt.ts`. Thêm danh sách 4 file **chỉ một làn** đụng để khỏi tranh chấp nhầm |
| 3 | Không ghi **mốc rebase** của Làn B | Chốt: B rebase sau khi **A4** vào `develop`; trước đó B mở nhánh được nhưng **không mở PR** |
| 4 | Hợp đồng hàm A4 → B1 **chưa chốt** | Ghi rõ hàm nhận gì, trả gì; chữ ký cụ thể chốt ở bước đầu A4 |
| 5 | Quyết định #3 (hằng số ngưỡng) và #4 (`PermissionGate`) **không phase nào nhận** | **Chuyển sang Đợt 4.** Cả hai thuộc miền tài chính; nhét vào kế hoạch lớp/buổi làm PR mất mạch. Không chặn gì ở đây |
| 6 | H-10: khoá bài học vẫn "chọn lúc thi hành" | **Chốt**: `(chương trình, thứ tự unit toàn cục, thứ tự bài trong unit)`, kèm mã bài làm trường đối chiếu |
| 7 | M-3: hai hợp đồng `studentId` **phân tích rồi không chọn** | **Chốt**: một hợp đồng duy nhất — mọi thủ tục nhận `studentId` tường minh; token không mang `studentId`. Lý do quyết định: nếu con đang chọn nằm trong token thì "đổi con không xác thực lại" **không thể chạy** |
| 8 | M-6: cơ chế làm chết phiên **chưa chọn** | **Chốt**: tăng `tokenVersion` — cơ chế đã có và đang chạy |
| 9 | M-5: bắt buộc có chính sách giới hạn thử nhưng **chưa viết** | **Chốt**: sao khuôn đã có ở `StudentAccount` (`schema.prisma:486-490`) |
| 10 | A1 chỉ nêu 2 đường tạo buổi, thực tế có **3** | Bổ sung `apps/api/src/lms-ops/router.ts:194-204` vào ràng buộc |
| 11 | A1 chưa viết **hợp đồng thời điểm** cho khoá mới | Thêm ràng buộc 3c + phần giải thích: khoá so tới mili giây, mọi writer phải đi qua một hàm chuyển giờ nhận `"HH:mm"` |
| 12 | Con số "3 flow" của B1 **sai** | Thay bằng lệnh đo (`pnpm acceptance:report` trước và sau), không khẳng định số |

---

## Xác nhận từ validate — không phải lỗi

| Điều được kiểm | Kết quả |
|---|---|
| Đổi khoá duy nhất của buổi có khả thi không | **Có.** Không nơi nào dùng `upsert`/`findUnique` theo khoá cũ; chỉ 3 chỗ tạo hàng loạt |
| Dùng cột thời điểm làm khoá duy nhất có an toàn không | **Có**, vì mọi hàng đi qua cùng một hàm chuyển giờ, giây và mili đều bằng 0 |
| Thứ tự A1 → A2 → A3 có đảo không | **Không đảo.** A1 chưa hủy buổi khi gỡ khung; A2 chưa hủy buổi khi đóng lớp; A3 mới móc cả hai |
| Khung test có đủ đo gần hết cổng không | **Đủ** |

---

## Còn mở — ghi ra, không giấu

| # | Việc | Vì sao chưa xử ở kế hoạch này |
|---|---|---|
| 1 | Cổng "đóng lớp không đụng buổi" của A2 sẽ **bị A3 đảo** | Đúng — A3 làm đóng lớp hủy buổi. Cổng đó chỉ đúng **trong phạm vi A2**; khi A3 xong thì test tương ứng chuyển chủ sang A3. Ghi vào A3 lúc thi hành |
| 2 | Cách đo migration **lùi** của enum vòng đời (A4) | Repo chưa có khuôn đo migration lùi; A4 phải dựng cách đo hoặc hạ cổng xuống "tiến được + dữ liệu đúng" |
| 3 | Đợt 5 **vẫn chưa mở khoá** sau A1–A5 + B1 | Còn thiếu chỗ chứa: giáo viên trên khung lịch, mốc hiệu lực khung, điểm danh có phép, học bạ, họp phụ huynh, và 6 bảng chưa có nhà. Cộng thêm: gói bán trống, gán cơ sở, hash mật khẩu |
| 4 | Khoá ổn định xuyên hệ mới có cho **bài học** và **mã học sinh** | Lớp, buổi, phụ huynh chưa có. Thuộc Đợt 5, nhưng phải chốt **trước** khi viết script nhập |

> Mục 3 là điều đáng nói nhất: kế hoạch này **thu hẹp** khoảng cách tới Đợt 5 chứ **không mở khoá**
> được nó. Đừng đọc nhầm là xong A5 thì nhập được dữ liệu.

Status: DONE
Summary: 12 phát hiện đã sửa vào kế hoạch, 4 xác nhận không phải lỗi, 4 còn mở được ghi tường minh. Kế hoạch giờ thi hành được; nhưng nó không mở khoá Đợt 5, chỉ thu hẹp khoảng cách.
