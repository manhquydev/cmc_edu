# Bản đồ luồng nghiệp vụ CMC EDU v2 theo 5 vai trò (journal + ak-scout tổng hợp)

> Nguồn: journal (3 file plans/journals) + 4 Explore subagents (P1/P2/P3/P4) + docs 14/24-28/25 + code grep.
> Ngày: 2026-08-17. Vai trò: super_admin · GĐKD · GĐĐT · sale · giao_vien (+ PH/HS cho LMS).

## 1. Bản đồ luồng theo module × vai trò (34 WF + admin)

### P1 — Tuyển sinh & Tài chính (9 WF)
| WF | Luồng | Vai trò | UI | Live spec | Edge chưa test (ưu tiên) |
|---|---|---|---|---|---|
| P1-01 | CRM phễu O1→O5 | sale, GĐKD(assign) | /crm | 01 | opportunityAssign (chỉ manager), markLost reason bắt buộc, reopen lost, out-of-facility, due/rotting filter |
| P1-02 | Phiếu thu từ opp | sale | /finance/new | 02 | needs_confirmation (SĐT trùng), amount invalid, opp lost→chặn |
| P1-03 | Cổng tiền duyệt | GĐKD/GĐĐT(>20tr), sale FORBIDDEN | /finance | 02 | **second-eye GĐKD bị chặn >20tr**, self-approve audit, double-approve race |
| P1-04 | Provisioning | auto | — | 02 | idempotent replay, race SĐT trùng |
| P1-05 | Enrollment activate | auto/sale | /finance/class-placement | 02 | blockLms (không UI consumer — gap sản phẩm) |
| P1-06 | Guardian link | PH↔staff | /admin/parents (orphan!) | **KHÔNG** | requestLink không có UI LMS; approve/reject non-pending |
| P1-07 | LMS login OTP | PH/HS | /login | 04 | OTP cooldown 30s, sai code 5 lần lock, expired |
| P1-08 | Huỷ phiếu/hoàn tiền | GĐKD/super | /finance/:id | **KHÔNG** | **I3 revert O4 assert**, refund cap QĐ0028, void:true, opp lost→chặn huỷ |
| P1-09 | Recon agent | GĐĐT/GĐKD | /ops/recon | **KHÔNG** | dismiss/action flag, 5 loại cờ, agent read-only |

### P2 — Lớp & học tập (9 WF)
| WF | Luồng | Vai trò | UI | Live | Edge |
|---|---|---|---|---|---|
| P2-01 | Tạo lớp tự sinh buổi | GĐĐT | /admin/classes | 03 (tRPC!) | **dialog tạo lớp qua UI chưa journey** |
| P2-02 | Điểm danh | GV, GĐĐT | /teaching/attendance | 03 | markAll >200, window biên, re-mark absent→present |
| P2-03 | Mở bài tập | HS (no-ui) | /student/exercise | — | no-ui-path (gap) |
| P2-04 | Cung cấp bài PDF | GĐĐT | /teaching/exercises | — | exercise.update, folder archived, re-publish closed |
| P2-05 | HS làm bài nộp | HS (no-ui) | /student/exercise | — | no-ui-path |
| P2-06 | GV chấm bài + sao | GV/GĐĐT | /teaching/grading | — | score=0 boundary, anti-self, listForGrading paginate |
| P2-07 | Nhận xét AI | GV (confirm), GĐĐT(draft) | /teaching/session-assessment | — | **AI draft→sửa→chốt UI chưa journey**, GĐĐT confirm FORBIDDEN |
| P2-08 | Session-evidence | GV → PH | /teaching/session-evidence | — | evidence trên session done, GET bytes e2e |
| P2-09 | Xếp dãy bài | GĐĐT | /teaching/classes/:id/exercise-sequence | — | **freeze sequence UI chưa journey** (picker+save) |

### P3 — Nhân sự & Lương (11 WF)
| WF | Luồng | Vai trò | UI | Live | Edge |
|---|---|---|---|---|---|
| P3-01 | Chấm công punch | nhân viên | /hr/checkin | 06 | ranh giới ngày ICT, punch ngày phiếu REJECTED |
| P3-02 | Offsite approval | sale/GV → GĐ track | /hr/checkin | **KHÔNG** | cần seed shift TODAY — gap DB |
| P3-03 | Đăng ký ca | sale/GV | /hr/shifts/new | 06 | từ ngày không future → chặn |
| P3-04 | Duyệt ca | GĐ theo track | /go/shiftRegistration | 06 | **reject (P3-07) chưa live**, anti-self, super bypass |
| P3-05 | Bậc lương + chốt lương | GĐKD/GĐĐT | /hr/salary-tiers, /hr/payroll | 07/08 | **reopen phiếu draft**, assemble kỳ trống, kpi confirm sau finalize chặn |
| P3-06 | KPI nộp/xác nhận | mọi người | /hr/kpi, /hr/my | 07/08 | tierMissing, day-3 gate |
| P3-08 | Tất toán KPI | GĐ branch-scope | /hr/kpi | 07/08 | skippedUnfinalized, self-exclusion |
| P3-09 | KPI refresh | mọi người | /hr/my | 07/08 | công thức cap 100%, rollover |
| P3-10/11 | Session-done sweep | hệ thống | — | — | no-ui-path |

### P4 + Admin (5 WF P4 + 7 ADM)
| Mã | Luồng | Vai trò | UI | Live | Edge |
|---|---|---|---|---|---|
| P4-01 | Đổi quà | HS redeem, staff duyệt | /admin/engagement/rewards | 09 (config only) | reject hoàn sao, hết hàng, chưa đủ sao |
| P4-02 | Cấu hình quà | GĐKD/GĐĐT | /admin/engagement/gifts | 09 | archive Ẩn đã chọn, sale không thấy entry |
| P4-03 | Họp PH | sale/GĐ | /crm/post-sale-meeting | 10 | **double-book warning UI**, complete thiếu result chặn |
| P4-04 | Lịch test | sale/GĐ | /crm/opportunities/:id | **KHÔNG** | periodic không UI (gap), entrance no_show |
| P4-05 | After-sale | sale/GĐ | /crm/aftersale | 11 | **student.setLifecycle (E8) chưa test**, close chưa resolved chặn |
| ADM-01 | Facility CRUD | super | /admin/facilities | — | trùng code, không delete (design) |
| ADM-02 | User quản trị | super+GĐ | /admin/users | 00 | **escalation guard create/update/reset (E12) chưa test trực tiếp**, resetPassword UI flow (E13) |
| ADM-03 | Network IP/geofence | super | /admin/network-ip | — | **toggle activate (E15) chưa journey**, geofence không journey |
| ADM-04 | Audit log | super | /admin/audit-log | 05 | khoảng ngày ngược banner |
| ADM-05 | Shift config | super+GĐ | /admin/shift-config | — | ca đêm reject (API có) |
| Cockpit | Tổng quan inbox | mọi vai | /cockpit | đi ngang | **không journey assert nội dung (E20)** |

## 2. Ưu tiên triển khai live specs sâu hơn (happy + edge, real UI, không seed DB)

**Nhóm A — edge case KHẢ THI live (ưu tiên cao):**
1. **12-ops-finance-edge** (P1-08 + P1-03): GĐKD huỷ phiếu kèm lý do → assert O4 revert (I3) + phiếu cũ status; hoàn tiền partial; second-eye: GĐKD KHÔNG duyệt phiếu >20tr (tạo phiếu 25tr qua sale → GĐKD bị chặn → GĐĐT duyệt được).
2. **13-ops-shift-reject** (P3-07): sale đăng ký ca → GĐKD Từ chối kèm lý do → trạng thái hiển thị từ chối; anti-self (GĐKD không duyệt ca mình tạo? — ca không track).
3. **14-ops-user-guards** (ADM-02 E12/E13): GĐKD tạo user → cố set role super_admin → bị chặn (hoặc UI ẩn); resetPassword modal cho user hiện hữu → login tạm; last-admin guard.
4. **15-ops-lifecycle** (P4-05 E8): GĐKD đổi lifecycle student (active→blocked_lms) qua /admin/students/:id → LMS picker ẩn con (hoặc audit ghi).
5. **16-ops-meeting-doublebook** (P4-03 E4): đặt 2 họp cùng giờ → warning UI "trùng giờ" (dialog giữ mở + Đóng).

**Nhóm B — cần quyết định (ghi nhận, không chặn):**
- E5/E9 (outbox nhắc PH, priority sort): spec-code lệch — cần quyết định doc/code, không phải test.
- E15 toggle network: sẽ phá punch nếu tắt hết — test cẩn thận (tạo network mới → bật → tắt → đảm bảo vẫn còn 1 active).
- P2-01 dialog tạo lớp qua UI: tạo lớp qua UI thật (không tRPC) — thay thế seed exception hiện tại.
- P2-07 AI nhận xét: cần LLM stub/API — không khả thi live production (LLM_STUB_PROD_FORBIDDEN).

**Nhóm C — no-ui-path / gap sản phẩm (không test được live, ghi nhận):**
P1-06 (guardian requestLink không UI), P2-03/05 (HS làm bài), P3-02 (offsite cần seed), P3-10/11 (worker), P4-04 periodic (không UI), blockLms (không UI consumer).

## 3. Ledger hiện tại (2026-08-13, business-verification.json): 43 luồng = 17 verified-correct + 20 reachable-only + 6 not-proven.
> **2026-08-17 (bổ sung):** report chi tiết cụm P3 đã lưu tại plans/reports/explore-p3-flows-report.md —
> xác nhận P3-01 smoke · P3-02…09 verified-correct · P3-10/11 no-ui-path; edge chưa test quan trọng nhất =
> guard "không chạm super_admin" ở user.update/user.resetPassword (user.create đã phủ trong live 14).
