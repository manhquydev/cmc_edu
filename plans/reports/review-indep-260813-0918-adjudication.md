# Phân xử review độc lập sau merge — #124/#125/#127

**Ngày:** 2026-08-13 09:18 · **Trên:** develop `bc986bd` (đã gồm cả ba PR)
**Cách làm:** 3 grok review độc lập (cấm đọc report phiên xây) + 1 subagent nghiên cứu pipeline + orchestrator
tự chạy full gate suite. Mọi finding dưới đây orchestrator đã **tự tái hiện**, không tin báo cáo agent.

## Xác minh nền của orchestrator

Tự chạy 9 cổng CI trên develop HEAD: **typecheck + ui-frames + ui-ratchet + ui-a11y-roles + doc-authority
(cả check lẫn test) — PASS hết.** Ba merge hợp thành đúng, develop xanh như tổng thể. Đây là điều kiện cần;
ba lane dưới đây tìm cái mà "xanh CI" không nói.

---

## Ba verdict độc lập

| Lane | Verdict | Bản chất |
|---|---|---|
| CRM (#127) | **FAIL** | Bug hành vi thật dưới filter |
| Precedence (#124) | **WEAK** | Cốt lõi vững, phủ màu/role yếu |
| Gates (#125) | **PASS_WITH_CONCERNS** | Cổng sống thật, có lỗ phủ |

---

## F1 — CRM empty-state nói dối dưới filter (thật, cần fix-forward)

Orchestrator đọc `pipeline.tsx:503,506-513`: nhánh empty gate **thuần** trên
`facilityCount = stageCounts[stage.key]`, mà server (`router.ts:483-489`) tính facility-wide, **luôn loại
lost**, bỏ qua search/stage/page.

Hệ quả đã xác minh bằng code + test của lane:
- **`lost=only`, cột có lost off-page** → `facilityCount=0` (loại lost) → in **"Chưa có"** trên cột thật sự
  có lost. **Đảo ngược đúng mục tiêu PR** (nói "không có" khi có).
- **search "Nguyễn", cột không khớp** → "Không có trên trang này · N ở giai đoạn" với N = tổng open facility
  bỏ search. Bịa số ma + hàm ý "trang khác" sai.
- **`?stage=` từ cockpit, optimistic advance**: tương tự.

Cái ĐÃ đúng: badge cột `= stageItems.length` khớp thẻ trong MỌI combo đo được; view mặc định (không filter)
trung thực; funnel giữ F7. Đây là bug hẹp hơn headline, nhưng `lost=only` là cùng hạng nói dối PR định giết.

**Ghi nhận tự phê:** orchestrator phiên trước xem cái này là "low, BA chấp nhận" — chỉ xét case search. Lane
độc lập mở rộng sang `lost=only` (nghiêm trọng hơn) và đúng. Miss của tôi.

**Fix reviewer đề xuất:** chỉ in "Không có trên trang này" khi `!search && lost==='exclude' && !stageFilter
&& facilityCount>0`; dưới filter thì dùng copy trung tính, **không** nội suy funnel N. ~0.5 ngày, 2 file.

## F2 — Cổng doc-authority có lỗ: file vẫn DẠY class nghỉ hưu, không được canh (thật, cheap fix)

`STYLING-BRIDGE.md:72-95` **dạy "add `.sh-cta--secondary` / `.sh-cta--ghost`"** kèm CSS đầy đủ — chỉ dẫn
SỐNG tạo class đã khai tử. `VIEW-GRAMMAR.md:22` còn "AppFrame + SideNav". Cả hai **không** trong allowlist 8
file của `check-doc-authority.mjs` ⇒ `pnpm check:doc-authority` EXIT 0 dù chúng dạy sai.

Đây đúng loại authority-split #125 giết, ở file #125 **cố ý hoãn** ("VIEW-GRAMMAR/STYLING-BRIDGE — phase sau").
Nên là known-deferred, không phải miss — nhưng lane độc lập đúng: cổng có lỗ và tài liệu đang dạy agent viết
`.sh-*`. Fix: thêm 2 file vào allowlist + dọn nội dung. ~1-2h.

## F3 — Precedence test: màu + role là pin-chuỗi (thật, ưu tiên trung bình)

Lane đột biến: đổi **chỉ fallback hex** `--color-text-primary: var(--console-gray-900, #212529→#ff00ff)` →
test **XANH** (assertion match chuỗi `--console-gray-900`, không resolve `--color-text-*`). Đảo winner
`var(--cmc-text, var(--console-gray-900))` (CMC thắng) → cũng xanh. `--text-*-weight/size` role không pin phía
console (test đọc mapping vendor `theme.css`, không đọc remap `console.css`).

Cái vững (lane xác nhận bằng đột biến đỏ): **12 bậc `--font-size-*` pin cứng** — đúng loại drift nguy hiểm
nhất (+45% display từ audit gốc); font-family pin; selector `.o_web_client` pin. `skipIf` upstream có guard
`if(CI) expect(existsSync)` nên CI thật không tắt im (chỉ máy dev không set CI mới skip).

⇒ "WEAK" chính xác: cổng bắt drift font-size (rủi ro chính) nhưng để lọt drift màu + role chữ. Nâng test là
follow-up, không khẩn.

## F4 — Ratchet regex mong manh (thật, ưu tiên thấp)

`ui-ratchet` chỉ dính đúng `style={{` + literal trần. Lọt: `style = {{`, object spread, template literal
`` `99px` ``, `background` (chỉ `backgroundColor` trong FAMILY.color). **Không** nới cho admin (file pages mới
vẫn đỏ) — chỉ là độ phủ regex. Hardening sau.

---

## Điều đáng khẳng định (independent confirmed vững)

- 9 cổng CI PASS trên develop tổng thể; ba merge không tương tác gãy.
- Badge kanban khớp thẻ mọi combo; funnel tách F7 đúng.
- Font-size precedence pin cứng (đột biến → đỏ).
- doc-authority/ratchet/a11y-roles bắt vi phạm dạng-chuẩn; a11y-roles **blocking thật** trong required job
  (không còn là cổng chết); baseline 61 khớp đếm sống; admin không bị nới.

## Nghiên cứu pipeline (bài học nền)

`research-260813-0908-dev-pipeline.md`: cổng nghiệm thu nghiệp vụ THẬT (`acceptance:report` +
`business:verify --strict`) nằm trong `ui-e2e.yml` (push-only); `acceptance:report` trong `ci.yml` là
`continue-on-error`. Ratchet grandfather dùng ở 5 chỗ. Rủi ro: chưa có VRT, UAT người thật chưa chạy,
dependabot auto-merge patch/minor khi CI xanh.

---

## Đề xuất fix-forward (xếp theo giá tr015/chi phí)

| # | Việc | Loại | Công | Ưu tiên |
|---|---|---|---|---|
| F1 | CRM empty-state trung thực dưới filter | bug hành vi sale-facing | ~0.5d | **cao** |
| F2 | Dọn STYLING-BRIDGE/VIEW-GRAMMAR + thêm allowlist | lỗ cổng + chỉ dẫn sai sống | ~1-2h | **cao** (cheap) |
| F3 | Pin màu + `--text-*` role trong precedence test | nâng cổng | ~2-3h | trung bình |
| F4 | Ratchet nhận thêm dạng JSX + `background` | hardening | ~1-2h | thấp |

## Câu treo cho owner
1. Fix-forward F1+F2 ngay (cả hai thật, rẻ) bằng herdr+grok như các phase trước? Hay chỉ ghi nhận?
2. F1 `lost=only` in "Chưa có" over lost — anh coi là must-fix hay chấp nhận (kanban là overview, bảng là
   work-queue)? Tôi nghiêng must-fix vì nó cùng hạng nói dối ban đầu.
