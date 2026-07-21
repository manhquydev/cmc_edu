# Brainstorm — Chấm công theo cặp vào/ra mỗi ngày

- Ngày: 2026-07-13
- Nhánh: main
- Trạng thái: Đã chốt thiết kế (Accepted, CHƯA implement)
- Decision record: `docs/decisions/0043-attendance-daily-inout-pairing.md`
- Modes: (none — không --html/--wiki)

## Vấn đề

Chủ sản phẩm rà soát luồng chấm công thực (đọc code, không đọc docs) và thấy code
đang chạy khác nghiệp vụ mong muốn ở 3 điểm cốt lõi: (1) không có khái niệm
vào/ra rõ ràng, (2) bấm ngoài mạng bị từ chối thẳng thay vì tạo phiếu, (3) cho
chấm bù ngày quá khứ tùy ý. Cần chốt mô hình đúng và ghi vào docs/harness để
tránh ảo giác / mất nghiệp vụ về sau.

## Hiện trạng code (ground truth)

- `checkInOut.punch` (apps/api/src/checkin/router.ts): mỗi lần bấm append 1
  `TimePunch` giống nhau (chỉ giờ + IP), không nhãn vào/ra. Ngoài mạng → từ chối
  `IP_NOT_ALLOWED`, không ghi gì. Cooldown 5 phút.
- Vào/ra suy ra SAU lúc tính lương/KPI qua `assignPunchesToShifts`
  (packages/domain-payroll) — ghép từng ca ±2h, dùng chung payroll + KPI.
- `ManualAttendanceTicket`: chỉ ngày + lý do (không có trường giờ). Duyệt = miễn
  cả ngày. Người duyệt = quản lý trực tiếp (`managerId`), không theo track.
- Trang `/hr/checkin` (check-in-out.tsx): 1 nút, banner tĩnh; form chấm tay nhập
  ngày tùy ý + lý do.

## Mô hình chốt (đích)

Xem đầy đủ 12 quy tắc ở decision record. Tóm tắt:

1. 1 checkin (mốc đầu/ngày) + 1 checkout (mốc cuối/ngày).
2. Trong mạng → hợp lệ ngay; ngoài mạng → vẫn ghi nhận + tạo phiếu (lần offsite
   đầu ngày ép lý do), phiếu mang giờ vào/ra, luôn cần duyệt tay, không tự duyệt.
3. Có cặp vào/ra = tất cả ca ngày đó có công (kể cả ca cách quãng — nới lỏng có
   chủ đích).
4. Muộn/sớm so khung ngoài cùng (ca sớm nhất bắt đầu / ca muộn nhất kết thúc), 1
   kết luận chung/ngày. Đơn giá phạt giữ nguyên.
5. Bỏ chấm bù ngày tùy ý. Phiếu bị từ chối → không công + cho gửi lại lý do.
6. Người duyệt phiếu = GĐ theo track (KD/ĐT), bỏ managerId.
7. UI: chống double-tap ~10s (bỏ cooldown 5 phút); nút đổi trạng thái 5s rồi tự về.

## Quyết định của người dùng (Discovery)

| Câu hỏi | Chọn |
|---|---|
| Nhiều ca/ngày | 1 cặp vào/ra/ngày; muộn/sớm suy từ giờ vs khung ca |
| Cooldown | Chống double-tap ~10s |
| Phiếu ngoài mạng duyệt | Coi giờ trên phiếu là chấm công hợp lệ |
| Form chấm bù ngày tùy ý | Bỏ (quên = tự chịu) |
| Mốc muộn/sớm nhiều ca | Khung ngoài cùng |
| Ca cách quãng | Tính đủ (ưu tiên đơn giản) |
| Phiếu bị từ chối | Không công + cho gửi lại lý do |
| Người duyệt phiếu | GĐ theo track |
| Cách ghi docs | Doc quyết định + harness, đánh dấu chưa implement |

## Rủi ro & lưu ý

- **Blast radius lớn**: viết lại lõi ghép công dùng chung payroll + KPI → cần TDD.
- Mô hình "1 cặp bao trùm" nới lỏng gian lận về-giữa-buổi (đã chấp nhận).
- Đổi duyệt managerId → track là thay đổi ủy quyền — cần rà dữ liệu hiện có.
- Drift phụ: TL27 ghi URL `/attendance/check-in-out`, thực tế `/hr/checkin`.

## Đã ghi lại (harness delta)

- `docs/decisions/0043-attendance-daily-inout-pairing.md` (Accepted, chưa impl).
- Đăng ký durable: `harness-cli decision add 0043-...`.
- Con trỏ SUPERSEDED-PENDING ở TL27 §WF-P3-01 và §WF-P3-02.

## Next steps

- Bước impl (khi sẵn sàng): `/ck:plan --tdd` với input là decision 0043 — vì đây
  là viết lại lõi tính công có test coverage cần khóa hành vi trước khi đổi.
- Chi tiết spec (TL10/11/19/20/27) cập nhật đúng lúc code đổi, không trước.

## Câu hỏi chưa giải quyết

- Nghỉ phép / nghỉ ốm hợp lệ (ngày không đi làm nhưng không bị trừ công) — hiện
  ngoài phạm vi; cần module nghỉ phép riêng hay dùng chính phiếu này? Chưa chốt.
- Ngày có ca đăng ký nhưng nhân viên KHÔNG bấm lần nào → không công (đã chốt),
  nhưng có cần cảnh báo/nhắc nhân viên cuối ngày không? Chưa bàn.
