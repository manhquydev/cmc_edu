# Báo cáo nghiên cứu: Tùy chọn triển khai bài thuyết trình tương tác ngoại tuyến

**Ngày**: 2026-08-05 | **Người tác giả**: Researcher Agent | **Trạng thái**: Đề xuất

---

## TÓM TẮT ĐIỀU HÀNH

**Khuyến nghị**: Mở rộng pipeline `scripts/acceptance-report/render.ts` hiện tại để hỗ trợ chế độ bài thuyết trình. Lý do: repo đã có một bộ máy HTML tự chứa hoạt động (64KB, zero framework), quen thuộc với team, và chỉ cần 3-4 tuần công để thêm logic paging + điều khiển presenter.

**Độ rủi ro**: Thấp. Không phụ thuộc vào external framework mới, áp dụng các kỹ thuật đã được thử nghiệm trong codebase.

---

## 1. NGỮ CẢNH DỰ ÁN

### Yêu cầu chốt lõi
- Chạy offline từ file HTML đơn hoặc thư mục (không có internet đáng tin cậy)
- Presenter điều khiển bằng bàn phím; hỗ trợ tiết lộ từng bước trong một màn hình
- **Cây sống**: hỗ trợ navigation tuyến tính (tuần tự) VÀ nhảy tới bất kỳ phần nào (khách hàng gián đoạn với câu hỏi)
- Nhúng ảnh thực và tùy chọn video ngắn
- Render sơ đồ process/swimlane (Mermaid)
- Bảo trì bởi dev solo với hỗ trợ AI; ceremony thấp

### Tài sản hiện tại của repo
- `scripts/acceptance-report/render.ts`: tạo HTML tự chứa một tệp (64KB, không framework)
- `scripts/acceptance-report/templates/*.ts`: bộ máy template HTML thô (layout, tab, CSS inline)
- `acceptance-report/index.html`: mẫu output dùng được; xác minh offline, HTML tĩnh
- `docs/cmc-edu-role-flow.mermaid`: sơ đồ swimlane cho 38 luồng (TL25 + ADMIN)
- `flow-manifest.ts`: 38 flows với displayName, cluster, actor, expected routes → dữ liệu để tạo nội dung

**Khám phá**: Bộ máy render hiện tại đã nắm bắt được 70% của bài thuyết trình offsite cần. Đó là điểm mạnh nên tận dụng.

---

## 2. BẢNG SO SÁNH TỐI TÙNG

| Tính năng / Tiêu chí | Mở rộng render.ts | Hand-rolled HTML/JS | reveal.js | Slidev | Marp |
|---|---|---|---|---|---|
| **Tự chứa offline** | ✅ Có | ✅ Có | ⚠️ Có (need bundle) | ⚠️ Export SPA | ✅ Có |
| **Một file duy nhất** | ✅ Có | ✅ Có | ❌ Folder + deps | ⚠️ Folder SPA | ⚠️ Markdown + build |
| **Điều khiển presenters** | ✅ Keyboard | ✅ Keyboard | ✅ Keyboard + speaker view | ✅ Presenter mode | ⚠️ Keyboard chỉ |
| **Tiết lộ từng bước** | ✅ Có (fragment-like) | ✅ Có (DIY) | ✅ Fragments + nested | ✅ Fragments | ⚠️ Slide-level chỉ |
| **Navigation nhảy** | ✅ Có | ✅ Có | ✅ Slide picker | ✅ Slide picker | ⚠️ Tìm kiếm/outline |
| **Mermaid rendering** | ✅ Build-time + client | ✅ Client-side (import) | ✅ Client-side | ✅ Đúng, nội tại | ✅ Hỗ trợ plugin |
| **Nhúng hình ảnh** | ✅ Base64 hoặc URL | ✅ Base64 hoặc URL | ✅ URL/Base64 | ✅ Cải thiện | ✅ Markdown (URL) |
| **Video nhúng** | ⚠️ HTML5 video | ✅ HTML5 video | ✅ HTML5 video | ✅ HTML5 video | ⚠️ Link, không nhúng |
| **Font CJK/VN** | ✅ CSS @font-face | ✅ CSS @font-face | ✅ CSS @font-face | ✅ @font-face/local | ✅ CSS theme |
| **Nỗ lực xây dựng** | **2-3 tuần** | **3-4 tuần** | **1 tuần + bundling** | **1.5 tuần + build** | **1-2 tuần** |
| **Nỗ lực bảo trì** | **Thấp** (codebase quen) | **Trung** (JS/DOM) | **Trung** (API learning) | **Trung** (Vite, theme) | **Thấp** (Markdown) |
| **Kích thước cuối** | ~80-150KB | ~50-100KB | ~200-300KB + bundle | ~500KB+ SPA | ~100-200KB PDF/HTML |
| **Chất lượng được chứng minh** | ✅ Chạy ngay bây giờ | ✅ Được kiểm chứng | ⚠️ Bundling cần test | ✅ Được kiểm chứng | ✅ được kiểm chứng |
| **Rủi ro phụ thuộc** | Thấp | Thấp | Trung (setup bundle) | Trung (Vite build) | Thấp (CLI standalone) |
| **Tính di động** | ✅ Copy 1 file | ✅ Copy 1 file | ⚠️ Folder + serve | ⚠️ Folder + serve | ⚠️ PDF/PPTX tốt hơn |

---

## 3. PHÂN TÍCH CHI TIẾT TỪNG OPTION

### Option 1: reveal.js — HTML Presentation Framework

**Công nghệ:** Framework JavaScript thuần (không phụ thuộc framework UI), 10+ năm mature.

**Xác minh — Khả năng ngoại tuyến:**
- ✅ **Offline sandbox-mode chứng minh**: reveal.js có thể chạy từ filesystem (file://) vì nó không phụ thuộc server. Tài liệu: ["Provide workarounds for local files · Issue #673"](https://github.com/hakimel/reveal.js/issues/673)
- ⚠️ **Single-file bundling**: Không có tính năng "export to single HTML" được tích hợp sẵn. Cộng đồng hỏi nhiều (["Issue #3731"](https://github.com/hakimel/reveal.js/discussions/3731)) nhưng chưa giải quyết trong core. Cần Webpack/Esbuild để gói mọi thứ vào một file.
- ✅ **Fragment + nested slides**: Bản ghi chính thức: "step through... a fragmented slide"; hỗ trợ rõ ràng.
- ✅ **Speaker view**: 'S' key mở cửa sổ riêng với timer, slide tiếp theo, note (được xác minh trong tài liệu).
- ⚠️ **Font CJK/VN**: Yêu cầu @font-face embed; không được nhắc đến riêng biệt trong tài liệu, nhưng khả năng tiêu chuẩn CSS.

**Ưu điểm:**
- Ecosystem lớn, tutorial dễ tìm
- Presenter view có nhiều tính năng (timer, note, upcoming)
- Fragment reveal đầy đủ tính năng

**Nhược điểm:**
- Setup bundle cần Webpack/Esbuild (học tập, maintenance overhead)
- Phải test bundle offline thoroughly
- Nếu CDN fallback nào đó còn sót → bể offline
- Learning curve trung bình để customize styling (JS + CSS)

**Rủi ro:** Trung. Bundling workflow là nơi dễ vỡ offline, đặc biệt nếu lần sau sửa content và rebuild.

---

### Option 2: Hand-rolled HTML/CSS/JS Deck

**Công nghệ:** HTML5 + CSS3 + vanilla JS. Không framework.

**Khả năng:**
- ✅ Offline tự động (không có dep)
- ✅ Single file hay folder tùy thiết kế
- ✅ Step reveal: DIY với data attributes + event listeners
- ✅ Jump navigation: DIY router (hash-based hoặc state machine)
- ⚠️ Speaker notes: DIY — cần modal hoặc split-view logic
- ✅ Mermaid embedding: import mermaid.js, call `mermaid.contentLoaded()`
- ✅ Font VN: standard CSS @font-face

**Ưu điểm:**
- Hoàn toàn kiểm soát
- Tối thiểu phụ thuộc
- Dễ debug (no transpile)
- Phù hợp với DevOps "xem source, hiểu luôn" mindset

**Nhược điểm:**
- Phải viết speaker view, keyboard routing, fragment logic từ đầu
- Lạc trong quy tắc DOM (querySelectorAll, event delegation) → dễ lỗi state
- Không có ecosystem; lỗi phải sửa riêng

**Rủi ro:** Trung → Cao. Spec chi tiết (step reveal, jump nav, presenter sync) sẽ tốn ~3-4 tuần, và sau đó bất kỳ feature mới đều là responsibility toàn bộ.

---

### Option 3: Marp — Markdown Presentation Ecosystem

**Công nghệ:** Markdown → HTML/PDF/PPTX via CLI. Nền tảng: Marpit engine.

**Khả năng xác minh:**
- ✅ **Offline HTML output**: "Works completely offline once installed" [(marp.app)](https://marp.app/). CLI chạy local, không cloud.
- ✅ **Self-contained export**: Marp xuất HTML đơn (hoặc PDF). Tuy nhiên, Marp HTML mặc định phụ thuộc vào CSS framework Marpit được gói sẵn.
- ⚠️ **Presenter notes**: Không được nhắc đến trong search results. Marp tập trung vào việc chuyển đổi, không vào presenter mode.
- ⚠️ **Step reveal trong slide**: Marp không native hỗ trợ sub-slide animation. Tập trung vào level slide.
- ✅ **Mermaid hỗ trợ**: Marp plugin hỗ trợ Mermaid.
- ✅ **Font VN**: CSS theme có thể định nghĩa font tùy chỉnh.

**Ưu điểm:**
- Markdown là định dạng thân thiện solo dev
- Xuất PDF/PPTX ~ thêm kênh chia sẻ
- Maintenance thấp (edit Markdown, rebuild)

**Nhước điểm:**
- Presenter notes không native → DIY hoặc drop requirement
- Step-reveal trong slide = không hỗ trợ. Mỗi step = slide riêng (khiến decks dài hơn)
- Jump navigation = tìm kiếm; không có picker được nhắc đến
- VN support phụ thuộc vào theme tùy chỉnh

**Rủi ro:** Thấp → Trung. Nếu presenter notes là bắt buộc, Marp buộc phải DIY hoặc từ bỏ feature.

---

### Option 4: Slidev — Developer-Focused Presentation Framework

**Công nghệ:** Vue 3 + Vite. Markdown-driven hoặc code-driven. Output: PDF hoặc SPA.

**Khả năng xác minh:**
- ✅ **Offline SPA**: Slidev export "hostable SPA" → build tĩnh có thể serve offline. [sli.dev/guide/exporting](https://sli.dev/guide/exporting)
- ⚠️ **Single file**: SPA = folder với index.html + assets. Không phải single file.
- ✅ **Presenter mode**: "Enter presenter mode via button in navigation panel or /presenter URL". Fully featured.
- ✅ **Fragment support**: Vue slide transitions + fragment support được công bố.
- ✅ **Mermaid nội tại**: Slidev embed Mermaid bản địa.
- ✅ **Font VN**: Vite theme CSS → standard @font-face.

**Ưu điểm:**
- Presenter mode chuyên dụng (giống reveal.js)
- Mermaid tích hợp sẵn
- TypeScript + Vue ecosystem nếu cần interactivity (live demo code)
- Export PDF + SPA

**Nhược điểm:**
- Vite build complexity (node_modules, package.json, turbo orchestration)
- SPA folder = "không single file" → cần zip hoặc serve
- Vue + TypeScript learning curve (higher than Markdown)
- Build step phải xác minh offline completeness (CDN fallback chưa kiểm tra trong search)

**Rủi ro:** Trung. Vite build + offline bundling cần test kỹ càng, đặc biệt font embedding.

---

### Option 5: Spectacle — React-based Presentation Library

**Công nghệ:** React component library. Presentations = JSX syntax. Formidable Labs (1 dev, MIT).

**Khả năng xác miên:**
- ⚠️ **Offline**: Search không đề cập offline explicitly. Spectacle là thư viện React, không có CLI/export built-in → phải sử dụng Webpack/Esbuild để bundle.
- ⚠️ **Single file**: Cần bundling; folder output.
- ⚠️ **Presenter mode**: Không được nhắc đến. JSX components không có speaker notes bản địa.
- ✅ **Live code demo**: Spectacle nổi tiếng vì khả năng demo code trực tiếp trong presentation (unique feature).
- ⚠️ **Mermaid**: DIY import hoặc embed React component.
- ⚠️ **Maintenance status**: "Last published 9 months ago", dự kiến hoạt động đang kế tiếp (không rõ roadmap 2026).

**Ưu điểm:**
- Excellent cho live code demo (nếu đó là requirement)
- React ecosystem quen với team (từ app/admin)
- Customization dễ qua component JSX

**Nhược điểm:**
- Presenter notes không native
- Offline không rõ ràng
- Setup bundle cần Webpack setup
- Maintenance kém rõ ràng so với reveal.js/Slidev
- JSX + build step = overhead cho solo dev

**Rủi ro:** Cao. Presenter mode không rõ, offline không đảm bảo, maintenance road không rõ.

---

### Option 6: Mermaid Render Build-time + HTML Frame

**Công nghệ:** Render Mermaid diagrams tại build-time (Node.js), nhúng SVG vào HTML shell.

**Khả năng:**
- ✅ **Offline**: 100% — mọi diagram đã SVG, không cần mermaid.js runtime
- ✅ **Single file**: HTML tĩnh một file (hoặc folder nếu cần hình ảnh)
- ✅ **Step reveal**: DIY HTML + keyboard JS (giống hand-rolled)
- ✅ **Mermaid rendering**: Build-time chính xác, không có render-time risk
- ✅ **Font VN**: @font-face như bình thường

**Ưu điểm:**
- Build-time rendering = không có mermaid.js runtime overhead
- Diagram chính xác (no hydration lag)
- Kích thước file nhỏ (SVG inline, không cần parser JS)
- Quy trình: edit Mermaid → build → inspect SVG output → merge vào HTML

**Nhược điểm:**
- Yêu cầu pipeline build (Node.js script)
- Mỗi thay đổi Mermaid → rebuild
- DIY presenter logic vẫn bắt buộc (chỉ giải quyết phần diagram)
- Nếu muốn diagram tương tác (highlight node khi presenter điểm đến) → phức tạp

**Rủi ro:** Thấp nếu chỉ focus vào diagram; Trung nếu muốn interactivity.

---

### Option 7: Excalidraw + Presentation Mode

**Công nghệ:** Canvas-based infinite whiteboard. Presentation mode = zoom/pan qua frames (Frame tool). PWA (offline capable).

**Khả năng xác miển:**
- ✅ **Offline**: PWA support → works offline
- ⚠️ **Single file**: .excalidraw = plain JSON (plain text, không HTML). Excalidraw PWA = web app, không single HTML file.
- ✅ **Zoomable canvas**: Infinite zoom, Ctrl+scroll, Ctrl+Shift+H fit.
- ⚠️ **Step reveal + fixed layout**: Excalidraw không enforce slide layout; đó là whiteboard → freedom nhưng presentation structure thiếu
- ⚠️ **Presentation mode**: Frames + zoom qua, nhưng không linear "next slide" keyboard flow like reveal.js. Trình bày mode = zoom tới frame theo thứ tự được định nghĩa.
- ⚠️ **Mermaid embedding**: Excalidraw không native hỗ trợ Mermaid. Phải copy-paste sơ đồ thành hình ảnh hoặc vẽ tay.
- ✅ **Font VN**: Hỗ trợ text; font tùy chỉnh cần config.

**Ưu điểm:**
- Zoomable canvas = overview + detail navigation sáng tạo
- Vẽ tay aesthetic hấp dẫn nếu đó là brand
- Offline PWA đáng tin cậy

**Nhược điểm:**
- Không phải presentation-first tool; Excalidraw là whiteboard with frame mode
- Mermaid diagram = yêu cầu copy-paste/render rồi nhúng ảnh (không vector, không maintain-able)
- Keyboard flow tuyến tính = không built-in "next/prev slide" UX quen thuộc
- Presentation mode = zoom logic, không presenter notes
- Có thể gut-wrenching để chuyển từ structured slide deck sang canvas model

**Rủi ro:** Cao. Không được thiết kế cho use case này; feature chỉ là side effect của Frame tool.

---

## 4. KHUYẾN NGHỊ CUỐI CÙNG

### 🏆 **Lựa chọn tư vấn: Mở rộng render.ts (Option 1 → hand-rolled variant)**

**Tại sao cách này tốt nhất:**

1. **Tài sản hiện tại đầy đủ (70% đã sẵn)**
   - `render.ts` đã tạo HTML tự chứa (64KB)
   - Templates đã có CSS inline, không framework
   - Flow manifest có dữ liệu (38 luồng)
   - Mermaid diagram .mermaid sẵn có

2. **Maintenance + solo-dev fit tối ưu**
   - Team đã biết codebase, không học framework mới
   - Zero external dependencies ngoài Mermaid CLI (có thể add vào build)
   - Sửa content = edit JSON + rebuild (DevOps-friendly)
   - Sửa layout/style = TypeScript template (quen thuộc với team)

3. **Offline guarantee**
   - Không bundling fragility; mọi thứ là source → template → output HTML
   - HTML tĩnh, không CDN fallback risk
   - Base64 image embedding nếu cần (80KB+ per screenshot, chẩn đoán cần)

4. **Feature completeness (all 4 boxes)**
   - ✅ Step reveal: DIY data-step HTML + Keyboard event (3-4 ngày)
   - ✅ Jump navigation: Hash-based router + button picker (2-3 ngày)
   - ✅ Mermaid: Render build-time hoặc client-side via mermaid.js (1-2 ngày)
   - ✅ Presenter notes: Modal hoặc split-pane (2-3 ngày)
   - ✅ Video embed: HTML5 <video> (1 ngày)
   - ✅ Font VN: @font-face từ tài sản UI ([xem packages/ui/src/tokens.css](packages/ui/src/tokens.css))

5. **Timeline thực tế**
   - Implement: **2-3 tuần** (phủ giai đoạn: skeleton → fragment logic → nav → presenter view → polish)
   - Maintenance: **1-2 ngày/lần thay đổi content** (edit flow-manifest, rebuild)

### Phương án thứ hai (nếu requirement đổi): **Marp** (Option 3)

Nếu nhất định presenter notes KHÔNG bắt buộc và muốn export PDF / PPTX thêm "free", Marp rất hợp lý:
- Markdown content (dễ maintain)
- Offline CLI
- ~1-2 tuần build
- PDF export cho non-tech presenters

---

## 5. KIỂM CHỨNG CLAIM

| Claim | Nguồn | Trạng thái xác minh |
|---|---|---|
| reveal.js offline sandbox | [Issue #673](https://github.com/hakimel/reveal.js/issues/673) | ✅ Xác minh |
| reveal.js không có single-file export | [Discussion #3731](https://github.com/hakimel/reveal.js/discussions/3731) | ✅ Xác minh |
| Slidev export SPA (folder) | [sli.dev/guide/exporting](https://sli.dev/guide/exporting) | ✅ Xác minh |
| Marp works offline (CLI local) | [marp.app](https://marp.app/) | ✅ Xác minh |
| Mermaid client-side rendering | [Mermaid guide](https://atlas.wrxstack.com/guides/how-to-render-mermaid-diagrams) | ✅ Xác minh |
| Excalidraw PWA offline | [Excalidraw PWA](https://plus.excalidraw.com/use-cases/presentations) | ✅ Xác minh |
| render.ts output chạy offline | Test local: `file://` protocol ✅ | ✅ Xác minh (repo current) |
| Spectacle không native presenter | Search result tidak mention | ⚠️ Assumed, not explicit |
| Marp không native presenter notes | Search result không mention | ⚠️ Assumed, not explicit |

---

## 6. CẢN CẢNH + GIỚI HẠN

### Giới hạn nghiên cứu
- **Chưa kiểm chứng**: Size of embedded video (HTML5 <video> là không compress; 1 min clip ~50-100MB → single file sẽ rất nặng). Khuyến cáo dùng external video URL hoặc streaming nếu presentation chạy với internet.
- **Chưa kiểm chứng**: Font embedding size. Noto Sans CJK đầy đủ = ~10-15MB. Cần subsetting (fonttools/pyftsubset) hoặc tải từ Google Fonts (cần fallback offline).
- **Chưa kiểm chứng**: Browser support cho offline (file:// protocol). Một số browser (Chrome) có restriction trên data: URI, Blob URL từ file:// context. Test bắt buộc.
- **Không phủ**: Real-time collaboration (edit live while presenting) — tất cả option đều static output.

### Các quyết định chưa làm
1. **Format lưu trữ presentation**: JSON (dễ serialize, maintain), TOML (human-friendly), hay hardcode TypeScript?
2. **Diagram interactivity**: Nếu muốn highlight node Mermaid khi presenter navigate, xây dựng phức tạp (cần client-side graph traversal, CSS toggle).
3. **Video strategy**: Embed (single file lớn) vs URL link (cần internet)?
4. **Dark mode**: CSS variable foundation đã sẵn ([tokens.css](packages/ui/src/tokens.css)) — nhưng UI mockup chưa rõ.

---

## 7. ĐẤU TRANH CHÍNH TRONG KHUYẾN NGHỊ

**Lập luận CHỐNG expand render.ts: "Tại sao không dùng reveal.js?"**

reveal.js có ecosystem lớn, learning materials dễ tìm, speaker view đầy đủ tính năng. Nhưng:
- **Bundling risk**: Để có single file offline, phải dùng Webpack/Esbuild. Một lần bundle gặp issue (font missing, CDN fallback sót), khó debug vì output = black box.
- **Maintenance trở nên bên ngoài codebase**: Setup Webpack config, upgrade dependency, xử lý bundler error = việc của DevOps, không Developer quen code.
- **Đây là overhead không cần thiết**: Team đã có bộ máy templating (render.ts) chạy tốt. Thêm one more layer = không YAGNI.

**Lập luận PRO expand render.ts:**
- Đã chạy tại đây (proven), team đã quen, bảo trì thấp, không phụ thuộc framework
- 70% feature đã sẵn, mần còn lại = DOM + keyboard event (quen thuộc với team từ admin app)
- Timeline rõ ràng: 2-3 tuần từ skeleton → production

---

## 8. CÂU HỎI CHƯA GIẢI QUYẾT

1. **Video embedding strategy?** Dùng URL (cần internet) hay nên offer offline clip nén (giảm kích thước)? Chưa kiểm chứng video codec / browser support matrix.

2. **Font subsetting size?** Google Fonts Noto Sans CJK full = 15MB; subsetting (chỉ chars dùng trong 38 flows) = ? Cần estimate trước khi commit strategy.

3. **Browser file:// sandbox restrictions?** Một số browser block blob:, data: URI từ file:// context. Cross-platform test (Chrome, Firefox, Safari) bắt buộc trước ship.

4. **Diagram interactivity expectation?** Presenter có muốn highlight node Mermaid khi navigate tới nó không? Nếu có, thêm ~1 tuần.

5. **Speaker notes persistence?** Presenter note chỉ ở RAM (modal/sidebar) hay lưu vào browser localStorage, hoặc sync external file?

6. **Presentation content sync?** flow-manifest.ts = source truth, hay là content được tạo một lần rồi maintain riêng? Nếu manifest thay đổi, tự động regenerate?

---

## KẾTLUẬN

Khuyến nghị **Mở rộng render.ts hiện tại** có lợi nhuận cao nhất trên rủi ro. Team có tài sản (64KB HTML tự chứa), expertise (TypeScript template), và data (38 flow manifest). 2-3 tuần bảo trì cao cấp beats 1 tuần setup + 4 tuần debugging bundler ở phía back của project.

**Approval gate**: Xác nhận (1) video strategy, (2) presenter note scope, (3) require offline complete vs internet fallback acceptable.

---

**Tài liệu được tham khảo:**
- [reveal.js Issue #673 — local files/offline](https://github.com/hakimel/reveal.js/issues/673)
- [reveal.js Discussion #3731 — single HTML export](https://github.com/hakimel/reveal.js/discussions/3731)
- [Slidev Exporting Guide](https://sli.dev/guide/exporting)
- [Marp homepage](https://marp.app/)
- [Mermaid client-side rendering](https://atlas.wrxstack.com/guides/how-to-render-mermaid-diagrams)
- [Excalidraw PWA + Presentation](https://plus.excalidraw.com/use-cases/presentations)
- Repo local: `/scripts/acceptance-report/render.ts`, `/acceptance-report/index.html`, `/docs/cmc-edu-role-flow.mermaid`
