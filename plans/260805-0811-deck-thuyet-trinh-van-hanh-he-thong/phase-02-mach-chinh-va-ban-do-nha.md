---
phase: 2
title: "Mạch chính: câu chuyện xuyên suốt + bản đồ nhà"
status: completed
dependencies: [1]
---

# Phase 2 — Mạch chính và bản đồ nhà

Đây là phần quyết định buổi thuyết trình thành hay bại. Nếu 10 phút đầu khách không "vào" được, mọi
chi tiết phía sau đều vô nghĩa.

## Context

Nguyên tắc từ research (Mayer, redundancy principle): khi có người nói, chữ trên màn hình **cạnh
tranh** với lời nói. Người xem không vừa đọc vừa nghe được — họ bỏ một trong hai, thường bỏ người
nói. Nên mạch chính phải gần như **chỉ có hình**.

## Requirements

1. **Mạch kể theo nhân vật**, không theo cấu trúc hệ thống
2. **Bản đồ nhà** — một màn hình toàn cảnh, bấm được, là nơi luôn quay về
3. Mỗi màn hình một ý, **≤ 25 từ** — ngưỡng này **chỉ áp cho mạch chính**, không áp cho màn tra cứu
   ở Phase 3 (hai loại màn có nhiệm vụ khác nhau)
4. Nội dung hiện dần theo từng bước, người nói kiểm soát nhịp
5. **Ngân sách thời lượng: ~40 phút** cho toàn mạch chính, chừa 20–50 phút hỏi đáp trong khung
   60–90 phút đã chốt. Khoảng 8 chặng ⇒ trung bình ~5 phút/chặng

## Nội dung mạch chính

Bám **một học sinh** và những người chạm vào em ấy — không kể theo "hệ thống có 4 cụm":

1. Phụ huynh quan tâm → Sale tư vấn, cho học thử
2. Chốt → Sale lập phiếu thu **nháp** *(nhấn: chỉ là nháp)*
3. **Cổng tiền** — Giám đốc Kinh doanh duyệt; vượt ngưỡng cần mắt-thứ-hai
4. **Hệ thống tự làm** — sinh tài khoản phụ huynh + học sinh, kích hoạt ghi danh, gửi email.
   *Không ai ngồi nhập tay.* Đây là khoảnh khắc "wow", cho nó một màn hình riêng
5. Học sinh vào lớp → giáo viên điểm danh, giao bài, chấm bài, cộng sao
6. Phụ huynh mở app xem lịch, kết quả, ảnh buổi học
7. Cuối tháng — chấm công, ca làm, KPI, chốt lương giáo viên
8. Vòng sau — đổi quà, họp phụ huynh, chăm sóc sau bán

Mỗi chặng kết bằng một câu hỏi mở dẫn sang chặng sau, để người nói có chỗ bắc cầu tự nhiên.

## Bản đồ nhà

Một màn hình duy nhất, luôn quay về được bằng một phím:

- Các vai trò con người + khối "⚙️ Hệ thống tự làm" + khối "🤖 AI soạn nháp"
- 4 cụm nghiệp vụ
- 3 cổng kiểm soát: cổng tiền · cổng lịch-ca · cổng tự động
- Mỗi khối **bấm được** → nhảy thẳng tới phần chi tiết tương ứng (Phase 3)

Đây là thứ giải quyết tình huống hay xảy ra nhất trong buổi nghiệm thu: khách ngắt lời "quay lại
chỗ duyệt tiền xem nào".

## Files

- `scripts/presentation/content/spine.ts` — nội dung mạch chính
- `scripts/presentation/content/home-map.ts` — dữ liệu bản đồ
- `scripts/presentation/diagram/home-map.ts` — vẽ bản đồ + vùng bấm
- `scripts/presentation/templates/deck-shell.ts` — thêm phím tắt "về nhà"

## Steps

1. Viết nội dung 8 chặng, mỗi chặng 1–3 màn hình
2. Chọn loại hình cho từng chặng theo bảng L1–L4 ở `plan.md`
3. Dựng bản đồ nhà, gắn liên kết tới id slide
4. Gán phím tắt "về nhà"
5. Chạy script đếm từ; màn nào vượt 25 từ thì cắt chữ, không thu nhỏ cỡ chữ

## Validation

- [ ] Đi hết mạch chính bằng phím mũi tên, không cần chuột
- [ ] Từ bản đồ nhà bấm tới bất kỳ cụm/vai trò nào trong 1 thao tác
- [ ] Từ bất kỳ đâu về được bản đồ nhà trong 1 thao tác
- [ ] Script đếm từ: **0** màn hình vượt 25 từ
- [ ] Grep từ cấm trên nội dung mạch chính → **0** kết quả
- [ ] Thử đọc to toàn mạch: kể trôi được, không phải đọc chữ trên màn hình

## Risks / Rollback

- **Mạch kể nhạt** — nguy cơ lớn nhất, không phát hiện được bằng test tự động. Giảm thiểu: đọc to
  thành tiếng ít nhất một lượt trước khi coi là xong.
- **Bản đồ quá rậm** — nếu vẽ đủ mọi thứ sẽ thành rối. Giữ đúng mức khối lớn; chi tiết để Phase 3.
- **Rollback:** nội dung nằm trong `content/`, xoá file là quay về khung Phase 1.
