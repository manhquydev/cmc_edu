# Quyết định của chủ hệ thống — Trải nghiệm chuỗi kinh doanh

**Ngày:** 2026-08-13 · **Nguồn:** phiên audit vận hành + `ak:advise` + hai nghiên cứu đối chiếu
**Dùng cho:** vòng `ak:advise` → `ak:brainstorm` → `ak:plan --deep` → `red-team` / `validate` sắp chạy

File này là **nguồn quyết định**, không phải kế hoạch. Nó tồn tại để các vòng sau không phải mở
lại những gì đã chốt, và để những dữ kiện đã đo không bị chép sai thành tài liệu.

---

## 1. Quyết định đã chốt

| # | Nội dung | Quyết định |
|---|---|---|
| 1 | Phạm vi nhánh | Thay toàn bộ, không giữ tương thích ngược |
| 2 | Danh tính LMS | Một tài khoản gia đình — thi hành ở [kế hoạch 0813](../260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/plan.md), **không** thuộc phạm vi này |
| 3 | Lát cắt đầu tiên | Chuỗi kinh doanh (CRM) |
| 4 | Tập pattern UX | Lấy **cả bộ**, xếp theo giá trị trên chi phí — không cắt bớt tuỳ ý |
| 5 | Odoo 11 của TEKY | **Chỉ tham khảo.** Không lấy làm chuẩn; họ đã tự phát triển độc lập nhiều năm và đi lùi là sai hướng |
| 6 | Đích tham chiếu | **Odoo bản mới nhất** |
| 7 | Cấu trúc kế hoạch | **Một kế hoạch chương trình + ba kế hoạch con** (xem §4) |
| 8 | Quy trình | `ak:advise` + `ak:brainstorm` để chốt phần cần triển khai → `ak:plan` → lặp `red-team` / `validate` tới khi sạch; quay lại `ak:advise` mỗi khi có câu hỏi cần chủ hệ thống quyết |
| 9 | Cổng tiền (học sinh chỉ sinh sau khi duyệt phiếu thu) | **Giữ nguyên** — khớp thực tế CMC. Nhưng xem §3 về rủi ro thói quen |
| 10 | Thực tế mobile | **Gần như toàn desktop** ⇒ nhóm mobile xuống cuối. `BottomSheet` và danh-sách→thẻ hạ ưu tiên; Đ3 co thành "đọc được trên màn hẹp", không đầu tư thao tác sâu |
| 11 | Breakpoint chatter cạnh phải | **1200px** (không chép 1400px của Odoo — laptop 1366×768 phải thấy được) |
| 12 | Badge cơ hội nguội | **Số ngày + ngưỡng riêng từng giai đoạn** như Odoo 19 (nâng từ cờ bật/tắt + ngưỡng chung hiện tại) |
| 13 | Kiến trúc dòng thời gian | **Một bảng `RecordEvent`** facility-scoped + RLS; ghi chú là một loại event (không bảng riêng); **emit tường minh trong cùng transaction** (red-team 13/08 đếm chính thức: **11 site / 4 file** — gồm cả appointment O2→O3→O4, bulk import, walk-in auto-create; bảng đầy đủ trong phase 2 Con A); **không** móc middleware, **không** backfill giả từ AuditLog. Căn cứ quyết định: `AuditLog` ghi bước O5 dưới `entity: 'Receipt'` (`finance/router.ts:433-449`, đã kiểm lại) ⇒ ghép từ AuditLog **thiếu đúng sự kiện nhập học**; cộng ràng buộc retention 12 tháng (§3.6). Nguồn: `brainstorm-260813-1615-dong-thoi-gian-va-cau-hinh.md` |
| 14 | Bộ lọc đã lưu | **Model riêng `SavedFilter`** (facility-scoped): "chia sẻ" là object cấp cơ sở, không phải preference cá nhân; repo chưa có bảng preference JSON nào nên generic-JSON là phát minh thêm, không phải tái dùng |
| 15 | Ngưỡng nguội theo giai đoạn | **Hằng số code** `Record<OpportunityStage, number>` + `satisfies` (exhaustive); đổi ngưỡng = PR qua CI — đúng đường quản trị một-người-vận-hành. Bảng DB chỉ xét khi có nhu cầu per-facility sau UAT |
| 16 | Ghi chú trên dòng thời gian | **Bất biến** — viết rồi không sửa/xoá; đính chính bằng cách ghi dòng mới (giống Odoo log note). Dòng thời gian là bằng chứng "ai nói gì lúc nào". Sau red-team: bất biến ép ở **tầng DB** (GRANT SELECT+INSERT theo tiền lệ wave-A), không chỉ "không có procedure" |
| 17 | Quyền timeline + ghi chú | **Ai xem được cơ hội thì đọc timeline và ghi chú được** — mọi sale trong cơ sở đọc được ghi chú của nhau (giống Odoo, nhất quán `opportunityGet` hiện không giới hạn theo người phụ trách). Chốt 13/08 sau red-team vòng 1 |
| 18 | Bảng ngưỡng nguội khởi điểm | **O1 7 · O2 7 · O3 14 · O4 7** (O5 loại trừ); chỉnh bằng PR sau UAT. O1=7 giữ journey `crm-rotting` (già hoá 10 ngày) xanh nguyên trạng |

## 2. Bốn điểm đau — thước đo của mọi hạng mục

Do chủ hệ thống tự nêu. Mọi phase phải trả lời được "nó chữa điểm đau nào".

| # | Điểm đau |
|---|---|
| Đ1 | Thẩm mỹ và tính nhất quán kém giữa các màn hình |
| Đ2 | UX lan man, nhiều chỗ giải thích dài dòng — chữ quá nhiều |
| Đ3 | Trải nghiệm responsive/mobile kém |
| Đ4 | Không biết dùng cái gì ở đâu; mơ hồ, **sợ dùng hệ thống** |

Đ1 đã có mốc đo: audit design system chấm CMC Console **10/20** và LMS **10/20**
(`audit-260813-0052-ds-impeccable-synthesis.md`), và
[`260813-0120-design-system-hardening`](../260813-0120-design-system-hardening/plan.md) đã landed
phần A–D. Kế hoạch con C **nối tiếp**, không mở lại.

---

## 3. Dữ kiện đã đo — không được chép sai ở vòng sau

### 3.1 Người dùng cũ thật sự quen gì

Xác minh từ trang Odoo Information công khai của chính hệ TEKY (`erp.teky.edu.vn/website/info`):
Odoo **11.0** + `OpenEduCat Core Enterprise` + `Admission Enterprise` + **`CRM (Leads,
Opportunities, Activities)`** + khoảng 19 module ngoài upstream. **Không phải Community thuần.**

⇒ Phễu họ quen đến từ **`crm.lead`** của Odoo, không phải `op.admission`. Mọi pattern trong
chương trình này đều là thứ họ đã dùng hàng ngày: việc cần làm có hạn với màu ba mức
(`overdue`/`today`/`planned`), chỗ gom đếm **Late / Today / Future**, chatter có ghi chú nội bộ,
bộ lọc lưu được kèm **"Use by default"** và **"Share with all users"**, kanban `default_group_by`
+ `group_expand`, smart button `statinfo`. Ẩn/hiện cột thì core 11 không có nhưng họ **cài module
riêng** (`EESTISOFT - columns toggles`) ⇒ vẫn là thói quen, đừng hạ ưu tiên.

**Cảnh báo:** DB của họ cài `Instantia Theme "Theme for V12"` trên Odoo 11 ⇒ giao diện họ nhìn
thấy **có thể không giống** Odoo 11 gốc. Xin ảnh chụp thật trước khi thiết kế theo ký ức người dùng.

### 3.2 Statusbar — đã đính chính hai lần, đây là bản đúng

| Ngữ cảnh | Hành vi | Bằng chứng |
|---|---|---|
| Màn tuyển sinh `op.admission` | **Không** bấm được; hành động ở nút header | `openeducat_admission` — không có `clickable` |
| Phễu CRM `crm.lead` | **Bấm được** | `odoo@11.0 addons/crm/views/crm_lead_views.xml:440` — `clickable="True"` |

`Opportunity` của `cmc_edu` đóng vai `crm.lead` ⇒ **cho bấm**. Nhưng ràng buộc backend chặt hơn
Odoo nên chỉ mở **đúng một bước liền kề**: `crm/router.ts:193` cấm đặt tay `O5_ENROLLED` (chỉ
`finance.receiptApprove` được), `advanceOpportunityOneStep` chỉ nhận bước kề, và sale chỉ tiến
được cơ hội chưa có chủ hoặc của mình (`crm/router.ts:204-220`). **Cho bấm rồi báo lỗi là làm Đ4
nặng thêm** — bước không hợp lệ phải nhìn là biết không bấm được.

### 3.3 Cổng tiền — giả định cũ sai chiều

Luồng "thu tiền trước khi thành học sinh" chạy thật ở OpenEduCat **9.0**, **chết từ 10.0**; ở
11.0 `create_invoice()`/`payment_process()` là dead code không XML nào gọi. Ngược lại
`openeducat_fees` 11.0 có luồng **ghi danh trước, xuất hoá đơn từng kỳ sau** và nó chạy được.

⇒ **Không được nói "người dùng TEKY đã quen bị chặn thanh toán".** Upstream 11 dạy họ điều trái
lại. `cmc_edu` giữ cổng tiền (quyết định #9), nhưng phải coi đây là **thay đổi thói quen cần giải
thích**. Module Enterprise 11.0 là mã đóng nên không tự trả lời được — **câu hỏi cần hỏi người
dùng**: hệ TEKY có chặn tới khi có phiếu thu, hay ghi danh trước rồi xuất hoá đơn sau?

### 3.4 Trạng thái code `cmc_edu` (đo 13/08)

**Đã có:** phễu O1→O5 + `LostReason`; `Opportunity.source`; `stageChangedAt` (đồng hồ nguội);
`nextActionAt` + `nextActionNote` + `crm.opportunityDueFollowUps`; `AuditLog`
(`schema.prisma:1099`); **middleware tự ghi nhật ký mọi mutation thành công** (`trpc.ts:141-159`);
khung `console-kanban.tsx`; `filter-bar.tsx`; `WorkflowStatusbar` (đã hỗ trợ `onStepClick`).

**Chưa có:** ghi chú tự do; kéo-thả kanban (`rg draggable|onDrop|DndContext` = 0); bộ lọc lưu được
(`rg savedFilter|favorite|SavedView` = 0); quy ước màu theo hạn.

**Hai cải chính quan trọng cho vòng sau:**

1. Kế hoạch CRM cũ `260720-2229` (đã done) ghi mô tả có "minimal notes on Opportunity" — **đọc kỹ
   thì không phải**. Nó chỉ là `nextActionNote`, đoạn chữ ngắn dính vào một việc cần làm duy nhất.
   Model ghi chú vẫn là **mới**.
2. `rg "action: 'crm\."` trong `crm/router.ts` chỉ ra **một** kết quả (`opportunityCreate:173`) —
   **đừng kết luận là thiếu nhật ký**. `opportunityCreate` nằm trong `AUDIT_EXCLUDED_PATHS`
   (`trpc.ts:105`) vì tự ghi dòng giàu hơn; phần còn lại do middleware lo.

**Lỗi đo được, chi phí hai dòng:** `use-opportunity-actions.ts:27-37` — `markLost` và `assign`
chỉ làm mới `opportunityList`, không làm mới `opportunityGet`. Đứng ở trang chi tiết bấm thì màn
hình **không đổi**. Ngay dưới nó `setNextAction` (`:42-56`) làm mới đủ ba query ⇒ là sót, không
phải chủ ý. Đây là nguồn trực tiếp của Đ4.

### 3.5 Dữ kiện chốt từ nghiên cứu Odoo 19 (`research-260813-odoo19-ux-patterns.md`)

Bản mới nhất: **Odoo 19.0** (18/09/2025); chưa có Odoo 20. Nguồn: đọc code 4 nhánh 16→19, SHA
ghi trong báo cáo.

| Phát hiện | Hệ quả cho `cmc_edu` |
|---|---|
| Chatter-bên-phải có từ **Odoo 16**, ngưỡng **≥1400px** | Laptop 1366×768 phổ biến ở VN sẽ **không bao giờ thấy** bố cục phải nếu chép nguyên ngưỡng. Đề xuất hạ 1200px — chờ chủ hệ thống chốt |
| **`BottomSheet`** (mới ở 19): dropdown thành sheet đáy khi màn nhỏ **và** cảm ứng | Đòn đơn lẻ mạnh nhất cho Đ3; thứ hạng phụ thuộc tỷ lệ dùng mobile thật (câu hỏi treo) |
| **`rotting`** (mới ở 19): ngưỡng theo giai đoạn + badge số ngày | `cmc_edu` **đã có** (`crm/rotting.ts` + badge ở `pipeline.tsx`), thậm chí thông minh hơn: loại trừ cơ hội có `nextActionAt` tương lai. Chênh lệch chỉ còn: hiện **số ngày** thay vì cờ bật/tắt, và ngưỡng **theo giai đoạn** thay vì một `ROTTING_THRESHOLD_DAYS` chung |
| Nhất quán của Odoo đến từ **một thang cỡ chữ, một bán kính bo, một thang spacing** — token màu gần như không đổi 16→19 | Con C siết thang, không đi sơn màu |
| **Không có style guide UI copy công khai** — báo cáo đo từ code và rút **9 quy tắc viết chữ** (§4.6) | Con C lấy làm chuẩn cắt chữ cho Đ2 — rẻ nhất, không phải viết code |
| List view mobile của Odoo **kém** (bảng cuộn ngang, mất sticky header, mất checkbox trên cảm ứng) | **Không chép.** Dưới breakpoint `md` đổi danh sách thành thẻ — chỗ hiếm hoi đi trước Odoo |
| Kanban mobile của Odoo làm tốt (scroll-snap) | Con B tham chiếu |
| Command palette Ctrl+K: giá trị đến từ provider tự quét `[data-hotkey]`, `cmc_edu` chưa có hệ hotkey | **Bỏ** (YAGNI) — trung tâm giáo dục không phải power user bàn phím |
| PR đang mở trên `master` đại tu text input cảm ứng bị chính reviewer Odoo phản đối | Odoo 19 chưa xong form màn nhỏ — coi nó là tham chiếu, **không phải đích cố định** |

### 3.6 Hai ràng buộc phải xử khi làm dòng thời gian

1. **Bảo mật:** `AuditLog` **không có `facilityId`** (`schema.prisma:1099-1114`) ⇒ đọc theo
   `(entity, entityId)` là đọc xuyên cơ sở và **RLS không đỡ được**. Đường đọc buộc phải kiểm
   quyền xem chính bản ghi đó trước, rồi mới truy log. Model ghi chú mới thì phải có `facilityId`
   thật để RLS đỡ (ADR 0042).
2. **Vòng đời:** `AuditLog` bị **xoá định kỳ sau 12 tháng**
   (`apps/api/src/worker/audit-log-retention-sweep.ts`, quyết định PO phase-04) ⇒ dòng thời gian
   dựng thẳng trên nó sẽ mất lịch sử cũ. Với phễu CRM có thể chấp nhận; với hồ sơ học sinh (mục
   tiêu dùng lại) thì không. Kiến trúc nguồn dữ liệu đang được brainstorm phân xử — kết quả ghi ở
   `brainstorm-260813-1615-dong-thoi-gian-va-cau-hinh.md`.

---

## 4. Cấu trúc kế hoạch đã chốt

Theo tiền lệ repo: kế hoạch chương trình giữ hợp đồng chung, kế hoạch con khai `parent:`
(như `260813-0813` trỏ lên `260812-1407`).

| Kế hoạch | Nội dung | Chặn bởi |
|---|---|---|
| **Chương trình** (mẹ) | Hợp đồng Đ1–Đ4, thứ tự, phép đo | — |
| Con A — Trang bản ghi | Phản hồi tức thì + statusbar bấm một bước · Dòng thời gian bản ghi · Việc cần làm có hạn + màu | không |
| Con B — Danh sách & phễu | Bộ lọc lưu được (kèm "mặc định" + "chia sẻ") · Kéo-thả phễu · Ẩn/hiện cột | Con A (dùng lại quy ước màu theo hạn) |
| Con C — Nhất quán + mobile + chữ | Nối tiếp `260813-0120-design-system-hardening`, **không mở lại** phần đã landed | Nghiên cứu Odoo bản mới |

**Lý do chia thay vì một kế hoạch nhiều phase:** (1) repo đang có ~17 kế hoạch chưa xong — thêm một
kế hoạch bao trọn sẽ nằm đó rất lâu; (2) ba nhóm không chung mặt review, trộn lại thì mỗi PR bắt
người review đổi ngữ cảnh giữa chừng; (3) nhóm C thuộc phả hệ design system đã có, nhét vào kế
hoạch CRM sẽ cắt mạch và dễ làm lại việc đã làm.

Kế hoạch nháp `260813-1551-trai-nghiem-chuoi-kinh-doanh` **đã giải thể** (xoá 13/08) — phần đo
code trong đó sống tiếp ở §3 file này và trong các phase của Con A. Cấu trúc thật:
[`260813-1629-chuong-trinh-trai-nghiem-chuoi-kinh-doanh`](../260813-1629-chuong-trinh-trai-nghiem-chuoi-kinh-doanh/plan.md)
+ [`260813-1629-con-a-trai-nghiem-trang-ban-ghi-crm`](../260813-1629-con-a-trai-nghiem-trang-ban-ghi-crm/plan.md).

---

## 5. Câu hỏi còn treo

| # | Câu hỏi | Ai trả lời | Chặn gì |
|---|---|---|---|
| 1 | Hệ TEKY có chặn tới khi có phiếu thu, hay ghi danh trước? | **Người dùng / trung tâm** | Không chặn phase nào; đổi cách giới thiệu cổng tiền |
| 2 | Ảnh chụp giao diện thật của hệ TEKY (vì có theme V12 chồng lên Odoo 11) | **Người dùng** | Độ tin của mọi suy đoán "họ quen thế này" |
| 3 | Thói quen nằm trong ~19 module TEKY tự viết | **Người dùng** — không suy ra được từ upstream | Phạm vi Con A/B |
| 4 | ~~Vị trí chatter~~ — **đã trả lời**: cạnh phải từ Odoo 16, ngưỡng 1400px; còn treo mỗi con số breakpoint cho `cmc_edu` (đề xuất 1200px) | Chủ hệ thống | Bố cục Con A |
| 5 | ~~Bảng nhiều cột trên màn hẹp~~ — **đã trả lời**: Odoo làm kém, không chép; dưới `md` đổi thành thẻ | — | đã đóng |
| 6 | ~~Quy tắc viết chữ~~ — **đã trả lời**: 9 quy tắc ở §4.6 của báo cáo Odoo 19 | — | đã đóng |
| 7 | ~~Tỷ lệ dùng mobile~~ — **đã trả lời**: gần như toàn desktop (quyết định #10) | — | đã đóng |
| 8 | ~~Ghi chú sửa/xoá được không~~ — **đã trả lời**: bất biến (quyết định #16) | — | đã đóng |
| 9 | Rủi ro drift: mutation CRM tương lai quên emit `RecordEvent` ⇒ timeline thiếu dòng (suy giảm UX, không mất dữ liệu tuân thủ) | Giảm nhẹ bằng **quy ước test per-mutation** — ghi vào plan Con A | Con A |
