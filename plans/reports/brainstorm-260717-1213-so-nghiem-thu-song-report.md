# Brainstorm Report — "Sổ Nghiệm Thu Sống" (Living Acceptance Ledger)

- Date: 2026-07-17 12:13 · Session: /brainstorm · Status: APPROVED by user
- Flags: none (no --html / --wiki)
- Audience quyết định: Ban giám đốc CMC (nghiệm thu, non-dev) + chính builder (self-audit)

## 1. Problem Statement

Dự án quá lớn (3211 symbols, 38 routers, ~30 luồng nghiệp vụ, 32 file docs) — 1 cá nhân không còn
nhìn được toàn cảnh: luồng nào hoàn thiện thật, luồng nào chỉ "có code", có đúng thiết kế đã chốt
không. Cách hiện tại (docs trạng thái viết tay: TL15, README status) **đã chứng minh drift** —
3 vòng audit docs-vs-code liên tiếp (commits 0078d7f, bdccfd4, 495aa96). Thiếu hoàn toàn tầng
trình bày cho người nghiệm thu không phải dev.

## 2. Exact Requirements (captured)

| Item | Answer |
|---|---|
| Expected output | 1 file HTML tự chứa, tiếng Việt, regenerate bằng 1 lệnh pnpm; 2 tab: Nghiệm thu (giám đốc) + Builder (self-audit) |
| Acceptance criteria | Mỗi luồng nghiệp vụ hiện trạng thái 3 mức có bằng chứng kèm ngày; symbol biến mất khỏi code → hàng đỏ ngay lần generate sau; giám đốc đọc được không cần giải thích |
| Scope boundary | KHÔNG sửa docs corpus TL00–TL31; KHÔNG thay thế UAT checklist go-live; KHÔNG realtime server — chỉ static regen |
| Constraints | Nguồn sự thật = code thật + app chạy thật (user chốt: "tránh tin vào docs hay test" dạng vanity metric); docs chỉ làm mẫu số/danh sách; premium design language (light, Inter, monochrome) |
| Touchpoints | apps/e2e (Playwright specs + screenshot), packages/db seed, GitNexus index/.gitnexus, docs/25-ma-tran-truy-vet-p1.md + TL26–28 (đọc, không sửa), scripts/ mới |

## 3. Approaches Evaluated

| # | Approach | Pros | Cons | Verdict |
|---|---|---|---|---|
| A | Dashboard tự sinh từ code-truth | Chống drift by design, chi phí duy trì ~0 | Người xem phải tin con số | Chọn — làm xương sống |
| B | Evidence pack Playwright (screenshot/video theo kịch bản UAT) | Thuyết phục nhất với non-dev; là code-đang-chạy | Nặng công; cần seed ổn định | Chọn — làm lớp trình bày |
| C | Củng cố TL15 + audit định kỳ (thủ công) | Không xây gì mới | Đã thử, đã drift; output dev-oriented | LOẠI |

User chọn A+B kết hợp, cơ chế lâu dài regenerate được.

## 4. Final Solution — Mô hình bằng chứng 3 tầng

```
docs (TL25/TL26-28)     code thật                  app đang chạy
= DANH SÁCH luồng   →   = BẰNG CHỨNG TĨNH      →   = BẰNG CHỨNG ĐỘNG
(mẫu số ~30 luồng)      (GitNexus/AST verify)      (Playwright + screenshot)
```

Nguyên tắc chốt (giải quyết mâu thuẫn "tin code, không tin docs/test"):
- Docs làm **mẫu số** (chỉ docs biết cái gì PHẢI tồn tại), không bao giờ làm bằng chứng hoàn thành.
- Code tĩnh chứng minh "đã xây" (wiring UI→API→DB nối liền), KHÔNG chứng minh "chạy đúng".
- E2e + screenshot = app thật đang chạy = bằng chứng động; con số test tổng (889) bị coi là vanity,
  chỉ mapping test↔luồng mới có giá trị nghiệm thu.

### Components

1. **Flow Manifest** — `scripts/acceptance-report/flow-manifest.ts` (file viết tay duy nhất).
   Mỗi luồng: `{ id, tênNghiệpVụ (VN, non-dev), cluster, expectedSymbols: {trpc[], uiRoutes[], models[]}, e2eSpec?, screenshotSteps? }`.
   Seed ban đầu chuyển từ TL25 + TL26–28 (mapping đã có ~70%).
2. **Verifier tĩnh** — đối chiếu manifest với code thật (GitNexus cypher hoặc AST parse 38 routers,
   route tables admin/lms, Prisma schema). Output per-flow: structural status + missing symbols.
   **Orphan detection**: procedure/route tồn tại trong code nhưng không thuộc luồng nào → cảnh báo
   (triết lý "không phần nào mồ côi" TL00).
3. **Evidence collector** — Playwright chạy e2e specs với `page.screenshot()` tại bước nghiệp vụ,
   lưu `assets/acceptance-evidence/{flowId}/step-NN.png` + metadata (ngày chạy, commit, pass/fail).
   Tận dụng 11 specs hiện có, bổ sung dần theo luồng.
4. **Renderer** — 1 HTML tự chứa (ảnh inline base64 hoặc thư mục kèm), tiếng Việt:
   - Tab **Nghiệm thu**: thẻ per-flow, trạng thái ⬤ Đã chứng minh chạy / ◐ Đã xây chưa chứng minh / ○ Chưa có,
     click → chuỗi screenshot dạng story. Zero jargon. Header: % tổng, ngày generate, commit.
   - Tab **Builder**: bảng drill-down — symbol thiếu, e2e thiếu, evidence cũ nhất, orphans.
5. **Commands**: `pnpm acceptance:report` (tĩnh, giây) · `pnpm acceptance:report --evidence` (kèm e2e, phút).

### Anti-drift properties (lý do design này sống được với 1 người)

- Mọi trạng thái tính lại từ code tại thời điểm generate — không có state viết tay nào tồn tại giữa 2 lần chạy.
- Manifest không thể nói dối âm thầm: symbol khai mà không còn trong code → đỏ ngay.
- Luồng mới quên khai → orphan detection lộ ra.

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Chi phí viết manifest ~30 luồng lần đầu (lớn nhất) | TL25/TL26–28 đã có mapping; có thể sinh draft manifest bán tự động từ GitNexus rồi review tay |
| Screenshot cần seed data ổn định | Seed + local-sim stack (cmc_staging) đã có; chốt kỷ luật: evidence chỉ chạy trên staging seed chuẩn |
| GitNexus index stale → verifier sai | Hook post-commit re-analyze đã có; verifier check meta.json freshness, warn nếu stale |
| UI đổi → screenshot cũ | Evidence có ngày + commit; tab Builder highlight evidence quá N ngày |
| Ảnh trẻ em / PII trong screenshot | Seed data phải là dữ liệu giả 100% (đã là nguyên tắc TL08 §7) — ghi thành invariant của evidence collector |

## 6. Success Metrics

1. Chạy 1 lệnh → HTML mới phản ánh đúng code tại commit đó (kiểm chứng: xoá 1 procedure → hàng đỏ).
2. Ban giám đốc đọc tab Nghiệm thu hiểu trạng thái mà không cần builder giải thích miệng.
3. Builder trả lời được "còn nợ gì so với thiết kế" trong <5 phút thay vì audit thủ công nhiều giờ.
4. Không cần sửa tay bất kỳ file trạng thái nào sau khi setup (đo bằng: TL15-style drift không tái diễn).

## 7. Next Steps

1. `/ck:plan` với report này làm context — đề xuất phase: (P1) manifest + verifier tĩnh + renderer tab Builder,
   (P2) tab Nghiệm thu + premium styling, (P3) evidence collector + screenshot instrumentation.
2. Quyết định kỹ thuật để phase plan chốt: GitNexus cypher vs AST parse trực tiếp cho verifier
   (lean: thử cypher trước, AST là fallback không phụ thuộc index freshness).

## Unresolved Questions

- Chuẩn ID luồng: giữ mã WF-P1-03 của TL23–28 hay đặt slug mới dễ đọc? (đề xuất: giữ WF-* làm id, thêm tên VN hiển thị)
- Evidence video (Playwright trace/video) có cần cho giám đốc không hay screenshot đủ? (đề xuất: screenshot trước, video là enhancement)
