# Biên bản diễn thử & kiểm thử phòng họp — deck vận hành CMC EDU

**Ngày build:** 2026-08-05  
**Commit build:** `83b59b0`  
**Lệnh:** `pnpm deck:build` → `presentation-deck/index.html`  
**Trạng thái số liệu:** **stale** — verification/business JSON ở `d359249` ≠ HEAD `83b59b0`. Banner stale hiện trên deck. Bản `--release` **từ chối build** (đúng D9).

---

## Kiểm tự động (đã chạy)

| Hạng mục | Kết quả |
|---|---|
| `pnpm test:deck` | **28/28 pass** (unit + integration) |
| `pnpm deck:build` (draft) | OK · 38 luồng · vendor 261KB |
| `pnpm deck:build -- --release` khi stale | Fail rõ ràng (commit lệch) |
| Mở `file://` bằng Chrome headless | Reveal ready · 64 slide |
| Phím mũi tên | Đi slide |
| Phím **H** | Về `#home-map` |
| Bấm khối bản đồ | Nhảy `#/role-sale` |
| Lỗi console/page | 0 sau khi sửa init UMD + H-key |
| Ảnh chụp hệ thống thật | 0 |
| Banner BẢN NHÁP | Có (draft) |
| Ghi chú `aside.notes` | Có trong HTML; `showNotes: false` — không hiện màn khách |
| PDF config | `pdfSeparateFragments: false`, `showNotes: false` |

---

## Diễn thử có bấm giờ (người thuyết minh)

| | |
|---|---|
| **Người diễn** | Chủ dự án (chưa chạy trọn trong phiên agent) |
| **Thời lượng thực tế** | _cần điền sau lần diễn thật_ |
| **Khung mục tiêu** | 60–90 phút (mạch chính ~40 + H&Đ) |
| **Máy trình chiếu** | _máy cá nhân / máy phòng — câu hỏi còn treo trên plan_ |

**Checklist lúc diễn (đánh tay):**

- [ ] Đọc to mạch chính 8 chặng — trôi, không đọc chữ slide
- [ ] Hỏi đáp giả lập: nhảy cổng tiền → H về nhà → cụm P3
- [ ] Màn phụ (S): ghi chú chỉ trên màn thuyết minh
- [ ] Ngắt mạng hoàn toàn trong lúc trình
- [ ] Đứng cuối phòng — cỡ chữ đọc được
- [ ] In PDF dự phòng sẵn trên máy (không kèm notes)

---

## Rủi ro còn mở trước buổi chính thức

1. **Chạy lại** `pnpm acceptance:report` + `pnpm business:verify` trên HEAD sạch số liệu, rồi `pnpm deck:build -- --release`.
2. Diễn thử bấm giờ một lượt đầy đủ (agent không thay được).
3. Chốt máy trình chiếu (plan Q1).

---

## Cách mở

```bash
pnpm deck:build
# mở presentation-deck/index.html (double-click hoặc trình duyệt)
# Phím: ←/→ · H nhà · S ghi chú · O tổng quan
# PDF: In → Lưu PDF
```
