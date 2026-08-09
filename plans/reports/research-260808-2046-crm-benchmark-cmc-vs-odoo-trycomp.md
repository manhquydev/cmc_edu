# Research Report: CRM cho CMC EDU v2 — Benchmark với Odoo CRM & trycomp.ai

> Thời điểm nghiên cứu: 2026-08-08 (Asia/Saigon). Read-only, không sửa code.
> Mục tiêu: so sánh "CRM" của CMC với 2 hệ tham chiếu (Odoo = CRM trưởng thành, trycomp.ai = CRM AI-native lean), rút hướng nâng cấp **bám bối cảnh CMC, tránh FOMO**.

## Mục lục
1. Executive Summary
2. Methodology
3. Bức tranh 3 hệ (CMC / Odoo / trycomp)
4. Gap analysis: CMC vs pattern CRM trưởng thành
5. Đề xuất nâng cấp (Tier A/B/C) — có chú thích chống-FOMO
6. Ánh xạ pattern → domain tuyển sinh
7. Next steps
8. Unresolved questions

---

## 1. Executive Summary

**Kết luận chính: CMC không thiếu "CRM" — CMC có một CRM tuyển sinh (admission pipeline) đã nghiệm thu, đúng và đủ cho nghiệp vụ hiện tại.** Luồng `Contact → Opportunity (O1→O5) → Receipt → Enrollment → Student` là một sales pipeline tuyến tính đã proven trên CI (journey `crm-*.journey.ui.spec.ts`), có state machine chặt (O5_ENROLLED chỉ do `finance.receiptApprove` đặt), dedup theo `(facilityId, phone)`, RLS đa cơ sở, và chăm sóc sau bán (P4: parent meeting / test appointment / after-sale case).

**So với Odoo (CRM thương mại trưởng thành):** CMC đã có gần hết các "must-have" cốt lõi (pipeline + stage, lead→enroll lifecycle, lost-reason, owner assignment, dedup, source lead-origin). Ba khoảng trống thật sự đáng đóng: (a) **next-activity/follow-up reminder trên chính Opportunity** — must-have của Odoo mà CMC đang thiếu ở cấp lead; (b) **báo cáo funnel + lost-reason + attribution theo kênh** — dữ liệu ĐÃ có sẵn, chỉ thiếu tầng report; (c) **cảnh báo lead "rotting"** (không chạm N ngày). Các thứ còn lại của Odoo (predictive scoring Naive Bayes, lead mining IAP, MRR recurring, weighted 2-tầng assignment) là **overengineering** với quy mô CMC.

**So với trycomp.ai (AI-native):** giá trị lớn nhất KHÔNG phải "gắn AI", mà là **evidence-ledger pattern** (`ContactFact`: score + band + status `PROPOSED/APPLIED/DISMISSED`) và **field-level AI flag** (`agentFilled`). Đây là thứ đáng áp dụng **NẾU** CMC cho AI tự điền dữ liệu học viên (từ hotline/fanpage/OCR) — để AI không bao giờ ghi đè field chính thức mà chỉ đề xuất cho tư vấn viên duyệt. Đây là điều kiện đi kèm khi thêm AI, không phải lý do để thêm AI.

**Khuyến nghị tổng:** làm 3 việc Tier A (đều là bổ sung additive, report-first, dễ prove trên CI), tạm dừng Tier B (cần quyết định sản phẩm), và **chủ động KHÔNG làm** Tier C (bẫy FOMO).

---

## 2. Methodology

- Sources: đọc trực tiếp source, không dùng tài liệu thứ cấp.
  - **CMC**: repo hiện tại (`apps/api/src/crm/router.ts`, `packages/db/prisma/schema.prisma`, `apps/admin/src/pages/crm/*`, `docs/system-architecture.md`, `docs/codebase-summary.md`, `acceptance-report/*`).
  - **Odoo**: `github.com/odoo/odoo` master, sparse-checkout `addons/{crm,sales_team,mail,utm,calendar,crm_iap_mine}` (đọc `crm_lead.py` 2890 dòng, `crm_stage.py`, `crm_team.py`, wizard convert, PLS).
  - **trycomp.ai**: `github.com/trycompai/crm` (shallow clone, `packages/db/prisma/schema.prisma` 1317 dòng, README, agent skills) + trycrm.ai.
- Cách làm: 3 scout/research subagent chạy song song, tổng hợp tại main context.
- Giới hạn: chưa field-by-field diff Odoo↔CMC bằng GitNexus; chi tiết wizard merge Odoo và import UI trycomp chưa bóc sâu (xem §8).

---

## 3. Bức tranh 3 hệ

### 3.1 CMC EDU v2 — "CRM = admission pipeline"

Stack: Vite + React 19 SPA (react-router 7, KHÔNG Next.js) · tRPC 11 + zod · Prisma 7 + PostgreSQL **RLS theo `facilityId`** · Entra SSO (staff). Monorepo pnpm/Turborepo.

Domain trước-bán (`apps/api/src/crm/router.ts`, key router `crm`):
- Models: `Contact` (unique `facilityId,phone`), `Opportunity` (stage/lostReason/closedAt/assignedToId/source).
- Stage: enum cứng `O1_LEAD → O2_CONTACTED → O3_TEST_SCHEDULED → O4_TESTED → O5_ENROLLED`. Advance một-bước; **O5 cấm set tay** (chỉ `finance.receiptApprove`).
- LostReason: enum 6 giá trị. Source: 6 lead-origin (referral/walkin/fanpage/hotline/event/other), **chỉ zod-enforce, không DB enum, không campaign/medium tracking**.
- Assignment: gán owner thủ công (sale nhận cho mình; GĐKD gán ai cũng được). **Không round-robin.**
- Dedup: `find-or-create-contact` theo phone chuẩn hoá.
- Sau-bán (P4, domain riêng ngoài key `crm`): `parentMeeting`, `testAppointment`, `afterSale` (open→in_progress→resolved→closed).
- Phân quyền: `crm.*` chỉ `giam_doc_kinh_doanh` + `sale`.
- Nghiệm thu: P1 complete; journey pipeline/receipt/aftersale **proven** trên CI; crm ~20 tests (>90%).

### 3.2 Odoo CRM — baseline trưởng thành

- **`crm.lead`**: 1 model cho cả Lead & Opportunity, phân biệt `type`. Convert = **update field, giữ nguyên record + lịch sử** (không tạo bảng mới).
- **`crm.stage`** tách bảng: `sequence`, `is_won`, `rotting_threshold_days`, `team_ids` (stage theo team). Won/Lost **suy ra** từ `(stage.is_won, active, probability)` — không có state enum song song.
- Lost reason + `leads_count` analytics. UTM attribution (`campaign/medium/source` từ mixin chung). Activities/next-action từ `mail.activity.mixin`. Email→lead qua `mail.alias`. Duplicate detection theo email/phone. Round-robin + weighted assignment 2-tầng (team→member, quota/30 ngày).
- **Advanced/optional**: Predictive Lead Scoring (Naive Bayes trên tần suất Won/Lost), Lead Mining (IAP trả phí — vendor lock-in), MRR/recurring plan, VoIP.
- Bài học kiến trúc: **CRM core KHÔNG tự viết chatter/activity/campaign — vay từ mixin/module chung (DRY).**

### 3.3 trycomp.ai CRM — AI-native lean

- Định vị: "open-source CRM cho AI agent" — *"the agent is not a feature of the CRM; the CRM is where the agent keeps its notes."* Agent chạy nền (work queue có lease `FOR UPDATE SKIP LOCKED`), tự enrich, tự lên lịch recheck.
- Stack: Turborepo/Bun · Next.js 16 + shadcn · NestJS + `nestjs-trpc` → tRPC 11 · Prisma + Postgres · Better Auth. **Single-tenant cố ý.**
- Data model: Company/Contact/Deal (stage **enum cứng 7 bước**, table view **không kanban**)/Activity (polymorphic 1 bảng).
- **Điểm sáng để học:**
  - `ContactFact` = evidence ledger: `field/value/score/band(VERIFIED|PROBABLE|POSSIBLE)/evidence/status(APPLIED|PROPOSED|DISMISSED|SUPERSEDED)`. Nguyên tắc: *"nothing about a person is guessed"* — evidence mạnh → ghi record; yếu → đề xuất cho rep duyệt.
  - `FieldDefinition.agentFilled` / `agentBrief`: đánh dấu field nào AI được tự điền + mô tả context cho AI.
  - `SuppressedDomain/Contact`: loại noise khỏi phễu.
  - Agent tab durable trên từng record.
- Cố tình bỏ: multi-tenant, RBAC chi tiết, kanban, report builder, stage cấu hình, module ngoài CRM.

### 3.4 So sánh nhanh

| Khía cạnh | CMC (admission) | Odoo | trycomp |
|---|---|---|---|
| Bản chất | Pipeline tuyển sinh, tuyến tính | CRM đa mục đích thương mại | CRM AI-native, đơn mục đích |
| Lead/Opp | 2 model (Contact + Opportunity) | 1 model 2 type | Contact + Deal |
| Stage | Enum cứng O1–O5 | Bảng cấu hình, theo team | Enum cứng 7 |
| Won/Lost | stage O5 + lostReason | suy ra từ stage/active/prob | stage enum |
| Attribution | source 6 giá trị (mỏng) | UTM đầy đủ | enrichment |
| Next-action | ❌ (không ở lead-level) | ✅ mail.activity | ✅ agent schedule |
| Assignment | thủ công | round-robin + weighted | 1 owner |
| Multi-tenant | ✅ RLS facilityId (mạnh) | ✅ multi-company | ❌ cố ý bỏ |
| AI | có package `llm` (chưa dùng cho CRM) | add-on | first-class + evidence ledger |
| Kiểm chứng | journeys proven trên CI | — | — |

---

## 4. Gap analysis: CMC vs pattern CRM trưởng thành

CMC **đã có**: pipeline + stage, lead→enroll lifecycle, lost-reason, owner assignment, dedup phone, source lead-origin, sau-bán, RLS đa cơ sở, kiểm chứng CI. Đây là nền vững — phần lớn "must-have" của Odoo đã hiện diện.

**Khoảng trống thật sự (ánh xạ must-have Odoo còn thiếu ở CMC):**

| Gap | CMC hiện tại | Chuẩn CRM trưởng thành | Mức đáng đóng |
|---|---|---|---|
| G1. Next-activity/follow-up ở lead-level | Có testAppointment/parentMeeting riêng, **không có "next follow-up date/task" ngay trên Opportunity** | Odoo `mail.activity` next-action là must-have cho tư vấn viên | **Cao** |
| G2. Báo cáo funnel + lost-reason + attribution | Dữ liệu đã có (stage counts, lostReason, source) nhưng thiếu tầng report/analytics quản trị | Odoo `lost_reason.leads_count`, UTM rollup | **Cao** (rẻ, data đã có) |
| G3. Cảnh báo lead "rotting" | Không flag lead lâu không chạm | Odoo `is_rotting` theo threshold | **Trung bình** |
| G4. Stage cấu hình theo cơ sở/chương trình | Enum cứng O1–O5 | Odoo stage table theo team | **Thấp** (chỉ nếu có nhu cầu thật) |
| G5. Round-robin assignment | Gán tay | Odoo round-robin | **Thấp** (chỉ khi volume cao) |
| G6. AI auto-fill an toàn (evidence ledger) | Chưa dùng AI cho CRM | trycomp `ContactFact` PROPOSED/APPLIED | **Có điều kiện** (khi thêm AI) |

Tech-debt phụ (không phải nâng cấp nghiệp vụ): `AppUser`↔`Opportunity` không có relation Prisma, owner name resolve bằng query phụ (`crm/router.ts:425`). Ghi nhận, không ưu tiên.

---

## 5. Đề xuất nâng cấp — có chú thích chống-FOMO

Nguyên tắc bối cảnh CMC (quyết định mọi ưu tiên):
- **Solo operator + code do AI sinh** → mọi bổ sung phải qua CI (`typecheck-and-test` + `ui-e2e`); thêm feature = thêm journey phải prove. ⇒ ưu tiên bổ sung **nhỏ, additive, report-first, dễ test**.
- **CRM đã proven** → không phá vỡ; ưu tiên non-breaking, không đụng state machine O1–O5 và RLS.
- KISS/YAGNI: chỉ đóng gap có người dùng thật cần ngay.

### Tier A — Nên làm (đóng gap thật, rủi ro thấp, fit cao)

**A1. Next-activity / follow-up reminder trên Opportunity** *(đóng G1)*
- Thêm khái niệm "next action" nhẹ ở lead-level: `nextActionAt` + `nextActionNote` (hoặc bảng activity nhẹ) trên Opportunity, hiển thị "cần follow-up hôm nay/quá hạn" trong pipeline.
- **DRY (bài học Odoo):** nối vào framework notification/audit sẵn có của CMC thay vì viết engine activity riêng. Kiểm tra trước xem có generic activity/reminder chưa.
- Vì sao: đây là must-have cốt lõi của consulting funnel — tư vấn viên quên follow-up = mất lead. Đây là ROI cao nhất.

**A2. Báo cáo funnel + lost-reason + attribution theo kênh** *(đóng G2)*
- Tận dụng dữ liệu ĐÃ có: conversion O1→O5 theo giai đoạn, phân bố `lostReason`, tỉ lệ đóng theo `source`. `opportunityList` đã có funnel stage counts → mở rộng thành report.
- Vì sao: quản trị tuyển sinh cần biết "rớt vì học phí hay vì chọn đối thủ", "kênh fanpage vs hội thảo ra bao nhiêu enroll". Effort thấp (đọc/aggregate), giá trị quản trị cao.

**A3. Cảnh báo lead rotting (report-first)** *(đóng G3)*
- Bắt đầu bằng 1 query/report định kỳ "opportunity chưa chuyển stage > N ngày", KHÔNG cần field/logic mới ngay (bài học Odoo: rotting có thể làm bằng report trước).
- Vì sao: rẻ, chống rơi lead, không đụng schema.

> Cả A1–A3 đều additive, không đổi state machine, dễ viết journey ui-e2e để prove → hợp mô hình CI-as-review của CMC.

### Tier B — Cân nhắc, cần quyết định sản phẩm (chưa làm ngay)

**B1. Stage cấu hình theo cơ sở/chương trình** *(G4)* — chỉ đáng nếu các campus/ngành thật sự có phễu khác nhau. Hiện 1 quy trình O1–O5 đang KISS tốt. **Mặc định: KHÔNG, trừ khi có nhu cầu vận hành thật.** (Đây chính là bẫy FOMO điển hình — "Odoo có stage cấu hình nên mình cũng phải có".)

**B2. Round-robin auto-assignment** *(G5)* — chỉ khi volume lead cao và cần chia đều/công bằng giữa nhiều tư vấn viên. Gán tay hiện đủ. Nếu làm, chỉ cần round-robin đơn giản `i % n`, KHÔNG copy engine weighted 2-tầng của Odoo.

**B3. AI auto-fill với evidence ledger** *(G6)* — CMC có sẵn package `llm`. NẾU muốn AI tự trích thông tin học viên/phụ huynh (từ hotline transcript, tin nhắn fanpage, OCR hồ sơ), thì **bắt buộc** áp dụng pattern trycomp: AI ghi `PROPOSED` fact có nguồn/score, tư vấn viên duyệt → `APPLIED`; field nhạy cảm (điểm thi, quyết định trúng tuyển) đánh dấu KHÔNG cho AI tự điền (`agentFilled=false`). Đây là điều kiện an toàn đi kèm AI, không phải lý do khởi động AI.

### Tier C — Chủ động KHÔNG làm (bẫy FOMO)

| Bỏ | Lý do (bám bối cảnh CMC) |
|---|---|
| Predictive Lead Scoring (Naive Bayes) | Cần khối lượng Won/Lost lớn mới có ý nghĩa thống kê; effort (frequency table, batch, model drift) >> lợi ích ở quy mô CMC |
| Lead mining / external enrichment | Vendor lock-in Odoo IAP; **privacy học đường** (học viên/phụ huynh ≠ company enrichment); không có dịch vụ tương đương VN |
| MRR / recurring plan | Học phí theo khóa/kỳ, không phải subscription SaaS; nếu cần trả góp → thuộc **finance/billing**, không nhồi vào lead model |
| Custom-field engine generic | YAGNI — chưa có nhu cầu field động; thêm = phức tạp hóa RLS + test |
| Marketing/email campaign automation | Scope lớn, không cốt lõi cho consulting tuyển sinh |
| Multi-currency deal | Đơn tiền tệ VND |
| Kanban drag-drop viết lại | Pipeline view + funnel counts đã phục vụ; drag-drop là mỹ phẩm, ưu tiên thấp |
| Single-tenant hoá (kiểu trycomp) | CMC cần đa cơ sở — RLS `facilityId` là **thế mạnh**, không được bỏ |

---

## 6. Ánh xạ pattern → domain tuyển sinh

```
Odoo crm.lead (type: lead|opportunity)   →  CMC Contact + Opportunity (đã tách, chấp nhận được)
Odoo crm.stage.is_won                    →  CMC stage O5_ENROLLED (đã có, khoá bằng receiptApprove)
Odoo lost_reason + leads_count           →  CMC LostReason enum + [A2] report
Odoo utm campaign/medium/source          →  CMC source 6 giá trị (mỏng) → [A2] attribution
Odoo mail.activity next-action           →  [A1] nextActionAt trên Opportunity  ← GAP chính
Odoo round-robin assignment              →  [B2] chỉ khi volume cao
trycomp ContactFact (evidence ledger)    →  [B3] khi AI auto-fill hồ sơ học viên
trycomp agentFilled / agentBrief         →  [B3] field nhạy cảm cấm AI tự ghi
trycomp SuppressedDomain                 →  lọc lead nội bộ/giáo viên khỏi phễu (nếu cần)
```

Bài học DRY quan trọng nhất từ Odoo: **đừng viết riêng chatter/activity/notification cho CRM** — tái dùng framework chung của CMC. Kiểm tra `packages/*` trước khi tạo mới.

---

## 7. Next steps

1. Xác nhận với chủ dự án 3 hạng mục Tier A (A1 next-action, A2 report funnel/lost/attribution, A3 rotting report) — đây là gói ROI cao, rủi ro thấp.
2. Nếu chốt Tier A: scout kỹ xem CMC đã có generic activity/notification/reminder framework chưa (quyết định A1 làm additive hay nối sẵn), rồi lập plan trong `plans/260808-2046-crm-followup-and-analytics/`.
3. Đưa Tier B ra quyết định sản phẩm riêng (đặc biệt B3 gắn với chiến lược AI của CMC).
4. Ghi Tier C vào docs như "quyết định KHÔNG làm + lý do" để chống FOMO lặp lại.

---

## 8. Unresolved questions

- CMC có sẵn generic **activity/next-action/notification framework** để A1 nối vào không? (chưa scout — quyết định additive vs reuse phụ thuộc điều này.)
- `opportunityList` funnel counts hiện tới đâu — đủ nền cho A2 hay cần thêm aggregate query? (cần đọc `crm/router.ts:367`.)
- Opportunity có timestamp chuyển-stage (cho A3 rotting) chưa, hay chỉ `closedAt`/`updatedAt`? (cần xác nhận schema.)
- Chiến lược AI của CMC cho CRM: có kế hoạch dùng `llm` package cho auto-fill/summarize hồ sơ học viên không? (quyết định B3.)
- Có nhu cầu vận hành thật cho đa-pipeline theo campus/ngành (B1) và volume lead đủ lớn cho round-robin (B2) không?
