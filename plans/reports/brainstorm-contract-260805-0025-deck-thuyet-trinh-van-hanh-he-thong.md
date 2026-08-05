# Giao kèo Brainstorm — Bộ trình bày trực quan có người thuyết minh

**Ngày:** 2026-08-05 · **Tiền đề:** `plans/reports/advisory-bao-cao-van-hanh-260805-0019-bao-cao-nghiep-vu-cho-khach-hang-report.md`

---

## Chỗ đảo trọng tâm so với bản tư vấn trước

Bản tư vấn trước thiết kế cho **người đọc một mình**: ba tầng, chi tiết đầy đủ, tự giải thích.
Người dùng nay xác nhận **họ là người thuyết minh trực tiếp**. Nguyên tắc lật ngược:

> Khi có người nói, chữ trên màn hình **cạnh tranh** với lời nói chứ không hỗ trợ. Người xem không
> thể vừa đọc vừa nghe — họ sẽ bỏ một trong hai, và thường bỏ người nói.

Hệ quả: artifact chính phải **ít chữ, nhiều hình**; phần chi tiết đầy đủ **không biến mất** mà tách
ra thành tài liệu để lại sau buổi. **Hai sản phẩm, hai nhiệm vụ** — không phải một.

Bốn quyết định đã chốt ở phiên trước giữ nguyên hiệu lực, chỉ đổi thứ tự ưu tiên: **bản trình bày
làm trước, tài liệu để lại làm sau** — ngược với thứ tự cũ.

> **Sửa đổi 2026-08-05 (cùng phiên, muộn hơn):** người dùng chốt **bỏ ảnh chụp hệ thống thật**, chỉ
> dùng sơ đồ. Điều này đảo lựa chọn "ảnh thật cho luồng chính" ở trên. Nhu cầu gốc — cho người nghe
> thấy giao diện trông ra sao — được đáp bằng **phác hoạ bố cục màn hình vẽ SVG**, không chứa dữ
> liệu thật. Hệ quả: toàn bộ rủi ro dữ liệu trẻ em rời khỏi phạm vi.
>
> **Số luồng:** giao kèo này ghi "38"; con số đúng là **cái manifest báo lúc build**. Nó đã đi
> 38 → 39 → 38 chỉ trong một ngày. Không chốt số trong tài liệu.

---

## Outcome

Một bộ trình bày trực quan chạy offline, người dùng cầm bàn phím điều khiển, dùng để đứng thuyết
minh trước khách hàng về **toàn bộ cách vận hành CMC EDU v2**: 7 vai trò, 4 cụm nghiệp vụ, 38 luồng.
Đích đến là khách **hình dung được hệ thống chạy thật ngoài đời trông ra sao**, không phải đọc hiểu
một tài liệu.

## Constraints

**Về hình thức trình bày**
- Người thuyết minh là kênh thông tin chính → mỗi màn hình một ý, chữ tối thiểu
- Người thuyết minh tự kiểm soát nhịp bằng bàn phím; nội dung hiện dần theo từng bước
- Phải nhảy được tới bất kỳ phần nào khi khách hỏi ngang, rồi quay lại mạch cũ
- Có ghi chú riêng cho người thuyết minh, khách không nhìn thấy

**Về kỹ thuật**
- Chạy offline hoàn toàn, không phụ thuộc mạng tại phòng họp
- Tiếng Việt phải render đúng dấu, kể cả khi máy trình chiếu thiếu font
- Solo dev + AI bảo trì → ít nghi thức, ít phụ thuộc

**Về nội dung và an toàn**
- Đủ 38 luồng / 4 cụm / 7 vai trò — không cắt phạm vi
- Ảnh màn hình **chỉ** sinh từ synthetic-seed. Tuyệt đối không từ local-sim: DB đó chứa `cmc_prod`
  với **dữ liệu trẻ em thật**
- Nhãn trạng thái sinh từ `pnpm acceptance:report`, không gõ tay
- Không dùng ngôn ngữ dev ở phần khách nhìn thấy

## Non-goals

- Không thay thế tài liệu chi tiết để lại — đó là sản phẩm riêng, làm sau
- Không dựng hệ thống quản lý slide dùng chung cho mọi mục đích
- Không demo hệ thống chạy trực tiếp trong buổi (rủi ro vỡ trận; dùng ảnh/clip quay sẵn)
- Không mở lại 4 vai trò đang tạm gác (`ke_toan`, `cskh`, `ctv_mkt`, `hr`)
- Không sửa code sản phẩm để phục vụ việc trình bày
- Chưa làm bản tiếng Anh

## Acceptance criteria

Đo được, không cảm tính:

1. Mở bằng trình duyệt trên máy **đã ngắt mạng** → chạy đủ chức năng
2. Đi hết mạch chính chỉ bằng phím mũi tên, không cần chuột
3. Nhảy tới bất kỳ vai trò hoặc luồng nào trong **≤ 2 thao tác**
4. Đủ **38/38** luồng; mỗi luồng trả lời được 4 câu: ai bắt đầu · ai duyệt · hệ thống tự làm gì ·
   xem kết quả ở đâu
5. Ngưỡng chữ mỗi màn hình khách nhìn: **≤ 25 từ** (đếm được bằng script)
6. Grep danh sách từ cấm (`tRPC`, `procedure`, `router`, `enum`, `RLS`, `migration`, `schema`,
   `endpoint`, `middleware`) trên phần khách nhìn → **0 kết quả**
7. Nhãn trạng thái khớp output `pnpm acceptance:report`, kèm commit SHA và cờ sạch/bẩn
8. **0** ảnh có nguồn từ local-sim — truy được nguồn từng ảnh
9. Có ghi chú người thuyết minh, tách khỏi màn hình khách thấy
10. Tiếng Việt hiển thị đúng dấu trên máy không cài font riêng

---

## Ba hướng hình thức đã cân nhắc

| | Hướng | Mạnh | Yếu |
|---|---|---|---|
| **A** | Deck tuyến tính, hoạt hoạ từng bước | Nhịp kể chắc, rủi ro thấp, dễ dựng | Khách hỏi ngang là gãy mạch; 38 luồng thành 38 slide rời rạc |
| **B** | Bản đồ hệ thống zoom được | Luôn thấy toàn cảnh; trả lời câu hỏi nhảy cóc rất tốt | Không có điểm bắt đầu/kết thúc tự nhiên; người xem dễ lạc; người nói cũng dễ lạc |
| **C** | **Lai: mạch tuyến tính + bản đồ làm "nhà"** | Có mạch kể để dẫn, có bản đồ để nhảy và quay về | Công dựng nhiều hơn A |

**Chọn C.** Không phải vẽ vời thêm: một bộ slide có trang mục lục dạng bản đồ bấm được **vẫn là một
artifact duy nhất**, không phải hai hệ thống. Cái nó mua được là tình huống thật hay xảy ra nhất
trong buổi nghiệm thu — khách ngắt lời hỏi "quay lại chỗ duyệt tiền xem nào" — và với A thì bạn
phải bấm mũi tên ngược 20 lần trước mặt khách.

## Trục kể chuyện

Tách bạch với hình thức, và quan trọng không kém:

- **Mạch chính kể theo nhân vật** — bám một học sinh và những người chạm vào em ấy, đi từ lúc phụ
  huynh mới quan tâm đến lúc có kết quả học tập và giáo viên được tính lương. Người xem hình dung
  bằng câu chuyện, không bằng sơ đồ khối.
- **Phần tra cứu tổ chức theo cấu trúc** — vai trò và cụm nghiệp vụ, dùng khi khách hỏi sâu.

Kể theo cấu trúc ngay từ đầu ("hệ thống có 4 cụm, cụm 1 gồm...") là cách nhanh nhất làm khách mất
tập trung trong 5 phút đầu.

---

## Chưa chốt — chờ research

- Công nghệ dựng (đang so sánh reveal.js / HTML thuần một file / Slidev / tái dùng `render.ts`)
- Bộ từ vựng thị giác: chọn 4–6 loại hình vẽ lặp lại cho toàn bộ 38 luồng
- Danh sách luồng cần ảnh thật (đề xuất 8 luồng ở bản tư vấn trước, chưa được xác nhận)

## Câu hỏi còn treo

1. Thời lượng buổi trình bày dự kiến? Quyết định độ sâu mạch chính (30 phút và 2 tiếng khác hẳn nhau)
2. Khách hàng là nội bộ CMC hay bên thứ ba nghiệm thu?
3. Trình chiếu bằng máy của bạn hay máy phòng họp? Ảnh hưởng ràng buộc font và độ phân giải
