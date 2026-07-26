# 2026-07-26 — Chạm trần journey 31/38, CI sống lại, và cái giá thật của một con số đáng tin

**Phạm vi:** branch `acceptance-journey-38-lms`, plan `260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms`.
**Kết quả cuối ngày:** sổ nghiệm thu **31/38 luồng đã chứng minh chạy** (artifact CI, `gitDirty:false`, commit `324bd12`) — là **trần** của phương pháp journey; 7 luồng còn lại `no-ui-path` ⇒ **38/38 đều có trạng thái máy-chứng, 0 chưa phân loại**. Phase 7 đóng. Journey xuyên app đầu tiên (P2-08 nửa PH) đã xanh, chờ CI gắn sổ.

## 1. CI chết 9 ngày — chẩn đoán đúng tiết kiệm cả ngày công

Mọi run từ 2026-07-17 fail sau 3–4 giây với **0 step chạy**. Đó là chữ ký của hết Actions minutes, không phải lỗi YAML. Repo chuyển public → chạy ngay, **không sửa một dòng workflow nào**. Job `ui-e2e` chạy lần đầu trong lịch sử dự án và xanh liên tiếp từ đó.

Số đo thay dự phóng: `ui-e2e` **6.1′** (dự phóng cũ 9′–53′) ⇒ giữ full-suite mỗi push. Quyết định visibility chốt bằng số: 142 run/11 ngày × ~12′ tính phí ≈ cạn 2.000′ free-tier private sau ~3,4 ngày ⇒ hướng bền là **self-hosted runner + private** (runbook `docs/runbook-self-hosted-runner.md`, đã kiểm trước 2 bẫy: cổng 5432 bị stack UAT chiếm → `55435`; bỏ `--with-deps` vì không sudo passwordless). Hai bước thao tác thuộc user, cuối ngày chưa thực hiện; repo còn public, 0 fork.

## 2. Bốn luồng mới — mỗi luồng lộ ra một thứ không đọc-code-thì-không-biết

- **P4-04 (test đầu vào):** server ép trình tự — complete ở O3 đẩy cơ hội sang O4 làm nút "Đặt lịch test" biến mất ⇒ phải đặt đủ 2 lịch trước khi resolve cái nào. Lỗi sản phẩm: trang chi tiết cơ hội render từ `crm.opportunityGet` nhưng không mutation nào invalidate nó ⇒ nhãn giai đoạn đứng yên vô hạn tới khi F5.
- **P3-06/P3-08 (KPI):** ràng buộc **kẹp hai đầu** — `kpi.confirm` trả 403 nếu payslip đã chốt, `kpi.bulkApprove` *âm thầm bỏ qua* nếu chưa chốt ⇒ trình tự khả thi duy nhất: xác nhận → chốt lương → tất toán. Vế "âm thầm" nguy hiểm: API vẫn 200 mà không đổi gì. Falsification bỏ bước chốt lương → spec ĐỎ, chứng minh bước đó load-bearing.
- **P1-06 (liên kết PH–con):** `guardian.requestLink` **không có UI ở đâu cả** (màn PH tự ghi "Liên hệ nhân viên"), và `/admin/parents` **mồ côi khỏi nav** — route sống, màn xây đủ, không menu nào trỏ tới. Giải pháp đúng provenance: gọi procedure thật qua phiên PH thật (`createLmsClient`), không seed.
- **P2-08 nửa PH (xuyên app):** GV công bố (ERP) → PH đọc trên LMS; cổng đồng ý ảnh chứng minh **có răng** — chưa bật đồng ý thì tóm tắt qua nhưng ảnh bị giữ; bật thì *cùng locator đó* thấy ảnh (nên count-0 ban đầu là từ chối thật, không phải chưa render).

## 3. Bài học đắt nhất: 3/4 lỗi ở P4-04 là lỗi của chính test

1. Nhãn trạng thái trùng label nút ("Hoàn thành"/"Vắng mặt") ⇒ assertion khớp nhầm vào nút của hàng chưa xử lý.
2. `toHaveCount(0)` ngay sau `reload()` ⇒ "chưa render kịp" cũng thoả. Falsification đầu **vẫn xanh** khi bỏ hẳn thao tác noShow — đúng định nghĩa xanh giả.
3. Phụ thuộc múi giờ: `datetime-local` parse theo múi giờ trình duyệt, list render theo ICT ⇒ **4× xanh local (ICT) nhưng đỏ trên runner UTC**. Sửa bằng `timezoneId: 'Asia/Ho_Chi_Minh'`; từ đó mọi journey mới chạy 4× dưới `TZ=UTC`.

Kết luận nghi thức: **4× xanh không phải bằng chứng — falsification + CI trọng tài mới là.** Sổ đã hành xử đúng khi từ chối ghi nhận P4-04 lúc nó đỏ trên CI (coverage 28 nhưng proven 27).

## 4. Lỗi quy trình tự bắt trong ngày

- Bịa field `additionalJourneys` không có trong `types.ts` → thay bằng cách hợp lệ (trỏ `journey` của P2-08 sang spec xuyên app phủ rộng hơn; spec nửa-GV ở lại làm guard hẹp).
- 4× xanh đầu của journey P2-08-PH chạy trên mã **có lỗi type** (`classCode` vs `classBatchId`) vì Playwright transpile không typecheck — chạy lại đủ 4× sau khi sửa.
- Một lần kết luận sớm ("đã xác nhận lỗi sản phẩm" khi mới có suy đoán; race trong test của tôi) — đã đính chính trong báo cáo.

## 5. Còn treo

- **Phase 8:** P4-01 nửa học sinh (đổi quà LMS → GĐ duyệt ERP), journey xuyên app thứ 3, full-suite 4× liên tiếp trên CI, chốt sổ v1.
- **Bàn giao plan sửa:** 3 finding RT-15 + `opportunityGet` không invalidate + `requestLink` không UI + `/admin/parents` mồ côi nav.
- **User:** đóng private + dựng runner (runbook sẵn).
- UAT M0 người thật vẫn là lần ký cuối — sổ máy-chứng là điều kiện cần, không đủ.
