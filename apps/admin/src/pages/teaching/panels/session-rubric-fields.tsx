import { Selector, Stack, Text, TextArea } from '@cmc/ui';
import type { RubricPayload, RubricProgram } from '@cmc/domain-lms';
import { NARRATIVE_MAX_CHARS } from '@cmc/domain-lms';

export type RubricDraft = {
  scores: Record<string, 1 | 2 | 3 | 4 | undefined>;
  narratives: { strength: string; weakness: string; recommendation: string };
};

export function emptyRubricDraft(catalog: RubricProgram): RubricDraft {
  return {
    scores: Object.fromEntries(catalog.criteria.map((c) => [c.key, undefined])),
    narratives: { strength: '', weakness: '', recommendation: '' },
  };
}

export function draftFromPayload(catalog: RubricProgram, payload: RubricPayload | null): RubricDraft {
  const base = emptyRubricDraft(catalog);
  if (!payload) return base;
  return {
    scores: { ...base.scores, ...payload.scores },
    narratives: {
      strength: payload.narratives?.strength ?? '',
      weakness: payload.narratives?.weakness ?? '',
      recommendation: payload.narratives?.recommendation ?? '',
    },
  };
}

export function isDraftComplete(catalog: RubricProgram, draft: RubricDraft): boolean {
  return catalog.criteria.every((c) => draft.scores[c.key] === 1 || draft.scores[c.key] === 2 || draft.scores[c.key] === 3 || draft.scores[c.key] === 4);
}

export function toRubricPayload(draft: RubricDraft): RubricPayload {
  const scores: Record<string, 1 | 2 | 3 | 4> = {};
  for (const [key, value] of Object.entries(draft.scores)) {
    if (value === 1 || value === 2 || value === 3 || value === 4) scores[key] = value;
  }
  return {
    version: 2,
    scores,
    narratives: {
      strength: draft.narratives.strength.trim() || undefined,
      weakness: draft.narratives.weakness.trim() || undefined,
      recommendation: draft.narratives.recommendation.trim() || undefined,
    },
  };
}

const SCORE_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
];

export function SessionRubricFields({
  catalog,
  value,
  onChange,
  readOnly = false,
}: {
  catalog: RubricProgram;
  value: RubricDraft;
  onChange?: (next: RubricDraft) => void;
  readOnly?: boolean;
}) {
  return (
    <Stack gap={2}>
      {catalog.criteria.map((criterion) => {
        const score = value.scores[criterion.key];
        const helper = score ? criterion.helpers[score] : '';
        return (
          <Stack key={criterion.key} gap={1}>
            <Selector
              label={criterion.labelVi}
              options={SCORE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: `${opt.value} — ${criterion.bands[Number(opt.value) as 1 | 2 | 3 | 4]}`,
              }))}
              value={score ? String(score) : undefined}
              onChange={(v) => {
                if (readOnly || !onChange) return;
                const next = Number(v) as 1 | 2 | 3 | 4;
                onChange({
                  ...value,
                  scores: { ...value.scores, [criterion.key]: next },
                });
              }}
              isDisabled={readOnly}
              hasClear={false}
            />
            {helper ? (
              <Text type="supporting" size="2xs">
                {helper}
              </Text>
            ) : null}
          </Stack>
        );
      })}
      {catalog.narratives.map((narrative) => (
        <TextArea
          key={narrative.key}
          label={`${narrative.labelVi} (tối đa ${NARRATIVE_MAX_CHARS})`}
          value={value.narratives[narrative.key]}
          onChange={(v) => {
            if (readOnly || !onChange) return;
            onChange({
              ...value,
              narratives: { ...value.narratives, [narrative.key]: v.slice(0, NARRATIVE_MAX_CHARS) },
            });
          }}
          rows={3}
          isDisabled={readOnly}
        />
      ))}
    </Stack>
  );
}
