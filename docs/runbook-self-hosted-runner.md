# Runbook — chuyển CI sang self-hosted runner + đóng repo về private

**Quyết định:** 2026-07-26. **Trạng thái:** chờ thực hiện (cần thao tác trên máy + GitHub UI của chủ repo).

## Vì sao

Repo được chuyển **public** ngày 2026-07-26 để lấy Actions miễn phí sau khi CI chết 9 ngày vì hết
Actions minutes. Đó là giải pháp tạm, đánh đổi bằng việc phơi toàn bộ mã nghiệp vụ.

Đo từ chính lịch sử CI: **142 run trong 11 ngày, cao điểm 49 run/ngày**. Mỗi run nay tốn **~12 phút tính
phí** (`ui-e2e` 6.1′ + `typecheck-and-test` 3.8′ + `e2e` 2.0′ — job song song vẫn tính riêng).

```
49 run/ngày × 12 phút ≈ 590 phút/ngày
Hạn mức private miễn phí = 2.000 phút/tháng
⇒ cạn sau ~3,4 ngày làm việc cao điểm
```

⇒ Chỉ chuyển private là **CI sẽ chết lại**. Self-hosted runner xoá hẳn bài toán hạn mức thay vì trả tiền
để né nó. Máy hiện tại: 16 core / 39GB RAM / Docker 29.6.2 / user trong group `docker` — dư sức, và đã
chạy đúng bộ này 34/34 xanh trong ~6 phút.

## ⚠️ Bất biến an toàn — đọc trước khi làm

> **Self-hosted runner CHỈ được chạy khi repo đã private.**
> Trên repo public, bất kỳ ai mở PR từ fork đều khiến **mã lạ thực thi trên máy bạn**. Vì vậy thứ tự dưới
> đây **đóng private TRƯỚC, dựng runner SAU** — không được đảo.

Tại thời điểm quyết định: **0 fork, 0 star, 0 watcher**; traffic chỉ là máy chủ repo. Đóng sớm thì coi
như chưa mất gì.

## Thứ tự thực hiện

### Bước 1 — Đóng repo về private (làm ngay, ưu tiên cao nhất)

GitHub UI: `Settings` → `General` → cuối trang `Danger Zone` → **Change repository visibility** → Private.

Sau bước này CI sẽ **tạm ngưng** cho tới hết Bước 3 (hạn mức tháng 7 đã cạn). Chấp nhận được: sổ nghiệm
thu đã chốt tại commit `63f8c3d` và không phụ thuộc CI để đọc lại.

### Bước 2 — Dựng self-hosted runner

GitHub UI: `Settings` → `Actions` → `Runners` → **New self-hosted runner** → Linux x64. GitHub sẽ hiện
sẵn token; chạy đúng các lệnh nó đưa, đại ý:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v<VERSION>/actions-runner-linux-x64-<VERSION>.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/manhquydev/cmc_edu --token <TOKEN_TU_GITHUB_UI>
```

Khi `config.sh` hỏi **labels**, thêm nhãn `cmc-local` (ngoài nhãn mặc định `self-hosted`, `Linux`, `X64`).

Cài chạy nền như service để không phải mở terminal:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status     # kỳ vọng: active (running)
```

> `svc.sh` cần sudo có mật khẩu — bình thường, nhập tay một lần. Nếu không muốn chạy service, dùng
> `./run.sh` ở một terminal riêng (runner chỉ sống khi terminal còn mở).

### Bước 3 — Chuyển workflow sang self-hosted

Sửa `.github/workflows/ci.yml`, **cả 3 job** (`typecheck-and-test`, `e2e`, `ui-e2e`):

```yaml
-    runs-on: ubuntu-latest
+    runs-on: [self-hosted, linux, X64, cmc-local]
```

**Bắt buộc đổi cổng postgres — nếu không, cả 3 job hỏng ngay.** Trên GitHub-hosted, service container
map `5432:5432` vào một máy ảo trống. Trên máy này **cổng 5432 đã bị `cmcv2-prod-postgres-1` chiếm** (stack
mô phỏng production dùng cho UAT G1 — **không được tắt nó**). Service container sẽ không bind được.

Sửa **cả 3 job**: đổi mapping và trỏ URL sang cổng mới (`55435` đã kiểm là trống):

```yaml
     services:
       postgres:
         ports:
-          - 5432:5432
+          - 55435:5432
     env:
-      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/cmc_ci?schema=public
-      APP_DATABASE_URL: postgresql://cmc_app:cmc_app_ci_password@localhost:5432/cmc_ci?schema=public
+      DATABASE_URL: postgresql://postgres:postgres@localhost:55435/cmc_ci?schema=public
+      APP_DATABASE_URL: postgresql://cmc_app:cmc_app_ci_password@localhost:55435/cmc_ci?schema=public
```

Và bước đặt mật khẩu `cmc_app` (có ở cả 3 job) phải thêm `-p`:

```yaml
-          PGPASSWORD=postgres psql -h localhost -U postgres -d cmc_ci \
+          PGPASSWORD=postgres psql -h localhost -p 55435 -U postgres -d cmc_ci \
```

> Cổng đang dùng trên máy (đo 2026-07-26): `5432` cmcv2-prod · `5433` cmc-e2e-pg (đã dừng) · `55432`
> cmc-synth-pg (DB dev) · `55433` dd-postgres · `55434` sentinel-rag-db. Nếu đổi `55435` thì phải đổi
> đồng bộ cả 3 chỗ trên.

**Và bắt buộc bỏ `--with-deps`** ở job `ui-e2e`:

```yaml
-        run: pnpm --filter @cmc/e2e exec playwright install --with-deps chromium
+        run: pnpm --filter @cmc/e2e exec playwright install chromium
```

> Lý do: `--with-deps` gọi `sudo apt-get`, mà máy này **không có sudo passwordless** ⇒ bước sẽ treo/hỏng.
> Bỏ đi là an toàn vì OS deps đã có sẵn (`~/.cache/ms-playwright/chromium-1228`) và bộ e2e đã chạy xanh
> 34/34 trên chính máy này.

### Bước 4 — Xác minh

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run on the self-hosted runner"
git push
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

Kỳ vọng: cả 3 job xanh. Kiểm **mức step** cho `ui-e2e` (job có `continue-on-error: true` nên badge job
không đủ tin):

```bash
gh run view <RUN_ID> --json jobs \
  --jq '.jobs[]|select(.name=="ui-e2e")|.steps[]|select(.name|startswith("Run UI e2e"))|.conclusion'
```

Rồi tái sinh sổ nghiệm thu từ artifact của run đó (quy trình chuẩn trong
`plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/`): tải artifact, chép đè
`apps/e2e/acceptance-results/journeys.json`, chạy `pnpm acceptance:report`, xác nhận `gitDirty:false` và
`gitSha` khớp HEAD.

## Điểm cần biết khi vận hành

- **Xung đột cổng là lỗi số một cần nghi.** Máy này chạy nhiều postgres cùng lúc (prod-sim, dev, và các
  stack khác). Sau khi đổi sang `55435` theo Bước 3, nếu job vẫn hỏng ở bước migrate thì kiểm ngay
  `ss -lnt | grep 55435` xem có ai chiếm mất không.
- **DB dev `cmc-synth-pg` hiện đã dừng** (`Exited (0)`, đo 2026-07-26). CI không cần nó (job tự dựng
  service container riêng), nhưng muốn chạy lại bộ e2e **cục bộ** thì phải bật lại:
  `docker start cmc-synth-pg`.
- **CI chỉ chạy khi máy bật.** Đây là đánh đổi cố hữu của self-hosted: push lúc máy tắt thì job nằm chờ
  trong hàng đợi cho tới khi runner online trở lại.
- **Không gian đĩa.** Mỗi run build lại admin/lms; còn 41GB nên thoải mái, nhưng nên dọn định kỳ
  `~/actions-runner/_work` nếu chạy dày.
- **Đồng hồ ổn định của `ui-e2e` phải chạy lại từ đầu.** Tiêu chí nâng job này thành gate chặn merge
  (ghi trong `.github/workflows/ci.yml`) yêu cầu môi trường runner không đổi trong cửa sổ đánh giá — đổi
  sang self-hosted là đổi môi trường, nên mốc đếm reset về ngày hoàn tất Bước 4.

## Rollback

Nếu runner gây rắc rối, quay lại GitHub-hosted bằng cách đảo `runs-on` về `ubuntu-latest` và khôi phục
`--with-deps`. Lưu ý repo lúc đó đã private ⇒ lại bị hạn mức 2.000 phút/tháng, tức chỉ là giải pháp tạm
cho tới khi runner hoạt động lại.

Gỡ runner: `cd ~/actions-runner && sudo ./svc.sh stop && sudo ./svc.sh uninstall && ./config.sh remove --token <TOKEN>`.
