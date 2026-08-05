# Tư vấn — Báo cáo vận hành nghiệp vụ dành cho khách hàng

**Ngày:** 2026-08-05 · **Loại:** advisory (không thay đổi code) · **Branch:** feature/geofence-gps-punch-verification

Bốn quyết định đã chốt với người dùng: **HTML 3 tầng + slide rút gọn** · **gắn nhãn trạng thái
chứng minh từng luồng** · **ảnh thật cho luồng chính, sơ đồ cho phần còn lại** · **đủ 38 luồng
P1–P4**.

---

## 1. Cảnh báo phải xử lý trước tiên — dữ liệu trẻ em thật

Lựa chọn "ảnh màn hình thật" có một cạm bẫy an toàn đã được ghi nhận sẵn trong repo:

> Postgres của local-sim chứa `cmc_prod` **THẬT** — dữ liệu trẻ em thật.
> *(nguồn: `plans/260717-1213-so-nghiem-thu-song/phase-04-...md`, Safety Gate mục 4; đối chiếu
> `docker-compose.prod.yml`)*

Chụp màn hình từ môi trường local-sim rồi ghép vào tài liệu gửi cho khách = **rò rỉ dữ liệu trẻ em
ra ngoài tổ chức**. Đây là rủi ro lớn nhất của toàn bộ công việc này, lớn hơn mọi rủi ro kỹ thuật
khác cộng lại, vì nó không thể thu hồi sau khi tài liệu đã gửi đi.

**Đường an toàn đã có sẵn, không phải làm từ đầu:**

| Thành phần | Trạng thái | Đường dẫn |
|---|---|---|
| DB tổng hợp riêng (container tách biệt) | ✅ có, đã validate 2026-07-18 | `scripts/synthetic-seed-env.sh` |
| Guard chặn trỏ nhầm vào DB thật | ✅ đã tách thành module dùng chung | `apps/e2e/src/assert-not-prod.ts` |
| Code chụp màn hình | ❌ **chưa tồn tại** | — |

**Ràng buộc bắt buộc:** mọi ảnh trong tài liệu chỉ được sinh từ synthetic-seed, không bao giờ từ
local-sim. Thêm một bước người thật duyệt từng ảnh trước khi ghép vào bản gửi ra ngoài — guard tự
động chặn được sai môi trường, nhưng không chặn được một cái tên thật lọt vào ảnh qua đường khác.

---

## 2. Vì sao 32 tài liệu hiện có không dùng lại trực tiếp được

Kho `docs/` đã rất đầy đủ (TL00–TL31) nhưng tổ chức theo **module và hợp đồng kỹ thuật**, phục vụ
người build. Khách hàng vấp ba rào cản:

1. **Ngôn ngữ** — `tRPC procedure`, `enum Role`, `RLS`, `invariant I1–I11`, `migration`.
2. **Trục tổ chức sai** — chia theo *cụm kỹ thuật* (data model, API contract, threat model), trong
   khi khách nghĩ theo *con người và công việc* ("sale của tôi làm gì", "ai được duyệt tiền").
3. **Không phân biệt thiết kế với thực tế** — tài liệu mô tả hệ thống *được thiết kế* thế nào; nó
   không nói luồng nào đã thật sự chạy được.

Tuy vậy phần lớn **nội dung** thì tái sử dụng được, chỉ cần dịch trục và dịch ngôn ngữ:

| Nguồn | Dùng cho |
|---|---|
| `docs/17-lien-ket-vai-tro-va-luong.md` | Xương sống Tầng 1 — đã có sẵn sơ đồ swimlane |
| `docs/14-danh-muc-vai-tro-phan-quyen.md` | Ranh giới quyền từng vai trò (Tầng 2) |
| `docs/24/26/27/28-workflow-spec-*.md` | Nội dung 38 luồng (Tầng 3) |
| `docs/19` + `docs/20` | Quy tắc nghiệp vụ: ngưỡng, chống tự duyệt, thời hạn |
| `scripts/acceptance-report/flow-manifest.ts` | Danh sách 38 luồng chuẩn + vai trò + màn hình |

---

## 3. Cấu trúc sản phẩm

### Tầng 1 — Toàn cảnh (1 trang, đọc trong 10 phút)

Đây là trang quyết định việc khách có hiểu hệ thống hay không. Ba khối:

- **Một sơ đồ duy nhất** — 5 vai trò ERP + 2 vai trò LMS, 4 cụm nghiệp vụ, và 3 cổng kiểm soát:
  cổng tiền (GĐ Kinh doanh), cổng lịch/ca (GĐ Đào tạo), và cổng tự động của hệ thống.
- **Câu chuyện xương sống** — một học sinh đi từ lúc còn là khách quan tâm → được tư vấn → đóng
  tiền → tài khoản phụ huynh tự sinh ra → vào lớp → điểm danh, có điểm → phụ huynh xem kết quả →
  giáo viên được tính lương. Đây là thứ khách hình dung được ngay lập tức.
- **Bảng "ai duyệt cái gì"** — câu hỏi số một của khách hàng doanh nghiệp là kiểm soát nội bộ. Nêu
  rõ nguyên tắc người lập phiếu ≠ người duyệt phiếu, và quy tắc mắt-thứ-hai khi vượt ngưỡng.

### Tầng 2 — Sáu chương vai trò ("một ngày làm việc")

Sale · Giáo viên · GĐ Kinh doanh · GĐ Đào tạo · IT · Phụ huynh & Học sinh (LMS).

Mỗi chương theo đúng một khuôn:

1. Người này chịu trách nhiệm gì
2. Mở máy lên thì thấy gì *(ảnh màn hình chính)*
3. Các việc thường ngày, xếp theo thứ tự thời gian trong ngày
4. **Việc gì hệ thống tự làm thay họ** — điểm thuyết phục mạnh nhất, đừng chôn nó
5. **Việc gì họ không làm được** — ranh giới quyền; khách cần điều này để yên tâm về kiểm soát

### Tầng 3 — 38 luồng, 4 cụm

Mỗi luồng một khối chuẩn hoá, tiêu đề bằng **tên nghiệp vụ** chứ không phải mã `P1-01`:

- Khi nào dùng đến luồng này
- Ai bắt đầu → ai duyệt → hệ thống tự làm gì → kết thúc ở đâu
- Nhìn thấy kết quả ở màn hình nào
- Quy tắc quan trọng (ngưỡng tiền, chống tự duyệt, thời hạn)
- **Nhãn trạng thái chứng minh** (mục 5)

---

## 4. Quy tắc dịch ngôn ngữ

Nguyên tắc: mô tả **cái người dùng thấy và làm**, không mô tả cái hệ thống gọi.

| Đừng viết | Hãy viết |
|---|---|
| `crm.opportunityAdvance` | "chuyển cơ hội sang bước tiếp theo trong phễu" |
| `receiptApprove` | "Giám đốc Kinh doanh duyệt phiếu thu" |
| RLS / facility scope | "mỗi cơ sở chỉ nhìn thấy dữ liệu của cơ sở mình" |
| provisioning tự động | "hệ thống tự tạo tài khoản cho phụ huynh và học sinh — nhân viên không phải nhập tay" |
| append-only ledger | "sổ ghi không sửa được: mọi điều chỉnh đều để lại dấu vết" |
| SoD (separation of duties) | "người lập phiếu và người duyệt phiếu bắt buộc là hai người khác nhau" |
| outbox | "email gửi cho phụ huynh có hàng đợi riêng, không bị mất khi lỗi mạng" |

**Cách kiểm tra khách quan:** lập danh sách từ cấm (`tRPC`, `procedure`, `router`, `enum`, `RLS`,
`migration`, `schema`, `endpoint`, `middleware`) và grep phần thân tài liệu. Còn sót từ nào thì
đoạn đó chưa viết xong.

---

## 5. Nhãn trạng thái — số phải ĐO, không được chép

Ba nhãn, đúng ba loại:

| Nhãn | Nghĩa với khách hàng |
|---|---|
| **Đã chạy được — có ảnh chứng minh** | Đã chạy tự động trên hệ thống thật, kèm ảnh |
| **Đã dựng — chưa nghiệm thu** | Chức năng có, chưa có bằng chứng máy chạy đầu-cuối |
| **Chưa có đường giao diện** | Nghiệp vụ chạy nền hoặc chưa mở màn hình |

Kèm một đoạn giải thích thẳng thắn ngay trong tài liệu: nhãn "đã chạy được" chứng minh **luồng đi
thông**, chưa chứng minh **mọi con số nghiệp vụ đều đúng**; và **UAT người thật chưa chạy**. Nói
trước điều này giữ được niềm tin; để khách tự phát hiện sau thì mất toàn bộ.

**Bắt buộc:** số liệu sinh từ `pnpm acceptance:report` tại thời điểm viết, kèm commit SHA. Con số
"31/38" trong `docs/system-architecture.md` gắn với commit `324bd12` ngày 2026-07-26 và **đã cũ** —
riêng branch hiện tại đã thêm journey mới (`checkin-geofence`). Chép lại số đó là tự tạo ra một
tuyên bố sai. Lý tưởng nhất: nhãn Tầng 3 sinh tự động từ output của lệnh, không gõ tay.

---

## 6. Kế hoạch thực hiện

Chia bốn giai đoạn, **mỗi giai đoạn kết thúc bằng một sản phẩm dùng được**. Bạn nói không giới hạn
thời gian, nhưng vẫn nên xếp thế này để tránh dựng một tài liệu lớn suốt nhiều phiên rồi mới phát
hiện lệch hướng.

### Giai đoạn 1 — Bộ khung + Tầng 1 + Tầng 3 dạng sơ đồ
- Dựng khung HTML tự chứa, ba tầng bấm xuyên được, in ra PDF không vỡ
- Viết Tầng 1 hoàn chỉnh
- Sinh 38 khối luồng từ `flow-manifest.ts` + workflow spec, mỗi khối một sơ đồ
- Nối nhãn trạng thái tự động từ `pnpm acceptance:report`
- ✅ *Đã là một sản phẩm gửi khách được, chỉ thiếu ảnh*

### Giai đoạn 2 — Sáu chương vai trò
- Viết Tầng 2 theo khuôn 5 mục
- Đối chiếu ranh giới quyền với `docs/14` để không hứa sai quyền

### Giai đoạn 3 — Ảnh thật (giai đoạn có rủi ro cao nhất)
- Dựng helper chụp màn hình trong bộ journey — **hiện chưa có, phải viết mới**
- Chạy **chỉ trên synthetic-seed**, guard `assert-not-prod` bật trên cả hai biến DB
- Chụp cho các luồng chính; đề xuất danh sách ở mục 9
- Người thật duyệt từng ảnh trước khi ghép

### Giai đoạn 4 — Slide rút gọn
- 25–35 slide rút từ Tầng 1 + Tầng 2, dùng cho buổi trình bày trực tiếp

---

## 7. Những điều nên tránh

- **Đừng bơm thẳng workflow spec vào tài liệu.** Chúng viết cho dev; dịch nửa vời ra văn phong lai
  còn khó hiểu hơn bản gốc. Phải viết lại theo trục "ai làm gì".
- **Đừng dùng mã `P1-01` làm tiêu đề.** Giữ mã ở góc, làm mã tra cứu đối chiếu sổ nghiệm thu.
- **Đừng hứa các vai trò đang tạm gác.** `ke_toan`, `cskh`, `ctv_mkt`, `hr` hiện **0 quyền và bị
  khoá bằng code** (`ACTIVE_ROLES` + kiểm tra bất biến), không phải "sắp có". Nếu nhắc, phải ghi rõ
  là ngoài phạm vi bản này.
- **Đừng để tài liệu thành ảnh chụp chết.** Phần số liệu phải sinh lại được bằng lệnh, nếu không
  ba tuần nữa nó lại sai như con số 31/38 hiện tại.
- **Đừng gộp "đã chạy được" với "đúng nghiệp vụ".** Hai tầng khác nhau; gộp lại là nói quá.

---

## 8. Tiêu chí nghiệm thu bản báo cáo

Đo được, không cảm tính:

1. Một người chưa từng biết dự án đọc Tầng 1 trong 10 phút, kể lại đúng được: ai duyệt tiền, ai
   duyệt lịch, và tài khoản phụ huynh sinh ra từ đâu.
2. Cả 38 luồng đều trả lời được đủ bốn câu: ai bắt đầu · ai duyệt · hệ thống tự làm gì · xem kết
   quả ở đâu.
3. Grep danh sách từ cấm trên phần thân → không còn kết quả nào.
4. Mọi nhãn trạng thái truy ngược được về một lần chạy lệnh có commit SHA và cờ sạch/bẩn.
5. Mọi ảnh truy ngược được về synthetic-seed, không ảnh nào từ local-sim.

---

## 9. Câu hỏi còn treo

1. **Khách hàng cụ thể là ai?** Ban giám đốc CMC nội bộ, hay bên thứ ba nghiệm thu? Nếu là bên thứ
   ba thì phần kiểm soát nội bộ ở Tầng 1 cần sâu hơn đáng kể.
2. **"Luồng chính" cần ảnh thật gồm những luồng nào?** Đề xuất 8 luồng: phễu tuyển sinh · duyệt
   phiếu thu · sinh tài khoản tự động · điểm danh · giao và chấm bài · phụ huynh xem kết quả ·
   đăng ký ca · chốt bảng lương. Cần bạn xác nhận hoặc sửa.
3. **Có cần bản tiếng Anh không?** Ảnh hưởng tới cách dựng khung ngay từ Giai đoạn 1.
4. **Tài liệu này có được dùng làm căn cứ ký nghiệm thu không?** Nếu có, phần nhãn trạng thái cần
   chặt hơn nữa và nên kèm bản in PDF có phiên bản, không chỉ HTML.
