# Brainstorm → Plan: chuẩn hoá từ ngữ UI (Odoo-style condensation)

Ngày: 2026-08-05 · Branch: `develop` · Trạng thái: giao kèo đã chốt, chờ plan

## Giao kèo

**Outcome.** Giao diện dùng từ đặc, trọng tâm, theo lối Odoo: title = danh từ đối
tượng, giải thích là *theo yêu cầu* (empty state / helper) chứ không *thường trực*
(subtitle trên mọi trang). Không còn thuật ngữ nội bộ ở mặt tiền. Chuẩn được ghi
thành luật trong design system để lần sinh code sau không tái phát.

**Constraints.**
- `ui-e2e` là required check trên `main`; 507 dòng selector bám text trên 50 spec.
- Không đụng nhãn form (`getByLabel`) — vốn đã đúng chuẩn và là nơi e2e bám nhiều nhất.
- Tiếng Việt, một ngôn ngữ. Không dựng i18n.
- Làm trên branch + PR, không commit thẳng `main`.

**Non-goals.**
- Không gom copy vào module tập trung (phương án C — bị loại, YAGNI: repo đơn ngữ,
  lint rule hẹp mua được phần lớn giá trị quản trị).
- Không quét toàn bộ ~150 chuỗi (phương án B — để pass sau).
- Không đổi nhãn form, không đổi tên route/nav.
- Không sửa trạng thái tính năng OTP (chỉ sửa câu chữ lộ hạ tầng).

**Acceptance criteria.**
1. `docs/12-design-system-ui.md` §8 từ 2 gạch đầu dòng → chuẩn copy có luật kiểm được.
2. 35 subtitle literal: xoá phần chỉ diễn đạt lại title; giữ + rút gọn phần mang
   ràng buộc thật.
3. 0 chuỗi user-facing chứa định danh nội bộ (`x.yCreate`, `SettingsShell`,
   `FullCalendar`, `Entity`, `API`, `agent`).
4. Chuỗi OTP stub ở LMS thay bằng thông báo trung tính, không lộ hạ tầng.
5. Lint rule chặn tái phát pattern định danh nội bộ trong chuỗi JSX.
6. `typecheck-and-test` + `ui-e2e` xanh trên CI.

## Chẩn đoán

Gốc: `docs/12-design-system-ui.md` §8 chỉ có 2 gạch đầu dòng — không có luật về
độ dài, slot nào chứa gì, khi nào được giải thích. Mỗi trang tự bịa văn phong.

Ba lỗi, ba cách sửa khác nhau:

- **D1 — giải thích thường trực.** 42 subtitle (35 literal + 7 dynamic) trên page
  header; đa số chỉ diễn đạt lại title thành câu. Odoo không có slot này.
- **D2 — từ vựng nội bộ ra mặt tiền.** Vi phạm chính luật §8 đã viết.
- **D3 — title hình dạng câu văn.** Nặng nhất ở LMS (title 2 câu). *Thuộc pass B,
  ngoài phạm vi đợt này trừ chuỗi OTP.*

## Bằng chứng quyết định phạm vi

- **0/41 chuỗi subtitle được bất kỳ e2e spec nào tham chiếu** (kiểm bằng đối chiếu
  từng chuỗi với `apps/e2e/tests`). ⇒ xoá subtitle an toàn với CI.
- Selector e2e tập trung ở `getByLabel` trên nhãn form — nằm ngoài phạm vi sửa.
- ⇒ Phần đáng sửa nhất và phần an toàn nhất trùng nhau.

## Inventory

### Giữ + rút gọn (mang ràng buộc không suy ra được)

| File:line | Lý do giữ |
|---|---|
| `students/index.tsx:79` | "tối đa 20 kết quả" — giới hạn thật |
| `finance/receipt-create.tsx:227` | "tài khoản LMS tự tạo sau khi duyệt" — hệ quả không hiển nhiên |
| `teaching/session-assessment.tsx:149` | điều kiện buổi tự chuyển `done` — luật nghiệp vụ |
| `admin/network-ip.tsx:331` | title "Chấm công & vị trí" không nói rõ cấu hình cái gì |
| `enrollment/class-placement.tsx:114` | giải nghĩa trạng thái `reserved` |

### Sửa gấp — lộ thuật ngữ nội bộ

| File:line | Chuỗi |
|---|---|
| `teaching/schedule.tsx:298` | `FullCalendar · buổi học timed · list/kanban Soft Ops` — lộ tên thư viện npm |
| `admin/shift-config.tsx:323` | `… — SettingsShell` |
| `finance/reconciliation.tsx:228` | `Cảnh báo từ agent phân tích tự động` |
| `finance/refund.tsx:29` | `finance.refundCreate đã tồn tại nhưng chưa có màn…` |
| `crm/opportunity-detail.tsx:184` | `… (crm.opportunityList)` |
| `go-resolver.tsx:20` | `Entity hoặc id trong URL không hợp lệ` |
| `students/student-detail.tsx:182,195,208,221` | `API … chưa khả dụng` ×4 |
| `admin/users.tsx:346` | `User ID (auth identity)` |
| `apps/lms` (OTP) | `ConsoleEmailTransport (stub) … Brevo/Graph credentials` |

### Xoá (chỉ diễn đạt lại title)

`courses/index.tsx:90`, `classes/index.tsx:302`, `admin/users.tsx:272`,
`finance/receipt-list.tsx:167`, `hr/payroll.tsx:458,481`, `admin/facilities.tsx:100`,
`finance/revenue-report.tsx:185`, `engagement/gifts.tsx:120`,
`engagement/leaderboard.tsx:13`, `engagement/rewards.tsx:164`,
`teaching/exercises.tsx:196`, `teaching/grading.tsx:379`, và phần còn lại của 35.

Phân loại cuối cùng do plan chốt từng dòng — danh sách trên là điểm khởi đầu, không
phải phán quyết.

## Rủi ro

- **Mất thông tin khi xoá hàng loạt.** Giảm thiểu: phân loại từng dòng, mặc định
  giữ khi nghi ngờ.
- **Chuỗi `(Super Admin)` trong subtitle** — nav đã gate quyền; bỏ hay giữ cần
  quyết định trong plan.
- **7 subtitle dynamic** chưa soi nội dung runtime; plan cần đọc từng chỗ.

## Toàn cảnh mở rộng (scout song song 6 agent, 2026-08-05 11:31)

Yêu cầu: quét toàn diện để biết hướng tối ưu trước khi mở rộng phạm vi. Kết quả:

### 🔴 Phát hiện ngoài phạm vi văn phong — bảo mật, cần quyết định riêng

`apps/lms/src/pages/login.tsx:209` — không gate, hiển thị công khai trên màn đăng
nhập (không cần đăng nhập):
> "Mật khẩu mặc định: Cmc2026@ — phải đổi lần đầu đăng nhập."

`Cmc2026@` là mật khẩu mặc định DÙNG CHUNG cho mọi tài khoản học sinh mới cấp
(`apps/api/src/student/router.ts:94`, `provisioning/provision-from-receipt.ts:306`).
Học sinh đăng nhập bằng SĐT phụ huynh. ⇒ Ai biết SĐT phụ huynh của học sinh mới
ghi danh có thể đăng nhập trước khi gia đình đổi mật khẩu lần đầu, chỉ cần đọc
dòng này. Đã verify: `[DEV ONLY]` badge và `DevHeaderWriter` cạnh đó có gate
`import.meta.env.DEV` đúng chuẩn; riêng dòng mật khẩu mặc định KHÔNG có gate gì.
Vượt phạm vi giao kèo hiện tại — cần quyết định riêng (ẩn dòng, hay đổi cơ chế
mật khẩu mặc định).

### Inventory D1/D2/D3 mở rộng (ngoài 42 subtitle gốc)

| Vùng | D1 | D2 | D3 |
|---|---|---|---|
| finance/hr/crm | 14 | 22 | ~2 |
| teaching/attendance/students/classes/courses/enrollment/admin/engagement/parents | 14 | 8 | 0 |
| LMS (trừ mật khẩu mặc định + OTP đã biết) | 20 | 9 | 7 |

D2 lặp pattern rõ: role code (`super_admin`, `GĐKD/GĐĐT`) 5 chỗ; tên hàm API
(`finance.refundCreate`, `payslip.assemble`, `crm.opportunityList`) 5 chỗ;
permission code trong ngoặc (`(shift.manage)`, `(user.manage)`, `(class.create)`)
4 chỗ; status code thô hiển thị thay nhãn (`Lost`, `O1–O5`).

### Nguồn gốc lỗi D2 trong error message

30/33 chỗ render lỗi ở admin+lms lấy thẳng `error.message` từ backend tRPC throw
(`apps/api/src/**/router.ts`) — sửa văn phong nhóm này bắt buộc đụng backend, không
chỉ frontend. Chỉ 6 chỗ là hardcode FE thuần: 4× `student-detail.tsx` ("API...chưa
khả dụng"), `finance/refund.tsx`, permission code ở `crm/opportunity-detail.tsx:184`
— cả 6 đều đã nằm trong giao kèo đã chốt, an toàn sửa FE-only.

### Rủi ro e2e khi mở rộng ngoài subtitle

Quét 376 chuỗi title/description/label (admin+lms, không chỉ subtitle):
**70 chuỗi (18.6%) bị e2e tham chiếu** (button label, dialog title, section header,
permission message), **306 (81.4%) an toàn**. Kết luận cũ về subtitle (0/41) không
đổi. Nếu mở rộng phạm vi ngoài subtitle: cần dual-edit source + e2e spec cho 70
chuỗi at-risk.

### packages/ui — nơi nên gắn chuẩn để tự enforce

39 component có slot copy (title/subtitle/description/label/hint/message...).
13 component hoàn toàn không có JSDoc hướng dẫn: `EmptyState`, `ConfirmDialog`,
`MetricCard`, `Callout`, `StatusBadge`, `StatCard`, `FocusCard`, `EntityHeader`,
`SectionBlock`, `InsightMetric`, `PageHeader.subtitle`, `Panel`, các `*.label`
dùng chung. `SessionCard` có JSDoc mẫu tốt nhất (dòng 30-57) — nên lấy làm khuôn.

## Quyết định cuối (2026-08-05 11:31, sau scout mở rộng)

**Bảo mật:** tách hẳn khỏi kế hoạch này. Đã spawn subagent chạy `/ak-fix` xử lý
riêng, song song (không chặn công việc chuẩn hoá từ ngữ). Kết quả subagent này
được báo cáo về phiên chính khi xong — không nằm trong scope plan bên dưới.

**Phạm vi chuẩn hoá từ ngữ — CHỐT (Phạm vi A+, "chỉ frontend"):**

Gồm:
1. 42 subtitle gốc (35 literal + 7 dynamic) — giữ khi mang ràng buộc thật (theo
   quyết định vòng 1), xoá khi chỉ diễn đạt lại title.
2. Toàn bộ D2 hardcode ở FRONTEND (lộ thuật ngữ/role-code/API-name/permission-code
   nội bộ) tìm được ở 3 vùng quét — finance/hr/crm (22), domain còn lại (8), LMS
   (9) — TRỪ chuỗi nào trùng vào danh sách 70 chuỗi at-risk với e2e (plan cần đối
   chiếu từng chuỗi cụ thể trước khi sửa, không giả định an toàn).
3. `docs/12-design-system-ui.md` §8 viết lại thành chuẩn thật + lint rule chặn
   pattern định danh nội bộ trong chuỗi JSX.

KHÔNG gồm (backlog phase sau, không phải đợt này):
- 27 chỗ D2 có nguồn backend (`apps/api/**/router.ts` throw trực tiếp) — không
  đụng backend đợt này.
- D1 (giải thích thừa) và D3 (title dạng câu văn) mới phát hiện ngoài subtitle —
  để lại nguyên trạng, chỉ ghi nhận trong inventory trên làm backlog.
- Mật khẩu mặc định lộ (login.tsx:209) — xử lý bởi subagent ak-fix riêng.
- Lỗ hổng luồng OTP stub — đã tách trước đó.
- JSDoc cho 13 component packages/ui thiếu guidance — có thể đưa vào plan làm
  phần "gắn chuẩn vào component" nếu planner thấy hợp lý, không bắt buộc trong
  acceptance criteria gốc.

## Câu hỏi chưa giải quyết

1. `(Super Admin)` / tên vai trò trong subtitle: giữ như tín hiệu phạm vi, hay bỏ
   vì nav đã gate? (chi tiết, để plan quyết định từng dòng)
2. Trong danh sách D2 mới (finance/hr/crm 22 chỗ, domain khác 8 chỗ, LMS 9 chỗ),
   plan cần đối chiếu CỤ THỂ với 70 chuỗi at-risk e2e trước khi liệt kê final —
   báo cáo này chỉ xác nhận tỷ lệ tổng thể (18.6%), chưa map từng chuỗi.
