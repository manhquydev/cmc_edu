# LMS session comment rubric (cmc_edu)

Port catalog law from cmc-lms onto QualitativeAssessment session comments.
Worktree: `/home/manhquy/Downloads/cmc_edu-session-rubric` (`feat/lms-session-comment-rubric`).
Do not mix with #183.

## Acceptance

- `SESSION_COMMENT_RUBRIC` in `@cmc/domain-lms`
- Session confirm requires complete 8/8/9 scores; narratives max 2000
- Period confirm stays free-text
- LMS `listForChild` returns rubric + program
- session-done: legacy content OR complete v2
