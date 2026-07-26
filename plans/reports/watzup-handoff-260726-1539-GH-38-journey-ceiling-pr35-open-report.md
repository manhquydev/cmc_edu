# Watzup — trạng thái bàn giao 2026-07-26 (chiều)

**Branch:** `acceptance-journey-38-lms` · 50 commit ahead of `main`, 0 behind · cây sạch, đồng bộ origin
**PR:** [#35](https://github.com/manhquydev/cmc_edu/pull/35) — mở, chờ CI trên head `6498464`
**Sổ nghiệm thu:** **31/38 luồng đã chứng minh chạy** (artifact CI, `gitDirty:false`) = trần journey; 7 luồng `no-ui-path` ⇒ 38/38 có trạng thái máy-chứng, 0 chưa phân loại.

## Đang bay (in-flight)

- [x] Phase 1–7 của plan `260724-1212` — **đóng** (Phase 7 chốt hôm nay tại `324bd12`)
- [x] Journey xuyên app #1 (P2-08 nửa PH: GV công bố → PH xem + cổng consent) — xanh trên CI run `d1f9918`
- [ ] **Phase 8 — phần còn lại duy nhất của plan:**
  - [ ] P4-01 nửa học sinh: HS đổi quà trên LMS (`/student/gifts`, `rewards.redeem`) → GĐ duyệt ERP
  - [ ] Journey xuyên app #3 (ứng viên: điểm danh ERP → PH thấy, hoặc điểm → HS thấy)
  - [ ] Nghi thức RT-9: full-suite **4× liên tiếp trên CI** với luật retry/reset thành văn (~25′ CI)
  - [ ] **Chốt sổ v1**: SHA + link artifact + bảng tổng kết commit được vào report chốt (KHÔNG trỏ file gitignored)
  - [ ] Report chốt plan + bàn giao danh sách sửa (xem dưới)

## Ưu tiên đề xuất (cao → thấp)

1. **[User, ~15–30′] Đóng repo private + dựng self-hosted runner** — repo đang PUBLIC để lấy CI miễn phí; 0 fork nên đóng bây giờ chưa mất gì. Runbook: `docs/runbook-self-hosted-runner.md` (đã kiểm trước 2 bẫy: cổng `55435`, bỏ `--with-deps`). **Đóng private TRƯỚC, dựng runner SAU** — an toàn bắt buộc.
2. **Phase 8** theo thứ tự trên — không còn gì chặn; công thức/khuôn có sẵn trong phase file.
3. **Quyết định merge PR #35** — điều kiện đã kiểm: CI xanh, 0 file sản phẩm bị chạm. Chưa merge tự động vì *phần việc chưa hết* (Phase 8 còn); lựa chọn thuộc user: (a) merge mốc Phase-7 rồi Phase 8 trên branch mới cắt từ main, hoặc (b) giữ PR mở tới khi Phase 8 xong. Lưu ý: đổi runner sẽ reset đồng hồ ổn định của `ui-e2e` (tiêu chí nâng gate trong `ci.yml`).

## Bàn giao plan-sửa (đo được, chưa sửa — bất biến plan)

| # | Finding | Nơi ghi |
|---|---|---|
| 1 | `crm.opportunityGet` không được invalidate → nhãn giai đoạn đứng yên tới F5 | plan.md mục (d) |
| 2 | `guardian.requestLink` không có UI; `/admin/parents` mồ côi nav | manifest P1-06 |
| 3 | KPI kẹp hai đầu: confirm 403 sau chốt lương, bulkApprove bỏ qua khi chưa chốt | manifest P3-06/08 |
| 4 | RT-15: OTP plaintext outbox; secrets dev-default; `parseLmsToken` client không verify | plan.md §RT-15 |

## Đọc nhanh cho phiên sau

- Recipe chạy suite + ledger: memory `acceptance-ledger-run-recipe` (env, `PLAYWRIGHT_UI=1`, không `--reporter=line` khi cần ledger, commit-trước-chạy-sau).
- Journal hôm nay: `docs/journals/260726-journey-ceiling-31-38-ci-restored-three-product-findings.md` — đặc biệt mục "3/4 lỗi là của chính test" và bẫy múi giờ (mọi journey mới: chạy 4× dưới `TZ=UTC`, ghim `timezoneId`).
