---
phase: 4
title: "Ghi chú thuyết minh, diễn thử, kiểm thử phòng họp"
status: completed
dependencies: [2, 3]
---

# Phase 4 — Ghi chú, diễn thử, kiểm thử

Phase biến "một bộ slide đẹp" thành "một buổi thuyết trình chạy được". Phần lớn sự cố thuyết trình
xảy ra ở đây chứ không ở nội dung.

## Đính chính so với bản kế hoạch đầu

Bản đầu tuyên bố **"tài liệu để lại đến miễn phí"** qua xuất PDF. Red-team bác bỏ, và đúng: kế hoạch
tự mâu thuẫn ba chỗ — Phase 2 đòi mạch chính *"gần như chỉ có hình"*, tiêu chí toàn cục đòi ≤ 25 từ,
phase này đòi ghi chú là *"gạch đầu dòng gợi ý"*. Ba yêu cầu đó cùng nhau **tối thiểu hoá đúng thứ
làm nên một tài liệu đứng một mình**.

Chốt lại:

- Xuất PDF vẫn làm, nhưng **chỉ để dự phòng khi deck lỗi tại phòng họp** — không phải tài liệu để lại
- **Tài liệu chi tiết để lại là sản phẩm riêng, ngoài phạm vi bản kế hoạch này**
- Bản PDF dự phòng **không** kèm ghi chú thuyết minh. Bản đầu định bật `showNotes: 'separate-page'`,
  làm vậy là đưa toàn bộ ghi chú nội bộ vào tay người xem — mâu thuẫn trực tiếp với chính tiêu chí
  "khách không thấy ghi chú"

## Requirements

1. Ghi chú thuyết minh ở màn hình phụ, khách **không** thấy — kể cả trong bản PDF
2. Ghi chú là **gạch đầu dòng gợi ý**, không phải kịch bản đọc
3. Diễn thử có bấm giờ, vừa khung **60–90 phút**
4. Kiểm thử trên thiết bị trình chiếu thật

## Nguyên tắc viết ghi chú

Người nói **không** mô tả lại cái đang hiện trên màn hình. Màn hình lo phần *cái gì*, người nói lo
phần *tại sao* và *nó có ý nghĩa gì với người nghe*.

Mỗi màn: **3–4 gạch đầu dòng**. Kèm một câu chuyển sang màn sau, và câu trả lời cho câu hỏi hay bị
hỏi nhất ở màn đó.

Đối tượng là **ban giám đốc CMC nội bộ** ⇒ ghi chú nên nhấn vào vận hành hằng ngày và điểm nghẽn
thực tế, bớt phần thủ tục nghiệm thu.

## Phiên bản deck

Deck sẽ được trình bày nhiều lần, nội dung sẽ đổi giữa các lần. Cần:

- Số phiên bản + ngày hiện kín đáo ở góc
- Commit SHA của lần build, để đối chiếu ngược khi có tranh luận về số liệu

## Files

- `scripts/presentation/content/presenter-notes.ts`
- `scripts/presentation/templates/deck-shell.ts` — bật notes màn phụ, cấu hình PDF **không** kèm notes
- `plans/reports/` — biên bản diễn thử và kiểm thử phòng họp (thư mục báo cáo chuẩn của dự án)

## Steps

1. Viết ghi chú cho mạch chính trước — phần cần dẫn dắt nhất
2. Viết ghi chú cho các luồng hay bị hỏi sâu: cổng tiền, sinh tài khoản tự động, chấm công, lương
3. Bật màn hình phụ, kiểm ghi chú **không** lọt sang màn khách
4. Cấu hình PDF dự phòng: `pdfSeparateFragments: false` (để mặc định thì mỗi bước hiện dần tách một
   trang, bản in phình lên hàng trăm trang), **không** bật `showNotes`
5. **Diễn thử trọn buổi có bấm giờ** — làm sớm, ngay khi mạch chính xong, đừng để tới cuối
6. **Kiểm thử phòng họp thật:** máy chiếu hoặc màn ngoài độ phân giải thấp hơn · **ngắt mạng hoàn
   toàn** · máy không cài font riêng · đứng xa bằng khoảng cách người ngồi cuối phòng

## Validation

- [ ] Ghi chú hiện đúng ở màn phụ, **0** rò sang màn khách
- [ ] Bản PDF dự phòng **không** chứa ghi chú thuyết minh
- [ ] Số trang PDF ở mức hợp lý (không phình do tách trang từng bước)
- [ ] Chạy được khi **ngắt mạng hoàn toàn**
- [ ] Đọc được ở độ phân giải máy chiếu, nhìn từ cuối phòng
- [ ] Tiếng Việt đúng dấu trên máy không cài font
- [ ] Diễn thử trọn buổi ít nhất một lượt, **vừa khung 60–90 phút**, có ghi thời lượng thực tế
- [ ] Bản PDF dự phòng nằm sẵn trên máy trình chiếu

## Risks / Rollback

- **Máy phòng họp thiếu font / trình duyệt cũ** — dùng font stack hệ thống, mang máy riêng, luôn có
  PDF dự phòng.
- **Ghi chú lọt sang màn khách** — phải kiểm thật với hai màn hình, không suy đoán.
- **Vượt khung thời gian** — chỉ phát hiện được bằng diễn thử có bấm giờ; vì vậy diễn thử đặt ở bước
  5 chứ không phải bước cuối.
- **Rollback:** deck lỗi tại phòng họp → bản PDF dự phòng vẫn trình bày được trọn nội dung.
