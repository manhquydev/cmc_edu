# Brainstorm Report — Tầm nhìn đích cuối dự án & cấu trúc plans hiện thực hóa

Date: 2026-07-08 · Mode: standard · Branch: feat/staff-sso-golive · Decision: Vision mở-rộng-ngoài-pilot, roadmap M0–M4, phương án A (roadmap doc + plan just-in-time)

## 1. Problem statement

User yêu cầu: làm rõ hướng đi/tầm nhìn kết quả cuối cùng của dự án + tạo plans hiện thực hóa.
Bối cảnh: brainstorm 2026-07-07 đã chốt Hướng A→C (go-live sprint → post-GO); M0 đang chạy
(PR #24 CI xanh). Câu hỏi thật = vision SAU pilot là gì, và tổ chức plans thế nào để không drift.

## 2. Quyết định user (2 vòng AskUserQuestion)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Phạm vi vision | **Mở rộng ngoài pilot** — full P0–P5, multi-facility, AI walk/run, VPS thật |
| 2 | Ưu tiên post-GO | **P4 → P5 → multi-facility** (đúng hướng C) |
| 3 | Timeline | **Không deadline cứng** — quality-gated |
| 4 | Cấu trúc plans | **A: roadmap doc + plan just-in-time** |
| 5 | VPS thật timing | **M1** — ngay sau pilot ổn, trước P4/P5 |
| 6 | Số cơ sở M4 | **Tất cả cơ sở CMC hiện có** (con số cụ thể chốt khi lập plan M4) |

## 3. Approaches evaluated (cấu trúc plans)

| Phương án | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Roadmap doc + plan just-in-time** | Không drift (bài học 260706-1803 stale 8 phases, 260707-2128 flip status sớm); YAGNI; khớp convention `docs/project-roadmap.md` | Không thấy chi tiết M3/M4 ngay | ✅ **CHỌN** |
| B. Master plan M0–M4 đầy đủ ngay | Toàn cảnh chi tiết ngay | M2–M4 phụ thuộc dữ liệu pilot chưa tồn tại → chi tiết viết trước = hư cấu; lặp lỗi drift đã gặp 2 lần | ❌ |

## 4. Final solution

**Artifact chính: `docs/project-roadmap.md`** (đã tạo) gồm:
- **Definition of Final Done** 5 điểm: nghiệp vụ khép kín TL25 · AI agent công dân thật (HOTL/eval-gated) · hạ tầng VPS thật · multi-facility toàn CMC · vòng học hỏi đóng.
- **Milestone M0–M4** quality-gated: M0 go-live (đang chạy, plan 260707-2308) → M1 pilot-ổn + VPS thật → M2 P4-completion → M3 P5 AI crawl→walk → M4 multi-facility.
- Exit criteria đo được per milestone; nguyên tắc just-in-time planning; bất biến + stop-conditions kế thừa; bảng phụ thuộc ngoài repo.
- Loại khỏi phạm vi: SaaS hoá multi-tenant ngoài CMC (cần brainstorm riêng nếu đặt ra).

**Plans**: M0 dùng plan hiện có 260707-2308 (không tạo mới). Plan M1 tạo khi M0 gần GO. Mỗi milestone: brainstorm-nhẹ → `/ck:plan` → red-team nếu chạm tiền/auth/dữ-liệu-trẻ → cook.

## 5. Risks

- Roadmap doc không được cập nhật → thành stale như TL15; mitigations: cột Trạng thái + quy tắc cập nhật ghi ngay trong doc §3.
- M3 phụ thuộc chất lượng data pilot — nếu pilot ít dữ liệu, eval agent không đủ mẫu; ngoại lệ draft-only sớm đã ghi §2.
- VPS thật (M1) là chi phí/thủ tục ngoài repo — nếu chậm, M2 có thể chạy trên local-sim nhưng backup drill RT-13 vẫn treo.

## 6. Success metrics

- `docs/project-roadmap.md` là nguồn sự thật duy nhất cho hướng đi; mỗi milestone chuyển pha có cập nhật.
- M0 exit: biên bản GO ký. M1 exit: ≥2 tuần 0-CRITICAL + VPS thật + drill pass. M2 exit: TL25 P4 không ô trống. M3 exit: eval đạt ngưỡng TL29 §5. M4 exit: toàn bộ cơ sở live + isolation audit pass.

## 7. Next steps

1. Tiếp tục M0: merge PR #24 → Phase 2 ENV → Phase 3 UAT (plan 260707-2308 — không cần plan mới).
2. Khi M0 gần GO → brainstorm-nhẹ + `/ck:plan` cho M1 (pilot-ổn + VPS thật), truyền report này làm context.
3. Cập nhật roadmap doc khi milestone chuyển trạng thái.

## Unresolved questions

- Số cơ sở CMC cụ thể + danh sách (cần cho plan M4).
- Độ phủ thực tế "họp PH" (carried từ report 260707-2308 — audit khi lập plan M2).
- VPS thật: nhà cung cấp/spec/chi phí — chốt khi lập plan M1.
