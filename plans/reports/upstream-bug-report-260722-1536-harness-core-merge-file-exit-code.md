# Issue gửi upstream — hoangnb24/repository-harness

Chép phần dưới dấu `---` vào https://github.com/hoangnb24/repository-harness/issues/new

Đã kiểm chứng trên `harness-v0.1.4` (commit `0b2ac97`). Không có issue/PR trùng
(0 issue mở, 0 PR mở tại thời điểm 2026-07-22).

---

**Title:** `harness update` fails hard instead of reporting a conflict when a file has 2+ conflicting regions

### Summary

`GitThreeWayMerge::merge` treats any `git merge-file` exit code above `1` as a
hard error. But `git merge-file` returns the **number of conflicting regions**
as its exit status, so any file with two or more conflicts aborts `harness
update` with an unhelpful message instead of being reported as a normal
conflict.

### Affected code

`crates/harness/src/infrastructure/git_merge.rs`

```rust
match output.status.code() {
    Some(0) => Ok(MergeOutcome::Clean(output.stdout)),
    Some(1) => Ok(MergeOutcome::Conflict(
        String::from_utf8_lossy(&output.stdout).into_owned(),
    )),
    _ => Err(PortError::new(format!(
        "git merge-file failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))),
}
```

### Reproduction

```bash
printf 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\n'       > base
printf 'A1\nb\nc\nD1\ne\nf\nG1\nh\ni\nJ1\nk\nl\n'   > local
printf 'A2\nb\nc\nD2\ne\nf\nG2\nh\ni\nJ2\nk\nl\n'   > upstream

git merge-file -p --diff3 local base upstream >/dev/null 2>&1; echo $?   # -> 4
```

Single-conflict case returns `1` and is handled correctly; the four-conflict
case returns `4` and falls into the error arm.

### Impact

1. `CoreApplication::update` calls `self.merge_contents(...)?`, so the error
   propagates and **aborts the whole update**, including files that would have
   merged cleanly. The intended behavior — collect conflicts, stop without
   writes, list the affected paths — never runs.
2. The error message is useless in practice. `git merge-file -p` writes the
   merged result to **stdout**, so `stderr` is empty and the user sees a bare
   `git merge-file failed:` with no file path.

This is not theoretical. In a consumer repository where `docs/README.md` was
adopted at install time and then diverged substantially from upstream, a
simulated upstream edit to that file produces exit code `3` — so the very first
core release touching it would hit this path.

### Suggested fix

Any positive exit code means "merged with conflicts"; the conflicted result is
still on stdout.

```rust
match output.status.code() {
    Some(0) => Ok(MergeOutcome::Clean(output.stdout)),
    Some(code) if code > 0 && code < 128 => Ok(MergeOutcome::Conflict(
        String::from_utf8_lossy(&output.stdout).into_owned(),
    )),
    _ => Err(PortError::new(format!(
        "git merge-file failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))),
}
```

`git merge-file` caps the reported count at 127 and uses values outside that
range for genuine failures, so the `< 128` bound keeps real errors as errors.

### Suggested test

The existing test in that module only covers the single-conflict case:

```rust
let conflict = merger.merge(b"one\n", b"local\n", b"upstream\n").unwrap();
assert!(matches!(conflict, MergeOutcome::Conflict(_)));
```

Adding a multi-region case would have caught this:

```rust
let multi = merger
    .merge(
        b"a\nb\nc\nd\ne\n",
        b"A1\nb\nC1\nd\nE1\n",
        b"A2\nb\nC2\nd\nE2\n",
    )
    .unwrap();
assert!(matches!(multi, MergeOutcome::Conflict(_)));
```
