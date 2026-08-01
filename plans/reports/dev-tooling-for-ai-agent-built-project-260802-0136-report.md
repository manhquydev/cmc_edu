# Research Report: Công cụ hỗ trợ phát triển cho dự án lớn code bởi AI agent

> Thời điểm nghiên cứu: 2026-08-02 01:36 (Asia/Saigon) · 4 web searches · Bối cảnh: CMC EDU v2 (TS monorepo, pnpm, Playwright e2e, GitHub Actions CI, GitNexus)

## Executive Summary

Câu hỏi thật của bạn không phải "có tool nào không" mà là: **code toàn do AI agent viết thì lấy gì đảm bảo chất lượng?** Đây là câu hỏi đúng, và câu trả lời thẳng: **AI agent (Claude Code, Codex CLI...) chỉ là tầng "viết code". Đảm bảo chất lượng nằm ở một tầng khác — tầng verify — và tầng đó bạn phải chủ động dựng, agent không tự cho.**

Bộ công cụ dev "ngày xưa" (Postman, DBeaver, linter, debugger) **không hề biến mất** — nó vẫn cần, chỉ là giờ agent gọi được nó qua CLI/MCP. Cái *mới* năm 2026 là hai tầng: (1) **AI code-review guardrails** (Codacy, CodeRabbit, CodeQL) chặn code AI ở cửa PR, và (2) **spec-driven development** (GitHub Spec-Kit) — biến spec thành nguồn sự thật để agent không "trôi" (drift). Với dự án của bạn, điểm yếu đã biết là *"CI xanh nhưng prod hỏng vì e2e bỏ qua UI"* — nên đầu tư đúng chỗ là **tầng verify**, không phải thêm agent.

---

## 1. Bản đồ: toolkit "ngày xưa" → thời AI agent

Không có gì bị thay thế. Mọi thứ chỉ được **agent gọi qua CLI hoặc MCP**. Đây là bảng ánh xạ:

| Nhu cầu | Công cụ truyền thống | Tương đương thời AI agent (2026) |
|---|---|---|
| Test API thủ công | **Postman** | **Bruno / Hoppscotch / Thunder Client** (git-native, lưu JSON cạnh code) — agent tự chạy `curl`/Playwright APIRequest |
| Test API tự động (regression) | Postman collection runner | **Playwright APIRequest**, Vitest, k6 (agent viết + chạy trong CI) |
| Xem/sửa DB | DBeaver, pgAdmin | `psql` CLI, **Supabase MCP** — agent query trực tiếp |
| Debug | Chrome DevTools, debugger | **Playwright MCP / Chrome DevTools MCP** — agent tự mở browser, đọc console |
| Đọc/hiểu codebase | Đọc tay, grep, IDE "go to def" | **GitNexus / GitLab Knowledge Graph** — impact analysis, call graph (bạn đã có GitNexus) |
| Review code | Reviewer con người | **CodeRabbit / Codacy / CodeQL** trên PR (xem mục 3) |
| Docs/API contract | Swagger UI | OpenAPI + MCP docs server (context7) |

**Điểm mấu chốt:** agent CLI mạnh vì nó *điều phối* những tool này thay bạn. Nhưng nó chỉ gọi được tool nào bạn đã cấu hình (MCP server, script, CLI trong PATH). Repo của bạn đã có sẵn: Playwright MCP, GitHub MCP, Supabase MCP, GitNexus, filesystem MCP — đó chính là "Postman + DBeaver + reviewer" phiên bản agent.

---

## 2. AI Agent CLI landscape 2026 (cái bạn đang dùng)

Thị trường CLI agent đã ổn định quanh vài tên. Tất cả đều: đọc cả repo, sửa file, chạy lệnh, làm task nhiều bước tự động.

| Agent | Mạnh nhất khi | Ghi chú |
|---|---|---|
| **Claude Code** (bạn đang dùng) | Workflow Claude-native, subagent, skills | Đứng #1 bản refresh cuối 07/2026 nhờ Opus 5 + điều khiển model per-subagent |
| **Codex CLI** | Hệ sinh thái OpenAI | Giữ kỷ lục Terminal-Bench |
| **Gemini CLI** | Debug lặp nhanh, repo local | Nhẹ UI, nhanh |
| **Aider / OpenCode / Kilo CLI** | Open-source, đa IDE/cloud/Slack | Kilo cấu hình được, nối GitHub/Slack |

**Kết luận thực tế:** bạn không thiếu agent. Việc thêm agent thứ 2 không giải quyết nỗi lo chất lượng — nó chỉ đẻ code nhanh hơn. Giá trị nằm ở mục 3 và 4.

---

## 3. Tầng thật sự trả lời nỗi lo của bạn: Verify guardrails

Đây là thứ "ngày xưa không có mà giờ có" và là **khoản đầu tư đúng** cho dự án code-by-AI:

- **CodeRabbit** — review AI ngay trên PR, tích hợp >40 linter + security scanner, tóm tắt diff, fix 1-click. Đọc mọi PR trước khi merge.
- **Codacy Guardrails** — DevSecOps hợp nhất: quét chất lượng + bảo mật + guardrail riêng cho code do máy sinh; enforce policy tập trung, chặn ở PR và ngay trong IDE/agent.
- **CodeQL + Dependabot** (GitHub native, free cho repo) — bắt lỗ hổng bảo mật + lỗi dependency. Bật ngay, gần như không tốn công.
- **Agent Verifier** — skill cắm thẳng vào Claude Code/Cursor, kiểm mọi dòng code AI theo chuẩn tổ chức; tự nhận diện framework agent (LangGraph, CrewAI...).

Nguyên tắc bất biến: **con người + tool tự động** — không tool nào thay được review người ở các quyết định nghiệp vụ (đúng với dự án ERP/LMS có số học nghiệp vụ).

---

## 4. Spec-Driven Development — chống "AI trôi" trên dự án lớn

Vấn đề gốc của code-by-agent: **agent "mù ngữ cảnh"**, dễ trôi khỏi ý định ban đầu qua nhiều phiên. Giải pháp 2026 là biến **spec thành artifact nguồn, code là output biên dịch ra**.

- **GitHub Spec-Kit** (open-source, model-agnostic) — quy trình có cấu trúc cho agent (Copilot, Claude Code, Gemini CLI). Spec là trung tâm, agent code theo ràng buộc.
- Lựa chọn khác: AWS Kiro, Cursor Plan Mode, OpenSpec, BMAD-METHOD, Claude Code skills.
- **Với bạn:** đây gần đúng thứ repo đã làm — `docs/` frozen + `plans/` + skill intake. Bạn đã đi đúng hướng spec-driven; Spec-Kit chỉ là bản đóng gói chuẩn hoá hơn nếu muốn tham khảo.

---

## 5. Khuyến nghị cụ thể cho CMC EDU v2

Xếp theo ưu tiên (ROI cao → thấp), bám đúng điểm đau đã biết của repo:

1. **Vá lỗ hổng "CI xanh, prod hỏng"** — đây là rủi ro #1, không phải thiếu tool. E2e hiện bypass UI ⇒ "31/38 proven" đo backend chứ không đo cái user chạm được. Cần e2e **đi qua UI thật** (Playwright click luồng người dùng) + **UAT người thật**. Không tool review nào cứu được nếu test đo sai chỗ.
2. **Bật CodeQL + Dependabot** (free, GitHub native) — nhưng lưu ý CI GitHub Actions của bạn *đang chết vì hết quota billing từ 2026-07-17*, không phải lỗi code. Phải khôi phục billing trước, nếu không mọi guardrail chạy trên CI đều vô nghĩa.
3. **Thêm CodeRabbit hoặc Codacy** vào cổng PR — chốt chặn tự động cho mọi code AI trước merge.
4. **API testing: chọn Bruno** (không phải Postman) — git-native, collection lưu JSON cạnh code, version cùng repo, MIT free. Hợp monorepo hơn Postman (Postman từ 01/03/2026 free chỉ 1 user).
5. **Tiếp tục dùng GitNexus** cho impact analysis trước khi agent sửa symbol — bạn đã có, đây đúng là "an toàn khi để AI sửa code lớn".

**Đừng làm:** thêm agent CLI thứ hai để "cho chắc". Nó tăng tốc độ đẻ code, không tăng độ tin cậy.

---

## Resources & References

**AI Agent CLI:**
- [Best AI Coding Agents 2026 — Faros](https://www.faros.ai/blog/best-ai-coding-agents-2026)
- [2026 Guide to Coding CLI Tools: 15 Agents — Tembo](https://www.tembo.io/blog/coding-cli-tools-comparison)
- [Best CLI AI Tools 2026 — Kilo](https://kilo.ai/articles/best-cli-coding-agents)

**Verify / Guardrails:**
- [Review AI-generated code — GitHub Docs](https://docs.github.com/en/copilot/tutorials/review-ai-generated-code)
- [AI Code Review Tools 2026 — Mend](https://www.mend.io/blog/ai-code-review-tools-key-benefits-and-tools/)
- [AI Guardrails for Code Quality — Codacy](https://www.codacy.com/guardrails)
- [Agent Verifier — Advisorpedia](https://www.advisorpedia.com/ai/meet-agent-verifier-guardrails-for-ai-generated-code-at-scale/)

**API testing:**
- [Postman Alternatives 2026: Bruno, Insomnia, Hoppscotch](https://jonathansblog.co.uk/best-postman-alternatives-2026)
- [Postman vs Bruno vs Insomnia 2026 — Crosscheck](https://crosscheck.cloud/blogs/postman-vs-bruno-vs-insomnia-2026/)

**Spec-Driven Development:**
- [Spec-driven development with AI — GitHub Blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [GitHub Spec-Kit — MarkTechPost](https://www.marktechpost.com/2026/05/08/meet-github-spec-kit-an-open-source-toolkit-for-spec-driven-development-with-ai-coding-agents/)
- [SDD Definitive 2026 Guide — BCMS](https://www.thebcms.com/blog/spec-driven-development/)

---

## Unresolved Questions

1. GitHub Actions billing đã khôi phục chưa? Mọi guardrail chạy trên CI phụ thuộc câu này.
2. Bạn muốn *chốt chặn tự động* (CodeRabbit/Codacy, tốn phí/user) hay tự dựng gate bằng tool free (CodeQL + review agent nội bộ)?
3. Ưu tiên vá e2e-qua-UI trước, hay dựng guardrail PR trước? (Khuyến nghị: e2e trước — vì đó là rủi ro đo-sai-chỗ, guardrail không cứu được.)
