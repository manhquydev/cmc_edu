---
phase: 3
title: "Nội dung toàn bộ luồng nghiệp vụ"
status: completed
dependencies: [1, 2]
---

# Phase 3 — Nội dung toàn bộ luồng nghiệp vụ

Phase nặng nhất, khoảng **90% công sức** của cả kế hoạch. Vỏ kỹ thuật chỉ là 10%.

## Context

Số luồng **lấy động từ manifest lúc build**, không chép. Ảnh chụp tại `83b59b0`: 38 luồng — P1=9 · P2=8 · P3=11 · P4=5 · ADMIN=5. Con số này đã đổi một lần ngay trong phiên viết kế hoạch (`P3-01b` bị xoá), nên coi bảng dưới là tỉ lệ tương đối, không phải hợp đồng.

Nguồn nội dung để biên tập lại (**không bơm thẳng vào deck** — chúng viết cho dev):
- `docs/24-workflow-spec-p1.md` · `docs/26-workflow-spec-p2.md` · `docs/27-workflow-spec-p3.md` ·
  `docs/28-workflow-spec-p4.md`
- `docs/19-quy-tac-nghiep-vu-chi-tiet.md` · `docs/20-quy-tac-nghiep-vu-van-hanh.md` — ngưỡng, thời hạn
- `docs/14-danh-muc-vai-tro-phan-quyen.md` — ranh giới quyền, để không hứa sai

## Requirements

Mỗi luồng phải trả lời đủ **4 câu**:
1. Ai bắt đầu?
2. Ai duyệt?
3. Hệ thống tự làm gì?
4. Xem kết quả ở màn hình nào?

Cộng thêm: quy tắc quan trọng (ngưỡng tiền, chống tự duyệt, thời hạn) và **nhãn trạng thái hai
tầng** (đã chạy thông / đã kiểm đúng nghiệp vụ / chưa chứng minh).

**Ngưỡng chữ:** màn tra cứu ở phase này **không** chịu ngưỡng 25 từ của mạch chính — bốn câu trả lời
không thể nhét vừa 25 từ. Ngưỡng riêng cho màn tra cứu: **≤ 60 từ**, và chữ nằm trong sơ đồ **không**
tính vào ngưỡng (nếu tính thì mọi swimlane đều false-fail; nếu bỏ hẳn thì lách được bằng cách nhét
chữ vào node — nên đếm riêng và đặt trần riêng cho chữ trong sơ đồ).

**Nguồn "xem kết quả ở màn hình nào": lấy từ `flow-manifest.ts`, KHÔNG lấy từ workflow spec.** Docs
đã trôi: `docs/24` ghi `/finance/receipts/new?opportunityId=`, manifest ghi `/finance/new`. Manifest
đối chiếu trực tiếp scanner output nên nó là sự thật.

## Cắt theo cụm — mỗi cụm ship độc lập

| Đợt | Cụm | Số luồng | Ghi chú |
|---|---|---|---|
| 3a | P1 Tuyển sinh & ghi danh | 9 | Làm trước — trùng mạch chính, kiểm chứng khuôn sớm |
| 3b | P2 Vận hành lớp | 8 | |
| 3c | P3 Nhân sự · ca · lương | ~11 | Nặng nhất cụm |
| 3d | P4 Đổi quà · họp PH · sau bán | 5 | |
| 3e | ADMIN Quản trị hệ thống | 5 | Màn quản trị, mô tả gọn |

**Hai chốt rà khuôn, không phải một:**

- **Sau 3a (9 luồng)** — bắt lỗi khuôn cơ bản khi sửa còn rẻ
- **Giữa 3c (sau khoảng nửa số luồng P3)** — 3a toàn luồng tuyến tính nên **không** stress được khuôn. P3 mới
  là chỗ khuôn gãy: nhiều luồng đan chéo vai trò, có luồng chạy nền không giao diện
  (`P3-10`, `P3-11`), và cụm này ít chất liệu docs nhất

**Cảnh báo chất liệu:** `docs/27` (cụm P3) mỏng hơn hẳn các cụm khác tính trên mỗi luồng. Đợt 3c sẽ
phải đọc thẳng code hoặc journey spec để bù, không chỉ đọc docs — tính thêm thời gian cho đợt này.

**Ai chịu trách nhiệm tính đúng nội dung:** phần diễn giải nghiệp vụ do người thuyết minh (chủ dự
án) rà và chốt, không giao trọn cho khâu sinh nội dung. Nói sai với ban giám đốc tệ hơn nói khó hiểu.

## Files

- `scripts/presentation/content/flows/p1.ts` … `p4.ts`, `admin.ts` — nội dung biên tập từng luồng
- `scripts/presentation/content/flow-copy-schema.ts` — kiểu dữ liệu, ép đủ 4 câu trả lời
- `scripts/presentation/check-copy.ts` — script kiểm: đếm từ + từ cấm + thiếu trường

## Steps

1. Định nghĩa schema nội dung, ép **bắt buộc** đủ 4 câu — thiếu là lỗi kiểu, không phải lỗi review
2. Viết `check-copy.ts`: đếm từ mỗi màn, quét từ cấm, báo luồng nào thiếu trường
3. Biên tập đợt 3a (P1), gán loại hình L1–L4 cho từng luồng
4. **Rà khuôn** sau 3a — sửa schema/khuôn nếu cần, rồi mới đi tiếp
5. Biên tập 3b → 3e
6. Chạy `check-copy.ts` sau mỗi đợt, không để dồn

## Quy tắc dịch ngôn ngữ

| Đừng viết | Hãy viết |
|---|---|
| `crm.opportunityAdvance` | "chuyển cơ hội sang bước tiếp theo" |
| `receiptApprove` | "Giám đốc Kinh doanh duyệt phiếu thu" |
| RLS / facility scope | "mỗi cơ sở chỉ thấy dữ liệu của cơ sở mình" |
| provisioning tự động | "hệ thống tự tạo tài khoản — không ai nhập tay" |
| append-only ledger | "sổ ghi không sửa được, mọi điều chỉnh đều để lại vết" |
| SoD | "người lập phiếu và người duyệt phải là hai người khác nhau" |
| outbox | "email cho phụ huynh có hàng đợi riêng, không mất khi lỗi mạng" |

**Danh sách từ cấm phải gồm cả jargon đến thẳng từ `displayName` của manifest** — danh sách chỉ có
từ backend sẽ bắt hụt: `geofence`, `OR gate`, `auto-score`, `branch-scope`, `HOTL`,
`idempotent`, `O1→O5`. Các tên luồng trong manifest **phải được đặt lại tên tiếng Việt cho khách**,
không dùng nguyên `displayName`.

**Cấm** dùng mã `P1-01` làm tiêu đề — để mã ở góc, làm mã tra cứu đối chiếu sổ nghiệm thu.

**Cấm** hứa 4 vai trò đang gác (`ke_toan`, `cskh`, `ctv_mkt`, `hr`). Chúng đang **0 quyền và bị khoá
bằng code**, không phải "sắp có". Nếu nhắc, phải ghi rõ ngoài phạm vi bản này.

## Validation

- [ ] `check-copy.ts` sạch: 0 màn mạch chính vượt 25 từ, 0 màn tra cứu vượt 60 từ, 0 vượt trần chữ-trong-sơ-đồ, 0 từ cấm, 0 luồng thiếu trường
- [ ] Phủ đúng số luồng manifest báo lúc build (đếm động, không so với số ghi trong tài liệu)
- [ ] Mỗi luồng nhảy tới được từ bản đồ nhà trong ≤ 2 thao tác
- [ ] Nhãn HAI TẦNG từng luồng khớp cả `verification.json` và `business-verification.json`; luồng tiền/lương còn ở mức `reachable-only` phải hiện rõ, không gộp vào "đã chạy được"
- [ ] Đối chiếu ngẫu nhiên 5 luồng với workflow spec gốc — không sai lệch nghiệp vụ
- [ ] Đối chiếu phần quyền với `docs/14` — không hứa quyền không có

## Risks / Rollback

- **Sai nghiệp vụ khi diễn giải lại** — nguy hiểm nhất về nội dung: nói sai với khách còn tệ hơn nói
  khó hiểu. Giảm thiểu: mỗi luồng phải trỏ về mục nguồn trong workflow spec để soát lại được.
- **Đuối giữa chừng** — gần 40 luồng là dài. Giảm thiểu: cắt 5 đợt, mỗi đợt dùng được ngay.
- **Trôi khuôn giữa các đợt** — giảm thiểu bằng schema ép kiểu + rà khuôn sau 3a.
- **Rollback:** từng đợt là file riêng, bỏ file là bỏ đợt đó, các đợt khác vẫn chạy.
