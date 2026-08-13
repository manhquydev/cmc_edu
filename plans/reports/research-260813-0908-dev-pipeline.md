# Pipeline giao hàng thật — CMC EDU v2 (2026-08-13)

Nguồn: `.github/workflows/{ci,ui-e2e,dependabot-auto-merge}.yml`, `AGENTS.md`,
`docs/WORKFLOW.md`, `docs/system-architecture.md`, `package.json`,
`scripts/{ui-ratchet,check-ui-frames,check-doc-authority}.mjs`, `git log`.

## A. Sơ đồ pipeline thật (bước, thứ tự, blocking/non-blocking)

Trigger: `push` (mọi branch) + `pull_request` → `main`. 3 workflow file, không phải 1.

**`ci.yml` job `typecheck-and-test`** (BLOCKING, required check) — thứ tự thật trong file:
1. checkout, pnpm 10.24, node 22 (`ci.yml:48-57`)
2. `pnpm install --frozen-lockfile`
3. `prisma migrate deploy` (superuser role tạo `cmc_app` role) + set password CI-only (`ci.yml:68-74`)
4. ghi `packages/db/prisma/.env` (Prisma 6 cần dotenv fallback cho engine subprocess, `ci.yml:76-81`)
5. `pnpm typecheck` (turbo, side-effect build `@cmc/auth/dist`)
6. **screen-role-matrix drift** — `continue-on-error: true` (`ci.yml:100-105`), tức NON-BLOCKING dù có script fail thật
7. `pnpm lint`
8. `check:ui-frames` + `test:ui-frames` — BLOCKING (Soft Ops bulk gate)
9. `check:ui-ratchet` + `test:ui-ratchet` — BLOCKING (ratchet, xem mục B)
10. `check:ui-a11y-roles` + `test:ui-a11y-roles` — BLOCKING
11. `check:doc-authority` + `test:doc-authority` — BLOCKING
12. `pnpm test` (vitest toàn domain, `--filter=!@cmc/e2e`)
13. **`acceptance:report`** — `continue-on-error: true` (`ci.yml:140-142`) → **NON-BLOCKING**
14. coverage threshold `@cmc/domain-payroll` ≥90% lines+functions — BLOCKING

**`ci.yml` job `e2e`** — toàn job `continue-on-error: true` (`ci.yml:152`), API-only Playwright (không set `PLAYWRIGHT_UI`, không cài browser) → NON-BLOCKING.

**`ui-e2e.yml`** (workflow riêng, **push-only**, không chạy trên `pull_request` trực tiếp — lý do kỹ thuật ghi ở `ui-e2e.yml:1-11` và `ci.yml:202-209`: tránh 1 head SHA có 2 check run cùng tên, 1 cái `skipped` có thể ghi đè cái đỏ thật). Job `ui-e2e` — BLOCKING kể từ 2026-08-02 (trước đó `continue-on-error`, promote sau khi đạt tiêu chí đã định trước — xem mục B):
1. build workspace (`pnpm build`, cần `@cmc/db/dist`)
2. cài Playwright Chromium + OS deps
3. chạy full `ui-chromium` project (không chạy 1 spec lẻ — ledger từ chối kết luận nếu chạy thiếu, `ui-e2e.yml:170-174`)
4. **Business-correctness gate**: `pnpm acceptance:report` (regenerate ledger, fail nếu có tRPC orphan chưa được claim — "orphan ratchet") rồi `pnpm business:verify --strict` (fail nếu bất kỳ luồng money/state nào chỉ ở mức `reachable-only`, chưa `verified-correct`) — cả hai BLOCKING trong `ui-e2e.yml`, khác hẳn `acceptance:report` non-blocking trong `ci.yml` (hai lần chạy, hai mức nghiêm ngặt khác nhau)
5. upload `journeys.json` làm artifact — nguồn DUY NHẤT được ledger nghiệm thu chấp nhận (`if: always()`, kể cả khi đỏ)

**`security-scan`** (Trivy config/misconfig, `ci.yml:219-243`) — report-only, `continue-on-error: true`, KHÔNG trong branch protection.

**`dependabot-auto-merge.yml`**: patch/minor auto-merge qua `gh pr merge --auto --squash`, nhưng chỉ *request* auto-merge — merge thật vẫn chờ `typecheck-and-test` + `ui-e2e` xanh (`dependabot-auto-merge.yml:26-38`). Major bump → thủ công.

**Biểu hiện "một người + AI, CI = đội review" trong config, cụ thể:**
- Comment tại `ui-e2e.yml:92-104` viết thẳng: "this repo is operated by a solo maintainer whose code is mostly AI-generated — there is no human-QA fallback standing behind a merge, so the only gate that proves user-reachable behaviour must be non-bypassable" — đây là lý do promote `ui-e2e` thành blocking, ghi đè tiêu chí thận trọng ban đầu (20 runs / 14 ngày) sớm hơn vì rủi ro solo cao hơn team.
- Comment `ui-e2e.yml:196` lặp lại rationale y hệt cho business-correctness gate.
- `AGENTS.md` "Operating model": "Các gate tự động (CI) chính là đội review đó — coi chúng là non-bypassable, không phải gợi ý"; yêu cầu cả `typecheck-and-test` VÀ `ui-e2e` xanh trước khi báo "done".

## B. Cơ chế ratchet chống-drift

**Định nghĩa chung** (rõ nhất ở `scripts/ui-ratchet.mjs:9-10`): so số hiện tại với baseline committed; **chỉ fail khi số MỚI TĂNG** so với baseline — nợ cũ được "ông nội hoá" (grandfathered), drift mới bị chặn ngay. Không đòi dọn sạch nợ cũ trong 1 lần (không khả thi với solo+AI), nhưng khoá không cho nợ phình thêm.

Danh sách cổng dùng pattern ratchet:
1. **`ui-ratchet.mjs`** — đếm literal spacing/fontSize/radius/color trong `style={{}}` mỗi file admin+lms, so `scripts/ratchet-baseline.json`; admin đã về 0 (literal mới fail ngay), LMS còn baseline nợ. Có `ratchet-exemptions.json` cho case đã justify từng cái (file, property, value).
2. **`check-doc-authority.mjs`** — không hẳn ratchet số, mà ratchet "không tái xuất hiện": allowlist file cố định (`docs/README.md`, `docs/12-...`, `design-system/.../MASTER.md`...) bị cấm chứa token chrome đã retire (`AppFrame`, `.premium-`, `--sh-`, `premium.css`...). Một khi 1 file được dọn sạch, không được phép nhiễm lại.
3. **`check-ui-frames.mjs --strict`** — Soft Ops "bulk gate": ngưỡng cohesion (bulk-enabled lists ≥5), grandfathers phần cũ, strict fail khi hụt ngưỡng.
4. **Orphan ratchet trong `acceptance:report`** — tRPC procedure mới phải được claim vào 1 flow hoặc liệt vào `DOCUMENTED_GAPS`, không được để "mồ côi" không ai biết (xác nhận qua commit `53fa7d0 chore(acceptance): classify tRPC orphans + enable orphan ratchet`).
5. **`business:verify --strict`** — tương tự: flow money/state không được lùi từ `verified-correct` về `reachable-only` (comment `ui-e2e.yml:188-196`).

**Vì sao phù hợp solo+AI:** không có người review đọc từng PR để bắt "code này thụt lùi so với hôm qua" — ratchet biến việc đó thành máy đo tự động, so-sánh-với-baseline thay vì so-sánh-với-chuẩn-tuyệt-đối (chuẩn tuyệt đối cho 1 file cũ đôi khi bất khả thi ngay). Baseline là file JSON committed → chính nó cũng là bằng chứng git-diff-được, không phải con số ai đó nhớ.

## C. Điểm mạnh thật

- **2 lớp blocking bổ sung nhau, không trùng lặp**: `typecheck-and-test` (tĩnh: type/lint/unit/domain-coverage/ratchet) + `ui-e2e` (động: browser thật, cookie session thật qua production build — comment `ui-e2e.yml:38-42` nói rõ dev-build tRPC client gửi dev-header khác hẳn signed cookie prod, nên phải build prod mới test đúng đường auth thật).
- **Ledger-of-record chỉ chấp nhận artifact CI**, không chấp nhận file local ai đó tự sửa (`ui-e2e.yml:202-206`) — chặn việc tự khai man "đã chạy 40/40" bằng cách sửa tay JSON.
- **Orphan + business ratchet** là cặp cổng hiếm gặp: không chỉ "code chạy được" (reachable) mà còn ép khai báo rõ đã verify đúng số nghiệp vụ (`verified-correct`) cho luồng tiền/trạng thái — đúng chỗ rủi ro cao nhất khi AI sinh code (business logic sai nhưng test hời hợt vẫn xanh).
- **`ui-e2e` tách workflow riêng vì lý do kỹ thuật cụ thể** (double check-run cùng SHA có thể để lộ 1 slot skipped ghi đè slot đỏ) — chi tiết nhỏ nhưng cho thấy pipeline được thiết kế có chủ đích chống lách gate, không phải copy-paste hời hợt.
- **Promotion có tiêu chí bằng số, ghi log quyết định** (20 runs/14 ngày, sau đó override có lý do — `ui-e2e.yml:55-104`) — mọi thay đổi mức nghiêm ngặt của gate đều có dấu vết audit trong chính file YAML, không phải quyết định miệng.
- **Dependabot auto-merge vẫn phải qua CI required checks** — không phải auto-merge mù.

## D. Điểm yếu / rủi ro thật

- **`acceptance:report` trong `ci.yml` là non-blocking** (`continue-on-error: true`, `ci.yml:140-142`) — nghĩa là trên MỌI push/PR thường, tRPC orphan mới có thể lọt qua không ai biết cho tới khi `ui-e2e` chạy (push-only, không chạy trực tiếp trên PR event). Một PR có thể merge (`typecheck-and-test` xanh) trước khi orphan bị bắt, nếu timing của `ui-e2e` check-run không kịp gắn vào PR head SHA đúng lúc review.
- **Screen-role-matrix drift cũng non-blocking** (`ci.yml:86-105`) — chính comment thừa nhận nó "đã drift 1 lần không bị phát hiện" (nav entry bị xoá ở `24ef2e3` nhưng JSON committed vẫn còn 1 ngày) — nghĩa là gate được thêm SAU khi sự cố xảy ra, và ngay cả gate mới cũng chưa đủ tin cậy để blocking.
- **`e2e` job (API-only) trong `ci.yml` toàn job continue-on-error** — không có tầng nào giữa unit-test và full-browser-e2e chặn cứng trên mọi PR; PR merge chỉ cần `typecheck-and-test` xanh, `ui-e2e` (real gate) chạy SAU trên push, có độ trễ.
- **`ui-e2e` push-only, không trigger trực tiếp trên `pull_request`** — dựa vào cơ chế "check run gắn theo SHA" để hiện trên PR; nếu dev tạo PR từ 1 SHA chưa từng push riêng (vd rebase, hoặc PR mở từ branch có sẵn trước khi push mới), có thể có khoảng trống thời gian PR "trông sẵn sàng merge" mà chưa có `ui-e2e` check gắn vào — rủi ro timing, không phải lỗi logic.
- **Journey = smoke, không phải đúng số học nghiệp vụ** (theo AGENTS.md) — dù `business:verify --strict` gate money/state flow, phạm vi flow được coi "verified-correct" phụ thuộc vào ai gắn nhãn đó lúc viết journey; nếu journey tự nó sai giả định (vd assert sai công thức), gate vẫn xanh. Ratchet/ledger chỉ bắt "lùi trạng thái", không bắt "trạng thái sai ngay từ đầu".
- **UAT người thật chưa chạy** (AGENTS.md, `docs/system-architecture.md:28` nhắc runbook `docs/runbook-uat-golive.md`) — toàn bộ pipeline ở trên là bằng chứng "code chạy đúng theo giả định của agent", không phải "người dùng thật xác nhận đúng nghiệp vụ".
- **Không có visual regression test** — ratchet UI (`ui-ratchet.mjs`, `check-ui-frames.mjs`) chỉ đọc source (đếm literal, đếm frame component), không chụp/so ảnh render thật; 1 thay đổi CSS phá layout nhưng không đổi literal có thể lọt hoàn toàn.
- **Dependabot auto-merge patch/minor**: rủi ro thật là *silent* nếu CI có lỗ (vd acceptance:report non-blocking) — 1 bump breaking business logic nhẹ (không type-break) có thể auto-merge nếu không chạm test hiện có. Comment tự thừa nhận "Axios incident 2026-03" là bài học nền, nhưng đó là baseline cho major-bump policy, không phải bằng chứng patch/minor luôn an toàn.
- **`security-scan` (Trivy) report-only, không phải required check** — misconfig nghiêm trọng trong Dockerfile/nginx không chặn merge, chỉ tạo artifact; phụ thuộc thao tác thủ công "liếc Security tab hàng tuần" (AGENTS.md) — dễ bị bỏ quên khi bận.
- **SSO/RLS known bug đã biết trước, chưa fix** (`system-architecture.md:102,540`, `sso-routes.ts:220`) — không phải lỗ CI, nhưng là ví dụ nợ kỹ thuật được tài liệu hoá rõ ràng thay vì fix ngay, đúng tinh thần "ghi nhận rồi defer" của dự án này.

## E. Bài học hành động được (agent + phát triển tiếp)

1. **Không bao giờ báo "done" chỉ dựa vào `typecheck-and-test` xanh** — phải đợi `ui-e2e` (workflow riêng, push-only) thật sự chạy xong trên đúng SHA của PR trước khi coi acceptance ledger là đáng tin; kiểm `gitSha` trong artifact khớp HEAD.
2. **Khi thêm 1 field/gate mới, học theo pattern ratchet**: đặt `continue-on-error: true` trước, ghi rõ tiêu chí định lượng để promote sau (số run, số ngày, tỷ lệ false-positive) — đừng blocking ngay khi mới viết, nhưng cũng đừng để non-blocking vô thời hạn không ai theo dõi lại (screen-role-matrix đang ở trạng thái này, nên nhắc lại định kỳ).
3. **Baseline JSON (ratchet) là hợp đồng, không phải noise** — khi sửa file có literal cũ, KHÔNG tự ý `--write-baseline` để né gate; chỉ hạ baseline khi thực sự dọn nợ, agent phải giải thích được vì sao baseline thay đổi trong PR.
4. **Business logic mới chạm money/state flow → phải tự hỏi "flow này đã trong ledger `verified-correct` chưa"**, không chỉ "test có pass không" — pass ≠ đúng số học nếu flow chưa từng bị assert đúng công thức nghiệp vụ trong journey.
5. **Trước khi tự động merge / claim xong việc dựa trên Dependabot hoặc bất kỳ auto-merge nào**, nhớ patch/minor tự merge không có ai đọc — nếu thay đổi 1 dependency có khả năng ảnh hưởng business logic tinh vi (không phải chỉ type), cân nhắc tạm tắt auto-merge cho riêng gói đó thay vì tin CI hiện có sẽ bắt được.
6. **Đừng lẫn "số ĐO" và "số CHÉP"**: mọi con số nghiệm thu trích dẫn trong report/plan phải kèm ngày + nguồn (`pnpm acceptance:report` output hoặc CI artifact `acceptance-journeys-<sha>`), không copy số cũ từ doc khác mà không re-verify.
7. **Visual/UI regression là lỗ thật chưa vá** — nếu sắp làm việc lớn về design system/CSS, đừng dựa vào ratchet hiện có để tự tin "không phá layout"; cần review bằng mắt hoặc đề xuất thêm screenshot-diff riêng.
8. **Security tab không tự chặn gì** — Trivy/CodeQL/Dependabot security signal đều report-only hoặc ngoài luồng merge; nếu agent phát hiện 1 finding nghiêm trọng, phải escalate rõ ràng cho user thay vì giả định pipeline sẽ tự chặn.

## Câu hỏi mở

- `ui-e2e` push-only có thực sự luôn gắn đúng check-run vào PR head SHA trong mọi trường hợp (rebase, force-push, PR mở sau khi branch đã có sẵn)? Comment nói "verify on the first PR after promotion" (`ui-e2e.yml:88-90`) nhưng không thấy bằng chứng post-hoc xác nhận đã verify liên tục — nên hỏi hoặc kiểm tra thêm nếu nghi ngờ 1 PR merge mà thiếu `ui-e2e` check thật.
- Screen-role-matrix drift và `acceptance:report` (bản trong `ci.yml`) còn ở trạng thái non-blocking bao lâu nữa / có tiêu chí promote bằng số như `ui-e2e` từng có không? Không thấy ghi trong `ci.yml` (khác với `ui-e2e.yml` có hẳn "PROMOTION CRITERIA" block).

Status: DONE
Summary: Đọc xong 3 workflow CI + AGENTS.md + docs kiến trúc + 5 script ratchet + git log; report tại đường dẫn trên nêu rõ pipeline thật, cơ chế ratchet, mạnh/yếu có file:line, và 8 bài học hành động được.
