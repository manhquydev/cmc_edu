# Phương pháp Trình bày Hệ Thống ERP/LMS phức tạp cho Khách Hàng Không Kỹ Thuật - Báo Cáo Nghiên Cứu

**Ngày:** 2026-08-05  
**Phạm vi:** Evidence-based visual presentation patterns cho narrated live demos  
**Áp dụng cho:** 7 roles (sale, teacher, business director, training director, IT, parent, student) + 4 business clusters + 38 business flows

---

## Tóm Tắt Điểm Chính

Trình bày hệ thống phức tạp cho khách hàng không kỹ thuật thành công khi:
- **Người nói là kênh thông tin chính** - hình ảnh hỗ trợ, không lặp lại từng từ
- **Sử dụng lặp lại vocabulary nhỏ** (4-6 loại diagram) - tránh mỏi nhận thức từ phải học style mới
- **Chia nhỏ thành segments** - mỗi flow độc lập, có thể skip/quay lại trong Q&A
- **Pre-record fallback sẵn sàng** - live demo là tương tác, nhưng failure mode được xử lý

---

## 1. Nền Tảng Cognitive Science cho Narrated Presentation

### 1.1 Multimedia Learning Principles (Mayer)

**Nguồn:** Richard Mayer's 12 Principles of Multimedia Learning, được công bố lần đầu từ cognitive psychology research của Yale University và Rutgers. Mayer là tác giả cuốn "Multimedia Learning" (Cambridge University Press, 2009).

**Các nguyên tắc liên quan nhất cho live narrated presentation:**

| Nguyên Tắc | Định Nghĩa | Áp Dụng vào Đây |
|-----------|-----------|-----------------|
| **Redundancy Principle** | Đối tượng học tốt hơn từ hình ảnh + narration **mà không** on-screen text lặp lại từng từ. Text trùng lặp với tiếng nói khiến nhận thức bị "traffic jam". | **Slide không được ghi đầy đủ lời thoại của presenter.** Chỉ có labels, keywords, hoặc số liệu. Presenter nói phần còn lại. |
| **Signaling Principle** | Emphasize key information bằng arrows, boxes, hoặc highlighting để dẫn hướng chú ý khán giả. | Khi presenter nói về bước quan trọng trong flow, visual highlight bước đó. Không dùng arrows hay colors cho mọi element. |
| **Segmenting Principle** | Người học hiệu quả hơn khi nội dung phức tạp được chia thành segments riêng mà learner có thể control pace. | Mỗi business flow được trình bày độc lập. Presenter có thể tạm dừng, quay lại, hoặc bỏ qua flow mà không phá hỏng logic tổng thể. |
| **Pre-training Principle** | Khi học viên biết danh tính/role của mỗi actor trước, họ hiểu flow tốt hơn (không phải học role lẫn flow đồng thời). | Trước khi trình bày flows: **1) Giới thiệu 7 roles một cách dễ nhớ (ví dụ: hình ảnh avatar, màu sắc đặc biệt).** Sau đó trình bày flows. |
| **Coherence Principle** | Loại bỏ details không liên quan (decorative graphics, background music lạ, tangential examples). Nó gây ra cognitive load, không giúp. | Diagram phải đơn giản. Không có "nice-to-have" decorative elements. Mỗi shape, color, arrow phải có lý do. |

**Chứng cứ mạnh:**
- [Mayer's Principles of Multimedia Learning - Educational Technology](https://educationaltechnology.net/mayers-principles-of-multimedia-learning/)
- [PDF: Principles for reducing extraneous processing in multimedia learning](https://www.researchgate.net/publication/262915119_Principles_for_reducing_extraneous_processing_in_multimedia_learning_Coherence_signaling_redundancy_spatial_contiguity_and_temporal_contiguity_principles)

**Áp dụng vào CMC EDU:**  
Presenter không nên dùng slide chứa full script. Thay vào đó, mỗi slide hiển thị diagram + 2-3 keywords chính. Presenter nói chi tiết từ speaker notes.

---

## 2. Visual Grammar cho Business Process (Non-Technical Audience)

### 2.1 Swimlane Diagram
**Dùng cho:** Quy trình có **nhiều roles/departments tham gia theo trình tự** (sale order → approval → fulfillment).  
**Ưu điểm:**
- Rõ ràng: ai chịu trách nhiệm từng bước
- Dễ nhận diện flow giữa departments
- Quen thuộc với business users (không phải "technical" diagram)

**Nhược điểm:**
- Khó vẽ nếu flow rất phức tạp (>15 bước trên nhiều lanes)
- Đọc ngang (horizontal) → khó hiển thị trên slide nếu chiều rộng lớn

**Quy tắc vẽ cho non-technical:**
- Max 6-8 swimlanes (tương ứng 6-8 roles). Trên 8 → chia thành 2 diagram hoặc dùng "overview + detail" pattern
- Mỗi lane = 1 role rõ ràng (label rõ)
- Boxes trong lane = tasks; Diamonds = decisions (yes/no)
- Arrows = flow direction
- **Không dùng BPMN/UML symbols phức tạp** - chỉ shapes đơn giản (rectangle, diamond, arrow)

**Ví dụ CMC EDU:** "Sales Order" flow - Sales (nhập PO) → Finance (approve → fund check) → Warehouse (pick & pack) → Logistics (ship). 4 lanes, ~12 bước.

**Nguồn:**
- [Swimlane Diagram: Designing Better Business Processes - Venngage](https://venngage.com/blog/swimlane-diagram/)
- [What is a Swimlane Diagram - Lucidchart](https://www.lucidchart.com/pages/tutorial/swimlane-diagram)

---

### 2.2 Customer/Employee Journey Map
**Dùng cho:** Hiểu trải nghiệm của **một actor duy nhất qua toàn bộ process** (teacher's journey: login → create course → assign tasks → grade).  
**Ưu điểm:**
- Kể được story: "Sáng hôm nay, một giáo viên..."
- Non-technical users dễ relate vì nó là "day in life"
- Hiển thị touchpoints + emotions/pain points

**Nhược điểm:**
- Chỉ hiển thị 1 actor → không thấy cross-department interactions
- Không thể trình bày tất cả 7 roles cùng lúc

**Cấu trúc:**
- **Phases:** Mỗi phase là một giai đoạn (login, course creation, grading, etc.)
- **Actions:** Từng step người làm
- **Touchpoints:** Nơi they interact với system
- **Emotions/Pain points:** Biểu tượng/comment về cảm giác (satisfied, confused, frustrated)

**Ví dụ CMC EDU:** "Teacher's First Week" journey - login → explore dashboard → create first course → add students → setup grading → submit grades.

**Nguồn:**
- [How to create customer journey maps - Zendesk](https://www.zendesk.com/blog/customer-journey-map/)
- [Journey Mapping 101 - Nielsen Norman Group](https://www.nngroup.com/articles/journey-mapping-101/)

---

### 2.3 Service Blueprint
**Dùng cho:** Kết hợp **customer journey + back-end processes** - giải thích "hệ thống làm gì phía sau" khi customer không thấy.  
**Ưu điểm:**
- Cho thấy cả "visible" (customer thấy) và "invisible" (system thực thi)
- Giúp customer hiểu: "Tại sao có độ trễ? → Hệ thống check inventory phía sau"
- Legitimizes complexity: "Có vẻ đơn giản nhưng phía sau hệ thống làm rất nhiều việc"

**Nhược điểm:**
- Phức tạp hơn journey map đơn giản
- Cần 2-3 layers (customer actions, visible system actions, back-end processes) → dễ gây cognitive overload

**Cấu trúc:**
```
Customer Journey:          [Step 1] → [Step 2] → [Step 3]
                              ↓         ↓         ↓
Visible System Actions:    [UI] → [confirmation] → [report]
                              ↓         ↓         ↓
Back-end Processes:   [validate] → [compute] → [log event]
```

**Ví dụ CMC EDU:** "Student Check-In" → Customer sees "QR scan" → Behind the scenes: GPS validation, geofence check, database update, notification sent to manager.

**Nguồn:**
- [What is a Service Blueprint - Lucid](https://lucid.co/blog/what-is-a-service-blueprint)
- [Service Blueprints: Definition - NN/G](https://www.nngroup.com/articles/service-blueprints-definition/)
- [Service Blueprint vs Journey Map](https://miro.com/customer-journey-map/service-blueprint-vs-journey-map/)

---

### 2.4 Control Gate / Approval Workflow Diagram
**Dùng cho:** Processes với **explicit gates, conditions, approvals** (multi-level approval, compliance checks).  
**Ưu điểm:**
- Rõ ràng: Decision points ở đâu, ai decide, kết quả?
- Hiển thị retry loops, rejection paths
- Tốt cho audit/compliance narratives

**Nhược điểm:**
- Nếu quá nhiều gates → diagram chùng lủng (messy)
- Khó nhúng narrative vào

**Quy tắc vẽ:**
- Rectangles = tasks/actions
- Diamonds = decision gates (yes/no branches)
- Circles = start/end
- Parallelograms = input/output (email, form)
- Colors: Approve = green, Reject/retry = orange/red

**Ví dụ CMC EDU:** "Expense Approval" → Employee submits → Finance reviews (< 10M auto-approve, > 10M → Director) → If approved, system processes payment → Notification sent. If rejected, return to employee.

**Nguồn:**
- [Approval Workflow Flowchart - ChatDiagram](https://www.chatdiagram.com/examples/flowchart/approval-workflow)
- [Control-flow diagram - Wikipedia](https://en.wikipedia.org/wiki/Control-flow_diagram)

---

### 2.5 "Day in the Life" Walkthrough (Narrative + Storyboard)
**Dùng cho:** **Holistic understanding** - "Nhìn toàn bộ workflow của một user qua một ngày làm việc."  
**Ưu điểm:**
- Storytelling: dễ remember, dễ relate
- Thấy được interactions giữa multiple systems/roles
- Non-technical users tưởng tượng được realistic scenario

**Nhược điểm:**
- Không detail technical steps
- Khó show rare edge cases (exception flows)

**Cấu trúc:**
- **Time-based layout:** 8am → 9am → 10am → etc.
- **Screenshot + narration:** Mỗi timeframe có 1 screenshot + presenter nói "lúc này sales person..."
- **Annotations:** Labels, arrows từng bước
- **Emotion/outcome:** Cuối mỗi phase → "Sales person có đủ info để close deal" ✓

**Ví dụ CMC EDU:** "A Teacher's Day"
- 7:45am: Arrives, logs in → checks new assignments
- 8:15am: Enters classroom → takes attendance via app → sees geolocation verify
- 9:00am: Uploads grades → system auto-normalizes scores
- 3pm: Reviews parent inquiry → responds via messaging
- 4:30pm: Exports report → downloads to device

**Nguồn:**
- [Top 10 Day in the Life PowerPoint Templates - Slideteam](https://www.slideteam.net/blog/top-10-day-in-the-life-ppt-templates-and-samples)
- [Mastering workflows: Real-life Workflow Examples - Process.st](https://www.process.st/workflow-examples/)

---

### 2.6 Before/After Comparison
**Dùng cho:** **Demonstrating value** - "Trước (manual/old system)" vs "Sau (với CMC EDU)."  
**Ưu điểm:**
- Immediately communicates benefit/pain point solved
- Highly persuasive for ROI conversations
- Simple to understand even without context

**Nhược điểm:**
- Không trình bày chi tiết *cách* system hoạt động
- Phụ thuộc vào "Before" state là credible

**Cấu trúc:**
```
BEFORE (Manual / Old System)      AFTER (CMC EDU)
─────────────────────────────────────────────
Sales sends PO via email         Sales enters PO in system
                                 (auto-validates data)
Finance prints, stamps, files    Finance reviews online
                                 (auto-check budget)
Warehouse checks email           Warehouse sees auto-generated
manually, picks items            picking list
Time: 3 days, errors: 15%        Time: 2 hours, errors: 0%
```

**Ví dụ CMC EDU:** "Grade Submission"
- Before: Teachers manual-enter grades in spreadsheet, email to department → hours of entry + errors
- After: Teacher enters in system, auto-validates, exports official report → 10 minutes, zero errors

**Nguồn:**
- [Before and After Comparison: Business Process Improvement - Lean 6 Sigma Hub](https://lean6sigmahub.com/before-and-after-comparison-how-to-document-improvement-results-effectively-lean-6-sigma-hub/)
- [Visual Comparison Techniques - Dev3lop](https://dev3lop.com/visual-comparison-techniques-for-before-after-analysis/)

---

## 3. Trình Bày Nhiều Items (38 Business Flows) Mà Không Overwhelm

### 3.1 Progressive Disclosure Pattern

**Định nghĩa:** Chia nội dung thành layers. Hiển thị "overview" đầu tiên → khán giả chọn "deep dive" vào chi tiết nào.

**Cách áp dụng cho 38 flows:**

**Lớp 1 (Overview):** Bảng index của 38 flows, nhóm theo 4 business clusters.
```
| Cluster | Flows | Actors |
|---------|-------|--------|
| Sales | Quote, Order, Invoice, Payment | Sale, Customer |
| HR | Recruitment, Onboarding, Payroll | HR Manager, Employee |
| Finance | Budget, Expense Approval, Reconciliation | Finance, Director |
| Academic | Enrollment, Course, Grading | Teacher, Student, Parent |
```

**Lớp 2 (Medium Detail):** Thumbnail swimlane cho mỗi flow (~3 lines, 5-6 steps). Presenter nói "cho những ai muốn thấy detail của flow này, đây là swimlane."

**Lớp 3 (Full Detail):** Swimlane/journey map đầy đủ cho mỗi flow. Presenter jump tới nếu khách hàng hỏi "Chờ, flow này hoạt động như thế nào?"

**Ưu điểm:**
- Non-linear presentation: khách hàng có thể request jump vào flow bất kỳ
- Không ai bị overwhelm ở phần đầu
- Presenter maintain control: "Cảm ơn câu hỏi, hãy nhìn layer này..."

**Áp dụng CMC EDU:**
- **Slide 1:** Overview table (38 flows grouped by 4 clusters)
- **Slides 2-10:** Thumbnail + 1-liner mỗi flow (10 flows per slide)
- **Slides 11-50:** Full detail swimlanes (mỗi flow 1 slide)
- Presenter: "Hôm nay ta sẽ đi qua overview. Nếu ai muốn detail hơn, hãy báo & ta sẽ jump vào."

**Nguồn:**
- [Progressive Disclosure in UX - UXPin](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)
- [Progressive Disclosure Overview - Vanseo Design](https://vanseodesign.com/web-design/progressive-discolosure/)

---

### 3.2 Chunking + Segmentation Strategy

**Mạnh mẽ từ Cognitive Load Theory (Sweller, 1988):** Working memory chỉ xử lý được ~4-7 chunks thông tin mới.

**Áp dụng cho 38 flows:**
- **Chia 38 flows thành 6-7 "chapters"** (mỗi chapter = 1 business cluster hoặc 1 actor persona)
  - Chapter 1: Sales & Customer flows (5-6 flows)
  - Chapter 2: HR & Recruitment flows (4-5 flows)
  - Etc.
- **Mỗi chapter ~ 10-15 phút** (1-2 flows deep dive, rest as overview)
- **Giữa chapters:** 2-3 min break để khách hàng "reset" cognitive load

**Cách vẽ chapter-aware:**
- Mỗi chapter có **intro slide** (overview of chapter theme + actors involved)
- Flows được **color-coded by chapter** (Sales = blue, HR = green, etc.)
- Index slide cập nhật lúc đầu mỗi chapter: "Bây giờ ta ở Chapter 2 - HR flows"

**Ứng dụng CMC EDU:**
```
Chapter 1: Sales & Orders (15 min) - 5 flows
  ├─ Quote Creation (swimlane)
  ├─ Purchase Order (swimlane)
  ├─ Invoice & Payment (swimlane)
  └─ 2 other flows (overview only)
Chapter 2: Academic Cycle (15 min) - 6 flows
  ├─ Enrollment (journey map)
  ├─ Course Setup (swimlane)
  ├─ Grading (before/after)
  └─ Etc.
...
(5-6 chapters total, ~60-75 min + Q&A)
```

**Áp dụng cognitive science:** Giữa chapter, presenter tóm tắt "Vậy ở chapter 1, chúng ta thấy 5 flows sale, tất cả đều có approve gate ở Finance. Bây giờ ta move vào Chapter 2 nơi focus là academic workflow."

**Nguồn:**
- [Chunking: Reducing Cognitive Load - Pearson Schools](https://www.pearson.com/en-au/schools/insights-news/unlocking-the-power-of-chunking-reducing-cognitive-load/)
- [Cognitive Load Theory: 12 Strategies - Structural Learning](https://www.structural-learning.com/post/cognitive-load-theory-a-teachers-guide)

---

### 3.3 Visual Consistency + Recognition (Same Vocabulary Across 38 Flows)

**Masalah:** 38 flows, jika masing-masing punya style lain → viewers harus belajar visual grammar setiap kali → **cognitive tax per flow meningkat**.

**Solusi:** Gunakan **4-6 loại diagram recurring** untuk semua 38 flows.

---

## 4. Recommended Visual Vocabulary (4-6 Types, Reusable Across All 38 Flows)

**Rationale:** Jika masing-masing flow punya diagram style baru, khán giả harus belajar ulang visual grammar. Konsistensi → viewers nhận diện pattern, cognitive load giảm. Kalimat Tufte: *"Simplicity is for the sake of understanding complexity, not reducing it."*

| Tipe | Loại Flow | Visual | Symbol Set | Complexity |
|------|----------|--------|-----------|-----------|
| **Type A: Role-Based Swimlane** | Workflows dengan 2-4 roles tuần tự approve/execute | Horizontal lanes by role | Rectangle, Diamond, Arrow | Medium |
| **Type B: Single-Actor Journey** | 1 user's workflow (teacher, student, HR manager) | Timeline + screenshot + annotations | Circle nodes, linear flow, emotion markers | Low |
| **Type C: Service Blueprint** | Process có visible + back-end components | 3-layer diagram (customer action, visible system, invisible) | Same as A + dashed lines for backend | Medium-High |
| **Type D: Control Gate** | Multi-approval, retry loops, exception handling | Flowchart with yes/no branches | Rectangle (task), Diamond (decision), Circle (start/end) | High |
| **Type E: Before/After** | Value demonstration (manual vs automated) | Side-by-side comparison | Simplified swimlanes or boxes | Low |
| **Type F: "Day in Life" Storyboard** | Holistic user experience across multiple systems | Time-based annotated screenshots | Time markers (8am, 9am...) + callouts | Low |

**Tính toán:** Thay vì 38 unique diagram styles → chọn 4-6 types, mỗi type xuất hiện 6-9 lần. Viewer học visual grammar 1 lần per type, áp dụng đó tới nhiều flows.

**Quyết định xem loại nào cho từng flow:**
- "Có nhiều roles & sequential approval?" → Type A (Swimlane)
- "Chỉ 1 user's daily experience?" → Type B (Journey) hoặc Type F (Storyboard)
- "Cần giải thích back-end processing?" → Type C (Service Blueprint)
- "Có complex gates & retry loops?" → Type D (Control Gate)
- "Muốn highlight improvement?" → Type E (Before/After)

**Ví dụ áp dụng cho 38 flows CMC EDU:**
- Sales flows (6): Type A (swimlane, multiple roles: Sales, Finance, Warehouse)
- HR flows (5): Type B (journey, mỗi flow = 1 HR person's day)
- Academic flows (10): Type F (day in life) + Type B (student journey)
- Compliance/Approval flows (8): Type D (control gate with retry)
- Finance flows (6): Type C (service blueprint: what user sees + backend reconciliation)
- Etc.

**Áp dụng vào CMC EDU:** Tạo "diagram style guide" trang 1 của presentation → giải thích 6 types, 1 example mỗi loại → khán giả đã sẵn sàng "read" tất cả 38 flows sau đó.

---

## 5. Live Demo vs Pre-Recorded vs Annotated Screenshots

### 5.1 Comparative Analysis

| Tiêu Chí | Live Demo | Pre-Recorded Clip | Annotated Screenshot |
|----------|----------|------------------|----------------------|
| **Credibility** | Cao (khách hàng thấy "real system") | Trung (khách hàng may nói "that's a script") | Thấp nếu không có context |
| **Flexibility** | Cao: presenter skip/jump, address objections | Thấp: fixed sequence | Trung: presenter nói thêm |
| **Risk of Failure** | **Cao:** network, server, DB connection, live data | Thấp: file cached, tested | Thấp: static image |
| **Setup Complexity** | Cao: need working env, test data, backup plan | Trung: record once, replay | Thấp: just image + pointer |
| **Engagement** | Cao: interactive, Q&A during demo | Trung: passive watching | Trung: presenter narrates |
| **Time to Prepare** | Trung-Cao: setup, rehearse, contingency | Cao: record, edit, perfect | Thấp: annotate screenshot |

### 5.2 Known Live Demo Failure Modes + Mitigations

**Network Failures:**
- Presenter loses Internet → system unreachable
- *Mitigation:* Pre-download app or use staging server on local network (no external dependency)

**Data Freshness:**
- Live data show "no orders" → looks broken
- *Mitigation:* Pre-populate test data matching scenario ("imagine 50 open orders today")

**Dependency Breaks:**
- API key expired, database password wrong, dependency version mismatch
- *Mitigation:* Test live environment **morning of presentation,** check all credentials, have backup credentials

**Screen Rendering Issues:**
- Font rendering different on projector vs laptop
- *Mitigation:* Use system fonts (Arial, Segoe), avoid custom fonts; test on projector beforehand

**Attention Hijack:**
- Unexpected error dialog, or presenter clicks wrong button → loses narrative thread
- *Mitigation:* Rehearse clicks; use keyboard shortcuts only you know; have "skip this part" shortcut

**Solution Pattern: "Live-Looking" Demo (Lipsync Pattern)**

Presenter records a screen video of the flow **beforehand**, then **plays it back during presentation as if it's live.** Audience sees smooth, narrated walkthrough. If live demo fails → no loss of face, just pivot to the recording.

**Implementation:**
1. Record demo screen (~5 min per flow)
2. Edit lightly (remove hesitation, fix clicks, normalize timing)
3. **During presentation:** Try live demo first (if network good). If failure → "Let me show you the recorded version which is cleaner anyway."

### 5.3 Recommended Hybrid Approach for CMC EDU

**Model:** Live Overview + Pre-recorded Deep-Dive

- **Live component:** Presenter shows **live dashboard** of CMC EDU (real-time data from staging), clicks through 2-3 quick operations to demonstrate system is responsive
- **Pre-recorded component:** For each of the 38 flows, show **2-3 min annotated screen recording** that walks through the flow (presenter narrates over)
- **Screenshot component:** Alongside pre-recorded, show swimlane diagram as reference

**Rationale:**
- **Live demo keeps audience engaged** ("system is real, not a mock")
- **Pre-recorded ensures quality** (no awkward pauses, fast, professional)
- **Diagram provides structure** (viewers see process flow while watching demo)
- **Risk mitigation:** if live breaks, pivot to recordings without disruption

---

## 6. Narrator Support Patterns

### 6.1 Presenter Notes Structure

**Anti-pattern:** Full script on presenter notes → presenter reads, sounds robotic, loses eye contact.

**Pattern: Cue Cards for Narrator**
- Max 3-4 bullet points per slide
- Each bullet = 1-2 sentences of talking points
- Keywords/phrases only, not full sentences
- Example:
  ```
  Slide: "Sales Order Workflow"
  Notes:
  • Order created by sales → system auto-validates against credit limit
  • Finance reviews within 4 hours (SLA = orange if delayed)
  • Once approved, warehouse gets auto-picking list
  • Takes 2-3 days total vs 5-7 days manual
  ```

**vs Anti-pattern:**
  ```
  "When a sales representative creates an order in the system, 
  the system automatically checks the customer's credit limit 
  to ensure the order doesn't exceed their approved credit..."
  (reads word-for-word, sounds scripted)
  ```

**Structure Presenter Notes by Story Arc:**
- **Opening (5 sec):** What flow is this? Why important?
- **Narrative (30-60 sec):** Step-by-step, who does what, where's the gate?
- **Value (15 sec):** "So instead of 5 days, this is now 2 days. No errors."
- **Transition (5 sec):** "Next flow is..."

### 6.2 Dual-Screen Setup (Presenter View)

**Setup:** Presenter's laptop screen = presenter view (notes + next slide). Projector/audience screen = clean slide only (no notes).

**Software Support:**
- PowerPoint: Presenter View (built-in, Windows & Mac)
- Google Slides: Presenter View (built-in)
- Web frameworks: Reveal.js, Remark, or custom HTML5 (dual-screen via query param)

**Benefits:**
- Presenter sees notes while speaking (no memory needed)
- Presenter sees **next slide preview** → know what's coming, time transitions
- **Timer on presenter screen** → pace stays on track
- Audience sees clean visuals only

**Pro Tips:**
- Position presenter laptop **visible to you** but **not between you and audience** (don't turn your back)
- Refer to notes as *navigation*, not *script* (glance, not read)
- Practice until notes feel like "memory jogger," not "teleprompter"

**Áp dụng CMC EDU:**
- Slide 1: Overview (notes: "Welcome, today we'll cover 38 flows across 4 clusters. Take 90 min, Q&A after.")
- Slides 2-6: 6-7 visual types introduced (notes per slide: 1-2 sentences explaining type)
- Slides 7-50: Deep dive per flow (notes: 3-4 bullets, 30-60 sec talking points)

### 6.3 Pacing + Timing Guidance

**Rule of Thumb:**
- **Overview slide:** 2-3 min (introduce, set context)
- **Swimlane/diagram slide:** 3-5 min (walk through each step, highlight decision points)
- **Journey map slide:** 2-3 min (narrative-driven, can be quick)
- **Before/after slide:** 2 min (let the visual speak)
- **Q&A:** ~10 min per 20 min of content

**Total Time Calculation for CMC EDU:**
- Intro + 6 visual types: 10 min
- 4 clusters (6 flows deep-dive, ~6 overview) × 15 min/cluster: 60 min
- Q&A buffer: 15 min
- **Total: 85-90 min** (fits typical 1.5-hour customer session)

**Managing Q&A Jumps:**
- Presenter notes can include "If audience asks about X, jump to slide Y"
- Slides should be **independent** (each swimlane doesn't depend on the one before)
- Use "Chapter tabs" or "flow index" on presenter screen for fast navigation

**Nguồn:**
- [How to Use PowerPoint Presenter View - Slidemodel](https://slidemodel.com/how-to-use-powerpoint-with-dual-monitors/)
- [Speaker notes: Microsoft Support](https://support.microsoft.com/en-us/office/start-the-presentation-and-see-your-notes-in-presenter-view-4de90e28-487e-435c-9401-eb49a3801257)

---

## 7. Anti-Patterns to Avoid in Narrated Presentations

### 7.1 Text-Heavy Slides (Tufte's "Chartjunk" + Redundancy Principle Violation)

**Anti-pattern:**
```
Sales Order Processing Workflow

When a sales representative receives a purchase order from a customer, 
the system automatically checks the customer's credit limit. If the 
credit limit is exceeded, the order is flagged for manual review by 
the Finance Manager. Once Finance approves the order (or customer 
provides additional credit), the order is sent to the Warehouse...
```

**Why it fails:** Audience reads *or* listens, not both. If they're reading, they miss your narration. If they're listening, they ignore the text.

**Fix:** Replace with diagram + 3 keywords:
```
[Swimlane Diagram of flow]

Slide text: "Order Creation → Credit Check → Finance Approval → Warehouse Fulfillment"

Presenter speaks (not on slide): "When sales enters an order, the system checks credit limit. If exceeded, Finance must approve. Once approved, warehouse gets a picking list..."
```

**Nguồn:**
- [Why Text-Heavy Slides Hurt - SlideGenius](https://www.slidegenius.com/blog/why-text-heavy-slides-hurt-your-product-launch-presentation/)
- [Text Heavy Slides: How to Avoid - InkNarrates](https://www.inknarrates.com/post/text-heavy-slides)

---

### 7.2 Cognitive Overload (Too Many Flows per Slide)

**Anti-pattern:**
```
Slide: "Here are all 38 flows in one giant matrix with 6 swimlanes each, 
full BPMN symbols, color-coded by actor, with legends..."
```

**Why it fails:** Working memory can hold 4-7 chunks. One slide with 38 flows = 38 chunks → instant overload → nobody learns anything.

**Fix:** Progressive disclosure (see section 3.1).

---

### 7.3 Decorative Graphics (Chartjunk)

**Anti-pattern:**
```
Diagram title has a fancy clipart of a businessman running
Flows have gradient backgrounds
Decision points have emoji instead of shapes
Transitions: all diagrams fade in with sound effects
```

**Why it fails:** Eyes lock onto decorative element instead of the flow. Sound effects are distracting when narrator is speaking (violates Coherence Principle).

**Fix:** Use shapes only for information. No gradients, emojis, or sound effects. Muted color palette. Black/white diagram + 1-2 highlight colors for signaling.

**Tufte's Standard:** Maximize data-ink ratio, erase non-data-ink.

---

### 7.4 Mixing Multiple Diagram Styles (Cognitive Grammar Switching)

**Anti-pattern:**
```
Flow 1: Swimlane (horizontal)
Flow 2: BPMN flowchart (different symbols)
Flow 3: Service blueprint (3 layers)
Flow 4: Entity-relationship diagram (totally different)
```

**Why it fails:** Audience must re-learn visual grammar for each flow → cognitive load per flow = high.

**Fix:** Use 4-6 types consistently (section 4).

---

### 7.5 No Fallback for Live Demo Failure

**Anti-pattern:**
```
Presenter is showing live demo. Network goes down.
"Oh, sorry, let me reload..."
(5 min of troubleshooting while audience sits in silence)
```

**Why it fails:** Kills momentum, destroys credibility, audience loses focus.

**Fix:** Pre-recorded fallback (section 5.2, Lipsync pattern).

---

### 7.6 Presenter Talks *About* Slide Rather Than *With* Slide

**Anti-pattern:**
```
Slide shows swimlane of "Order Processing"
Presenter says: "This slide shows a swimlane of order processing. As you can see, 
there are 4 swimmers. The first swimmer is Sales..."
```

**Why it fails:** Presenter is describing what's visible → audience stops listening ("I can read it myself") → becomes narration + redundancy.

**Fix:** Presenter assumes audience sees diagram, speaks to *why* and *implications*, not *what*.

```
Same slide. Presenter says:
"Notice the Finance gate here — that's the bottleneck. In the current manual process, 
they take 2 days to approve. With CMC EDU, it's 2 hours because the system auto-validates 
budget constraints..."
```

Presenter is **adding information**, not repeating.

---

## 8. Implementation Checklist for CMC EDU Presentation

### Pre-Presentation (2-3 weeks before)

- [ ] Choose visual vocabulary (4-6 types). Create 1 example per type for "how-to-read" intro slide.
- [ ] Categorize 38 flows by type (which flows use swimlane, which use journey map, etc.)
- [ ] Draft swimlanes for sale/HR/finance flows (Type A: Swimlane) — each on own slide
- [ ] Draft journey maps for student/teacher flows (Type B: Journey) — each on own slide
- [ ] Draft service blueprints for "visible + backend" flows (Type C)
- [ ] Draft control gates for approval workflows (Type D)
- [ ] Draft before/after comparisons for high-value flows (Type E)
- [ ] Draft "day in life" storyboards if helpful (Type F)
- [ ] Group flows by chapter (4-6 chapters, ~6-10 flows per chapter)
- [ ] Write presenter notes (3-4 bullets per slide, 30-60 sec talking points)
- [ ] Test all diagrams on projector (font sizes, colors, clarity)

### During Presentation (1 day before + day-of)

- [ ] **Test live demo environment:** Log in, check data, test 2-3 operations
- [ ] Test presenter view: laptop + projector, notes visible, timer working
- [ ] Have pre-recorded videos ready (fallback if live demo fails)
- [ ] Print physical notes (backup if presenter view fails)
- [ ] Rehearse: time pacing, practice transitions, nail 2-3 key talking points

### Post-Presentation

- [ ] Collect feedback: "Which flows were clearest? Which were confusing?"
- [ ] Update diagrams for next iteration (address feedback)
- [ ] Archive recordings (reusable for future customers)

---

## 9. Architectural Implications for CMC EDU

### A. Reuse Visual Artifacts as Documentation

Once 38 flows are diagrammed for presentation, reuse in:
- **User onboarding docs** (new teacher follows same swimlanes)
- **Admin training** (finance admin sees control gates)
- **API docs** (developers see service blueprints showing backend)

### B. Test Presentations Against Sample User Groups

Before customer-facing presentation:
- Dry-run with 3-4 non-technical staff (e.g., finance department, customer service)
- Measure: Can they follow all 6 visual types without explanation?
- Collect: "Which flow was confusing? Which was clear?"
- Iterate before customer sees it

### C. Build Presentation as a Product, Not a One-Off

- **Deck as artifact:** Versioned slides, reusable per customer segment (sales-focused vs academic-focused versions)
- **Recording library:** Each flow pre-recorded → reusable for on-demand learning, customer onboarding
- **Interactive mode:** Future iteration → clickable flows, drill-down from overview to detail (progressive disclosure in software, not just slide deck)

### D. Measure Customer Comprehension

Post-presentation survey:
- "On a scale of 1-5, how well did you understand the 38 workflows?"
- "Which flows remain unclear?"
- "Which diagram type was easiest to follow?"
→ Data-driven iteration

---

## 10. Unresolved Questions

1. **Color accessibility:** Exact color palette for diagrams (must pass WCAG contrast, but also visually cohesive). *Answer needed:* Finalize palette with design/accessibility review.

2. **Swimlane lane limits:** Research says "max 6-8 lanes," but some CMC EDU processes may have 10+ roles (e.g., multi-level approval). *Question:* Should we split into 2 swimlanes, or use a different visual (e.g., layers instead of lanes)?

3. **Segmentation strategy:** Proposed 4-6 chapters. *Question:* Should chapters align with **business clusters** (sales, HR, etc.) or **user personas** (sales manager's day, teacher's day, etc.)? Evidence slightly favors personas (better storytelling).

4. **Live demo readiness:** Assumed staging environment exists and is stable. *Question:* Does CMC EDU staging environment have realistic test data and <5min setup/teardown?

5. **Presentation duration:** Estimated 85-90 min for 38 flows + intro. *Question:* Is customer availability 2 hours or 1.5 hours? Affects depth strategy (all flows medium detail vs some overview only).

6. **Interactivity:** Current recommendations assume linear presentation. *Question:* Should future version support "click to explore flow" (interactive deck)? Would require higher effort but better for remote/asynchronous customers.

---

## Kesimpulan

**Evidence-based presentation untuk non-technical customers membutuhkan:**

1. **Cognitive science foundation** (Mayer, Sweller): Redundancy principle (narration ≠ on-screen text), segmentation (bite-sized chunks), coherence (no chartjunk).

2. **Consistent visual vocabulary** (4-6 diagram types): Swimlane, Journey Map, Service Blueprint, Control Gate, Before/After, Day-in-Life. Reuse across 38 flows to minimize "grammar learning" per flow.

3. **Progressive disclosure**: Overview → chapters → deep-dive. Non-linear, supports Q&A jumps.

4. **Live demo + recorded fallback**: Live for credibility, recorded for safety. Hybrid model removes single point of failure.

5. **Narrator is the channel**: Slides support, not replace, the speaker. Presenter notes structure (cue cards, not script). Dual-screen setup (notes invisible to audience).

6. **Anti-patterns**: Text-heavy slides, cognitive overload, decorative graphics, diagram style-hopping, no fallback, "describing the obvious."

**Untuk CMC EDU ngay lập tức:**
- Tạo diagram style guide (6 types, 1 example mỗi loại) → slide 1 của presentation
- Categorize 38 flows by type
- Draft swimlanes/journey maps/service blueprints per flow
- Group flows by chapter (4-6 chapters)
- Write presenter notes (3-4 bullets, 30-60 sec per slide)
- Test on projector + presenter view setup
- Record fallback videos for each flow
- **Dry-run with 3-4 non-technical staff → iterate**

---

## Danh Sách Nguồn (Sources)

### Mayer's Multimedia Learning Principles
- [Mayer's Principles of Multimedia Learning - Educational Technology](https://educationaltechnology.net/mayers-principles-of-multimedia-learning/)
- [PDF: Principles for reducing extraneous processing in multimedia learning](https://www.researchgate.net/publication/262915119_Principles_for_reducing_extraneous_processing_in_multimedia_learning_Coherence_signaling_redundancy_spatial_contiguity_and_temporal_contiguity_principles)

### Swimlane Diagrams
- [Swimlane Diagram: Designing Better Business Processes - Venngage](https://venngage.com/blog/swimlane-diagram/)
- [What is a Swimlane Diagram - Lucidchart](https://www.lucidchart.com/pages/tutorial/swimlane-diagram)

### Journey Maps & Service Blueprints
- [How to create customer journey maps - Zendesk](https://www.zendesk.com/blog/customer-journey-map/)
- [Journey Mapping 101 - Nielsen Norman Group](https://www.nngroup.com/articles/journey-mapping-101/)
- [What is a Service Blueprint - Lucid](https://lucid.co/blog/what-is-a-service-blueprint)
- [Service Blueprints: Definition - NN/G](https://www.nngroup.com/articles/service-blueprints-definition/)
- [Service Blueprint vs Journey Map](https://miro.com/customer-journey-map/service-blueprint-vs-journey-map/)

### Control Gate & Approval Workflows
- [Approval Workflow Flowchart - ChatDiagram](https://www.chatdiagram.com/examples/flowchart/approval-workflow)
- [Control-flow diagram - Wikipedia](https://en.wikipedia.org/wiki/Control-flow_diagram)

### Day in the Life
- [Top 10 Day in the Life PowerPoint Templates - Slideteam](https://www.slideteam.net/blog/top-10-day-in-the-life-ppt-templates-and-samples)
- [Mastering workflows: Real-life Workflow Examples - Process.st](https://www.process.st/workflow-examples/)

### Before/After Comparison
- [Before and After Comparison: Business Process Improvement - Lean 6 Sigma Hub](https://lean6sigmahub.com/before-and-after-comparison-how-to-document-improvement-results-effectively-lean-6-sigma-hub/)
- [Visual Comparison Techniques - Dev3lop](https://dev3lop.com/visual-comparison-techniques-for-before-after-analysis/)

### Edward Tufte & Information Design
- [Mastering Tufte's Data Visualization Principles - GeeksforGeeks](https://geeksforgeeks.org/data-visualization-mastering-tuftes-data-visualization-principles/)
- [Tuftes 6 Principles for Graphical Integrity - Medium](https://medium.com/service-design-insight/tuftes-6-principles-for-graphical-integrity-adopted-for-service-design-42e1446df6e9)

### Progressive Disclosure
- [Progressive Disclosure in UX - UXPin](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)
- [Progressive Disclosure Overview - Vanseo Design](https://vanseodesign.com/web-design/progressive-discolosure/)

### Cognitive Load & Chunking
- [Chunking: Reducing Cognitive Load - Pearson Schools](https://www.pearson.com/en-au/schools/insights-news/unlocking-the-power-of-chunking-reducing-cognitive-load/)
- [Cognitive Load Theory: 12 Strategies - Structural Learning](https://www.structural-learning.com/post/cognitive-load-theory-a-teachers-guide)

### Live Demo vs Pre-Recorded
- [Live demos vs recorded demos in 2026 - Guideflow](https://www.guideflow.com/blog/live-demos-vs-recorded-demos)
- [Are live demos a good idea for SaaS Sales - Walnut.io](https://www.walnut.io/blog/product-demos/are-live-demos-a-good-idea-for-saas-sales/)

### Presenter View & Speaker Notes
- [How to Use PowerPoint Presenter View - Slidemodel](https://slidemodel.com/how-to-use-powerpoint-with-dual-monitors/)
- [Speaker notes: Microsoft Support](https://support.microsoft.com/en-us/office/start-the-presentation-and-see-your-notes-in-presenter-view-4de90e28-487e-435c-9401-eb49a3801257)

### Anti-Patterns & Cognitive Overload
- [Why Text-Heavy Slides Hurt - SlideGenius](https://www.slidegenius.com/blog/why-text-heavy-slides-hurt-your-product-launch-presentation/)
- [Text Heavy Slides: How to Avoid - InkNarrates](https://www.inknarrates.com/post/text-heavy-slides)
- [Cognitive Overload in Presentations - AiPPT](https://learn.aippt.com/how-to-avoid-cognitive-overload-in-powerpoint-presentations/)

### Nielsen Norman Group
- [Information Architecture: NN/G](https://www.nngroup.com/topic/information-architecture/)

---

**Report compiled:** 2026-08-05 | **Language:** Vietnamese (technical terms in English) | **Purpose:** Evidence-based research for live narrated software system presentation to non-technical business customers.
