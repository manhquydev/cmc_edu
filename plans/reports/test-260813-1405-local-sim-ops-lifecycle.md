# Test Report — local-sim ops lifecycle

**HEAD:** `6af0f5f`  
**When:** 2026-08-13T07:13:05.536Z  
**Stack:** live local-sim (https://erp.localhost / https://hoc.localhost), real email/password, no minted cookies.

## What this run is

Một ngày vận hành trung tâm trên UI thật: sale đưa lead qua phễu CRM, lập phiếu thu trên ngưỡng second-eye, GĐĐT duyệt kích hoạt LMS, tra cứu học viên và range unit, giáo viên thấy lớp trên lịch, học viên vào cổng bị giữ ở đổi mật khẩu.

Đây **không** phải P2-05 (học viên mở/nộp bài). Happy-path phát bài vẫn là worker sau `endTime`.

## Identity under test

| Field | Value |
|-------|-------|
| Học viên | Nguyễn Vận Hành f877bca5 |
| Lớp | CMCDEVEL-UCREA-2026-001 |
| Học phí | 25.000.001 đ (≥ 20 triệu, GĐĐT second-eye) |
| Mã phiếu | SO00007 |
| Receipt id | c9dd0025-5a6d-46be-bc91-7216bdac21b4 |

## Steps

| Id | Role | Step | Result | ms |
|----|------|------|--------|----|
| S1 | sale | Sale đăng nhập ERP (email/password, không mint cookie) | ok | 420 |
| S2 | sale | Tạo cơ hội CRM và chuyển 3 bước tới O4 Ghi danh | ok | 1529 |
| S3 | sale | Ghi danh → phiếu thu 25.000.001đ lớp demo (sale không tự duyệt) | ok | 1257 |
| S4 | sale | Sale không thấy menu Phiếu thu (SoD ADR-B) | ok | 526 |
| S5 | giam_doc_dao_tao | GĐĐT tìm phiếu theo tên học viên và duyệt kích hoạt LMS | ok | 1955 |
| S6 | giam_doc_dao_tao | GĐĐT tra cứu học viên → tab Lớp học thấy enrollment + cấp range | ok | 1641 |
| S7 | giao_vien | Giáo viên mở Lịch dạy, xem lớp demo đang vận hành | ok | 934 |
| S8 | student | Học viên đăng nhập LMS bằng SĐT phụ huynh → cổng đổi mật khẩu | ok | 1383 |

## Notes

- **S1:** https://erp.localhost/cockpit
- **S2:** O4 Ghi danh visible
- **S3:** SO00007
- **S4:** Phiếu thu absent
- **S5:** c9dd0025-5a6d-46be-bc91-7216bdac21b4
- **S6:** CMCDEVEL-UCREA-2026-001; grant UI visible
- **S7:** CMCDEVEL-UCREA-2026-001
- **S8:** https://hoc.localhost/student/change-password

## Limits (product, not test bugs)

- P2-05 student open/submit remains no-ui-path (worker delivers after endTime; Phát bài is GĐĐT break-glass).
- Parent email-OTP is blocked-on-comms on local-sim; student phone+password is the live path.

## Screenshots

`plans/reports/live-sim-ops/`

| File | What it shows |
|------|----------------|
| `01-sale-login.png` | Sale on cockpit after production email/password login |
| `02-crm-o4.png` | Opportunity at O4 with **Ghi danh** |
| `03-receipt-created.png` | Sale stays on `/finance/new`; banner mã phiếu (không `receiptGet`) |
| `04-gddt-receipt-list.png` | GĐĐT list finds the student by visible name |
| `05-gddt-approved.png` | SO00007 25.000.001đ **Đã duyệt**, LMS provisioned, second-eye banner |
| `06-gddt-student-class.png` | Tab Lớp học: enrollment `1–4`, Cấp/cắt range |
| `07-gv-schedule.png` | GV Lịch dạy → Danh sách có lớp demo |
| `08-student-password-gate.png` | LMS `/student/change-password` (học viên không tự đổi) |

Failed earlier attempts left draft/approved receipts SO00002–SO00006 on this DB; they are test debris, not product defects.

## Re-run

```bash
LOCAL_SIM_LIVE=1 pnpm verify:local-sim:ops
```

Overall: **ok**
