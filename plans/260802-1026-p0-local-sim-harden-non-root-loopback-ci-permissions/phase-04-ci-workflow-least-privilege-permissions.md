---
phase: 4
title: "CI workflow least-privilege permissions"
status: completed
priority: P0
effort: "15m"
dependencies: [1]
---

# Phase 4: CI workflow least-privilege permissions

## Overview

Pin GITHUB_TOKEN to least privilege. Repo stays public. No self-hosted changes.

## Requirements

- Top-level `permissions: contents: read`
- Jobs that `upload-artifact` get `actions: write` (and contents: read)
- Other jobs inherit top-level only

## Related Code Files

- Modify: `.github/workflows/ci.yml`

## Implementation Steps

1. After `env:` block (or before jobs), add:
   ```yaml
   permissions:
     contents: read
   ```
2. On `ui-e2e` and `security-scan` jobs:
   ```yaml
   permissions:
     contents: read
     actions: write
   ```
3. Do not change triggers, continue-on-error, or runs-on.

## Success Criteria

- [ ] `permissions:` present at workflow top level
- [ ] artifact-uploading jobs declare `actions: write`
- [ ] YAML still valid (no structural break)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Artifact upload fails | job-level actions: write |
| Future deploy job needs id-token | out of scope; add when CD lands |
