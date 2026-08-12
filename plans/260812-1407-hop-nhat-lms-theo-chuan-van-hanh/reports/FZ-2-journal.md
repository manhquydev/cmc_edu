# FZ-2 — Nhật ký phiên 2026-08-12

**Chế độ:** chỉ tạo journal · không sửa file khác · không commit  
**Skill:** `/ak:journal` (nội dung + nghi thức honesty; persist local theo quy ước repo)  
**AgentWiki publish skipped** — skill hoãn bước này; file local là nguồn sự thật.

## File journal đã tạo

`docs/journals/260812-lms-thuc-trang-ba-loi-dong-bang-cmc-lms.md`

Đường dẫn tuyệt đối:

`/home/manhquy/Downloads/cmc_edu/docs/journals/260812-lms-thuc-trang-ba-loi-dong-bang-cmc-lms.md`

## Quy ước tên

Bám các journal gần đây (`260808-…`, `260805-…`, `260802-…`, `260726-…`): `YYMMDD-slug.md`.  
Không dùng `YYYY-MM-DD-` (họ cũ hơn, ít dùng gần đây).  
Không gọi `ak journal create` — lệnh đó ghi `plans/journals/`, ngoài ownership `docs/journals/**`.

## Văn phong đối chiếu

Đọc trước: `260808-deps-ts6-prisma7-driver-adapter-migration.md`, `260802-solo-vibe-operating-model-and-review-wave.md`, `260726-journey-ceiling-31-38-ci-restored-three-product-findings.md`, `260722-260723-three-flows-broken-16-days-measurement-lied-four-ways.md`, `260805-deck-thuyet-trinh-van-hanh-cook.md`.

Journal mới theo họ tiếng Việt gần đây: tiêu đề ngày + luận điểm, header phạm vi/PR/status, viết **vì sao**, bài học kể cả chỗ tự sai, việc còn treo không tô hồng.

## Nội dung đã ghi

1. **Bối cảnh** — hợp nhất LMS `cmc-lms` → `cmc_edu`; phiên đo bằng code, không tin status tài liệu, rồi mới thi công.
2. **Ba mảng** — #117 / #118 / #119; trọng tâm ba lỗ nghiệp vụ (thu tiền không cấp quyền; unit 4 buổi thành 5; học lại không nộp lại được) chứ không liệt kê thay đổi.
3. **Đóng băng** — `cmc-lms` neo `031d193`, chốt 12/08; sửa sự cố vẫn làm, tính năng mới ngừng; không tắt hệ cũ.
4. **Cách làm** — Herdr đa agent, red-team + validate trước thi công, review độc lập trước merge.
5. **Bài học** — typecheck lẻ bỏ sót `@cmc/scripts`; gỡ procedure quên `flow-manifest` hạ nghiệm thu im lặng; Bright I.G chỉ lộ trên dữ liệu thật.
6. **Còn treo** — hệ cũ còn sống; seed 96 unit không theo migrate; TRUNCATE Submission; lỗ số khung còn trong nguồn; chưa có CI khóa manifest; UAT người thật chưa chạy.

## Không đụng

- Không sửa journal cũ, docs khác, code, plan.
- Không commit, không push.
- Không tạo file thứ hai dưới `docs/journals/`.

## Chỗ đã sửa

| File | Việc |
|------|------|
| `docs/journals/260812-lms-thuc-trang-ba-loi-dong-bang-cmc-lms.md` | Tạo mới (toàn bộ) |

Status: DONE
