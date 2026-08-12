# Tài liệu 29 — Test Plan (G4)

> Kế hoạch kiểm thử v2: kim tự tháp test, coverage target theo module, danh mục test-spec (từ ô Test
> của Ma trận TL25), kịch bản trọng yếu theo bất biến, eval cho agent, cổng CI. Điền ô "Test" mà
> traceability để trống.

---

## 1. Kim tự tháp test

| Tầng | Phạm vi | Công cụ | Nơi |
|---|---|---|---|
| **Unit** (đáy — dày) | Hàm thuần: lương/phạt post-tax, KPI, `computeFinalGrade`, `exercise-open` Tier A, tiến trình unit trên trục có lỗ hổng (`order_global` gap-aware), `ipMatchesCidr`, code-gen | Vitest | `packages/domain-*`, `lib/` |
| **Integration** (giữa) | RLS theo facility, flow provisioning, cổng tiền SoD, cổng điểm danh, ticket-lock ca, restamp/grant unit trên trục gapped (Bright I.G) | Vitest + Postgres test | `apps/api` |
| **E2E** (đỉnh — mỏng) | Critical path: ghi danh→provisioning, làm bài PDF→chấm, chấm công, duyệt ca | Playwright | `apps/e2e` |

## 2. Coverage target theo module (rủi ro-dựa)

| Module | Target | Vì sao |
|---|---|---|
| **finance / provisioning / payroll** (tiền) | **≥ 90%** unit + integration đủ nhánh | Sai = mất tiền/toàn vẹn |
| exercise-open · attendance gate · unit progression | ≥ 85% (Tier A, cancelled, reserved; trục unit **có lỗ hổng** thật) | Logic tinh vi (ADR 0038 Tier A; gap-aware 2026-08-12) |
| auth / RLS / RBAC | ≥ 85% + test vượt-rào âm tính | Bảo mật/cô lập |
| shift / kpi | ≥ 80% | Nhiều nhánh vai trò |
| CRM / rewards / meeting / aftersale | ≥ 70% | Rủi ro trung bình |
| dashboard / search | smoke | Utility |

## 3. Danh mục test-spec (từ Ma trận TL25 — ô Test)

Mỗi WF có ≥1 spec. Trích: `finance/approve.spec` · `provisioning/idempotent.spec` ·
`enrollment/reserved-active.spec` · `finance/cancel-refund.spec` · `agent/recon.spec` ·
`class/generate-sessions.spec` · `attendance/gate.spec` · `exercise/open-tier.spec` ·
`submission/annotate-submit.spec` · `submission/grade.spec` · `assessment/draft-confirm.spec` ·
`session-evidence/publish.spec` · `checkin/ip-match.spec` · `checkin/manual-ticket.spec` ·
`shift/register-mode.spec` · `shift/approve-fallback.spec` · `payroll/penalty-posttax.spec` ·
`kpi/override-tree.spec` · `rewards/redeem-refund.spec` · … (28 luồng → ≥28 spec).

## 4. Kịch bản trọng yếu theo bất biến (bắt buộc có test)

| Bất biến / rule | Test phải chứng minh |
|---|---|
| SoD cổng tiền (ADR-B) | sale gọi `receiptApprove` → `FORBIDDEN`; audit ghi ai-tạo/ai-duyệt kể cả trùng người |
| Provisioning idempotent (ADR 0041) | lỗi provisioning **không rollback** netAmount; replay không nhân đôi; race SĐT ON CONFLICT |
| netAmount/refund (QĐ0028) | `SUM(refund) ≤ netAmount` dưới `FOR UPDATE`; refund vượt → `BAD_REQUEST` |
| enrollment (ADR-A) | `reserved` không điểm danh được; `active ⇔ Receipt approved` |
| exercise-open (ADR0038) | unit mở chỉ sau buổi kết thúc (ICT) — **Tier A only** (Tier B / buổi bù gỡ 2026-08-12; **không** viết lại test Tier B); lifecycle chặn |
| unit progression (trục gapped) | restamp/grant/roster trên Bright I.G: `order_global` thiếu 40/44/48/52/56 — buổi sau lỗ hổng gán unit **có thật** (vd. 41), không invent label lỗ; gói N unit = N unit thật; cancel+restamp trượt đúng trên trục |
| attendance gate | buổi cancelled không điểm danh; mismatch batch chặn |
| check-in IP (ADR0039) | IP trong CIDR → `ip`; ngoài → `manual`; không tự duyệt phiếu |
| shift (ADR0040) | sale SINGLE vs GV MULTIPLE; ticket-lock 1 phiếu; không tự duyệt; fallback nhóm |
| RLS | query cơ sở A không thấy dữ liệu cơ sở B (test âm tính) |
| dữ liệu trẻ (TL08§7) | nhận xét/ảnh trẻ không auto-publish; internalNote ẩn với PH |

## 5. Eval cho AI agent (điều kiện bật tự chủ)

- **Golden dataset** gán nhãn tay cho từng agent (admissions, recon, teacher-assist).
- Chỉ số: độ chính xác/phù hợp · **tỉ lệ hallucination** · **tỉ lệ người override** (thấp = tốt) · chi phí.
- **Regression**: đổi prompt/model → chạy lại eval, không tụt thầm.
- Ngưỡng bật auto đặt theo số liệu (crawl-walk-run — TL04/13). Recon agent giữ **HOTL** tới khi đủ tin.

## 6. Cổng CI (Jenkins — dựng theo DEBT)

Pipeline chặn merge: **typecheck → lint → unit → integration (RLS) → e2e critical → verify-RLS**. PR
đụng module tiền/PII phải xanh 100% nhánh trọng yếu §4. Coverage report công khai theo module.

> **THỰC TẾ ĐÃ DỰNG (ghi chú 2026-07-26 — tài liệu thiết kế đóng băng, chỉ chú thích, không viết lại ý định):**
> CI thật là **GitHub Actions** (`.github/workflows/ci.yml`), không phải Jenkins. Và **chỉ job
> `typecheck-and-test` thực sự chặn merge** (typecheck → lint → unit/integration RLS → gate coverage
> `@cmc/domain-payroll` ≥90%). Các job/bước `e2e`, `ui-e2e`, drift ma trận màn×vai, và `acceptance:report`
> đều đang `continue-on-error: true` ⇒ **chạy cảnh báo, KHÔNG chặn merge**. Không tồn tại job `verify-RLS`
> riêng (kiểm RLS nằm trong integration test của `typecheck-and-test`).
> Chủ ý là warn-first rồi mới nâng thành gate; mốc nâng `ui-e2e` bắt đầu đếm từ 2026-07-26 (2 run xanh liên tiếp).

## 7. Định nghĩa "Done" (khớp DoR TL00 §5)

Một WF/màn "xong" khi: có spec ở §3, đạt target §2, phủ kịch bản §4 liên quan, e2e critical (nếu thuộc
critical path) xanh. **Ô Test trong TL25 trỏ tới spec thật** — không còn trống.

> Liên kết: TL25 (ô Test) · TL01 (bất biến) · TL08§7 (dữ liệu trẻ) · TL13 (eval agent) · TL18 (công cụ).
