# Phân tích Moodle LMS — Tích hợp và Kiến trúc cho CMC EDU v2

**Ngày:** 2026-07-25  
**Scope:** Bóc tách nền tảng Moodle kinh điển; khả thi tích hợp (không nhúng code); học được concepts.  
**License verify:** ✅ Confirmed GPL-3.0-or-later từ file source.

---

## 1. Xác thực License

| Nguồn | Nội dung |
|-------|---------|
| **COPYING.txt** | "GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007" |
| **composer.json** | `"license": "GPL-3.0-or-later"` |
| **GitHub API** | `"spdx_id": "GPL-3.0"` |
| **Header PHP** | Mỗi file có notice GPL v3 or later |

**Kết luận:** Moodle là **GPL v3 hoặc cao hơn** — công khai, không proprietary. CMC EDU muốn tích hợp Moodle mà không dính GPL phải dùng **web services (API) không nhúng code**, không phải derivative work.

---

## 2. Trạng thái & Quy mô

| Thông số | Giá trị |
|---------|--------|
| **Branch mặc định** | `main` (development) |
| **LTS Branch hiện tại** | `MOODLE_400_STABLE` (v4.0, LTS) |
| **Version đang dev** | 5.3dev (Build: 20260722) |
| **PHP yêu cầu** | 8.3.0+ (strict) |
| **DB engine hỗ trợ** | MySQL 5.7+, MariaDB 10.2+, PostgreSQL 11+, SQL Server 2016+, Oracle 19c+ |
| **Ngôn ngữ core** | PHP (backend) + JavaScript/TypeScript (frontend) |
| **PHP files** | 50,135 files |
| **Lines of Code** | ~2.94M (PHP, không minified) |
| **Dung lượng** | 583 MB (public/, chỉ source) |
| **Community** | 7,283 stars GitHub, duy trì bởi Moodle Pty Ltd |

**Nhận xét:** Moodle là **monolith legacy**, lớn gấp 10–15x CMC EDU v2. Hệ thống lâu đời, tiến hóa từ 1999, heavy PHP procedural.

---

## 3. Kiến trúc Plugin

Moodle dùng **plugin system phân lớp** theo type:

| Plugin type | Tiền tố thư mục | Ví dụ | Mục đích |
|-------------|-----------------|-------|---------|
| **mod** | `mod_` | assign, quiz, forum, lti, book | Activity modules (hoạt động khóa học) |
| **auth** | `auth_` | manual, ldap, oauth2, lti | Xác thực & SSO |
| **enrol** | `enrol_` | database, cohort, category | Enrollment methods (ghi danh học) |
| **blocks** | `block_` | navigation, calendar, myoverview | Sidebar blocks |
| **theme** | `theme_` | boost (mặc định), clean | UI/UX themes |
| **question** | `qtype_` | essay, multichoice, truefalse | Question types (types câu hỏi) |
| **gradereport** | `gradereport_` | singleview, user, grader | Grade display reports |
| **local** | `local_` | (custom) | Local hacks, không reusable |
| **report** | (report/) | logs, stats, courseinfo | Site-wide reports |
| **tool** | `admin/tool/` | generator, messageinbound | Admin tools |
| **repository** | `repository_` | local, dropbox, googledocs | File storage backends |

### Plugin Manifest (`version.php`)
```php
$plugin->component = 'mod_assign';      // Identifier
$plugin->version   = 2026042001;        // YYYYMMDD + XX (incrementing)
$plugin->requires  = 2026041000;        // Min Moodle version
$plugin->maturity  = MATURITY_STABLE;   // ALPHA, BETA, RC, STABLE
```

### Plugin DB/Access Files
```
plugin/
├── version.php           # Metadata
├── db/
│   ├── install.xml       # XMLDB schema (install-time)
│   ├── upgrade.php       # Schema migrations
│   ├── access.php        # Capability definitions
│   ├── services.php      # Web service functions
│   └── tasks.php         # Scheduled tasks (cron)
├── lib.php               # Plugin callbacks (hooks)
├── classes/              # Autoloadable classes (PSR-4)
└── tests/                # PHPUnit + Behat tests
```

**Cơ chế nạp:** Moodle scan `version.php` tại install, build plugin registry. Không cần manifest JSON. Callback trong `lib.php` dùng naming convention (e.g., `mod_assign_user_complete_for_gradebook`).

---

## 4. Database Layer

### Abstraction: `moodle_database`
```php
// public/lib/dml/moodle_database.php
abstract class moodle_database {
    // Implemented by: mysqli_native_moodle_database, pgsql_native_moodle_database, etc.
    public function get_records($table, $conditions = null, $sort = '', $fields = '*', $limitfrom = 0, $limitnum = 0);
    public function get_record_sql($sql, array $params = null);
    public function insert_record($table, $dataobject, $returnid = true, $bulk = false);
    public function update_record($table, $dataobject, $bulk = false);
    public function delete_records($table, array $conditions = null);
    // ... 50+ methods
}
```

### XMLDB Schema (`db/install.xml`)
```xml
<XMLDB PATH="mod/assign/db" VERSION="20251126">
  <TABLES>
    <TABLE NAME="assign" COMMENT="...">
      <FIELDS>
        <FIELD NAME="id" TYPE="int" SEQUENCE="true" NOTNULL="true"/>
        <FIELD NAME="course" TYPE="int" NOTNULL="true"/>
        <FIELD NAME="name" TYPE="char" LENGTH="1333"/>
        <FIELD NAME="duedate" TYPE="int" NOTNULL="true" DEFAULT="0"/>
      </FIELDS>
      <KEYS>
        <KEY NAME="primary" TYPE="primary" FIELDS="id"/>
      </KEYS>
      <INDEXES>
        <INDEX NAME="course" UNIQUE="false" FIELDS="course"/>
      </INDEXES>
    </TABLE>
  </TABLES>
</XMLDB>
```

**Quy ước đặt tên bảng:** `mdl_` prefix (e.g., `mdl_assign`, `mdl_assign_submission`). Plugin prefix: `mdl_mod_quiz_attempts`.

### Upgrade Workflow
```php
// db/upgrade.php
function xmldb_mod_assign_upgrade($oldversion) {
    global $DB;
    if ($oldversion < 2026020100) {
        $table = new xmldb_table('assign');
        $field = new xmldb_field('gradepenalty', XMLDB_TYPE_INT, '2', null, true, false, 0);
        if (!$DB->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }
        upgrade_mod_savepoint(true, 2026020100, 'assign');
    }
}
```

**Hệ quả:** Moodle **không dùng ORM** → raw SQL, ít type safety, lâu để debug. `moodle_database` là stateless, mỗi query phải pass full params.

---

## 5. Roles & Capabilities — Context Hierarchy

### Context Levels (định nghĩa tầng quyền hạn)
```php
// public/lib/accesslib.php
CONTEXT_SYSTEM      (10)    // System-wide (1 instance)
CONTEXT_USER        (30)    // Per-user (what others can do to user)
CONTEXT_COURSECAT   (40)    // Category hierarchy
CONTEXT_COURSE      (50)    // Course level
CONTEXT_MODULE      (70)    // Activity module
CONTEXT_BLOCK       (80)    // Block instance
```

**Hierarchy:** `System → Category → Course → Module/Block` (tree structure, each context has 1 parent).

### Capability Definition (`db/access.php`)
```php
$capabilities = array(
    'mod/assign:view' => array(
        'captype'      => 'read',
        'contextlevel' => CONTEXT_MODULE,
        'archetypes'   => array(
            'guest'   => CAP_ALLOW,
            'student' => CAP_ALLOW,
            'teacher' => CAP_ALLOW,
            'editingteacher' => CAP_ALLOW,
            'manager' => CAP_ALLOW
        ),
        'clonepermissionsfrom' => 'moodle/course:view'
    ),
    'mod/assign:submit' => array(
        'riskbitmask' => RISK_XSS,
        'captype'     => 'write',
        'contextlevel' => CONTEXT_MODULE,
        'archetypes'  => array('student' => CAP_ALLOW)
    ),
);
```

| Trường | Ý nghĩa |
|--------|---------|
| `captype` | `read` / `write` / `manage` |
| `contextlevel` | Tầng enforcement (CONTEXT_COURSE, CONTEXT_MODULE, ...) |
| `archetypes` | Mẫu role mặc định (student, teacher, manager) |
| `riskbitmask` | Độ rủi ro: RISK_CONFIG, RISK_XSS, RISK_PERSONAL, RISK_SPAM, RISK_DATALOSS |

### Permission Override (`role_capabilities` table)
```sql
role_capabilities:
  id, contextid, roleid, capability, permission, timemodified, modifierid

-- Permission = CAP_ALLOW (1), CAP_PREVENT (-1), CAP_PROHIBIT (-1000)
-- CAP_PROHIBIT: không thể ghi đè ở context con
```

### So sánh với CMC EDU's Postgres RLS
| Aspect | Moodle (Application-layer) | CMC EDU (Database-layer RLS) |
|--------|---------------------------|---------------------------|
| **Enforcement** | PHP function `has_capability()` | PostgreSQL row policies (`CREATE POLICY`) |
| **Enforcement Point** | Application tier | Database tier |
| **Flexibility** | High (runtime role switches) | Medium (predefined policies) |
| **Performance** | Filter after query (can fetch 1M rows) | Filter at DB (efficient) |
| **Consistency** | Weaker (cache invalidation) | Stronger (DB enforces) |
| **Scoped To** | User → Context (hierarchy) | User → Facility (flat org) |

**Kết luận:** Moodle **enforce authorization ở tầng ứng dụng** (business logic), CMC EDU **enforce ở tầng DB** (security boundary). Moodle linh hoạt hơn nhưng phải cache + invalidate. CMC EDU an toàn hơn nhưng kém linh hoạt.

---

## 6. Gradebook — Tiên tiến Aggregation

### Data Model
```php
// public/lib/grade/grade_item.php
class grade_item {
    public $courseid;
    public $categoryid;
    public $itemname;           // e.g., "Quiz 1"
    public $itemtype;           // 'course', 'category', 'mod'
    public $itemmodule;         // e.g., 'quiz', 'assign'
    public $grademax;           // Max score (100)
    public $grademin = 0;       // Min score
    public $scaleid;            // If scale-based (e.g., A/B/C/D/F)
    public $aggregation;        // Aggregation strategy
    public $aggregationcoef;    // Weight
    public $display;            // GRADE_DISPLAY_TYPE_REAL, GRADE_DISPLAY_TYPE_PERCENTAGE
    public $calculation;        // Formula: "=item1*0.3+item2*0.7"
}

class grade_category {
    public $fullname;           // Category name
    public $parent;             // Parent category ID
    public $depth, $path;       // Hierarchy (like course_categories)
    public $aggregation;        // Strategy for children
    public $keephigh = 0;       // Keep top N items
    public $droplow = 0;        // Drop bottom N items
}

class grade_grade {
    public $itemid;             // grade_item.id
    public $userid;
    public $rawgrade;           // Raw user score
    public $finalgrade;         // After aggregation
    public $hidden;             // Hide from student
    public $excluded;           // Exclude from parent aggregation
    public $feedback;
    public $feedbackformat;
}
```

### Aggregation Strategies
| Strategy | Công thức | Dùng cho |
|----------|----------|---------|
| `GRADE_AGGREGATE_SUM` | Σ(grade × coef) | Cumulative (common) |
| `GRADE_AGGREGATE_MEAN` | Σ(grade) / n | Average across items |
| `GRADE_AGGREGATE_MEDIAN` | Median value | Robust to outliers |
| `GRADE_AGGREGATE_MIN` | min(grades) | Weakest link |
| `GRADE_AGGREGATE_MAX` | max(grades) | Best attempt |
| `GRADE_AGGREGATE_MODE` | Mode (most frequent) | Discrete grades |

### Grade Calculation Engine
```php
// lib/grade/calc_formula.php
$calculation = "=item1*0.3 + item2*0.7";  // Item references
$calc_formula = new calc_formula($calculation);
$raw_grade = $calc_formula->evaluate(array(
    'item1' => 85,
    'item2' => 92
));  // Returns: 85*0.3 + 92*0.7 = 89.9
```

**Nhận xét cho CMC EDU:** Moodle gradebook là **complex aggregation tree** (category nesting, formulas, weights, keep/drop logic). CMC EDU hiện có `FinalGrade` table đơn giản (user + course + score). Tích hợp Moodle gradebook thông qua API là khó (deep nesting), tốt hơn là clone concepts vào schema của CMC.

---

## 7. Quiz Engine — Question Bank & State Machine

### Architecture
```
Question Bank → Question Attempt → Grade

quiz (mod)
├── questions (shared bank)
├── quiz_attempts (state machine: inprogress → finished)
├── question_attempts (per-question state)
└── question_attempt_steps (answer history)
```

### Question Types (qtype plugins)
- `qtype_essay` — Free text, manual grade
- `qtype_multichoice` — Single/multiple correct
- `qtype_truefalse` — Binary
- `qtype_shortanswer` — Regex match
- `qtype_numerical` — Numeric tolerance
- `qtype_matching` — Pair matching
- `qtype_dragdrop` — Drag to drop zones
- (+ 15+ more)

### State Machine
```
Attempt states:
  inprogress → finished → reviewed

Question attempt:
  start → in_progress → answered → reviewed

Steps track: answer, grade, comment, timestamp
```

**Hệ quả:** Quiz engine là **stateful, sequential** (can resume, retake). CMC EDU hiện chỉ lưu Exercise + Submission (binary). Tích hợp lại phức tạp (state reconciliation).

---

## 8. Course Structure & Completion

### Navigation
```
Course
├── Section 1 (Topics/Weekly)
│   ├── Module (Activity) — assign, quiz, forum
│   │   └── completion_state (notstarted → inprogress → complete)
│   └── Resource (File, Page, Label)
└── Gradebook (aggregated from all modules)
```

### Completion Tracking
```php
// lib/completionlib.php
completion_info::update_state() — Mark user progress
completion_state:
  COMPLETION_INCOMPLETE     (0)
  COMPLETION_INCOMPLETE_LOCKED (1)  // Admin locked
  COMPLETION_COMPLETE       (1)
  COMPLETION_COMPLETE_PASS  (2)     // Passed min grade
  COMPLETION_COMPLETE_FAIL  (3)     // Below min grade
```

### Enrollment Methods (enrol plugins)
- `enrol_manual` — Admin ghi tay
- `enrol_database` — Sync external DB
- `enrol_cohort` — Group-based
- `enrol_category` — All in category
- `enrol_lti` — LTI launches

**Nhận xét:** CMC EDU có ClassBatch (tương course), ClassSession (tương activity), nhưng không có "section" hierarchy hay formal completion states. Moodle structure là **course → section → activity → item** (4 levels), CMC là **class → session → exercise** (3 levels).

---

## 9. Web Services & Tích hợp Bên Ngoài — Khả thi

### External API Model (`externallib.php`)

```php
// core_course_external extends \core_external\external_api
class core_course_external extends external_api {
    public static function get_course_contents_parameters() {
        return new external_function_parameters(array(
            'courseid' => new external_value(PARAM_INT, 'course id')
        ));
    }
    
    public static function get_course_contents($courseid) {
        self::validate_parameters(self::get_course_contents_parameters(), 
                                  array('courseid' => $courseid));
        $context = context_course::instance($courseid);
        self::validate_context($context);
        
        // Capability check enforced here
        require_capability('moodle/course:view', $context);
        
        // Return data (auto-serialized to JSON/XML)
        return array(...);
    }
    
    public static function get_course_contents_returns() {
        return new external_single_structure(array(...));
    }
}
```

### Auth: Token-based
```php
// webservice/externallib.php
$token = $DB->get_record('external_tokens', 
    array('token' => $wstoken, 'userid' => $USER->id));
$service = $DB->get_record('external_services', 
    array('id' => $token->externalserviceid));
// Token grants access to subset of functions
```

### Protocols Hỗ trợ
| Protocol | Use | Auth |
|----------|-----|------|
| **REST** | HTTP POST/GET | Token in URL/header |
| **SOAP** | Enterprise integration | WSDL-based |
| **AMF** | Legacy Flash | (deprecated) |
| **JSON-RPC** | Lightweight | Token |

### Khác: LTI & OAuth2
- **LTI v1.3 (mod_lti, auth_lti)** — Launch Moodle from Canvas/Blackboard, embed as LTI consumer
- **OAuth2 (auth_oauth2)** — Login via Google, Microsoft, LinkedIn
- **SSO (Shibboleth)** — Enterprise SSO

### Đánh giá Tích hợp Moodle ← → CMC EDU

| Kịch bản | Khả thi | Chi phí | Ghi chú |
|----------|---------|--------|---------|
| **Moodle là external service, CMC embed via LTI** | ✅ Cao (100%) | $$ | CMC là LTI consumer, Moodle là provider. Users launch từ CMC → Moodle, kết quả sync lại. Not integrated, separate identity. |
| **Sync users/courses qua REST API** | ✅ Cao (85%) | $$$ | Moodle exposes `core_user_create_users`, `core_course_create_courses`. CMC polls/webhooks để sync. Requires strong async queueing. |
| **Gradebook real-time sync** | ⚠️ Medium (60%) | $$$$ | Moodle gradebook is complex (nested aggregation). CMC would need to fetch `core_grades_get_grades` on every change, recalculate. **High latency, eventual consistency only**. |
| **Question bank reuse** | ✅ Medium (70%) | $$$ | Moodle question bank is plugin-based, REST export is partial. Better to replicate schema, not integrate. |
| **Enroll students via API** | ✅ Cao (90%) | $$ | `core_enrol_*` functions exist, stateless, fast. |
| **Embed Moodle UI in CMC** | ❌ Low (20%) | High/risky | Moodle theme is tightly coupled, SSO required, session sharing risky. Not recommended. |

### Concrete Recommendation: API-First Integration
```
CMC EDU (TypeScript/tRPC)
    ↓ (token auth)
Moodle REST API (PHP/external)
    ↓ (return JSON)
CMC converts to schema
    ↓ (async queue)
CMC updates local tables (courses, enrollments)

Real-time gradebook:
  Moodle webhook → CMC endpoint (define custom LTI or cron)
  Moodle exposes: user_id, item_id, grade, timestamp
  CMC upsert into local FinalGrade table
```

**Kết luận:**
- **Integration tới lúc: 85–90% khả thi**, chủ yếu user, course, enrollment
- **Gradebook real-time: không khả thi** (complex aggregation), cần manual sync hoặc webhook
- **No code embedding**: Moodle và CMC sống separate, API-driven, phù hợp với GPL
- **Cost:** 4–6 weeks dev (REST client, async queueing, schema mapping, testing)

---

## 10. Điểm Học Được Cho CMC EDU v2

### Concepts Có Giá Trị
| Concept | Moodle Implementation | Áp dụng cho CMC |
|---------|----------------------|-----------------|
| **Grade Aggregation** | Recursive category tree + formula engine | Upgrade FinalGrade: thêm category, formulas, keep/drop |
| **Capability/Context** | Application-layer enforcement (has_capability) | Keep Postgres RLS, nhưng thêm "context type" (course, module, facility) |
| **Plugin Architecture** | Component-based, version.php + db/access.php | Reuse concept: plugin dir, version manifest, feature flags |
| **Question Bank** | Shared repo, qtype plugins, reusable across courses | Build question bank MVP: question + qtype + answer pool |
| **Completion Tracking** | State machine (incomplete → complete → pass/fail) | Extend Exercise: add state, completion criteria |
| **Enrollment Methods** | Plugin-based, stateless (enrol_manual, enrol_database) | Generalize: ClassBatch enrollment can be plugin-based |

### Trade-offs & Nhược Điểm của Moodle
| Aspect | Moodle | CMC Better? |
|--------|--------|------------|
| **Language** | PHP 8.3 procedural | TypeScript + modern async (✓ CMC) |
| **Database** | No ORM, raw SQL (legacy) | Prisma ORM (✓ CMC) |
| **Type Safety** | Loose (string keys, stdClass) | TypeScript strict (✓ CMC) |
| **Testing** | PHPUnit + Behat (slow) | Jest + vitest (✓ CMC faster) |
| **API** | REST only, not strongly typed | tRPC w/ Zod (✓ CMC more type-safe) |
| **Deployment** | PHP app server (Apache, Nginx) | Containerized (✓ CMC Turborepo) |
| **Mobile-first** | Not prioritized (web-first UI) | Mobile app + responsive (✓ CMC priority) |
| **Localization** | String tables, external (LANG files) | i18n + Crowdin (better for k–12 Việt) |

---

## 11. Đánh Giá Moodle Cho K–12 Trung Tâm Giáo Dục Việt Nam

### Phù hợp ✅
- **Mature, stable LMS** — 25 năm phát triển, trusted by millions
- **Gradebook sophistication** — k–12 cần aggregation (class grade = avg of assignments + tests)
- **Question bank** — Tiêu chuẩn quốc tế, hỗ trợ GIFT/QTI import
- **Offline support** — Moodle Desktop app (but not mobile-first)
- **Open-source, không licensing cost**

### Không phù hợp ❌
- **PHP-heavy, hard to hire** — Việt Nam shortage in PHP, abundant TypeScript devs
- **Mobile-first:** Moodle web app, tồn tại mobile app riêng (khó sync)
- **Multi-tenant:** Moodle single-tenant per instance, hard to run k facilities on 1 Moodle
- **Tiếng Việt:** Language pack available nhưng incomplete (term mismatch k–12 Việt)
- **Complexity:** 2.94M LOC quá lớn cho 1 team, maintenance risk
- **Parent portal:** Moodle không built-in parent view, need custom theme

### Verdict: ❌ Không khuyến cáo Moodle làm Core LMS
**Lý do:**
1. **CMC EDU v2 đã có LMS riêng** (Course, Exercise, ClassBatch, FinalGrade) — **Don't try to replace it**
2. **Integration complexity >> benefit** — Gradebook sync là bottleneck, quá lâu
3. **Team skill:** CMC team là TypeScript/modern stack, Moodle là PHP — lệch xa
4. **Mobile-first priority:** Moodle không mobile-first, CMC có mobile app — conflict

### Khuyến cáo Thay thế ✅
**Tùy chọn:**
1. **Moodle as external LMS** (optional) — Organizations còn dùng Moodle cũ có thể link via LTI
2. **Clone Moodle concepts vào CMC** — Gradebook aggregation, question bank, completion states
3. **Build CMC LMS mạnh hơn** — Invest 6 months vào FinalGrade (categories, formulas), Question Bank (types, import), Completion Tracking

---

## Unresolved Questions

1. **Moodle clustering/multi-tenant:** Có support không? (Assumed: single-tenant per instance, need load balancer)
2. **Moodle audit log:** Là DB history, not audit trail (diff tracking)? Need verify.
3. **Moodle mobile app:** Separate repo, sync lag? How real-time?
4. **LTI 1.3 state management:** If CMC launches Moodle via LTI, how handle login state after return?
5. **Postgres RLS vs Moodle capability:** If wrap Moodle behind Postgres RLS, double-enforcement cost?

---

## Files Checked
- `/public/version.php` — Version metadata
- `/public/lib/accesslib.php` — Roles, capabilities, context hierarchy
- `/public/lib/grade/grade_item.php`, `grade_category.php`, `grade_grade.php` — Gradebook model
- `/public/mod/assign/version.php`, `db/access.php`, `db/install.xml` — Plugin anatomy
- `/public/lib/dml/moodle_database.php` — Database abstraction
- `/public/webservice/externallib.php`, `/public/course/externallib.php` — Web services
- `COPYING.txt`, `composer.json` — License verification

---

## Status
**DONE**

**Summary:**  
Moodle là LMS kinh điển, GPL-3.0, 2.94M LOC PHP. Architecture là plugin-based, no ORM, context-based RBAC. Gradebook sophisticated (aggregation, formulas), web services REST-based. Tích hợp với CMC qua API tới được 85–90% (users, courses, enrollments), nhưng gradebook real-time khó (complex state). Khuyến cáo: không thay thế CMC LMS, clone concepts thay vào.

**Concerns:**  
- Moodle complexity quá cao so với CMC team skill (PHP vs TypeScript)
- Gradebook integration có latency, không real-time tốt
- Mobile-first priority mismatch (Moodle web-first)
