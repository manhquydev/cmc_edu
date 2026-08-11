# Ma trận đối soát luật nghiệp vụ × UI (sau densify goal)

**Ngày:** 2026-08-11  
**Phạm vi:** form densify = **chỉ vỏ**; mutation / permission **không** đổi  

## Verdict scale

`Khớp` · `Khớp một phần` · `Lệch` · `Chưa UAT`

| # | Luật đã chốt | Kỳ vọng UI | Bề mặt densify | Kết luận domain |
|---|--------------|------------|----------------|-----------------|
| 1 | Resource-centric: 1 chứng từ = 1 menu | Không app “Duyệt …” | nav-registry: không label Duyệt KPI/ca/chấm | **Khớp** |
| 2 | List = mở phiếu; form = quyết định | Ca inbox index-only; KPI bulk approve chỉ board | shifts/kpi unchanged API | **Khớp** |
| 3 | KPI confirm = managerId; approved = bulk GĐ | Nút theo `viewerCanConfirm` / `viewerCanOverride` | kpi-detail | **Khớp** (Chưa UAT người) |
| 4 | Chấm: punch append; cấm bù ngày tự do | Không form manualPunch.create | check-in-out | **Khớp** |
| 5 | Không product kanban ticket TEKY | Không route kanban bù | — | **Khớp** |
| 6 | Hoàn/huỷ trên form phiếu thu | refundCreate + receiptCancel + flags | receipt-detail | **Khớp** · **Chưa UAT** |
| 7 | Facility / RLS | get by id facility-scoped | student/parent/class get | **Khớp** |
| 8 | Design = Console, không TEKY teal | Token Console | densify surfaces | **Khớp một phần** visual list còn lệch |
| 9 | Student lifecycle chỉ setLifecycle + confirm | `student.setLifecycle.mutate` + ConfirmDialog | student-detail densify | **Khớp** (visual only) |
| 10 | Class assignTeacher server-filter giao_vien | `classBatch.assignTeacher` + pickList role | class-detail densify | **Khớp** (visual only) |
| 11 | Session cancel/assignUnit/addMakeup contracts | Mutations unchanged in class sessions tab | class-detail tests green | **Khớp** |

### Densified this goal (presentation only)

| Surface | Chrome added | Mutation symbols |
|---------|--------------|------------------|
| `/admin/students/{id}` | WorkflowStatusbar lifecycle, density ops, VI labels, header actions | **still** `student.setLifecycle` |
| `/admin/classes/{id}` | WorkflowStatusbar class status, density ops, sheet copy | **still** `classBatch.assignTeacher`, `classSession.*` |

**Independent review finding:** No new role-product routes; no TEKY kanban; no free makeup punch UI; no permission key changes.
