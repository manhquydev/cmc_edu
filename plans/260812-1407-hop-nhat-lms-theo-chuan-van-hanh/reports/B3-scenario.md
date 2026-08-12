# B3-scenario — Ca biên: chỉ còn đường phát bài (`SessionExercise`)

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch:** `feat/lms-delivery-only-homework`  
**Mode:** `/ak:scenario` · **read-only** · không sửa code  
**Brief:** `BRIEF-B3.md` — gỡ Tier A (ADR 0038), `exercise.openForStudent` chỉ đọc bài đã phát  

**Evidence path (as-built):**

| Path | Vai trò sau B3 |
|------|----------------|
| `apps/api/src/lms-ops/exercise-delivery.ts` | `deliverForSession` / `deliverDueExercises` / `deliveredExerciseIdsForStudent` / `writeSequenceUpdate` |
| `apps/api/src/exercise/open-tier.ts` | `listOpenExercisesForStudent` / `assertExerciseOpenForStudent` (nhánh kill-switch delivery) |
| `apps/api/src/lms-ops/on-roster.ts` | Dual-gate: active + lifecycle + archive day + **unit stamp + range** |
| `apps/api/src/lms-ops/cancel-session.ts` ~L130–147 | Hủy buổi → xóa `SessionExercise` nếu chưa có submission non-draft |
| `apps/api/src/worker/index.ts` | Worker gọi `deliverDueExercises` |
| `apps/lms/src/pages/student/home.tsx` | Empty state copy gắn “sau khi hoàn thành buổi học” (ngôn ngữ Tier A) |

---

## Dimensions analyzed / skipped

| Dimension | Dùng? | Lý do |
|-----------|-------|-------|
| User Types | ✓ | HS active / reserved / archived / blocked_lms; 2 lớp |
| Timing | ✓ | worker lag, race deliver, cancel mid-draft |
| State Transitions | ✓ | deliver → cancel → closed/draft; sequence rewrite |
| Authorization | ✓ | dual-gate roster; submit gate |
| Data Integrity | ✓ | SE orphan, shared exerciseId, 14d window |
| Business Logic | ✓ | mid-join, sold range vs unstamped session |
| Scale / Input / Env / Compliance / Integration | partial | ghi ở mục (10) nếu material |

**Mục tiêu ưu tiên:** ca làm **HS mất bài** hoặc **thấy bài không được phép**.

---

## Ma trận ca biên (theo 10 trục + phụ)

Mỗi ca: **tình huống → hành vi đúng → cách kiểm chứng → severity**.

### (1) Lớp chưa gán dãy bài / chưa phát — HS thấy gì?

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S1.1** | `ClassExerciseItem` rỗng **và** buổi không stamp unit (hoặc stamp nhưng không có homework published) → `deliverForSession` return `null` | `openForStudent.items = []`. **Không** 500. UI: empty state **rõ nghĩa** (“chưa phát bài / lớp chưa xếp dãy”), **không** copy Tier A “sau khi buổi kết thúc” nếu chưa có delivery | API list rỗng; screenshot LMS home; assert copy sau B3 | **High** (UX + hiểu nhầm) |
| **S1.2** | Có dãy bài nhưng **chưa buổi nào end** / worker chưa deliver | Rỗng cho đến khi có `SessionExercise` | `deliverDueExercises` 0; open empty | Medium |
| **S1.3** | API rỗng vs UI “trắng trơn” không banner | Phải có EmptyState (đã có title, nhưng message sai ngữ cảnh B3) | `student/home.tsx` L49–53 | **High** (copy sai product) |

**Hiện trạng code:** empty message vẫn nói *“Bài tập sẽ xuất hiện sau khi hoàn thành buổi học”* — đúng Tier A, **sai** delivery-only (buổi end ≠ đã phát nếu worker/manual fail).

**Bỏ sót dễ:** agent gỡ Tier A nhưng **không** đổi empty copy → HS/PH tưởng hệ hỏng.

---

### (2) Buổi đã kết thúc nhưng worker chưa chạy kịp

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S2.1** | `endTime < now`, chưa có `SessionExercise`, worker delay | **Chưa mở** (fail-closed). Không “lộ” bài vì endTime như Tier A | `listOpenExercises` empty; manual `deliverSessionExercise` → xuất hiện | **Critical** (hồi quy so với Tier A default ON) |
| **S2.2** | Worker down / lỗi từng session (`deliverDueExercises` catch → skip) | Bài kẹt vô hạn cho đến manual deliver hoặc worker recover | Log `[deliverDueExercises] session`; metric skipped | **High** |
| **S2.3** | Buổi end > **14 ngày** trước (`windowMs` L233–234) | Worker **không** quét → **không bao giờ** auto-deliver | Session `endTime` 15 ngày trước, worker 0 deliver | **Critical** (mất bài im lặng) |
| **S2.4** | Race 2 worker deliver cùng batch | Advisory lock + re-check; một `SessionExercise` / session; position không nhân đôi | Concurrent `deliverForSession` | Medium |

**Bỏ sót dễ:** chỉ test “deliver manual happy path”; không test **14-day poison window** và **SLO worker**.

---

### (3) Buổi bị hủy sau khi đã phát

Code: `cancel-session.ts` L130–147; visibility: `deliveredExerciseIdsForStudent` lọc `status: { not: 'cancelled' }` (L332–335).

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S3.1** | Deliver xong, **0** submission non-draft → cancel | Xóa `SessionExercise`; open **không** còn bài; sequence position “không cháy” (spec §8.3) | int test đã có `cancel after deliver revokes…` | High |
| **S3.2** | HS **đang draft** (status draft) → cancel | Draft **không** chặn revoke (`status: { not: 'draft' }` count). SE xóa → open mất; `saveDraft`/`submit` sau đó **BAD_REQUEST** “not open yet” | Tạo draft → cancel → open empty → submit fail | **Critical** (mất bài đang làm) |
| **S3.3** | HS đã **submit** (non-draft) → cancel | SE **giữ** (count > 0). Nhưng open list **vẫn ẩn** vì session cancelled. Submission vẫn xem qua `listForChild` / grade path | cancel + SE còn; open không chứa exercise; listForChild còn | **High** (đúng: không mở lại; vẫn xem bài đã nộp) |
| **S3.4** | Cùng `exerciseId` đã có submission từ **lớp khác** cùng facility → cancel lớp này | Count facility-wide theo `exerciseId` → **không xóa** SE lớp này dù **lớp này** chưa ai nộp → position sequence “cháy”? + open vẫn ẩn vì cancelled | 2 batch, same homework catalog id | **High** (data integrity / sequence burn) |
| **S3.5** | Cancel-sweep worker (0 present) path | Cùng revoke logic trong `session-done-sweep` | Sweep cancel + SE | Medium |

**Bỏ sót dễ:** chỉ assert SE delete; **không** assert HS mid-draft; **không** assert count submission **facility-wide** (S3.4).

---

### (4) HS vào lớp giữa chừng — buổi trước đã phát

Visibility = `onRoster` per delivery: active + ranges cover **session unit order** + archive day.

| ID | Tình huống | Hành vi đúng (đề xuất product) | Kiểm chứng | Sev |
|----|------------|--------------------------------|------------|-----|
| **S4.1** | Join sau buổi 1–3; đã grant range **chỉ từ unit hiện tại** (không `grantPast`) | **Không** thấy bài đã phát của unit quá khứ (không thuộc quyền) | Deliver unit 1–3; enroll + range from current; open không chứa homework unit 1 | High (policy) |
| **S4.2** | Join giữa chừng + `grantPast` full | **Có** thấy bài đã phát cho unit trong range (nếu session còn non-cancelled và SE còn) | grantPast → open contains old deliveries | Medium |
| **S4.3** | Product “có nên thấy bài cũ?” | Cần **chốt chủ hệ thống**: (A) chỉ bài từ lúc vào lớp / (B) mọi bài trong dải đã mua. Code hiện tại = **B theo unit range**, không theo “ngày join” | Document + test S4.1/S4.2 | **High** (ambiguity) |

**Bỏ sót dễ:** giả định “vào giữa = không thấy gì” trong khi range backfill mở hết bài cũ.

---

### (5) HS bị gỡ khỏi lớp nhưng đã nộp bài

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S5.1** | `archiveEnrollment` / status ≠ active; đã submit | `deliveredExerciseIdsForStudent` chỉ `status: 'active'` → **mất khỏi open**. Submission non-draft vẫn `listForChild` | archive → open empty; listForChild còn | High |
| **S5.2** | Chỉ có draft, rồi archive | Mất open; **không** submit được; draft orphan? | assert saveDraft/submit fail | **Critical** (mất work) |
| **S5.3** | Unarchive sau đó | Thấy lại deliveries còn SE + roster pass | unarchive → open restore | Medium |

---

### (6) Hai lớp, cùng một HS, cùng chương trình

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S6.1** | 2 batch UCREA active; mỗi batch deliver homework khác unit | Open = **union** exercise ids (Set) | 2 SE → 2 items (nếu 2 exercise id) | Medium |
| **S6.2** | 2 batch deliver **cùng** `Exercise` catalog id (fallback unit homework) | Set **gộp 1**; open 1 item — OK nếu cùng bài | same homework id twice | Medium |
| **S6.3** | Cancel batch A (có SE + submission count facility > 0 vì batch B đã nộp cùng exercise) | SE A có thể **không revoke** (S3.4); open vẫn không show A vì cancelled; B vẫn show | cross-batch cancel | **High** |
| **S6.4** | Một lớp archived, một active | Chỉ deliveries của batch active (enroll filter) | | Medium |

---

### (7) Bài đã phát rồi chuyển `closed` / `draft`

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S7.1** | SE trỏ exercise; staff `close` / unpublish → `closed` | Open filter `status: 'published'` → **biến mất**. Submit fail “not published” | close → open empty; assert fail | **Critical** (mất bài đã phát) |
| **S7.2** | HS đã submit trước khi close | listForChild / grade vẫn thấy submission; open không cần | | High |
| **S7.3** | Re-publish sau close | Xuất hiện lại nếu SE + roster còn | | Medium |
| **S7.4** | `writeSequenceUpdate` yêu cầu published — không chặn close **sau** deliver | Đúng: deliver lúc published; close là lifecycle riêng — cần policy “cấm close nếu còn SE active”? | Product rule | High |

**Bỏ sót dễ:** agent chỉ test deliver published; không test **close sau deliver**.

---

### (8) Dãy bài lớp bị sửa sau khi đã phát một phần

Code: `writeSequenceUpdate` + `planSequenceUpdate` — freeze `position <= deliveredCount` (MAX position).

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S8.1** | Deliver pos 1–2; gán lại dãy mới | Pos ≤ max delivered **giữ**; chỉ tail thay | int assign sequence + reassign | High |
| **S8.2** | SE đã trỏ exercise cũ pos 1; tail đổi | Open vẫn exercise cũ cho pos 1 (đúng freeze) | | Medium |
| **S8.3** | Deliver “lủng” positions? | `deliveredPositions` + `nextDeliverablePosition` — cần không nhảy nhầm / double | domain tests | Medium |
| **S8.4** | Gán dãy rỗng | badRequest “At least one exerciseId” | | Low |
| **S8.5** | Un-publish exercise **chưa** deliver trong tail rồi gán lại | reject “must be published” | | Medium |

---

### (9) HS có dải unit nhưng buổi chưa gắn unit

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S9.1** | Có `ClassExerciseItem`; deliver OK (sequence path, không cần unit); session `curriculumUnitId = null` | SE tạo được; **nhưng** `deliveredExerciseIdsForStudent` lấy `sessionOrderGlobal = null` → `onRoster` **fail-closed** → HS **không thấy** bài đã phát | deliver unstamped; open empty | **Critical** (phát rồi “mất”) |
| **S9.2** | Không sequence; stamp null | `deliverForSession` return null (L196–197) | | Medium |
| **S9.3** | Stamp sau khi deliver | Visibility **bật** khi stamp + range match (SE đã có) | stamp after SE → open | High |
| **S9.4** | Có range nhưng stamp unit **ngoài** range | onRoster false → không thấy (đúng dual-gate) | | High |

**Bỏ sót dễ:** test deliver happy path luôn stamp unit; **không** test sequence-first + unstamped session (S9.1).

---

### (10) Trục khác agent dễ bỏ

| ID | Tình huống | Hành vi đúng | Kiểm chứng | Sev |
|----|------------|--------------|------------|-----|
| **S10.1** | `blocked_lms` / `withdrawn` | Open empty; submit fail | lifecycle | High |
| **S10.2** | Enrollment `reserved` (chưa active) | Không trong active enrollments → empty | | High |
| **S10.3** | Tier A **default ON** hôm nay; B3 gỡ → mọi env đang dựa “buổi end = mở cả unit catalog” **hẹp lại** chỉ 1 bài/buổi | Regression journey: end session without deliver → **empty** (trước đầy homework unit) | e2e/open-tier rewrite | **Critical** (product change) |
| **S10.4** | Fallback không dãy: 1 homework/unit; unit có thêm test_periodic | Chỉ homework type trong fallback L181–186 | | Medium |
| **S10.5** | Sequence exhausted (`nextPos == null`) | deliver null; buổi end không có bài | | Medium |
| **S10.6** | `assertExerciseOpenForStudent` thiếu `exercise.id` | fail closed “not open yet” (L228–229) | | Medium |
| **S10.7** | Parent `listForChild` vs student open | Parent thấy submission; student open delivery-only — không đồng bộ list “bài đang mở” | | Medium |
| **S10.8** | Manual `lmsOps.deliverSessionExercise` permission vs chỉ worker | Ops có thể cứu S2.x | RBAC | Medium |
| **S10.9** | Xóa cờ `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE` | Env cũ set cờ không còn effect / crash nếu còn đọc | grep env | Medium |
| **S10.10** | Dual-gate: entitlement “thừa” theo brief nhưng **onRoster vẫn check ranges** | Không bỏ range check khi gỡ env flag — **vẫn cần** | | **Critical** (security/business) |

---

## Severity summary

| Severity | Count (approx) | Theme |
|----------|----------------|-------|
| **Critical** | 8 | Worker 14d window; mid-draft cancel; close after deliver; unstamped+sequence invisible; Tier A regression; env dual-gate; draft+archive |
| **High** | 12+ | Empty copy; worker down; cancel keep SE; mid-join policy; two-class share exerciseId; sequence freeze |
| **Medium / Low** | rest | races, aliases, permissions |

---

## Ưu tiên ca “HS mất bài” / “thấy bài không được phép”

### Mất bài (implementer **must** test)

1. **S2.1 / S2.3** — end nhưng chưa deliver / ngoài 14 ngày → empty (so với Tier A cũ).  
2. **S3.2** — cancel khi đang draft → SE xóa, mất draft path.  
3. **S7.1** — close exercise đã phát → biến mất open.  
4. **S9.1** — deliver theo dãy + session chưa stamp → SE có nhưng open không.  
5. **S5.2** — gỡ lớp khi chỉ draft.  
6. **S1.3** — empty copy gây “tưởng mất bài / hệ hỏng”.

### Thấy bài không được phép

1. **S4.2 / S4.3** — grantPast / range rộng → thấy bài buổi trước khi join (có thể không mong muốn).  
2. **S10.10** — nếu ai đó gỡ luôn dual-gate range theo brief “entitlement thừa” **sai** → HS không mua vẫn thấy bài đã phát của lớp.  
3. **S6.x** — cross-batch same exerciseId / cancel count facility-wide side effects.  
4. Cancelled session: open **đúng** phải ẩn (đã filter); đừng “fix” bằng cách bỏ filter cancelled.

---

## Gợi ý kiểm chứng tối thiểu cho agent implement B3

| # | Test / check |
|---|----------------|
| T1 | `LMS_OPEN_TIER` path removed; open == delivery only (extend `exercise-delivery.int.test.ts`) |
| T2 | Session ended, no SE → open empty; after deliver → open contains exactly that exercise |
| T3 | deliver + draft + cancel → open empty + submit BAD_REQUEST |
| T4 | deliver + submit + cancel → listForChild keeps submission; open excludes |
| T5 | Sequence deliver with `curriculumUnitId=null` → open empty until stamp (or product forbids deliver) |
| T6 | Close published exercise with SE → open empty |
| T7 | Mid-join without grantPast → no old deliveries |
| T8 | Worker `endTime` older than 14d → not auto-delivered |
| T9 | Rewrite empty copy in `apps/lms` (brief nói không sửa LMS procedure — **copy vẫn nên sửa** nếu trong scope; nếu không: flag DONE_WITH_CONCERNS) |
| T10 | Range dual-gate still enforced after removing `LMS_ENTITLEMENT_GATE` |

---

## Notes for the Tier-A removal agent (blind spots)

1. **Delivery lag is new user-visible behavior** under default-on Tier A today.  
2. **`onRoster` null unit stamp** can make successful delivers invisible.  
3. **Cancel revoke uses facility-wide submission count** on `exerciseId` — not session-scoped.  
4. **Cancelled sessions are excluded from open even if SE retained** — intentional but confuses “I submitted” vs “I can open”.  
5. **14-day worker window** is a silent backlog killer.  
6. **Empty-state copy** still documents Tier A.  
7. **Do not remove unit-range checks** when deleting `LMS_ENTITLEMENT_GATE`.  
8. **Close/draft after deliver** is an open product footgun.

---

## Status: DONE

Ca biên đã bóc theo 10 trục + phụ; ưu tiên mất bài / thấy trái phép; gắn file/line evidence.  
Không sửa code · không commit.
