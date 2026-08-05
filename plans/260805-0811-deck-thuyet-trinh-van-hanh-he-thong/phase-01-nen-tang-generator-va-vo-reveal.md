---
phase: 1
title: "Nền tảng: generator + vỏ reveal + đường dữ liệu"
status: completed
dependencies: []
---

# Phase 1 — Nền tảng

Dựng bộ xương chạy được đầu-cuối với **một luồng mẫu**, xác minh sớm mọi rủi ro kỹ thuật trước khi
đổ công sức nội dung vào toàn bộ luồng.

## Context

Ba nguồn dữ liệu, **không phải hai**:

| Nguồn | Cho |
|---|---|
| `scripts/acceptance-report/flow-manifest.ts` | Danh sách luồng (đếm động), tên, cụm, vai trò, đường màn hình |
| `acceptance-report/verification.json` | Tầng "chạy thông" (31 proven / 7 not-yet) |
| `acceptance-report/business-verification.json` | Tầng "đúng nghiệp vụ" (16 verified-correct · 15 reachable-only · 7 not-proven) |

Hai file JSON nằm dưới `/acceptance-report/` — **đã bị gitignore** (`.gitignore:173`). Bản clone mới
không có chúng. Đây là lý do build **không được** hard-fail khi thiếu.

Tham khảo cách dựng HTML tự chứa và font stack hệ thống: `scripts/acceptance-report/templates/layout.ts`.

## Requirements

1. `pnpm deck:build` sinh bộ trình bày hoàn chỉnh
2. Chạy **offline tuyệt đối** — không request ra ngoài
3. Tiếng Việt đúng dấu trên máy **không cài font riêng**
4. Số luồng lấy **động** từ manifest
5. Nhãn **hai tầng**, xử lý stale theo D9
6. Bốn loại hình vẽ dựng thành component tái dùng

## D9 — Xử lý dữ liệu thiếu và stale (KHÔNG hard-fail)

Bản kế hoạch đầu định throw khi manifest lệch verification. Sai, vì hai lý do đã xác minh:

- `verification.json` bị gitignore ⇒ clone mới không có ⇒ build chết ngay từ commit đầu
- `flow-evidence.ts:61-67` hạ **mọi** luồng về fallback + badge `stale` khi `sha !== headSha` ⇒
  **mỗi commit nội dung** ở Phase 3 làm hỏng toàn bộ nhãn

Cách xử lý đúng:

| Tình huống | Hành vi |
|---|---|
| Thiếu file JSON | Không fail. Nhãn = "chưa đo" + banner cảnh báo trên deck |
| Lệch tập luồng (manifest vs verification) | Không fail. Luồng thừa = "chưa đo", banner nêu tên luồng lệch |
| `sha !== headSha` | Banner "số liệu chạy ở commit khác", hiện cả hai SHA. **Không** âm thầm chiếu số cũ |
| `deck:build --release` | **Bắt buộc** đủ cả hai file, SHA khớp HEAD. Thiếu → fail |

Nguyên tắc: bản làm việc luôn build được; bản đưa ra trước khách thì không được phép mập mờ.

**Hai cạm bẫy của `--release`, phải xử ngay khi dựng:**

1. **Đừng đòi "cây git sạch".** `plans/**` là file chưa track; chỉ cần ghi một biên bản diễn thử là
   cây bẩn và `--release` fail vô cớ. Chỉ kiểm **những đường dẫn ảnh hưởng tới số liệu**
   (`scripts/`, `apps/`, `packages/`), không kiểm cả cây.
2. **Đảo mặc định để quên cờ không im lặng.** Bản không có `--release` phải **luôn** hiện dải
   "BẢN NHÁP — số liệu chưa xác nhận" trên mọi màn có nhãn. `--release` là thứ **gỡ** dải đó đi.
   Nếu làm ngược, quên cờ nghĩa là mang bản nháp ra trình bày mà không ai biết.

## Files

**Tạo mới** — `scripts/presentation/`:
- `build.ts` — điểm vào, cờ `--release`
- `load-flow-data.ts` — đọc 3 nguồn, gộp nhãn hai tầng, sinh banner cảnh báo
- `diagram/swimlane.ts` · `journey.ts` · `control-gate.ts` · `before-after.ts` — L1–L4
- `diagram/screen-sketch.ts` — **phác hoạ bố cục màn hình bằng SVG** (khung, cột, nút, bảng, nhãn
  tiếng Việt). Đây là chỗ thay thế cho ảnh chụp đã bỏ: cho thấy hình hài giao diện, **không** chứa
  dữ liệu thật. Dùng kèm L1–L4, không phải loại thứ năm đứng riêng
- `templates/deck-shell.ts` — khung HTML + init reveal
- `content/` — Phase 2–3 đổ vào

**Sửa:** `package.json` (script `deck:build`) · `.gitignore` (thư mục output của deck — sản phẩm sinh
ra, không commit). Kiểm bằng `git check-ignore -v` trên **đường dẫn thật**, không suy đoán từ mẫu:
mẫu có dấu `/` ở giữa bị neo vào gốc repo và sẽ không phủ thư mục lồng.

**Không đụng:** `scripts/acceptance-report/*` — mắt xích đo nghiệm thu, chỉ **đọc**.

## Steps

1. Thêm reveal.js, **ghim version cụ thể**. Vendor **chọn lọc** vào output: chỉ `dist/reveal.js`
   (bản UMD), CSS theme cần dùng, và plugin notes. Không copy cả gói (~5MB) — mục tiêu < 400KB
2. **Dùng bản UMD, không dùng bản ES module** — đây là cách né chuyện module bị chặn trên `file://`.
   Mở thử bằng `file://` và ghi lại kết quả thật, không suy đoán
3. **Font: dùng font stack hệ thống**, không nhúng file font. `@font-face` từ `file://` bị chặn ở
   một số trình duyệt. `templates/layout.ts` trong repo đã giải bài này — dùng lại cách đó
4. `load-flow-data.ts`: đọc 3 nguồn, gộp theo `id`, áp D9. Không throw ở chế độ thường
5. Dựng 4 component hình vẽ, mỗi cái nhận dữ liệu có kiểu, trả SVG/HTML tĩnh
6. Render **một luồng mẫu** — đề xuất `P1-03 Duyệt phiếu kích hoạt học viên`: nhiều vai trò, có cổng
   duyệt, có phần hệ thống tự làm ⇒ chạm được cả 4 loại hình
7. Bật notes + chế độ tổng quan; kiểm phím mũi tên và link tới slide theo id

## Validation

- [ ] `pnpm deck:build` chạy sạch trên cây **không có** hai file JSON → ra deck với nhãn "chưa đo"
- [ ] `deck:build --release` trên cây thiếu dữ liệu → **fail** với thông báo rõ
- [ ] Mở output trên máy **đã tắt mạng** → hiển thị đủ, console không lỗi tài nguyên ngoài
- [ ] Grep `http://` / `https://` trong output → không còn tham chiếu ngoài
- [ ] Tiếng Việt đúng dấu trên máy sạch font
- [ ] Đổi `sha` trong `verification.json` → deck hiện banner stale, không chiếu số cũ lặng lẽ
- [ ] Kích thước vendor < 400KB
- [ ] Phím mũi tên đi được; tổng quan mở lưới; link theo id nhảy đúng
- [ ] Luồng mẫu render đủ 4 loại hình

## Risks / Rollback

- **`file://` chặn tài nguyên** — bản UMD hạ rủi ro này xuống thấp, nhưng vẫn phải mở thử thật ở
  bước 2 trước khi làm tiếp. Fallback: kèm lệnh serve tĩnh.
- **Vendor phình to** — kiểm kích thước ngay ở bước 1.
- **Rollback:** toàn bộ nằm trong `scripts/presentation/` + 2 dòng config. Xoá thư mục là sạch.
