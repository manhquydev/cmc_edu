# Cockpit 5 roles — design sample

Standalone Operate surface exploring a **canon** (Linear + Stripe craft) composition for CMC EDU ERP cockpits.

## Open

```bash
# from repo root
python3 -m http.server 8765 --directory design-lab/cockpit-roles
# then http://127.0.0.1:8765/?role=giam_doc_kinh_doanh
```

Role query values: `super_admin` · `giam_doc_kinh_doanh` · `giam_doc_dao_tao` · `sale` · `giao_vien`

## What this proves

- One chrome, five role payloads (SoD: sale never sees receipt amounts).
- Approved composition: `.impeccable/mocks/comp-c.webp` (table + sidebar + sticky funnel).
- Not production — do not mount into `apps/admin` without resolving double-chrome (sample sidebar vs `ConsoleNavbar`).

## Authority

- Product truth: `/PRODUCT.md`
- Surface brief: `.impeccable/surfaces/design-lab-cockpit-roles-index-html.md`
- Data on screen is **synthetic**.
