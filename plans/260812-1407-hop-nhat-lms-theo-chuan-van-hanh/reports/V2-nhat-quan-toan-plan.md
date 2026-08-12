# V2 — Validate nhất quán toàn plan

Phạm vi: chỉ đọc `plan.md` và toàn bộ năm phase trong thư mục kế hoạch. Đây là đối chiếu tài liệu, không phải xác minh code runtime.

## Kết luận

Có các mâu thuẫn cần sửa trước khi coi bộ plan là một chương trình nhất quán:

1. Bảng phụ thuộc ở `plan.md` sai so với front matter của các phase: plan buộc B xong trước C/D, nhưng phase C và D chỉ phụ thuộc A.
2. `plan.md` mô tả entitlement của A như outcome đã có hiệu lực; phase-01 giới hạn đây chỉ là cờ tạm trên nhánh open-tier cũ, hết tác dụng khi B tắt nhánh đó.
3. phase-01 đo các lớp/buổi thiếu neo hoặc stamp nhưng cổng vào A8 không bắt #3/#4 bằng 0; phase-05 lại yêu cầu import không có buổi thiếu stamp.
4. `plan.md` ghi “A chỉ kích hoạt thứ đã xây sẵn”, trong khi phase-01 mới yêu cầu nhập 239 unit, thêm API đọc, sửa entitlement theo enrollment, chặn makeup, cảnh báo hết unit và các thao tác bù dữ liệu.

Ngoài các điểm trên, việc màn xếp dãy bài đã chuyển sang B được ghi nhất quán trong phase-01/phase-02; không thấy phase-02–05 giả định màn đó đã ship ở A.

## Bảng đối chiếu

| ID | Mức | Chủ đề | Trích dẫn bên 1 | Trích dẫn bên 2 | Kết luận / cần sửa |
|---|---|---|---|---|---|
| V2-01 | HIGH | Phụ thuộc giữa các đợt | `plan.md:72`: “A → B → (C ∥ D) → E”; bảng cũng ghi C và D phụ thuộc chuỗi sau B. | `phase-03...:3-5`: `dependencies: [1]`; `phase-04...:1-5`: `dependencies: [1]`; `phase-05...:1-5`: `dependencies: [2, 3, 4]`. | Mâu thuẫn thật. Theo phase, C và D có thể chạy sau A song song với B; chỉ E cần B,C,D. Sửa dependency graph hoặc sửa front matter phase C/D. |
| V2-02 | HIGH | Ý nghĩa outcome của Đợt A / entitlement | `plan.md:66`: outcome A là “entitlement có hiệu lực”. | `phase-01...:171-180`: bật `LMS_ENTITLEMENT_GATE` chỉ là “biện pháp tạm”, chỉ tác dụng trên nhánh bài tập cũ; sang B cờ hết tác dụng, chặn theo unit chuyển sang roster/delivery. | Wording của plan làm A giống trạng thái entitlement hoàn tất lâu dài, trong khi phase nói chỉ là chuyển tiếp. Outcome nên ghi “bật cổng tạm trên open-tier, chuẩn bị chuyển sang delivery ở B”. |
| V2-03 | HIGH | Cổng A cho dữ liệu thiếu stamp/neo | `plan.md:111`: giảm thiểu R3 bằng “Đếm + backfill trước khi bật”. | `phase-01...:73-76`: A2 đo #3 buổi thiếu `curriculumUnitId`, #4 lớp thiếu `startUnitId/currentUnitId`; nhưng `:85` chỉ bắt #1, #2, #5 = 0 và #7 xử lý trước A8, không bắt #3/#4 = 0. | Cổng cho phép bật khi vẫn còn lớp/buổi mà chính phase mô tả sẽ làm roster rỗng. Đồng thời `phase-05...:57-60` yêu cầu dry-run không có buổi thiếu unit stamp. Cần đưa #3/#4 vào hard gate hoặc ghi rõ xử lý/ngoại lệ và tiêu chí import. |
| V2-04 | MEDIUM | Phạm vi A bị mô tả là chỉ kích hoạt cái đã xây | `plan.md:88-89`: “A chỉ kích hoạt thứ `cmc_edu` đã xây sẵn… chỉ cần chạy xong cổng đo A0”. | `phase-01...:18-20`: A không chỉ dựng màn; `:50-62` nhập 239 unit; `:87-101` viết API đọc; `:103-112` sửa scope entitlement; `:144-155` chặn makeup và viết API cảnh báo; `:157-180` bù dải/bật cờ. | Mô tả parent plan đã lỗi thời so với phase viết lại. Nó làm nhẹ sai effort, thứ tự và điều kiện “đã xây sẵn”. Cập nhật đoạn giải thích và điều kiện bắt đầu A theo A1→A2→A3/A4→A5/A6/A7→A8. |
| V2-05 | MEDIUM | Điều kiện tiên quyết A chưa phản ánh thứ phase thật sự cần | `plan.md:76-88`: tiên quyết cho A chỉ là truy vấn A2; #5/#6 là quyết định sản phẩm. | `phase-01...:38`, `:50-64`, `:67`, `:87`, `:114-155`: phải có nguồn CSV 239 dòng và kiểm đếm, nhập khung trước A2; A2 chạy sau A1; API đọc/scope phải xong trước màn; A7 phải xong trước A8; A6 phải khóa tạo makeup. | Không khớp hoàn toàn. Bổ sung vào prerequisite/entry gate của A: nguồn khung chương trình + quy tắc orderGlobal, A1 thành công, API A3/A4, A6/A7, và lần chạy A2 trong 24h trước A8. |
| V2-06 | MEDIUM | Tiêu chí nghiệm thu parent bỏ sót cam kết của A | `plan.md:96-105`: chỉ có các tiêu chí tổng quát, không nêu 239 unit, per-enrollment gate, A2 #1/#2/#5/#7, warning ≤1, chặn makeup, cờ bật trong CI. | `phase-01...:184-195`: 10 tiêu chí cụ thể, gồm toàn bộ các điều kiện trên. | Parent acceptance không đủ để chứng minh A hoàn thành. Bổ sung acceptance cấp chương trình hoặc link bắt buộc tới phase acceptance và nêu các hard gate A8. |
| V2-07 | MEDIUM | Tiêu chí nghiệm thu parent bỏ sót cam kết của B | `plan.md:96-105`: chỉ “một mô hình bài tập duy nhất”, “không còn đường tạo buổi bù” và CI. | `phase-02...:95-101`: còn phải test unit lùi đúng sau hủy, học lại unit nộp lại được, open-tier OFF chỉ delivery, cùng typecheck/ui-e2e. | “Một mô hình” không bao phủ rekey Submission và delivery-only proof. Bổ sung các test/điều kiện B vào tiêu chí chương trình. |
| V2-08 | MEDIUM | Tiêu chí nghiệm thu parent bỏ sót C/D/E | `plan.md:96-105` không có hard-stop C0, `kind='family'`, ownership đa con, lifecycle 6 giá trị/cancel reason, dry-run đối soát, RLS boot-check, một tuần vận hành. | `phase-03...:51-82`; `phase-04...:61-67`; `phase-05...:57-79`. | Parent không đủ để xác nhận các phase sau. Thêm checklist liên kết từng phase, đặc biệt các cổng C0, D migration và E dry-run/cutover. |
| V2-09 | LOW | Thuật ngữ “cổng đo A0/A2” không nhất quán | `plan.md:83`: gọi “cổng đo A2 — 8 truy vấn”; `plan.md:88`: lại gọi “cổng đo A0”. | `phase-01...:67`: tiêu đề là “A2. Cổng đo”; `:85`: “Cổng vào A7”. | Cùng một cổng bị gọi A0 và A2. Chuẩn hóa thành A2, và gọi điều kiện bật cờ là “A8 entry gate”. |
| V2-10 | LOW | Thuật ngữ “dual-gate” bị dùng ở hai phạm vi | `plan.md:50`: entitlement được mô tả như luật thuần chung; `plan.md:111`: bật entitlement gate là giảm R3. | `phase-01...:178-180`: A8 nói cờ chỉ tác dụng nhánh bài tập cũ, không phải dual-gate vĩnh viễn; `phase-02...:59-61`: delivery-only sau khi tắt open-tier mới là đường chính. | Không sai nghiệp vụ nếu hiểu theo giai đoạn, nhưng dễ đọc thành một cơ chế duy nhất xuyên A→E. Dùng rõ “open-tier entitlement gate tạm” và “delivery/roster dual-gate sau B”. |
| V2-11 | LOW | Cách gọi “bù dải” và “quyền học chỉ đến từ tiền” cần ngoại lệ rõ hơn | `plan.md:53-54,99-100`: quyền học đến từ tiền, chỉ ngoại lệ break-glass. | `phase-01...:159-169`: dữ liệu cũ không có phiếu thu được phép cấp tay, có lý do/audit; có phiếu thì phải chạy lại provision từ receipt. | Không phải mâu thuẫn logic, nhưng parent thiếu điều kiện phân biệt hai nhánh. Ghi rõ manual grant chỉ là break-glass có kiểm soát, không phải đường vận hành thường ngày. |
| V2-12 | LOW | Phase D nêu `blocked_lms` là giá trị thừa nhưng parent vẫn dùng như quyết định mapping chưa chốt | `plan.md:82`: “Ánh xạ `blocked_lms` → giá trị nào trong bộ 6”, đề xuất `on_hold`. | `phase-04...:18-32`: `blocked_lms` không tồn tại trong chuẩn mới; mapping vẫn cần owner xác nhận. | Nhất quán về việc chưa chốt, nhưng parent gọi đây là prerequisite cho D/E trong khi D phase chưa đặt hard gate cụ thể trước khi bắt đầu. Nên ghi rõ “chốt trước migration D và import E”, không chỉ “điều kiện tiên quyết chương trình”. |

## Trả lời bảy câu hỏi

### (1) `plan.md` mô tả Đợt A có khớp phase-01 không?

**Khớp một phần, chưa khớp hoàn toàn.** Tên đợt, 239 unit, màn cấp/thu, sửa scope entitlement và bật cờ đều hiện diện. Nhưng parent vẫn nói A chỉ kích hoạt thứ đã xây sẵn và chỉ cần cổng đo, trong khi phase-01 thêm nhập dữ liệu, API đọc, chặn makeup, warning, backfill và các hard gate.

### (2) Màn xếp dãy bài đã chuyển khỏi A chưa?

**Đã chuyển nhất quán.** phase-01 ghi rõ không dựng màn (`:46`), ranh giới không đụng bài tập (`:142`); phase-02 có B6 ghi “chuyển từ Đợt A sang đây” và chỉ dựng sau thư viện bài (`:81-91`). `plan.md` không còn liệt kê màn này trong outcome A hay bảng phase. Chỉ còn câu kiến trúc tổng quát `plan.md:50` nhắc “xếp dãy bài” như một luật thuần để port; không gán nó cho A, nên không phải mâu thuẫn sở hữu.

### (3) Bảng phụ thuộc có đúng không?

**Không đúng.** `plan.md:72` buộc B chạy trước C/D, nhưng front matter C/D chỉ `[1]`; E `[2,3,4]`. Đồ thị khớp phase là `A → (B ∥ C ∥ D) → E`, trừ khi owner cố ý thêm phụ thuộc B cho C/D.

### (4) Điều kiện tiên quyết parent có khớp phase-01 thật sự cần không?

**Chưa đủ.** Parent chỉ nêu truy vấn A2 và các quyết định sản phẩm; phase-01 còn cần nạp CSV/239 unit trước A2, hard gate #1/#2/#5/#7 trước A8, API A3/A4, khóa makeup A6 và warning A7. Các điều kiện này phải được đưa vào entry/exit gate nếu parent là nguồn điều phối.

### (5) Tiêu chí nghiệm thu chương trình có bỏ sót không?

**Có, bỏ sót nhiều.** Bảng parent không kiểm chứng đầy đủ các cam kết cụ thể của A (239 unit, per-enrollment, warning, no-makeup, cờ bật trong CI), B (delivery-only, rekey nộp lại, unit rollback), C (C0/password, family/kind/ownership), D (lifecycle/cancel reason/done audit), E (dry-run parity, RLS, one-week no rollback).

### (6) Thuật ngữ có không nhất quán không?

Có: A0/A2; “entitlement có hiệu lực” so với “cờ tạm”; “dual-gate” chung so với “open-tier gate tạm + delivery dual-gate sau B”. Các điểm này có thể gây hiểu sai thứ tự hoặc tiêu chí hoàn thành.

### (7) Phase-02–05 có giả định điều phase-01 đã đổi không?

Không thấy giả định rằng màn xếp dãy bài đã được ship ở A; B6 còn ghi rõ chờ B5. Tuy nhiên có hai điểm cần đồng bộ:

- B phụ thuộc A nhưng vẫn tham chiếu “đếm ở A0”; phase-01 hiện gọi cổng là A2, nên đổi tham chiếu thành A2.
- E yêu cầu không có buổi thiếu unit stamp, trong khi A2 chỉ đo #3 và không bắt hard-zero; đây là gap giữa điều kiện thoát A và điều kiện vào E (`phase-05:57-60`).

## Unknowns

- Chưa có quyết định owner cho việc có tách permission cấp/thu/gỡ hay giữ một key.
- Chưa có tiêu chí “khoảng đủ dài” của E4 ngoài việc chủ hệ thống sẽ chốt.
- Không đọc các tài liệu nguồn ngoài sáu file được yêu cầu; các tuyên bố về `cmc-lms` ở đây chỉ được kiểm tra tính nhất quán nội bộ giữa plan/phase.

Status: DONE | Summary: Bộ plan còn mâu thuẫn dependency, outcome entitlement tạm/vĩnh viễn, cổng stamp/neo, và parent acceptance/prerequisite; việc chuyển màn xếp dãy bài sang B đã nhất quán.
