# Override: List / ops pages

**Applies to:** phiếu thu, lớp học, users, CRM lists, exercises, parents, etc.

## Density

- **Compact** tier: tighter row padding, sticky header, less vertical air.  
- FilterBar always visible when list can grow.  
- Empty: `EmptyState` + primary create/filter-clear action — never only centered text in void.

## Header

- Prefer **one** title source (PageHeader). Avoid triple: topbar + breadcrumb + H1 all full weight.  
- Actions: **one** primary (Tạo…); secondary outline; overflow `⋯` for rare row actions.

## Table

- Status badges: **Vietnamese labels** (`Đang hoạt động`, not `active`).  
- Row actions: prefer overflow menu over N repeated buttons.  
- Loading: skeleton / DataTable loading prop.  
- Error: Banner above table + Retry.

## Mutation feedback

```text
Button isPending → Toast success | Banner error near table
Destructive → ConfirmDialog first
```

## Click targets

- Desktop row height comfortable; action hit area ≥ 32px (desktop) / 44px if touch primary.  
- Pagination disabled state: opacity + no pointer.
