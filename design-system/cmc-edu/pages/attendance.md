# Override: Điểm danh (teacher ops)

**Reference implementation** for touch + feedback (keep and extend).

## Flow

1. Preselect **lớp / buổi hôm nay** when possible (deep link `?session=`).  
2. Do not strand user on empty “Chọn lớp” with no hints.  
3. Roster: cycle status present → late → absent; first click → present.  
4. Labels + color (not color alone).  
5. Touch targets ≥ **44×44**.

## Save

- Validate ≥1 marked student before save (already done).  
- `isPending` + label “Đã lưu” + icon (already done).  
- Add: **leave-guard** when dirty (`saved === false`).  
- Optional toast “Đã lưu điểm danh” if Banner not in view.

## Anti-patterns

- Silent whole-class present.  
- Primary save only on tiny control.  
- No indication of unmarked count.
