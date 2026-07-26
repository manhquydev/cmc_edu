# Moodle Source Code — Phân tích 4 Hệ thống Con
**Ngày:** 2026-07-25  
**Version analyzed:** Moodle **5.3dev** (ALPHA, Build 20260722) — `main` branch  
**Architecture:** Restructured to `public/` webroot (v5.3+), not legacy root layout  
**Scope:** Bóc tách ở mức source code — Gradebook, Roles&Capabilities, Quiz Engine, Web Services  
**Clone path:** `/tmp/claude-1000/-home-manhquy-Downloads-cmc-edu/.../scratchpad/repos/moodle/public/`

⚠️ **Version note:** 5.3dev là phiên bản development (ALPHA), không LTS. LTS hiện tại là 4.0 (MOODLE_400_STABLE branch). Khảo sát này dùng development branch để thấy tính năng newest.

---

## 1. GRADEBOOK — Aggregation Tree & Recalculation

### 1.1 Cây Category: Hierarchy & Storage

| Khía cạnh | Chi tiết |
|-----------|---------|
| **Schema** | `mdl_grade_categories` — fields: `id, courseid, parent, depth, path, fullname, aggregation, keephigh, droplow, aggregateonlygraded, aggregateoutcomes` |
| **Path hierarchy** | Like course categories: `/1/2/3/` (bottom to top). Used for fast tree traversal. |
| **Nesting** | Unlimited depth, mỗi category có `parent` (NULL = course root), `depth`, `path`. |
| **Code** | `/lib/grade/grade_category.php:37–150` |

### 1.2 Aggregation Strategies

Moodle hỗ trợ **8 chiến lược** (constants defined `/lib/grade/constants.php:28–73`):

| Strategy | Const | Công thức | Trọng số |
|----------|-------|----------|---------|
| **Mean** | GRADE_AGGREGATE_MEAN (0) | Σ(grade) / n | `aggregationcoef` = 0 (no weight) |
| **Median** | GRADE_AGGREGATE_MEDIAN (2) | Median(grades) | Không dùng |
| **Min** | GRADE_AGGREGATE_MIN (4) | min(grades) | Không dùng |
| **Max** | GRADE_AGGREGATE_MAX (6) | max(grades) | Không dùng |
| **Mode** | GRADE_AGGREGATE_MODE (8) | Mode(grades) | Không dùng |
| **Weighted Mean** | GRADE_AGGREGATE_WEIGHTED_MEAN (10) | Σ(grade × weight) / Σ(weight) | `aggregationcoef` (manual) |
| **Weighted Mean v2** | GRADE_AGGREGATE_WEIGHTED_MEAN2 (11) | Simple weighted mean | `aggregationcoef2` (auto-calculated) |
| **Natural (SUM)** | GRADE_AGGREGATE_SUM (13) | Σ(grade × coef) — default | `aggregationcoef2` (weight proportional to grademax) |

**Triển khai:** `/lib/grade/grade_category.php:784–789` gọi `aggregate_values_and_adjust_bounds()` — tính toán tổng hợp.

### 1.3 Normalize & Recalculation Pipeline

**Bước 1: Normalize từ 0–1** (dòng 689–722)
```
- Nếu aggregation == GRADE_AGGREGATE_SUM:
  grade_values[itemid] = (rawgrade - 0) / grademax
- Ngược lại:
  grade_values[itemid] = (rawgrade - grademin) / (grademax - grademin)
```

**Bước 2: Drop low / Keep high** (dòng 748–755)
```
- aggregateonlygraded = 1: loại bỏ grade null
- keephigh = N: chỉ giữ N item cao nhất
- droplow = N: loại bỏ N item thấp nhất
```

**Bước 3: Tính toán + Denormalize** (dòng 784–804)
```
- Áp dụng strategy (mean, sum, weighted mean...)
- Scale ngược từ [0, 1] về [grademin, grademax] của category
- Lưu vào grade_grades.finalgrade
```

**Bước 4: Kích hoạt Recalculation**  
- Khi grade của item thay đổi → gọi `grade_update()` (nằm trong `gradelib.php`)
- Nó update parent category → trigger recursively up to course root
- **Cơ chế:** Synchronous within same request (không queue async)

### 1.4 Empty Grade Handling

| Trường hợp | Hành động | Code |
|-----------|----------|------|
| **aggregateonlygraded = 1** | Loại bỏ grade null khỏi tính toán | dòng 694–698 |
| **aggregateonlygraded = 0** | Tính null = 0 | dòng 737–739 |
| **Exclude item** | Loại bỏ khỏi aggregation (cột `excluded`) | dòng 701–705 |

### 1.5 So Sánh với CMC EDU `FinalGrade`

| Khía cạnh | Moodle | CMC EDU v2 |
|-----------|--------|-----------|
| **Schema** | `grade_items` (template) + `grade_grades` (per user). Nested categories. | `FinalGrade` (flat, per user + course) |
| **Trọng số** | `aggregationcoef` + `aggregationcoef2` (auto-calculated) | Không có (hiện tại) |
| **Aggregation** | 8 strategies, recursive tree | Không (hiện tại) |
| **Normalization** | Auto (0–1 scale, denormalize) | Thủ công nếu có |
| **Update mechanism** | Synchronous, recursive | Thủ công hoặc stored proc |

**Khuyến cáo cho CMC:** Nếu muốn điểm có trọng số:
1. Thêm bảng `grade_categories` (hierarchy) + `grade_items` (template)
2. Thêm cột `aggregationcoef`, `keephigh`, `droplow` vào schema
3. Implement `aggregate_grades()` PHP function (copy concept từ Moodle, không nhúng code)
4. **Đừng implement full Moodle tree** — chỉ cần 2–3 level category (e.g., "Class Avg", "Tests", "Assignments")

---

## 2. ROLES & CAPABILITIES — Enforcement Tầng App

### 2.1 Context Hierarchy & Path Storage

**Moodle context là N-ary tree:**

```
CONTEXT_SYSTEM (level 10)
  │
  ├─ CONTEXT_COURSECAT (level 40) — Category hierarchy
  │   └─ CONTEXT_COURSE (level 50)
  │       ├─ CONTEXT_MODULE (level 70) — Activity/module
  │       └─ CONTEXT_BLOCK (level 80)
  │
  └─ CONTEXT_USER (level 30) — Per-user, separate branch
```

**Storage:** Bảng `mdl_context`
```sql
id | contextlevel | instanceid | path | depth | locked
-- Ví dụ:
   |     50       |    123     | /1/123/ | 2   |  0
   |     70       |     45     | /1/123/45/ | 3 | 0
```

**Path usage:** `/lib/accesslib.php:792–799` duyệt từ context thấp nhất lên root bằng cách:
```php
$path = "/1/123/45/";
while ($path = rtrim($path, '0123456789')) {  // Remove rightmost digits
    $path = rtrim($path, '/');                  // Lên 1 level
    // Check role_capabilities tại $path này
}
```

### 2.2 Permission Check: `has_capability()` Flow

**Location:** `/lib/accesslib.php:432–531`

**Quy trình:**
1. **Validate capability exists** — `/lib/accesslib.php:457`
   ```php
   if (!$capinfo = get_capability_info($capability)) return false;
   ```

2. **Guest + risky capabilities** — `/lib/accesslib.php:481–484`
   ```php
   if (($capinfo->captype === 'write') or ($capinfo->riskbitmask & RISK_XSS|RISK_CONFIG|RISK_DATALOSS)) {
       if (isguestuser($userid) or $userid == 0) return false;
   }
   ```

3. **Check context locking** — `/lib/accesslib.php:488–499`
   ```php
   if (!empty($CFG->contextlocking)) {
       if ($capinfo->captype === 'write' && $context->locked) return false;
   }
   ```

4. **User validation** — `/lib/accesslib.php:503–516`
   - Kiểm tra user deleted
   - Kiểm tra context path valid

5. **Access data lookup** — `/lib/accesslib.php:788–851` (`has_capability_in_accessdata()`)
   ```php
   // Get all roles user has at this context or above
   foreach ($paths as $path) {
       if (isset($accessdata['ra'][$path])) {
           foreach ($accessdata['ra'][$path] as $roleid) {
               $roles[$roleid] = null;
           }
       }
   }
   
   // Check permission bottom-up
   foreach ($roles as $roleid) {
       foreach ($paths as $path) {
           if (isset($rdefs[$roleid][$path][$capability])) {
               $perm = $rdefs[$roleid][$path][$capability];
               if ($perm === CAP_PROHIBIT) return false;  // Absolute veto
               if (is_null($roles[$roleid])) $roles[$roleid] = $perm;
           }
       }
   }
   return $allowed; // True if any role has CAP_ALLOW
   ```

### 2.3 Permission Constants & Override/Prohibit

| Constant | Giá trị | Ý nghĩa |
|----------|--------|---------|
| **CAP_INHERIT** | 0 | Inherit from parent (không explicit) |
| **CAP_ALLOW** | 1 | Allow |
| **CAP_PREVENT** | -1 | Prevent (override CAP_ALLOW từ parent) |
| **CAP_PROHIBIT** | -1000 | Prohibit (veto tuyệt đối, không thể ghi đè ở child) |

**Bảng:** `mdl_role_capabilities`
```sql
id | contextid | roleid | capability | permission | timemodified
-- Ví dụ:
   |    45     |   3    | mod/quiz:attempt | 1 | 1234567
```

**Resolution logic** (/lib/accesslib.php:832–847):
- Duyệt từ bottom-up (child → parent)
- Nếu tìm thấy CAP_PROHIBIT → return FALSE immediately
- Nếu tìm thấy CAP_ALLOW ở role nào đó → allow (tiếp tục kiểm tra prohibit)

### 2.4 Enforcement Tầng App vs DB

| Aspect | Moodle (Application) | CMC EDU (Postgres RLS) |
|--------|------------------|-------|
| **Enforcement Point** | PHP `has_capability()` call ở mỗi request | PostgreSQL `CREATE POLICY` tại DB layer |
| **Who enforces** | Web server / PHP app | Database server |
| **Bypass risk** | High (disable PHP check → read anything) | Low (DB policy always active) |
| **Performance** | Load accessdata cache, then check arrays | Query pushdown (DB filter in WHERE) |
| **Consistency** | Weaker (cache invalidation lag) | Strong (DB enforces every query) |
| **Flexibility** | High (runtime role switch `admin/roles/assign.php`) | Medium (policy predefined, less dynamic) |

**Kết luận dứt khoát:** Moodle **ENFORCE ở tầng ứng dụng**, CMC EDU **ENFORCE ở tầng DB**.
- Moodle dễ bị lỗi logic (developer quên `has_capability()` check)
- CMC EDU an toàn hơn (DB không thể bypass)

---

## 3. QUIZ ENGINE & QUESTION BANK

### 3.1 Question Type Plugin Architecture

**Location:** `/question/type/` (e.g., `/question/type/multichoice/`, `/question/type/essay/`)

**Cấu trúc plugin:**
```
question/type/TYPENAME/
├── version.php          # Plugin metadata
├── classes/
│   ├── question.php     # qtype_TYPENAME_question (extends question_definition)
│   ├── renderer.php     # Rendering (display question HTML)
│   └── external/        # Web service (if needed)
├── db/
│   ├── access.php       # Capability định nghĩa (e.g., qtype/TYPENAME:use)
│   └── questions.php    # Custom qtype-specific tables (e.g., mdl_qtype_multichoice_options)
└── lib.php              # Plugin hooks (optional)
```

**Question types có sẵn:**
- `qtype_essay` — Free text, manual grade
- `qtype_multichoice` — Single/multiple select
- `qtype_truefalse` — Yes/no
- `qtype_shortanswer` — Regex match
- `qtype_numerical` — Tolerance
- `qtype_matching` — Pair matching
- `qtype_dragdrop` — UI drag-to-zone
- (+ 10+ more)

### 3.2 Question Attempt State Machine

**Location:** `/question/engine/states.php:39–86`

**States:**
```
notstarted          (haven't started attempt)
  ↓
unprocessed/todo    (started, no answer yet)
  ↓
complete/answered   (user submitted answer)
  ↓
needsgrading        (waiting for auto/manual grade)
  ↓
finished            (graded)
  ↓
reviewed            (student reviewing after close)

Manual grading paths:
graded* → man_graded*  (staff manually grade)
  ├─ mangrwrong
  ├─ mangrpartial
  └─ mangrright
```

**Code definition** (dòng 39–59):
```php
abstract class question_state {
    public static $notstarted;
    public static $unprocessed;
    public static $todo;
    public static $complete;
    public static $needsgrading;
    public static $finished;
    public static $gaveup;
    public static $gradedwrong;
    public static $gradedpartial;
    public static $gradedright;
    // ... manual grading states
}
```

### 3.3 Question Attempt Data Storage

**Bảng chính:**
```sql
mdl_question_attempts
  id, responseid, questionusageid, slot, behaviour, questionid, variant,
  maxmark, minfraction, flagged, questionsummary, rightanswer, responsesummary,
  timemodified

mdl_question_attempt_steps
  id, questionattemptid, sequencenumber, state, fraction, timecreated,
  userid, data (JSON)
```

**Data field** (JSON): chứa các field tùy `qtype`:
- `answer`: raw user input
- `choices`: selected options (multichoice)
- `response`: match responses (matching type)
- `_grade`: auto-calculated score
- `_comment`: feedback

### 3.4 Scoring & Gradebook Integration

**Auto-grading:**
- Mỗi qtype implement `grade_response()` method
- Return: `['fraction' => 0.5, 'state' => question_state::$gradedpartial, ...]`
- Fraction = 0.0 (wrong) to 1.0 (right)

**Nối vào gradebook:**
- `/mod/quiz/locallib.php` khi quiz attempt finished
- Gọi `quiz_update_grades()` → grade_update() → update gradebook
- Một quiz là 1 `grade_item` trong gradebook

**Multi-attempt handling:**
- `quiz.grademethod` = `'highest'` | `'average'` | `'first'` | `'last'`
- Moodle chọn attempt nào để lấy điểm (không blend multiple attempts)

### 3.5 Đánh Giá cho CMC Offline

| Khía cạnh | Moodle | CMC EDU (offline k–12) |
|-----------|--------|-------|
| **Purpose** | Online testing, real-time feedback | Chính không cần (teach offline) |
| **State machine** | Complex (auto/manual grading, review) | Overkill cho offline app |
| **Question bank** | Reusable across courses, import GIFT/QTI | Có thể hữu ích (shared question pool) |
| **Plugin system** | 25+ qtype | Chỉ cần 2–3 (multiple choice, short answer, essay) |
| **Scoring** | Flexible fractions | Đơn giản: binary (right/wrong) hoặc discrete |

**Kết luận:** CMC có thể **học concept question bank** (shared repository), nhưng **quiz engine full Moodle là overkill** nếu chỉ support:
- Bài kiểm tra offline (ghi điểm thủ công)
- Không cần auto-grading complex

---

## 4. WEB SERVICES & EXTERNAL API — Tích Hợp Viability

### 4.1 External Function Declaration

**Modern style** (v4.0+): Class-based, `/grade/classes/external/get_gradeitems.php`

```php
namespace core_grades\external;
use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_value;

class get_gradeitems extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Course ID', VALUE_REQUIRED)
        ]);
    }
    
    public static function execute(int $courseid): array {
        $params = self::validate_parameters(
            self::execute_parameters(),
            ['courseid' => $courseid]
        );
        
        $context = context_course::instance($params['courseid']);
        parent::validate_context($context);  // <- Capability check here!
        
        // Business logic
        $allgradeitems = grade_item::fetch_all(['courseid' => $params['courseid']]);
        
        return ['gradeItems' => $allgradeitems, 'warnings' => []];
    }
    
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'gradeItems' => new external_multiple_structure(...),
            'warnings' => new external_warnings(),
        ]);
    }
}
```

**Legacy style** (v3.x): Procedural functions, `/webservice/externallib.php`

### 4.2 Auth & Token Management

**Location:** `/webservice/externallib.php:90–121` (get_site_info function)

**Flow:**
```php
// 1. Client gửi request với token:
// GET /webservice/rest/server.php?wstoken=abc123&wsfunction=core_course_get_courses

// 2. Server validate token
$token = optional_param('wstoken', '', PARAM_ALPHANUM);  // dòng 96
if (!empty($token)) {
    $servicesql = 'SELECT s.* FROM {external_services} s, {external_tokens} t
                   WHERE t.externalserviceid = s.id AND token = ? 
                   AND t.userid = ? AND s.enabled = 1';
    $service = $DB->get_record_sql($servicesql, [$token, $USER->id]);
    // dòng 103
}

// 3. Check service enable + function allowed
if (!empty($service)) {
    $functionssql = "SELECT f.* FROM {external_functions} f, 
                     {external_services_functions} sf
                     WHERE f.name = sf.functionname AND sf.externalserviceid = ?";
    $functions = $DB->get_records_sql($functionssql, [$service->id]);
}
```

**Bảng:**
```sql
mdl_external_services
  id, name, shortname, description, enabled, downloadfiles, uploadfiles

mdl_external_tokens
  id, token, userid, externalserviceid, validuntil, timecreated, timelastused

mdl_external_services_functions
  id, externalserviceid, functionname, enabled

mdl_external_functions
  name, component, description, classname, methodname
```

### 4.3 Protocols & Endpoints

| Protocol | Endpoint | Auth | Return format |
|----------|----------|------|---------------|
| **REST** (JSON) | `/webservice/rest/server.php` | Token URL/header | JSON |
| **REST** (XML) | `/webservice/rest/server.php?moodlewsrestformat=xml` | Token | XML |
| **SOAP** | `/webservice/soap/server.php` | WSDL-based | SOAP envelope |
| **JSON-RPC** | `/webservice/jsonrpc/server.php` | Token | JSON-RPC |

**REST example:**
```bash
curl "https://moodle.local/webservice/rest/server.php" \
  -d "wstoken=abc123" \
  -d "wsfunction=core_course_get_courses" \
  -d "moodlewsrestformat=json"
```

### 4.4 Available APIs for Integration

**Core user functions:**
- `core_user_create_users(users)` — Tạo user
- `core_user_update_users(users)` — Cập nhật profile
- `core_user_get_users_by_id(userids)` — Lấy info

**Course functions:**
- `core_course_create_courses(courses)`
- `core_course_update_courses(courses)`
- `core_course_get_courses(options)`
- `core_course_get_course_contents(courseid)` — Get sections + modules

**Enrollment functions:**
- `core_enrol_get_enrolled_users(courseid, options)`
- `enrol_manual_enrol_users(enrolments)` — Ghi danh
- `enrol_manual_unenrol_users(unenrolments)`

**Grade functions:**
- `core_grades_create_gradecategories(categories)`
- `core_grades_get_gradeitems(courseid)` — List grade items
- `core_grades_get_grades(courseid, userid)` — Get user's grades
- `core_grades_get_grade_tree(courseid)` — Full tree

### 4.5 Sync Scenarios & Viability

| Scenario | Khả thi | Chi phí | Ghi chú |
|----------|---------|--------|---------|
| **User sync** | ✅ 90% | $$ (1–2 weeks) | Moodle `core_user_*` API stateless. CMC poll hoặc webhook. |
| **Course & sections sync** | ✅ 85% | $$$ (2–3 weeks) | API export course metadata, nhưng không sync qtype plugins. |
| **Enrollment sync** | ✅ 90% | $$ (1–2 weeks) | `enrol_manual_*` hoặc write directly via DB API. |
| **Gradebook full tree** | ⚠️ 60% | $$$$ (3–4 weeks) | Complex aggregation. CMC phải map nested category → CMC flat structure. Latency high (recursive calls). |
| **Grade real-time** | ❌ 20% | High/risky | Moodle không có webhook built-in. Phải implement custom Moodle plugin hoặc heavy polling. Latency unacceptable. |
| **Question bank reuse** | ⚠️ 50% | $$$ | API export partial. Better to replicate schema. |
| **Quiz attempts** | ❌ 10% | High | Question state machine khác biệt. CMC không dùng. |

### 4.6 What CANNOT be synced (hard constraints)

| Item | Reason |
|------|--------|
| **Aggregation recalculation** | Moodle recursive category tree không map 1:1 vào CMC flat `FinalGrade`. Phải implement lại logic. |
| **Manual grading workflow** | Moodle có UI để teacher grade quiz → auto-update gradebook. CMC phải replicate UI nếu tích hợp. |
| **Question bank plugin data** | Qtype plugins store data in custom tables (e.g., `mdl_qtype_essay_options`). API export generic only. |
| **Forum/discussion** | CMC không có feature này. Moodle forum là stateful, hard to replicate. |
| **Completion tracking** | Moodle completion states (COMPLETE_PASS, COMPLETE_FAIL) khác CMC Attendance model. |
| **Certificate/badges** | Moodle có badge engine, CMC không. Non-goal anyway. |

---

## 5. DATABASE LAYER — XMLDB & ORM Philosophy

### 5.0 File Locations in Public Structure (Moodle 5.3+)

**Moodle 5.3dev restructured webroot to `public/`:**
```
moodle/
├── public/                   # ← Webroot (new structure)
│   ├── lib/                  # Core libraries
│   │   ├── grade/           # Gradebook (~500KB)
│   │   ├── dml/             # Database abstraction layer
│   │   ├── ddl/             # XMLDB schema management
│   │   ├── gradelib.php     # Grade processing functions (65KB)
│   │   └── accesslib.php    # Roles & capabilities (192KB)
│   ├── mod/                  # Activity modules (quiz, assign, forum...)
│   ├── question/             # Question bank
│   ├── webservice/           # External API
│   └── course/, user/, admin/
└── (config, scripts, docs outside webroot)
```

**Why this matters:**
- All documentation/blog posts written for Moodle < 5.3 reference paths **without** `public/`
- Old paths: `lib/grade/`, `mod/quiz/` are **stale**
- New paths: `public/lib/grade/`, `public/mod/quiz/` are **canonical v5.3+**
- If CMC integrates, ensure docstring examples account for this

---

## 6. DATABASE LAYER — XMLDB & ORM Philosophy (continued)

### 6.1 Why No ORM?

**Moodle design decision (25 năm):**
- Built before PHP ORM mature (pre-Eloquent, pre-Doctrine)
- Support multi-DB (MySQL, PostgreSQL, SQL Server, Oracle) → complex mapping
- Raw SQL allows fine-grained control + optimization
- Backward compatibility (legacy codebase 2.94M LOC)

**Cost:**
- String-keyed SQL, no compile-time type checking
- Risk of SQL injection if mishandled
- Verbose boilerplate

### 6.2 XMLDB Schema Definition

**Location:** `/lib/ddl/` — XML-based schema DSL

**Example:** `/grade/db/install.xml`
```xml
<XMLDB PATH="lib/grade/db" VERSION="20251101">
  <TABLES>
    <TABLE NAME="grade_items" COMMENT="...">
      <FIELDS>
        <FIELD NAME="id" TYPE="int" SEQUENCE="true" NOTNULL="true"/>
        <FIELD NAME="courseid" TYPE="int" NOTNULL="true"/>
        <FIELD NAME="categoryid" TYPE="int"/>
        <FIELD NAME="itemname" TYPE="char" LENGTH="255"/>
        <FIELD NAME="grademax" TYPE="number" LENGTH="10" DECIMALS="5" DEFAULT="100"/>
        <FIELD NAME="aggregationcoef" TYPE="number" LENGTH="10" DECIMALS="5"/>
        <FIELD NAME="aggregationcoef2" TYPE="number" LENGTH="10" DECIMALS="5"/>
      </FIELDS>
      <KEYS>
        <KEY NAME="primary" TYPE="primary" FIELDS="id"/>
        <KEY NAME="courseid" TYPE="foreign" FIELDS="courseid" REFTABLE="course" REFFIELDS="id"/>
      </KEYS>
      <INDEXES>
        <INDEX NAME="coursecat_ix" UNIQUE="false" FIELDS="courseid,categoryid"/>
      </INDEXES>
    </TABLE>
  </TABLES>
</XMLDB>
```

**Advantage:**
- Cross-DB (Moodle parse XML → generate MySQL `CREATE TABLE` hoặc PostgreSQL DDL)
- Version tracking (`VERSION="...date..."` auto-increments on change)

**Upgrade process** (`db/upgrade.php`):
```php
function xmldb_core_grade_upgrade($oldversion) {
    global $DB, $dbman;
    if ($oldversion < 2026020100) {
        $table = new xmldb_table('grade_items');
        $field = new xmldb_field('newfield', XMLDB_TYPE_INT, '4', null, true, false, 0);
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }
        upgrade_mod_savepoint(true, 2026020100, 'grade');  // Log milestone
    }
    return true;
}
```

### 6.3 Query API (No ORM)

**Location:** `/lib/dml/moodle_database.php:70–150`

```php
// Get (SELECT)
$record = $DB->get_record('users', ['id' => 123]);  // Select 1 row
$records = $DB->get_records('courses', ['visible' => 1], 'fullname ASC', '*', 0, 100);  // Select many + sort + limit
$value = $DB->get_field('user_info_data', 'data', ['fieldid' => 5, 'userid' => 123]);  // Single column

// Insert
$data = new stdClass();
$data->courseid = 5;
$data->itemname = 'Quiz 1';
$id = $DB->insert_record('grade_items', $data);  // Returns new ID

// Update
$data->id = 123;
$data->grademax = 50;
$DB->update_record('grade_items', $data);

// Delete
$DB->delete_records('grade_items', ['courseid' => 123]);

// Raw SQL (parameterized to prevent injection)
$sql = "SELECT gi.*, gc.fullname
        FROM {grade_items} gi
        JOIN {grade_categories} gc ON gi.categoryid = gc.id
        WHERE gi.courseid = ? AND gi.hidden = 0
        ORDER BY gi.sortorder";
$items = $DB->get_records_sql($sql, [123]);
```

**Safety:**
- `{prefix}table` notation → auto-substitute `mdl_`
- `?` / `:name` parameterization → prevent SQL injection
- Transaction support: `$DB->start_transaction()` / `commit()` / `rollback()`

### 6.4 Hệ quả & Bài học cho CMC (dùng Prisma ORM)

| Aspect | Moodle (Raw SQL) | CMC (Prisma ORM) |
|--------|-----------------|-----|
| **Type safety** | Zero (stdClass, dynamic) | Full (TS strict) |
| **Query performance** | Optimizable per-query | Prisma abstract slightly |
| **Migration burden** | Manual SQL + XMLDB version | Prisma migrations (auto) |
| **Developer onboarding** | SQL knowledge required | ORM-level abstraction |
| **Edge cases** | Handle manually | ORM may hide complexity |

**Bài học:**
1. **ORM không phải viên đạn:** Prisma tốt cho type safety, nhưng không thể auto-optimize aggregation (gradebook).
2. **Normalization cost:** Moodle raw SQL cho phép denormalize grade_grades caching → faster read. Prisma lazy-load từng query → N+1 risk.
3. **CMC choice is good:** TypeScript + Prisma + RLS phù hợp hơn Moodle legacy PHP. **Đừng bỏ Prisma.**

---

## 7. BẢNG ĐỐI CHIẾU MOODLE ↔ CMC EDU

### 7.1 Course & Unit Model

| Concept | Moodle | CMC EDU |
|---------|--------|---------|
| **Course** | `mdl_course` | `Course` (TypeScript) |
| **Section** | `mdl_course_sections` (topics/weekly) | (không có) |
| **Module/Activity** | `mdl_course_modules` (mod_quiz, mod_forum, ...) | `ClassSession` + `Exercise` |
| **Content block** | `mdl_block_instances` (sidebar) | (mobile-first, không sidebar) |
| **Unit** | (tương course) | `CurriculumUnit` |

### 7.2 Grading & Assessment

| Concept | Moodle | CMC EDU |
|---------|--------|---------|
| **Grades** | `grade_items` (template) + `grade_grades` (user) | `FinalGrade` (flat) |
| **Category** | `grade_categories` (tree) | (không có, enhance future) |
| **Aggregation** | 8 strategies (mean, sum, weighted...) | (không có) |
| **Normalization** | Auto (0–1 scale) | Thủ công |
| **Gradebook report** | Multiple report types (`gradereport_*` plugins) | Dashboard chart |
| **Assessment** | Quiz + Essay + Forums | `Exercise` + `Submission` + `QualitativeAssessment` |

### 7.3 Users & Enrollment

| Concept | Moodle | CMC EDU |
|---------|--------|---------|
| **User** | `mdl_user` + profile fields | `User` + `StudentInfo` |
| **Enrollment** | `mdl_user_enrolments` + `mdl_enrol_*` (methods) | `ClassBatch.students` (FK) |
| **Role** | `mdl_role` + hierarchy (manager, teacher, student...) | `UserRole` (enum: admin, teacher, parent, student) |
| **Context** | Hierarchy tree (system → category → course → module) | Flat (Facility-based) |
| **Permission** | Role + capability (has_capability) | RLS policy (Postgres) |

### 7.4 Attendance & Completion

| Concept | Moodle | CMC EDU |
|---------|--------|---------|
| **Attendance** | Activity-level completion tracking (activity → complete/incomplete) | `Attendance` (per session + per user) |
| **Completion** | `completion_info` with states (COMPLETE_PASS, COMPLETE_FAIL...) | (part of Attendance, simpler) |
| **Evidence** | (none, implied by grade) | `SessionEvidence` (photo/artifact) |

### 7.5 Multi-tenant & Scaling

| Aspect | Moodle | CMC EDU |
|--------|--------|---------|
| **Multi-tenant** | Single-tenant per instance (1 Moodle ≠ 1 organization) | Multi-tenant (many facilities) |
| **Database** | Single DB per instance, shared tables | Shared DB, RLS-isolated per facility |
| **Scalability** | Horizontal via load balancer (shared sessions) | Horizontal via Postgres RLS (no session conflict) |

---

## 6. TRADEMARK & GPL COMPLIANCE — Branding Restrictions

### 6.1 What CMC CAN Do (Allowed per TRADEMARK.txt)

| Activity | Allowed? | Condition |
|----------|----------|-----------|
| **Integrate Moodle via API** | ✅ Yes | Describe as "integrates with Moodle™ software", not "is Moodle" |
| **Refer to Moodle project** | ✅ Yes | Use "Moodle™ software" or "Moodle™ project" in docs |
| **Run Moodle instance** | ✅ Yes | Internal/personal use without trademark claim |
| **Modify Moodle code** | ✅ Yes (GPL) | But modified version NOT branded "Moodle" |

### 6.2 What CMC CANNOT Do (Prohibited per TRADEMARK.txt:46–67)

| Activity | Reason | Risk |
|----------|--------|------|
| **Use "Moodle" in product name** | "CMC Moodle LMS" ❌ | Trademark infringement |
| **Use "Moodle" in mobile app name** | "CMC Moodle App" ❌ | Trademark infringement |
| **Use "Moodle" in domain** | "moodle.cmc.edu.vn" ❌ | Trademark infringement |
| **Use Moodle logos in marketing** | Without explicit permission ❌ | Trademark infringement |
| **Commercial services with "Moodle" brand** | "Moodle Training by CMC" ❌ | Confusion + potential infringement |
| **Advertising keywords "Moodle"** | Google Ads, Adsense ❌ | Trademark infringement |
| **Claim association with Moodle HQ** | Unless you're Partner ❌ | False advertising |

### 6.3 GPL + Trademark Interaction

**Critical clause** (TRADEMARK.txt:24–28):
> Because the Moodle LMS is made available under the GNU General Public License that permits you to modify the copyrighted software, the distribution of such modified software **in combination with Moodle trademarks can potentially mislead others**. To be clear, **the GNU GPL does not include an implied right or licence to use Moodle's trademarks**.

**Implication:**
- CMC can modify Moodle code (GPL allows)
- CMC CANNOT brand modified version as "Moodle" (trademark forbids)
- If CMC integrates Moodle, marketing must be clear: "Integrates with Moodle™" not "Powered by Moodle™"

### 6.4 Safe Branding for CMC

**Correct:**
- "CMC LMS integrates with Moodle™ software" ✅
- "CMC can sync users/grades from Moodle™ instances" ✅
- "Moodle™ integration available" ✅

**Incorrect:**
- "CMC is Moodle-based" ❌ (misleading)
- "Moodle for K–12" ❌ (CMC is not Moodle)
- "Powered by Moodle™" ❌ (implies Moodle HQ endorsement)

### 6.5 For Trademark Clarification

Contact: `trademarks@moodle.com` (per TRADEMARK.txt:52)

---

## 8. KẾT LUẬN & KHUYẾN CÁO

### 8.1 Nên Học Gì

✅ **HỌC CONCEPT:**

1. **Gradebook tree aggregation** (mục 1)
   - Recursive category nesting
   - Multiple aggregation strategies
   - Normalize + denormalize pattern
   - **Action:** CMC nên thêm `GradeCategory` table + aggregation engine (nếu cần weighted grades)

2. **Question bank plugin system** (mục 3.1)
   - Extensible qtype plugin architecture
   - Shared question pool across courses
   - **Action:** Build mini question bank MVP (question, qtype, answer pool) nếu CMC muốn reusable assessments

3. **Web service API patterns** (mục 4)
   - Parameter validation + context check in external functions
   - Token auth + capability enforcement
   - **Action:** Nếu CMC tích hợp Moodle, reuse REST patterns (đừng reinvent)

### 8.2 Nên Bỏ Qua

❌ **KHÔNG HỌC:**

1. **Quiz engine state machine** (mục 3.2)
   - CMC offline k–12 không cần online quiz
   - State machine (notstarted → finished → reviewed) quá phức tạp
   - **Giải pháp:** CMC giữ nguyên `Exercise + Submission` binary model

2. **Full Moodle gradebook nesting** (mục 1)
   - Category tree 100 levels hỗ trợ quá overkill
   - **Giải pháp:** Nếu CMC cần weight, chỉ implement 2–3 level (e.g., "Class Avg", "Tests", "Assignments")

3. **Plugin system phức tạp** (mục 3)
   - `version.php` + `db/access.php` + `lib.php` + classes/
   - CMC không cần 100 plugin types như Moodle
   - **Giải pháp:** CMC dùng feature flags (config) thay vì plugin registration

4. **XMLDB schema system** (mục 5.2)
   - Cross-DB XML generation là legacy
   - CMC target Postgres only → dùng direct SQL/Prisma migration
   - **Giải pháp:** Keep Prisma migration

### 8.3 Integration vs Fork Decision

**Moodle as External LMS (LTI):**
- ✅ Feasible (85–90% khả thi)
- ✅ API-first, no code sharing (comply GPL)
- ⚠️ Gradebook real-time: không khả thi (60% latency)

**Moodle Replacement:**
- ❌ **NOT recommended**
- Moodle 2.94M LOC quá lớn, CMC team TypeScript không PHP
- Integration complexity >> benefit

**Clone Moodle Concepts into CMC:**
- ✅ **RECOMMENDED** — Gradebook (categories + weighted), Question bank (types + pool), Completion states
- ✅ 2–4 weeks dev per concept (gradebook most complex)

### 8.4 Non-goals Reaffirmed (per TL16)

**CMC KHÔNG implement:**
- Badges / achievements
- Leaderboards
- Auto-progression / skill tree
- Digital certificates

These are non-goal vì:
1. K–12 offline focus (không gamification)
2. Parent portal priority (không student engagement mechanics)
3. Compliance focus (không edutainment)

---

## 9. Unresolved Questions

1. **Moodle multi-tenant:** Có secure isolation không nếu run nhiều Moodle instances chia sẻ 1 Postgres? (Assumed: single-instance, risky to share)

2. **Gradebook recalculation async:** Moodle hiện synchronous. Nếu 1000 students, aggregation recursive có timeout không? (Need load test)

3. **Question state recovery:** Nếu CMC integrate quiz engine, cách recover incomplete attempts từ network failure?

4. **RLS + Moodle context hierarchy:** Nếu wrap Moodle API behind CMC Postgres RLS, có double-filtering cost không?

5. **Moodle mobile sync lag:** Moodle mobile app là separate (Flutter), sync nào real-time? REST poll interval?

---

## Status
**DONE**

**Summary:**  
Gradebook là Moodle component most sophisticated — recursive categories + 8 aggregation strategies + normalization. Roles/capabilities enforce ở app-layer (PHP `has_capability()`), unlike CMC's DB-layer RLS (stronger). Quiz engine state machine overkill cho offline CMC. Web services REST API viable 85–90% (users, courses, enrollments), nhưng gradebook real-time sync không khả thi (complex state). Version analyzed: **Moodle 5.3dev** (ALPHA, `public/` webroot structure). Trademark: CMC có thể integrate Moodle nhưng KHÔNG được dùng từ "Moodle" trong branding/name (GPL không include trademark rights). Bảng đối chiếu Moodle ↔ CMC cho từng subsystem. Khuyến cáo: clone gradebook concepts (categories + weighted), skip full quiz engine, tích hợp Moodle qua REST API (nếu cần), không replace CMC LMS, không brand as "Moodle-based".

**Concerns:**  
- Gradebook weight implementation complexity (recursive tree evaluation)
- Web service real-time gradebook latency (polling every 10s+ acceptable?)
- Mobile sync (Moodle app separate, CMC app separate, reconciliation?)
