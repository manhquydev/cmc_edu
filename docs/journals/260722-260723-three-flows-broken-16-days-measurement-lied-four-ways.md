# 260722–260723 — Ba luồng chặn 16 ngày + công cụ đo nói dối 4 lần

## Bối cảnh

Nhịp A+B (phase 1–6 của plan `260722-1114-go-permission-va-do-runtime`) xong. Hệ thống "xanh" theo mọi gate: `pnpm test` 22/22, `acceptance:report` 38/38 built, `pnpm lint` sạch. Nhưng **3 luồng nghiệp vụ chưa từng chạy được từ 2026-07-06, mãi 2026-07-22 mới lộ**: F1 (sale thu học phí—không vai nào chọn được lớp), F2 (giáo viên thấy menu chấm điểm—dropdown rỗng im lặng), F4 (2 giám đốc mở payroll—danh sách nhân viên rỗng). Mỗi cái là vấn đề quyền: `class.read`, `classRoster.read`, `staff.pickList` bị gộp vào quyền viết, không có key đọc riêng. **Gỡ đúng 3 lỗi sau khi chạy probe HTTP trên server thật** — đó là thứ gate tự động không bao giờ thấy.

## Kết quả

**Nhịp A (quyền):** tách 3 key: `class.read` (4 vai), `classRoster.read` (GV+GĐĐT), `staff.pickList` (GĐKD+GĐĐT riêng). Chứng minh bằng test + probe HTTP.

**Nhịp B (teardown, capture, CI):** 
- Chặn S1 critical (`getPrivilegedDb` không guard DATABASE_URL)
- Sạch rác 15 facility rò từ audit test
- Runtime capture 102 tổ hợp màn-vai, 194 gọi, **0 denial** (sau đơn)
- Thêm 3 guard trang admin thiếu (tổng 9/16 denial lần đầu)

**Trạng thái workflow:** ghi rõ 38→37 built (P1-08 `/finance/refund` là placeholder).

## Bài học kỹ thuật — công cụ đo nói dối 4 lần

### 1. Sổ nghiệm thu đếm placeholder thành "built"

`docs/stories/US-RELEASE-01` tuyên bố 38/38 tính năng xây xong. Thực tế: `/finance/refund` là `EmptyState` chứa văn bản "Tính năng chưa áp dụng". Lệnh `pnpm acceptance:report` quét cả hai họ placeholder (2 `EmptyState` + 3 `ComingSoon` inline), nhưng không tách bước hay lỗi logic — nó chỉ bắt được sau khi team giáng giới hạn cứng vào bước check scanner ("thiếu route → báo `partial` không phải `built`"). **Bài học:** sổ nghiệm thu lần đầu **đã nói dối**, 38→37. UAT không đáng tin nên chạy trên tiền đề sai.

### 2. Runtime capture báo 11 lỗi, 6 là artifact của chính nó

Lần chạy đầu, capture báo 11 denial, trong đó 4 cột (`/hr/checkin` + `/hr/my`) là **bắt buộc** có AppUser real (không AppUser đó → procedure `forbidden` trước khi gọi `can()`). Capture seed `userId: capture-<role>` — danh tính tổng hợp — nên 6 denial là **do capture**, không phải lỗi sản phẩm. Bài học: giới hạn đã biết không vá = **sẽ** sinh finding giả. Người đọc báo cáo không có cách tự phân biệt, cần **từng bước** kiểm tra falsification.

### 3. Bước RESET của runbook UAT không làm gì, nhưng in `RESTORE DRILL PASSED`

`scripts/restore-drill.sh:36` default vào DB nháp `cmc_drill`, không phải prod. `:40-44` guard cứng: nếu `cmc_prod` → exit 1. Kết quả: chạy bước 7 (RESET) → `cmc_prod` **không thay đổi một row**, nhưng script in PASS. Cùng lỗi: restore chọn backup "mới nhất" bằng `sort | tail -1`, nhưng UAT kéo qua 02:00 UTC khi cron backup chạy → "mới nhất" là dump **giữa UAT, đã chứa rác**. Chốt duy nhất canh Go/No-Go lỗi. **Bài học:** script hiện tại chỉ dùng được cho drill, không thể restore prod; runbook cần script riêng, hoặc tắt cron + ghim key backup.

### 4. Bước đếm row "xác nhận sạch" chạy qua connection RLS

Bước 8 của runbook ghi SQL kiểm DB sạch, nhưng **không nói dùng connection nào**. Nếu dùng `APP_DATABASE_URL` (chịu RLS) mà không set GUC `current_setting('app.bypass_rls')`, điều kiện RLS trả NULL → mọi row lọc → count=0 → báo "sạch" đúng theo cấu trúc. DB **bẩn** nhưng RLS **giấu**. Bước 2 (kiểm ban đầu) đọc 0, bước 8 (kiểm cuối) đọc 0 → khớp nhau → tick GO. **Bài học:** chốt duy nhất canh đúng rủi ro runbook tự nêu trả PASS theo cấu trúc; SQL phải ghi rõ connection và GUC.

## Khoảng trống lớp — "nhan_vien" là lỗi dịch từ

TL25 (tài liệu gốc) dùng từ tiếng Việt "nhân viên" chung trong mô tả 4 luồng P3-01, P3-02, P4-01, P4-03. Manifest **gõ** từ đó thành role key `nhan_vien`, nhưng **vai này không tồn tại** ở registry hoặc ROLES enum. Tiền lệ sửa: P3-03 (WF-P3-03) trong cùng TL27 nói `nhân viên (sale/giáo viên)` và manifest **dịch đúng** thành `['sale','giao_vien']`. Audit 21 "procedure không gọi được" phần lớn là **artifact của đúng một lỗi dịch** này—manifest ghi actor `nhan_vien`, acceptor chạy `if (ACTOR_ROLES.includes('nhan_vien'))` → false → procedure chẳng bao giờ validate quyền, tái lập ảo tưởng lỗi quyền.

**Quyết định:** không nới quyền. P3-01 đề xuất 4 vai (`checkIn.punch` registry), P3-02 tách hai nửa (gửi lại vs duyệt, phần gửi lại là owner-check không có vai), P4-01 cọi `['hoc_vien', giam_doc_kinh_doanh, giam_doc_dao_tao, sale]`, P4-03 **mâu thuẫn**: TL28 khai giáo viên nhưng code + test chặn cứng → PO phải quyết.

## Sai lầm của chính agent, ghi thật

**(a)** `pgrep -f "playwright test..."` khớp chính argv của shell đang chạy lệnh đó ⇒ 3 shell treo vĩnh viễn, và một lần `pkill` nhầm giết chính lần chạy capture đang sống. Phải ghi rõ process PID, không grep pattern chứa chính command string.

**(b)** Nói runbook "rotate Brevo key" — sai, thực tế là dòng `.env.prod` thiếu ký tự xuống dòng, nuốt dòng kế tiếp. Sổ ghi sai → phí thời gian.

**(c)** Hỏi PO "actor của P3-02 thật là ai" mà lẽ ra tự tra tài liệu + registry + code được. Lý do hỏi là kinh nghiệm quá cẩn thận khi source mâu thuẫn (TL27 vs registry)—đúng nhận định mâu thuẫn, nhưng không nên hỏi trước khi liệt kê bằng chứng.

## Chưa xong

- **UAT người thật**: chưa chạy. Nhịp A+B chuẩn bị cho nó (fix 3 luồng, placeholder detection, runtime capture chứng minh), nhưng phần "bấm màn hình" còn 0.
- **26 procedure ngoài audit**: owner-check, LMS không có registry key; audit chỉ phủ 12/38 procedure, sẽ cần mở rộng sang LMS sau UAT.
- **Brevo + UAT trên prod**: chưa kiểm trên máy UAT; `cmc_prod` rỗng (dự án chưa vận hành nên chưa có dữ liệu trẻ em "thật" dù plan tuyên bố).

## Trạng thái

Plan chính (260722-1114) **DONE**. Hoãn Phase 7 (LMS capture) + Phase 8 (siết CI chặn merge) đến sau UAT. Mở **Phase 4 của 260707-2308** (UAT go/no-go) — người thật, biên bản chữ ký, những bài học thực tế mà automation không bao giờ thấy.
