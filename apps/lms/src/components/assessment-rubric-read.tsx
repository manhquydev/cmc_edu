import { Stack, Text } from '@cmc/ui';
import { formatBand, isRubricProgram, rubricFor, type RubricPayload } from '@cmc/domain-lms';

export function AssessmentRubricRead({
  program,
  rubric,
  fallbackContent,
}: {
  program: string | null;
  rubric: RubricPayload | null;
  fallbackContent: string;
}) {
  if (!rubric || !isRubricProgram(program)) {
    return (
      <Text type="body" size="sm">
        {fallbackContent}
      </Text>
    );
  }
  const catalog = rubricFor(program);
  return (
    <Stack gap={1}>
      {catalog.criteria.map((criterion) => {
        const score = rubric.scores[criterion.key];
        if (!score) return null;
        return (
          <Text key={criterion.key} type="body" size="sm">
            {criterion.labelVi}: {formatBand(criterion, score)}
          </Text>
        );
      })}
      {rubric.narratives?.strength ? (
        <Text type="body" size="sm">
          Điểm mạnh: {rubric.narratives.strength}
        </Text>
      ) : null}
      {rubric.narratives?.weakness ? (
        <Text type="body" size="sm">
          Điểm yếu: {rubric.narratives.weakness}
        </Text>
      ) : null}
      {rubric.narratives?.recommendation ? (
        <Text type="body" size="sm">
          Đề xuất từ giáo viên: {rubric.narratives.recommendation}
        </Text>
      ) : null}
    </Stack>
  );
}
