# Q2 — Kanban CRM nói dối số (P0-1)

**Brainstorm + advise** (không sửa code). Interview advise đã pre-answer bởi brief chủ dự án; grill nằm dưới.  
**Outcome:** sale thấy số trên cột = việc họ quyết định được, hoặc số đó được gắn nhãn tổng/đang-hiện.  
**Constraints:** giữ board; solo+AI; CI = `typecheck-and-test` + `ui-e2e`; không visual regression.  
**Non-goals:** bỏ board; P0-2 a11y; redesign pipeline.  
**Accept:** test tự động fail nếu badge/empty nói “không có” khi `stageCounts[stage] > 0`.

## Phản biện lập trường chủ

Hai mệnh đề nhịp 1 **đối nhau**. (A) “không hiện số không khớp thẻ” → badge = `stageItems.length`. (B) empty chỉ khi `stageCounts===0` → badge vẫn là tổng server. Sale **quyết theo số cột**. A **cất** đúng con số họ cần (8 O4, trang này 0). B giữ số 8 cạnh cột trống — hết “Chưa có” giả, **chưa** hết nói dối.  
`pipeline.test.tsx:13–14,58–60,153–166` **khóa** badge = `stageCounts` (F7: đừng đếm `items`). Đổi badge về số thẻ là đảo contract đã test, không phải “vá nhỏ”.  
Gốc: một query phẳng `pageSize:20` (`pipeline.tsx:34,287–293`) + `groupBy` items (`342–351`) + count/empty từ `stageCounts` (`504–508`). API đã tách **items trang** vs **tổng facility**. UI gộp thành một chữ số.

## Nhịp 1 — sửa gì, hết dối chưa?

**Không** làm A. Làm **nói thật phần thiếu**:

| Chỗ | Sửa |
|-----|-----|
| `pipeline.tsx:504–508` | `count` giữ `stageCounts[stage]`. Empty **chỉ** khi `count===0`. Nếu `count>0 && stageItems.length===0`: copy “0 trên trang này · N ở giai đoạn” — **cấm** `.console-kanban-empty` “Chưa có”. |
| `pipeline.tsx:353–354` + header cột | Badge: `stageItems.length`/`count` (vd. `1/5`) khi lệch; chỉ `count` khi khớp. Funnel (`481–488`) **giữ** tổng — đó là số quyết định. |
| `KanbanColumn` `console-kanban.tsx:20–29,35` | `count` nhận `ReactNode` hoặc thêm `visible?` — hôm nay chỉ số trần. |
| `pipeline.test.tsx:153–166` | Đổi assert: O1 badge không còn `'5'` trần nếu 1 thẻ; empty O4 (`stageCounts=0`) vẫn “Chưa có”; fixture O3=`2` + 0 items → **không** “Chưa có”. |

**Hết dối?** Hết dối *ngữ nghĩa empty* và hết *một số một nghĩa*. **Chưa** hết dối *công cụ*: sale vẫn không bấm được 7 thẻ O4 không nằm trang 1. Pager (`537–558`) vẫn cắt **mọi** cột cùng lúc. Search: `stageCounts` **bỏ** `search`/`stage`/`lost` (`router.ts:483–491`) — lọc “Nguyễn” funnel vẫn facility-wide. Nhịp 1 **giấu/gắn nhãn triệu chứng**, không sửa gốc.

**Cấm nhịp 1:** tăng `PAGE_SIZE` lên 100 (`router.ts:112` max 100) như “xong” — vỡ ở 101, CI không bắt.

## Nhịp 2 — API

**Đã có, không cần endpoint mới:**

- Lọc stage: `opportunityListInput.stage` `router.ts:102,450`; test `list.test.ts:58–66`.
- Đếm: `stageCounts` + `lostCount` `router.ts:474–495,519`; test `list.test.ts:129–146` (lost loại khỏi count).
- Paging + search + lost: `101–112,453–480`; `list.test.ts:38–56,73–127`.

**Thiếu:** một response “mỗi cột một `items[]` + `total` + page riêng”. `stageCounts` cố ý **không** theo search (`483–485`) — board lọc phải đếm theo cùng `where` với items.

**Nhịp 2 tối thiểu (YAGNI):** 5 `useQuery` `opportunityList({ stage, lost, search, page: colPage[stage], pageSize: 20 })`. `stageCounts` lấy query không `stage` (hoặc `groupBy` cùng `where` search). Pager **per cột**.  
Endpoint `opportunityBoard` chỉ khi 5 round-trip đo được chậm — đừng mở trước.

## Chứng minh (không visual regression)

**Unit/RTL là gate** (CI `typecheck-and-test`). E2E chỉ smoke “mở /crm, có board” — journey không assert count (`apps/e2e` không đụng `.console-kanban-col-count`).

Nhịp 1 — `pipeline.test.tsx`: (1) `stageCounts.O1=5`, 1 item O1 → badge chứa `1` và `5`, không chỉ `5`; (2) O3=2, 0 items → không “Chưa có”; (3) O4=0, 0 items → “Chưa có”.  
Nhịp 2 — RTL: 5 lần gọi `{stage:'O1_LEAD'|…}`; pager cột O1 không đổi page O2. API: `list.test.ts` thêm `stage`+`search` → `items.length===total` trong fixture nhỏ; nếu sửa `groupBy` theo search thì assert `stageCounts` co lại.

## Công / rủi ro

| | Công | Rủi ro |
|--|------|--------|
| Nhịp 1 | 0.5–1 ngày (UI+đổi test F7) | Sale thấy `1/5` vẫn tưởng 5 thẻ trong cột; AI revert test 153–166; search vẫn dối funnel |
| Nhịp 2 | 1.5–2.5 ngày (5 query + pager cột + RTL) | Cache/optimistic `handleAdvance` (`297–318`) lệch 5 keys; 5× payload; `ui-e2e` flaky nếu đụng journey CRM |

**Advise:** giữ board. Nhịp 1 = **nhãn hóa** (không giấu tổng). Nhịp 2 = **5 list theo `stage` đã có** — không invent API. Làm nhịp 1 mà không schedule nhịp 2 = để sale quyết trên số họ không với tới.
