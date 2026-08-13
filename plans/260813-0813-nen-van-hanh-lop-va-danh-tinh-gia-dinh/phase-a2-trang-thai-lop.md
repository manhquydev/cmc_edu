---
title: "A2: Trạng thái lớp + đóng và mở lại lớp"
status: pending
lane: A
dependencies: [A1]
---

# A2 — Lớp học có trạng thái thật, đóng được và mở lại được

## Hiện trạng: một ô chữ tự do chưa ai dùng

```prisma
// packages/db/prisma/schema.prisma:662-665
status  String  @default("active")
/// Not exercised by any P2-Foundation procedure yet
```

Chú thích trong chính mã tự nhận **chưa thủ tục nào dùng tới**. Không có đường đóng lớp, không
có đường mở lại. Bất kỳ đoạn mã nào cũng ghi được chuỗi tuỳ ý vào đó.

Nguồn có tập giá trị kiểm soát được:

```prisma
// cmc-lms/packages/db/prisma/schema.prisma:49-55
enum ClassStatus { planned  open  running  closed  cancelled }
```

Nhưng bên đó **thực tế chỉ dùng hai**: `running` và `closed`. Ba giá trị còn lại họ giữ lại chỉ
để nhận dữ liệu từ hệ cũ hơn.

## Vì sao phải làm trước khi nhập dữ liệu

Đây đúng cạm bẫy **E-2** đã gãy thật ở `cmc-lms`: họ chép `status='open'` từ hệ cũ sang hệ chỉ
làm việc với `running`, kết quả là **admin không sửa được unit của lớp** — lỗi im lặng, phát
hiện muộn.

Bảng ánh xạ là **hợp đồng của bước nhập dữ liệu** (E1 ở Đợt 5), không phải việc để script import
tự đoán lúc chạy.

## Tập giá trị đề xuất và bảng ánh xạ

Đề xuất giữ **đúng những gì trung tâm thật sự vận hành**, không chép cả 5 giá trị chỉ vì nguồn có:

| Giá trị đích | Nghĩa vận hành |
|---|---|
| `running` | Lớp đang dạy |
| `closed` | Lớp đã kết thúc |
| `cancelled` | Lớp bị huỷ, chưa từng chạy |

Ánh xạ từ nguồn:

| Nguồn | Đích | Ghi chú |
|---|---|---|
| `running` | `running` | Trực tiếp |
| `open` | `running` | **Chính chỗ E-2 đã gãy.** Nguồn coi `open` là lớp đã mở, chưa đóng |
| `planned` | `running` | Nguồn không dùng thật; lớp có buổi thì coi như đang chạy |
| `closed` | `closed` | Trực tiếp |
| `cancelled` | `cancelled` | Trực tiếp |
| Giá trị hiện có ở đích: `"active"` | `running` | Dữ liệu mẫu |

> Nếu khi nhập thật gặp lớp `planned` **chưa có buổi nào**, dừng và hỏi — **không** tự gán.
> Đây là luật E-6: để trống và hỏi, không bịa.

## Khoá quyền — chỗ dễ mở cửa sai

Kế hoạch bản đầu chỉ viết *"`requirePermission` + ghi vết"* mà **không chỉ định khoá nào**.
Red-team xếp đây là lỗi: nếu lấy nhầm khoá đọc lớp thì giáo viên và sale cũng vào được đường mở
lại lớp — mà mở lại lớp sẽ **hồi sinh buổi học** (A3), tức là chạm dữ liệu dạy và chấm công.

Đóng và mở lại lớp là **quyết định vận hành đào tạo**, cùng loại với cấp/thu quyền học
(`enrollment.grantUnits` hiện thuộc GĐĐT, và registry ghi rõ *"NEVER sale — SoD: money seat ≠
teaching rights"*).

⇒ Dùng khoá thuộc nhóm vận hành đào tạo, **không** dùng khoá đọc lớp, **không** cấp cho sale.
Khoá cụ thể chốt khi thi hành, đối chiếu `packages/auth/src/index.ts`, và phải thêm vào cả
registry lẫn `PermissionGate` của route quản trị.

## Ràng buộc bắt buộc

| # | Ràng buộc | Vì sao |
|---|---|---|
| 1 | Trạng thái là **tập đóng**, không phải chuỗi tự do | Ngăn đúng lỗi E-2: một đoạn mã ghi giá trị lạ, hỏng im lặng |
| 2 | Bảng ánh xạ viết **trong phase này**, trước khi có script nhập | Đây là hợp đồng E1, không phải suy đoán lúc chạy |
| 3 | Đóng/mở lại lớp dùng khoá **vận hành đào tạo**, không phải khoá đọc | Mở lại lớp chạm dữ liệu dạy và chấm công |
| 4 | Sale **không** có khoá này | Giữ đúng SoD hiện có |
| 5 | Mọi lần đóng/mở lại ghi `AuditLog` kèm người và thời điểm | Đây là thao tác đảo ngược được nhưng có hệ quả |
| 6 | Đóng lớp ở phase này **chưa** hủy buổi | Việc đó thuộc A3; tách ra để mỗi PR review được |

## Các bước

1. Đổi cột trạng thái sang tập đóng; migration ánh xạ `"active"` → `running`.
2. Viết bảng ánh xạ nguồn → đích vào phase này và vào tài liệu quyết định.
3. Thêm khoá quyền mới vào registry + test registry.
4. Thêm thủ tục đóng lớp và mở lại lớp, có quyền + ghi vết.
5. Bọc `PermissionGate` cho màn quản trị tương ứng; thêm mục điều hướng nếu cần.

## Kiểm chứng

| Cổng | Cách đo |
|---|---|
| Tập đóng | Ghi một giá trị ngoài tập ⇒ bị từ chối ở tầng dữ liệu, không chỉ ở tầng ứng dụng |
| Ánh xạ | Bảng ánh xạ 5 giá trị nguồn có mặt trong phase và trong tài liệu quyết định |
| Quyền | Test âm: giáo viên và sale gọi đóng/mở lại lớp ⇒ bị từ chối |
| Ghi vết | Mỗi lần đóng/mở lại sinh đúng một bản ghi vết có người thực hiện |
| Không rò sang A3 | Đóng lớp ở phase này **không** đổi trạng thái buổi nào |

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Chọn nhầm khoá quyền ⇒ mở cửa cho vai trò không nên có | Đối chiếu registry và ADR phân quyền trước khi thêm; test âm bắt buộc |
| Tập giá trị chọn hẹp quá, sau phải mở rộng | Mở rộng tập đóng là thao tác rẻ; thu hẹp mới đắt. Chọn hẹp là hướng an toàn |
| Nhập dữ liệu gặp trạng thái ngoài bảng ánh xạ | Dừng và hỏi, không tự gán (E-6) |
| Đổi kiểu cột làm gãy chỗ đang đọc chuỗi | Rà mọi nơi đọc trạng thái lớp trước khi đổi; hiện chú thích nói chưa ai dùng, nhưng phải kiểm chứ không tin chú thích |
