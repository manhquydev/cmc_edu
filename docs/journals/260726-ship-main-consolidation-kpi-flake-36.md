# 2026-07-26 chiều — Đưa main qua gate CI đỏ, phát hiện bug sản phẩm ẩn trong flake, và quyết định merge-commit bảo toàn SHA

**Phạm vi:** PR #35 (acceptance-journey-38-lms → main), PR #37 (feat/staff-password-auth → main).
**Kết quả cuối:** main ✓, 2 nhánh closed, origin sạch, sổ/docs sync 31/38@0b933bf.

## Sự kiện

**08:00** Chuẩn bị merge 2 PR vào main. PR #35: 56 commit, journey 31/38. PR #37: 2 commit auth.

**09:15** CI đỏ trên commit fix `aafdecb` (run 30197331312, test fail: `kpi lifecycle > kpi.refresh > double-fire concurrent refresh does not 500 and both resolve to the same draft row`). Giây phút hoảng loạn: có phải mình vừa break test không?

**09:45** **Phát hiện rẻ nhất:** commit docs-only `6ff525f` (trước fix) cùng test fail, commit feature lớn `b36e7c1` pass ⇒ **flaky, không regression của auth.**

**10:30** Đào sâu code `apps/api/src/kpi/auto-score.ts:370` — nghi bug **sản phẩm thật**: nhánh recovery P2002 (unique-violation) chạy `findFirstOrThrow` **TRONG transaction Postgres lỗi** → Postgres abort toàn bộ (state 25P02) → recovery branch có thể chết đúng lúc được kích hoạt. Synth DB (16 core, query nhanh) không lộ; CI runner (chậm) mới vào race này.

**11:00** Ghi issue GitHub #36 + bảng bằng chứng 5 run + 3 giải pháp ứng viên (upsert / ON CONFLICT / advisory lock). `gh run rerun --failed` 2 run → xanh.

**11:30** Merge theo tứ tự có chủ đích:
- PR #35 → main trước (56 commit, sổ 31/38, 8760010)
- PR #37 → main sau (chỉ còn diff 2 commit, 0b933bf)

**Quyết định merge:** **merge-commit, không squash**. Lý do: sổ nghiệm thu tham chiếu SHA bằng chứng (`eeba671`, `d1f9918`, ...). Squash = xóa SHA khỏi lịch sử main → phá chuỗi chứng cứ machine-certified.

**12:00** Hai bot review (cubic, CodeRabbit) pending. CodeRabbit rate-limited tối nay. **Gate thật = CI xanh trên đúng SHA** → merge không chờ advisory.

**12:15** CI hậu merge: xanh 3/3 job (run 30198153757).

**12:30** Dọn nhánh: origin chỉ còn main (acceptance + feat `--delete-branch`). Local: `git branch -d uat-prep-nav-and-boot-checks` pass (đã merged). `git branch --no-merged main` = rỗng.

**13:00** Docs sync: AGENTS.md snapshot 27/38→31/38, codebase-summary.md banner mới, changelog [2026-07-26] entry thứ hai.

## Bài học đáng ghi

**CI đỏ ≠ code mình sai**: docs-only fail = bằng chứng rẻ nhất để tách flake khỏi regression. Một commit, ba kết quả khác nhau trên cùng test là tín hiệu rõ ràng: hãy đào sâu, đừng rerun rồi quên.

**Flaky = canary cho bug sản phẩm**: issue #36 tồn tại vì race condition thật trong Postgres error recovery. Test lộ ra nó **vì chậm**, không phải test sai. Phân biệt: lỗi test vs lỗi sản phẩm lộ qua test.

**Merge method là bảo toàn chứng cứ, không thẩm mỹ**: sổ máy-chứng ghi SHA → main không thể rebase-squash → phải merge-commit.

## Còn treo

- Issue #36: chọn fix ứng viên, test locally, PR sửa trước merge `main` → khác branches tiếp.
- Phase 8: P4-01 nửa HS, journey xuyên app thứ 3.

Status: DONE
Summary: Merge 2 PR vào main (journey 31/38 + staff auth), phát hiện KPI flake là bug sản phẩm qua issue #36, quyết định merge-commit bảo toàn SHA chứng cứ.
Concerns/Blockers: Không. (AgentWiki skip — local ghi.)
