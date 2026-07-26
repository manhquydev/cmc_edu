# Tình trạng dự án CMC EDU v2 — đánh giá trung thực + việc còn lại

**Ngày:** 2026-07-26 · **Commit:** `22bbead` · **Branch:** `acceptance-journey-38-lms` (35 commit ahead of `main`, 0 behind)
**Loại:** đánh giá read-only, mọi con số đối chiếu bằng chứng máy — không có số nào viết theo trí nhớ.

> **Nguyên tắc của báo cáo này:** mỗi khẳng định đều kèm nguồn kiểm chứng được. Chỗ nào chưa chứng minh thì ghi là chưa chứng minh, không làm tròn thành "xong".

---

## 1. Bức tranh một dòng

Dự án có **hạ tầng kiểm thử thật và sổ nghiệm thu chính danh** — nhưng **chưa đủ điều kiện ký nghiệm thu**. Cụ thể: 27/38 luồng nghiệp vụ đã chứng minh chạy được end-to-end trên CI, còn 11 luồng chưa (4 làm được, 7 không có đường UI). Kiểm thử hiện ở mức *chạy được*, chưa tới mức *đúng số học nghiệp vụ*.

---

## 2. Đã đạt được (có bằng chứng)

### 2.1 CI đã sống lại — mốc quan trọng nhất phiên này

| Việc | Bằng chứng |
|---|---|
| CI chạy lại sau 9 ngày chết | Run `30184942661` (@`478495b`) và `30185169572` (@`22bbead`), cả 2 xanh |
| Nguyên nhân chết đã xác định đúng | Mọi run 2026-07-17→07-26 fail sau 3–4s với **0 step chạy** = hết Actions minutes, KHÔNG phải lỗi workflow. Repo chuyển public → chạy được ngay, không sửa 1 dòng YAML nào |
| Job `ui-e2e` chạy lần đầu tiên trong lịch sử dự án | Bước `Run UI e2e` xanh **ở mức step** (đã kiểm riêng vì job có `continue-on-error: true` có thể che lỗi) — 34/34 spec |
| Runtime thật (trước chỉ có dự phóng) | `ui-e2e` **6.1′**, `typecheck-and-test` 3.8′, `e2e` (API) 2.0′. Dự phóng cũ 9′–53′ ⇒ giữ per-push, không cần nightly/shard |

### 2.2 Sổ nghiệm thu chính danh đã tồn tại

Trước phiên này, **mọi** con số nghiệm thu đều mang dấu `-dirty` và nhãn "CHỈ THAM KHẢO" — plan tự quy định nguồn chính danh phải là artifact CI (D3/RT-3/V1). Nay:

```
artifact: acceptance-journeys-22bbead08cabaaa57419c566424e0eb961f58a7b
gitSha:   22bbead…  (khớp HEAD)
gitDirty: false     ← con dấu run local không bao giờ tạo được
```

Sổ sinh từ artifact đó:

```
38 luồng (37 built, 1 partial, 0 missing), 2 orphan (2 documented gap), 0 unresolved namespaces
journey coverage — 27/38 luồng có journey spec
bằng chứng chạy — 27/38 luồng đã chứng minh chạy
actor-audit — 0 phát hiện
```

Sạch cảnh báo: không còn `WORKTREE BẨN`, không còn `KẾT QUẢ CŨ`.

### 2.3 Kiểm thử — quy mô thật (số từ log CI, không phải ước lượng)

| Gói | Test files | Tests |
|---|---|---|
| `@cmc/api` | 104 | 988 |
| `@cmc/admin` | 39 | 396 |
| `@cmc/ui` | 12 | 45 |
| `@cmc/domain-payroll` | 2 | 38 (kèm gate coverage ≥90%) |
| `@cmc/domain-time` | 1 | 31 |
| `@cmc/domain-finance` | 5 | 17 |
| e2e journey specs | **27 file** | chạy trong `ui-chromium` |
| `ui-chromium` full suite | **34 spec** | 34/34 xanh trên CI |

### 2.4 Chất lượng của journey — vì sao đáng tin

Không phải test giả. Mỗi journey lái **trình duyệt thật → bản build production của admin/lms → tRPC API thật → Postgres thật có RLS**. Không mock.

Kỷ luật áp cho từng journey trong plan này:
- **Falsification load-bearing** — đã kiểm chứng test chuyển ĐỎ khi bỏ đúng hành động cốt lõi. Bắt được false-green thật: P3-05 "chốt lương" trước đây chỉ chứng minh *danh sách nhân viên hiển thị*, chưa hề chạm `finalize`.
- **4× xanh liên tiếp** trước khi tính là đạt.
- **SHA-binding**: sổ từ chối kết quả nếu commit của run ≠ HEAD.

---

## 3. Chưa đạt — nói thẳng

### 3.1 11/38 luồng chưa chứng minh chạy

**Nhóm A — 4 luồng CHƯA VIẾT journey (đều khả thi, đã khảo sát):**

| Luồng | Tên | Đường UI | Ghi chú khảo sát |
|---|---|---|---|
| P3-06 | Nộp & duyệt phiếu KPI | `/hr/kpi`, `/hr/my` | **Rủi ro time-travel đã gỡ** — xem 3.2 |
| P3-08 | Tất toán KPI hàng loạt | `/hr/kpi` | như trên |
| P4-04 | Đặt lịch test đầu vào | `/crm/opportunities/:id` | `crm.opportunityCreate` có UI thật (create-lead-dialog) ⇒ tạo Opportunity qua UI được |
| P1-06 | Liên kết phụ huynh–con | `/admin/parents` | Màn có thật (`guardian.listPendingLinks/approveLink/rejectLink`); cần dựng được 1 pending link trước |

**Nhóm B — 7 luồng `no-ui-path`** (P1-08, P2-01, P2-02, P2-03, P2-05, P3-10, P3-11): **không có đường UI nên journey không thể lái**. Đây là *gap có hồ sơ*, không phải nợ kỹ thuật của việc test. Muốn phủ thì phải xây UI trước — thuộc plan sửa, không thuộc plan nghiệm thu.

⇒ **Trần khả thi qua journey = 31/38.** Con số 38/38 "đã chứng minh chạy" là **không đạt được** trong phạm vi plan này, và không nên hứa.

### 3.2 Một rủi ro lớn của plan đã được gỡ (tin tốt, có bằng chứng)

Plan lo P3-06/P3-08 phải **mock đồng hồ** (và do đó có thể phải chấp nhận `red-fixme`). Kiểm tra source:

```
submitSlipOpensAt(period) = ngày 3 của tháng kế tiếp, ICT
                            (apps/api/src/kpi/auto-score.ts:275)
```

Kỳ `2026-06` mở nộp từ `2026-07-03`; hôm nay `2026-07-26` **đã qua mốc đó**. ⇒ Dùng **kỳ quá khứ** là chạy được tự nhiên, **không cần mock thời gian, không cần red-fixme**. Vẫn cần seed `managerId` + `SalaryRate.tier` (submitSlip chặn nếu chưa gán bậc lương).

### 3.3 Giới hạn bản chất của mức kiểm thử hiện tại

Đây là điểm dễ hiểu lầm nhất, nên nói rõ:

| Journey CHỨNG MINH | Journey KHÔNG chứng minh |
|---|---|
| Luồng chạy thông từ UI → API → DB | Con số nghiệp vụ tính **đúng** |
| Phân quyền/guard chặn đúng chỗ | Công thức KPI, tiền phạt, proration ra đúng giá trị |
| Chuyển trạng thái thật (Nháp→Đã chốt…) | Đúng với **mọi** input, biên, ngoại lệ |

Ví dụ cụ thể: journey P3-05 xác nhận `assemble → finalize` tạo được phiếu lương nháp mang đúng lương cơ bản của bậc, rồi chốt. Nó **không** kiểm phần KPI (`%côngca × %chỉ-số × đơn giá`) hay tiền phạt có ra đúng số hay không. Phần đúng-số-học nằm ở unit test của `@cmc/domain-payroll` (38 test, coverage ≥90%) — tách bạch, và **chưa được đối chiếu chéo với journey**.

Mỗi journey cũng chỉ đi **một đường hạnh phúc + một negative**, không phải ma trận đầy đủ.

### 3.4 Chưa đủ để ký nghiệm thu

Plan xác định từ đầu: **UAT M0 người thật vẫn là lần ký cuối**. Sổ máy-chứng là *điều kiện cần*, không phải *điều kiện đủ*. Ngoài ra chưa có: test tải/hiệu năng, test bảo mật chủ động, và dữ liệu chạy là dữ liệu tổng hợp (`cmc_synth`) chứ không phải khối lượng/trạng thái migration giống production.

### 3.5 Ba finding sản phẩm còn treo (từ red-team RT-15)

Chưa sửa — plan này cấm sửa app. Cần bàn giao sang plan sửa:
1. **OTP lưu plaintext** trong `EmailOutbox.payload`, không RLS (`apps/api/src/.../router.ts:423`).
2. **Secrets dev-default committed** trong repo — negative RLS/consent chỉ có giá trị khi env dùng secret riêng.
3. **`parseLmsToken` phía client không verify chữ ký** (`lms-session.tsx:39`) — token server ĐÃ ký, nên đây là vấn đề tin-tưởng-phía-client.

### 3.6 Rủi ro mới phát sinh phiên này: repo đang PUBLIC

Để lấy Actions miễn phí, repo đã chuyển public.

- ✅ **Đã kiểm: không có secret nào bị commit** — chỉ `.env*.example`; `.gitignore` chặn `.env*`; lịch sử git không có `.env`/`.pem`/key.
- ⚠️ **Nhưng toàn bộ mã nghiệp vụ đang công khai** (logic lương/KPI, schema DB, RLS policy, luồng ERP+LMS). Chuyển lại private **không thu hồi được** bản đã bị fork/clone/index.

**Cần quyết định:** (a) bật lại billing rồi private — chi phí thực thấp hơn lo ngại ban đầu vì chỉ ~6′/push; hoặc (b) **self-hosted runner** — miễn phí, repo giữ private. *Chưa thay đổi gì; chờ user.*

---

## 4. Việc còn lại — thứ tự đề xuất

| # | Việc | Ước lượng | Chặn bởi | Giá trị |
|---|---|---|---|---|
| 1 | 4 journey còn lại (P3-06, P3-08, P4-04, P1-06) → **31/38** | 1–2 ngày | không còn gì (3.2 đã gỡ) | Đóng trần khả thi của Phase 7 |
| 2 | Phase 8: ≥3 journey xuyên ERP→LMS (điểm danh→PH thấy; điểm→HV thấy; sao→đổi quà→GĐ duyệt) + nửa PH của P2-08 | 2–3 ngày | #1 | Chứng minh vòng đời tới người dùng cuối |
| 3 | Nghi thức chốt: **full-suite 4× liên tiếp trên CI** (~25′ CI) | 1 buổi | #2 | Luật RT-9 của plan |
| 4 | **Chốt sổ v1**: SHA + link artifact + bảng tổng kết **commit được** (không trỏ file gitignored) | 1 buổi | #3 | Sản phẩm ① của plan |
| 5 | Sửa docs sai lệch (audit đang chạy song song) | 1 buổi | — | Trung thực hồ sơ |
| 6 | Bàn giao 3 finding RT-15 sang plan sửa | 1 buổi | — | Không để trôi |
| 7 | **Quyết định visibility repo** (3.6) | user | user | Rủi ro sở hữu trí tuệ |

**Ngoài phạm vi plan này (cần plan riêng):** xây UI cho 7 luồng `no-ui-path`; kiểm đúng-số-học nghiệp vụ; test tải/bảo mật; UAT M0 người thật.

---

## 5. Câu hỏi chưa giải quyết

1. **Visibility repo** — chọn (a) billing+private hay (b) self-hosted runner? Đang public là trạng thái tạm, càng để lâu càng khó thu hồi.
2. **Nửa PH của P2-08** thuộc Phase 8 — có gộp vào cùng đợt LMS không, hay tách?
3. **Có nâng `ui-e2e` thành gate chặn merge không?** Hiện `continue-on-error: true` (warn-first). Chú thích trong `ci.yml` đề xuất chờ ~2 tuần chạy sạch rồi mới nâng. Nay đã có 2 run xanh liên tiếp — bắt đầu đếm từ đây.
4. **Đối chiếu chéo journey ↔ unit test đúng-số-học** (3.3) có thuộc plan nghiệm thu này không, hay đẩy sang plan sau?

---

## 6. Nguồn kiểm chứng

- Sổ: `pnpm acceptance:report` (regen từ artifact CI)
- Artifact: GitHub Actions run `30185169572` → `acceptance-journeys-22bbead…`
- Runtime + test counts: log job `typecheck-and-test` / `ui-e2e` cùng run
- Manifest 38 luồng: `scripts/acceptance-report/flow-manifest.ts`
- Luật trạng thái proven: `scripts/acceptance-report/flow-evidence.ts`
