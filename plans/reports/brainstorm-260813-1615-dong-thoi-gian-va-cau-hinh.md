# Dòng thời gian bản ghi + hai lựa chọn cấu hình — phân xử

**Brainstorm** (không sửa code). Đầu vào: `decisions-owner-260813-1607-trai-nghiem-crm.md` (12 quyết định
— KHÔNG mở lại). Bối cảnh: một người vận hành, code AI sinh, CI (`typecheck-and-test` + `ui-e2e`) là đội review.

**Outcome:** chốt nguồn dữ liệu timeline (chatter), chỗ lưu bộ lọc đã lưu, chỗ cấu hình ngưỡng nguội — đủ để `ak:plan` Con A/B viết phase không phải quay lại hỏi.
**Constraints:** RLS theo cơ sở qua `withFacility()` (ADR 0042); AuditLog append-only + sweep 12 tháng là quyết định PO (không đổi ngữ nghĩa); UI timeline phải dùng lại được cho hồ sơ học sinh + phiếu thu; mọi phương án phải test được bằng CI.
**Non-goals:** thiết kế chi tiết schema/UI (việc của plan); event-sourcing; mở lại quyết định #9/#12.
**Accept:** mỗi lựa chọn có khuyến nghị + bằng chứng lật + rủi ro; sai lệch dữ kiện trong brief được cải chính tại chỗ.

## Bằng chứng mới đo thêm (ngoài hợp đồng) — 4 điểm đổi cục diện

1. **Chuyển O5 (nhập học) vô hình với truy vấn `(entity, entityId=oppId)`.** `finance.receiptApprove` tự ghi
   audit row `entity: 'Receipt'`, `entityId: receipt.id`; id cơ hội chỉ nằm trong JSON
   `data.autoLinkedOpportunityId` — và chỉ khi auto-link (`finance/router.ts:433-445`). `receiptCancel`
   (hoàn tác cơ hội, `opportunityReverted`) cũng keyed theo Receipt (`:604-611`). ⇒ timeline dựng trên
   AuditLog **thiếu đúng sự kiện quan trọng nhất** trừ khi truy vấn JSON không index xuyên entity.
2. **Hai quy ước `entity` cho cùng một cơ hội.** Middleware ghi `entity = deriveEntity(path)` = chuỗi
   `'crm'` (`audit-helpers.ts:27-30`, `trpc.ts:176`); riêng `opportunityCreate` tự ghi `entity:
   'Opportunity'` (`crm/router.ts:170-178`). Đường đọc phải biết cả hai + mọi ngoại lệ tương lai.
3. **`data` của middleware = input thô đã lọc secret, không phải diff.** `sanitizeAuditData(rawInput)`
   (`trpc.ts:178`, `audit-helpers.ts:95-98`). `opportunityAdvance` chỉ có `{opportunityId, toStage}` —
   **không có from-stage**; `opportunityAssign` chỉ có `assigneeUserId` là login-id trần, cần resolve tên.
   Ghi thêm: audit write chạy **sau** `next()`, **ngoài** transaction nghiệp vụ, lỗi chỉ `console.error`
   (`trpc.ts:164-188`) — best-effort đúng nghĩa, không atomic với mutation.
4. **Cải chính brief:** `pipeline.tsx:264-265` — `q`/`lost` là **React state controlled**, KHÔNG sync URL;
   chỉ `stage`/`view` nằm URL (`:250-257`). Và repo **không có** bảng preference JSON nào (grep
   `Preference|settings Json` trong schema = 0) — "nhét vào bảng preference chung" nghĩa là *tạo mới* một
   bảng generic, không phải tái dùng.

---

## Lựa chọn 1 — Nguồn dữ liệu timeline (chatter)

### Thách thức giả định "A rẻ nhất"

A trông rẻ vì "không ghi gì thêm", nhưng chi phí dồn hết vào **đường đọc**: hợp nhất 2 quy ước `entity`,
parse JSON theo shape từng action (shape = zod input, **đổi input là câu tiếng Việt sai âm thầm** — test
fixture tĩnh vẫn xanh), resolve actor/assignee từ userId trần, guard quyền thủ công vì không có
`facilityId` (§3.6 hợp đồng), và **không có cách sạch** hiển thị O5/hoàn tác (bằng chứng #1). A cũng
**vẫn phải tạo bảng ghi chú mới** (AuditLog append-only, UPDATE/DELETE đã revoke khỏi `cmc_app` — ghi chú
người dùng không sống ở đó được). Cộng lại, A không phải phương án nhỏ nhất thoả hợp đồng — nó là phương
án *ghi* nhỏ nhất nhưng *đọc* lớn nhất, và sai ở một yêu cầu sản phẩm ("thấy đủ… đổi giai đoạn").

### Ba phương án

| | A. Ghép lúc đọc | B-hẹp. Một bảng `RecordEvent` (ghi chú = một loại event) | C. Lai (ghi chú mới + AuditLog tạm) |
|---|---|---|---|
| Ghi | 0 site mới + bảng ghi chú | ~8 emit site (6 CRM + 2 finance) trong cùng tx, 1 helper | bảng ghi chú |
| Đọc | Hợp nhất 2 nguồn, 2 quy ước entity, parse input-shape, guard tay | 1 `findMany` facility-scoped, RLS đỡ | như A |
| O5 / hoàn tác | **Mất** (keyed Receipt) | 1 dòng emit trong tx `receiptApprove`/`receiptCancel` sẵn có | mất |
| From-stage | Không có (input chỉ `toStage`) | Có — `advanceOpportunityOneStep` lock FOR UPDATE, biết stage cũ trong tx | không |
| >12 tháng | Bốc hơi (sweep `audit-log-retention-sweep.ts:33-42`) hoặc đổi quyết định PO | Không retention; AuditLog giữ nguyên vai trò tuân thủ | sự kiện cũ đã bị xoá lúc di cư |
| CI bắt drift | Kém — đổi zod input, renderer sai câu, fixture tĩnh vẫn xanh | Tốt — payload typed, compiler + unit test per-mutation | kém |
| Tái dùng học sinh/phiếu thu | Xây lại nguồn dữ liệu lần 2 | `entityType`+`entityId` dùng chung, emit site thêm sau | xây lại |

**B-hẹp khác B trong brief ở hai chỗ, đều cắt bớt:** (1) **không** móc từ middleware — middleware chạy
ngoài tx, không biết from-stage, không đi qua `withFacility` nên không ghi được bảng RLS; emit tường minh
trong chính transaction nghiệp vụ, atomic. (2) **không cần bảng ghi chú riêng** — ghi chú là
`RecordEvent(kind:'note')`, một model thay vì hai. Không backfill giả: dòng "Tạo" synthesize lúc đọc từ
`Opportunity.createdAt`; lịch sử stage trước cutover là không thể biết (chỉ có `stageChangedAt`) — chấp
nhận, không bịa.

### Khuyến nghị: **B-hẹp**

Không phải vì "sạch về miền" mà vì **đếm code thì B không lớn hơn A**: A = bảng ghi chú + CRUD + đường đọc
phòng thủ 2 nguồn + ngoại lệ O5 không vá được; B = 1 model + 1 migration + helper + ~8 dòng emit + 1
procedure đọc tầm thường. Hai vòng đời dữ liệu (tuân thủ 12 tháng vs lịch sử nghiệp vụ) tách đúng chỗ,
quyết định retention của PO không bị đụng. Với "CI là đội review": emit typed được compiler và unit test
per-mutation canh; renderer AuditLog-shape thì không gì canh.

Trả lời câu YAGNI ">12 tháng có cần NGAY không": cho riêng cơ hội CRM (chu kỳ tuần–tháng) thì **chưa** —
nhưng đó không phải lý do chọn B. Lý do chọn B là lỗ O5 + chi phí đường đọc, đúng *hôm nay*. Retention chỉ
là cái đinh thứ hai (và thành đinh thứ nhất khi component này sang hồ sơ học sinh — bản ghi sống nhiều năm).

**Bằng chứng sẽ lật khuyến nghị:** (a) nếu đo được rằng chỉ cần hiển thị ~3 loại sự kiện và PO chấp nhận
timeline không có dòng nhập học/hoàn tác — A thắng vì bảng ghi chú đằng nào cũng phải xây; (b) nếu tìm
thấy trong repo một cơ chế event/outbox sẵn có tái dùng được (đã grep: không có); (c) nếu Con A bị cắt
scope chỉ còn "ghi chú tự do" không tracking — khi đó chỉ cần bảng ghi chú, hoãn toàn bộ event.

**Rủi ro chưa giải quyết:** (1) **drift đường ghi thứ hai** — mutation CRM mới quên emit ⇒ timeline thiếu
dòng (suy giảm UX, không mất dữ liệu tuân thủ — AuditLog middleware vẫn hốt); giảm nhẹ bằng quy ước test
"mỗi mutation CRM có assert event row", không có cách cưỡng chế máy móc tuyệt đối. (2) **Cám dỗ
event-sourcing** — `RecordEvent` chỉ là dữ liệu hiển thị, `Opportunity` vẫn là nguồn sự thật; phải ghi rõ
trong plan để AI-code sau không "nâng cấp" nó. (3) Sửa/xoá ghi chú của chính mình (Odoo cho phép) — v1 đề
xuất immutable, mở sau nếu người dùng đòi; cần PO gật.

---

## Lựa chọn 2 — Bộ lọc đã lưu: model riêng hay preference JSON chung

Repo **chưa có** bảng preference nào (bằng chứng #4) — hai phương án đều là bảng mới, so nhau trần:

- **Model riêng `SavedFilter`** (facility-scoped RLS + owner + cờ `shared` + cờ default theo trang):
  "chia sẻ cho mọi người" là **object cấp cơ sở**, không phải preference cá nhân — nhét vào blob JSON
  per-user thì shared/default thành quy ước app-side không ràng buộc được ở DB, còn model riêng diễn đạt
  thẳng bằng cột + query "của tôi ∪ shared trong cơ sở". Payload lọc lưu đúng `Record<string,string>` mà
  `FilterBar` đã dùng (`filter-bar.tsx:20-33`) — áp bộ lọc = set lại state/URL, không cần format mới.
- **Bảng preference JSON chung**: chỉ thắng nếu sắp có ≥2 loại preference server-side cùng lúc. Ứng viên
  duy nhất là "ẩn/hiện cột" (Con B) — nhưng nó per-user, không share, không default ⇒ localStorage đủ
  (YAGNI), không đáng kéo generic-table vào.

**Khuyến nghị: model riêng `SavedFilter`.** Nó là phương án nhỏ nhất *thoả đủ ba thói quen* (lưu + mặc
định + chia sẻ) — generic table nhỏ hơn trên giấy nhưng thiếu ràng buộc, phải bù bằng code.
Lưu ý cho plan: `q`/`lost` của pipeline hiện là state controlled chứ không phải URL (bằng chứng #4) — khi
áp saved filter phải qua state, và **URL deep-link phải thắng default filter** khi cả hai cùng có mặt.

**Bằng chứng lật:** nếu Con B quyết ẩn/hiện cột cũng phải server-side đồng bộ nhiều máy (thói quen TEKY là
module server-side) và ship cùng sprint — cân nhắc lại generic table cho cả hai. **Rủi ro:** đặt tên khoá
trang (page key) thành quy ước chuỗi tự do — cần một hằng số/type chung để không rơi rụng khi thêm trang.

---

## Lựa chọn 3 — Ngưỡng nguội theo giai đoạn: hằng số code hay bảng cấu hình DB

Quyết định #12 chốt *cái gì* (số ngày + ngưỡng riêng từng giai đoạn); đây chỉ chốt *ở đâu*.

- **Hằng số trong code**: map `Record<OpportunityStage, number>` với `satisfies` — thêm giá trị enum mới là
  lỗi compile (khớp quy tắc exhaustive-switch của workspace). `isOpportunityRotting` đã là hàm thuần nhận
  threshold inject được (`rotting.ts:32-47`) — đổi chữ ký từ 1 số sang map là diff nhỏ, test thuần chạy
  trong `typecheck-and-test`. Đổi ngưỡng = PR một dòng qua CI — trong mô hình "CI là đội review", đó là
  **đường quản trị đúng**, không phải gánh nặng.
- **Bảng cấu hình DB + UI chỉnh**: chép Odoo — nhưng Odoo per-stage-editable vì nó là sản phẩm đa tổ chức;
  `cmc_edu` một tổ chức, **chưa UAT, chưa người dùng thật** — xây UI + quyền + test cho cái núm chưa ai
  từng vặn là YAGNI kinh điển. Config trong DB còn thoát khỏi tầm với của CI (đổi giá trị không qua gate nào).

**Khuyến nghị: hằng số trong code**, bỏ dần env `ROTTING_THRESHOLD_DAYS` (giữ tạm làm override toàn cục
nếu plan muốn đổi hành vi bằng không — không bắt buộc). Việc badge hiện **số ngày** thay cờ "Đang nguội"
(`pipeline.tsx:158-161`) là scope hiển thị của Con A/B, không đổi kết luận chỗ để cấu hình.

**Bằng chứng lật:** sau UAT, giám đốc kinh doanh thật sự yêu cầu tự chỉnh ngưỡng nhiều hơn ~quý/lần, hoặc
xuất hiện nhu cầu **ngưỡng khác nhau giữa các cơ sở** (hằng số code là toàn cục) — lúc đó bảng DB
facility-scoped mới đáng. **Rủi ro:** không đáng kể — con đường tiến hoá code-map → bảng DB là additive.

---

## Tổng hợp rủi ro chưa giải quyết + câu hỏi treo

1. (L1) Drift emit site — chấp nhận suy giảm UX có kiểm soát; ghi quy ước test vào plan Con A.
2. (L1) Ghi chú sửa/xoá được không — **cần PO gật** trước khi plan Con A khoá schema.
3. (L2) Ẩn/hiện cột server-side hay localStorage — quyết ở plan Con B; nếu server-side, xem lại bằng chứng lật của L2.
4. (L3) Không có — thiết kế thoát hiểm đã rẻ.
