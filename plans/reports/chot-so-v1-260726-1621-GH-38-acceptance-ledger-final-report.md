# Sổ nghiệm thu v1 — chốt (plan 260724-1212, Phase 8)

**Ngày chốt:** 2026-07-26 · **Branch:** `acceptance-journey-38-lms` · **PR:** #35
**Định nghĩa sổ v1 (D3/V1):** trạng thái per-flow CHỈ sinh từ artifact CI job `ui-e2e` (json Playwright, `gitDirty:false`, SHA khớp HEAD). Run local là advisory.

## 1. Con số chốt

```
38 luồng = 31 đã chứng minh chạy (proven)  +  7 no-ui-path có hồ sơ
         → 38/38 có trạng thái máy-chứng · 0 luồng chưa phân loại
Cấu trúc tĩnh: 37 built / 1 partial / 0 missing · actor-audit: 0 phát hiện
```

**Lệnh regen (bất kỳ ai, bất kỳ lúc nào):** tải artifact `acceptance-journeys-<sha>` của run `ui-e2e` gần nhất → chép đè `apps/e2e/acceptance-results/journeys.json` → `pnpm acceptance:report`. Sổ TỪ CHỐI kết quả nếu SHA của run ≠ HEAD.

### Bảng tổng kết per đợt (commit được — không trỏ file gitignored)

| Đợt | Proven | No-ui-path | Luồng no-ui-path |
|---|---|---|---|
| P1 — tuyển sinh/ghi danh | 8 | 1 | P1-08 (hoàn tiền — `/finance/refund` chưa xây) |
| P2 — vận hành lớp | 4 | 4 | P2-01, P2-02, P2-03, P2-05 (màn lớp/bài tập LMS chưa xây) |
| P3 — HR/lương/KPI | 9 | 2 | P3-10, P3-11 (worker nội bộ, không procedure/route) |
| P4 — rewards/CRM chăm sóc | 5 | 0 | — |
| ADMIN — quản trị | 5 | 0 | — |
| **Tổng** | **31** | **7** | |

**31/38 là TRẦN của phương pháp journey** — 7 luồng còn lại không có UI để lái; phủ chúng đòi XÂY UI trước (thuộc plan sửa, không thuộc plan đo).

### Đuôi LMS (yêu cầu ≥5 — đạt)

P1-04 (kích hoạt tài khoản HS), P1-06 (liên kết PH–con), P1-07 (đăng nhập OTP PH), P2-08 (ảnh buổi học + consent), P4-01 (đổi quà bằng sao) — **5 luồng**, cộng 3 journey xuyên app ERP→LMS ở §2.

## 2. Ba journey xuyên app (yêu cầu ≥3 — đạt)

| # | Spec | Chuỗi chứng minh | Negative thật |
|---|---|---|---|
| 1 | `lms-parent-evidence-consent` | GV công bố ảnh+tóm tắt (ERP) → PH đọc trên LMS | Cổng đồng ý ảnh CÓ RĂNG: chưa bật → tóm tắt qua, ẢNH BỊ GIỮ; bật → cùng locator thấy ảnh |
| 2 | `lms-stars-redeem-cycle` | Chấm bài SINH sao (ERP) → HS đổi quà (LMS, `rewards.redeem` student-gated) → GĐ duyệt+giao (ERP) | Bỏ chấm bài → không sao → nút "Chưa đủ sao" → ĐỎ |
| 3 | `lms-grade-parent-view` | GV chấm (ERP) → PH thấy "9 điểm · +5 sao" (LMS) | Trạng thái mở đầu "Chờ chấm" + 0 badge điểm, assert TRƯỚC positive trên cùng bề mặt |

Mỗi journey: falsification load-bearing đã kiểm (marker verified, RED thật) + 4× xanh liên tiếp dưới `TZ=UTC` + CI xác nhận. Điều kiện env cho negative (RT-15b): env chạy dùng secret dev-default ⇒ negative consent được tính là bằng chứng HÀNH VI (gate chặn đúng chỗ), không phải bằng chứng mật mã — đúng nhãn phase-08 yêu cầu.

## 3. Nghi thức RT-9 — chuỗi full-suite 4× liên tiếp trên CI

**Luật thành văn (áp từ đầu chuỗi):** (i) pass-sau-retry = flake, ghi sổ điều tra, KHÔNG reset chuỗi; (ii) fail thật ở spec cũ → sửa spec / ghi statusReason rồi chạy lại TỪ ĐẦU chuỗi; (iii) suite phải cùng nội dung — các commit trong chuỗi chỉ được chạm docs/plans/reports, KHÔNG chạm spec/manifest.

**Nội dung suite đóng băng tại `1c1332b`** (37 spec ui-chromium; 33 journey). Tiền lệ reset đã áp đúng luật: run tại `5a6a125` ĐỎ (lỗi múi giờ ở spec MỚI P4-04) → sửa spec (`2b0c27c`) → chuỗi tính lại từ đó.

| Run | Commit | CI run ID | Kết quả |
|---|---|---|---|
| 1 | `1c1332b` (spec cuối cùng vào suite) | `30196118114` | ✅ xanh |
| 2 | (commit report này) | *điền khi run xong* | — |
| 3 | (commit cập nhật plan/phase-08) | *điền khi run xong* | — |
| 4 | (commit khép chuỗi) | *điền khi run xong* | — |

## 4. Danh sách bàn giao plan-sửa (đo được, KHÔNG sửa — bất biến plan)

| # | Finding | Bằng chứng |
|---|---|---|
| a (RT-15) | OTP plaintext-at-rest trong `EmailOutbox.payload`, không RLS | red-team 260724 |
| b (RT-15) | Secrets dev-default committed — negative RLS/consent chỉ đạt mức hành-vi khi env chưa dùng secret riêng | red-team 260724 |
| c (RT-15) | `parseLmsToken` client không verify chữ ký (`lms-session.tsx:39`) | red-team 260724 |
| d | `crm.opportunityGet` không được mutation nào invalidate → nhãn giai đoạn + nút gate đứng yên tới F5 | journey P4-04, run đầu chờ 120s |
| e | `guardian.requestLink` không có UI ở đâu; màn PH tự ghi "Liên hệ nhân viên" (`parent/home.tsx:149`) | quét rộng `apps/lms/src` |
| f | `/admin/parents` mồ côi nav: route đăng ký (`admin.routes.tsx:58`), màn xây đủ, KHÔNG mục nav nào trỏ tới | đối chiếu toàn bộ path `nav-registry.ts` |
| g | KPI kẹp hai đầu: `kpi.confirm` 403 sau chốt lương; `bulkApprove` bỏ qua im lặng khi chưa chốt (200 mà không đổi gì) | journey P3-06/08 + falsification |
| h | Chấm 8.5 → LMS render "8 điểm" — mất phần thập phân giữa input chấm và render | journey xuyên app #3, run đầu |

## 5. Giới hạn phải đọc cùng con số 31/38

- Journey = smoke: chứng minh luồng CHẠY THÔNG + guard chặn đúng chỗ; KHÔNG chứng minh đúng số học nghiệp vụ (finding h là ví dụ sống).
- Dữ liệu tổng hợp, không phải khối lượng production; không test tải/bảo mật chủ động.
- **UAT M0 người thật CHƯA chạy** — sổ máy-chứng là điều kiện cần, không phải đủ, để ký nghiệm thu (D0).

## Unresolved questions

1. Visibility repo: đang PUBLIC lấy CI miễn phí; quyết định self-hosted runner + private đã chốt, 2 bước tay user chưa thực hiện (`docs/runbook-self-hosted-runner.md`).
2. Merge PR #35: đủ điều kiện kỹ thuật; chờ user chọn merge-mốc hay merge-sau-Phase-8 (điều kiện "hết phần việc" do user đặt).
3. Finding h cần triage: lỗi ở input chấm (coerce), lưu trữ (Decimal→Int), hay render LMS?
