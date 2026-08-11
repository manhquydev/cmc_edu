# Research: Hợp nhất LMS `cmc-lms` → `cmc_edu`

Date: 2026-08-11  
Plan: `plans/260811-1025-hop-nhat-lms-cmc-lms-vao-cmc-edu-erp/`

## Sources

- Explore scout: standalone LMS `/home/manhquy/Downloads/cmc-lms`
- Explore scout: monorepo LMS+ERP `/home/manhquy/Downloads/cmc_edu`
- GitNexus query: LMS provisioning / exercise open / guardian flows
- Docs: class-unit-spec, role-matrix, ADR 0038/0041, system-architecture

## One-line conclusion

**Port chuẩn nghiệp vụ LMS từ `cmc-lms` vào monorepo; giữ ERP làm cổng tiền và multi-facility; thay engine ghi danh/mở bài cũ bằng unit-range + sequence buổi; admin LMS = ops nhanh; family portal thay dual parent/student.**

## Capability comparison

| Area | cmc-lms (new standard) | cmc_edu LMS today | Merge action |
|---|---|---|---|
| Class unit engine | 4 sessions/unit, anchors, realign | ClassBatch + sessions; weaker unit product model | **Port** |
| Enrollment | Unit ranges, roster by session unit | Class membership; receipt activates | **Port ranges + bridge from receipt** |
| Exercise open | Library folders; 1 per session end | ADR 0038 Tier A/B by curriculumUnit | **Replace 0038** |
| Auth LMS | Family phone+password | Parent email OTP + student password | **Port family** |
| Create student | Admin free | Receipt-only (ADR 0041) | **Hybrid** |
| Teacher UX | Full week calendar + grade PDF | Admin teaching screens | **Port / upgrade** |
| Family UX | Unified portal | Thin parent/student SPA | **Port** |
| Finance/CRM | None | Full ERP | **Keep ERP** |
| Facility/RLS | None | Yes | **Keep on monorepo** |
| Gifts/badges | Mostly v2 | Student gifts live | Wave 2 |

## Critical bridge

```text
Receipt approved (ERP money)
  → ParentAccount / Student / Guardian / StudentAccount
  → Enrollment.active
  → EnrollmentUnitRange grant   ◄── missing today; core of new linkage
```

## Recommended waves

1. **Wave 1 (go-live ops):** domain+schema, provision bridge, API, admin/teacher/family UI, family auth, migrate, e2e
2. **Wave 2:** gifts/badges/levels, gradebook full, parent meetings, SSE

## Do not do

- Long-lived dual product DBs with continuous sync
- UI-only swap without domain port
- Drop money-gated provisioning
