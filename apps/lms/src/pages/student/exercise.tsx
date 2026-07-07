// Exercise detail — student submission flow.
//
// Flow: load exercise info → student writes answer → saveDraft → submit.
//
// Backend contracts:
//   submission.saveDraft({ exerciseId, annotationLayer, answerText? })
//   submission.submit({ exerciseId })
//
// annotationLayer is capped at 1MB by the backend. This UI sends a minimal
// JSON object (the text answer encoded as a JSON field) — well under the cap.
// Full PDF canvas annotation is a follow-up (pdfjs + canvas overlay, P2-debt).
//
// The student's own studentId/parentAccountId come from the session header —
// the backend requireLmsStudent() gate enforces ownership; no studentId is
// passed as input here.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { trpc } from '../../lib/trpc.js';

// Max answer text length — well within the backend's 20k char limit.
const MAX_ANSWER_TEXT = 5_000;

export default function ExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const [answerText, setAnswerText] = useState('');
  const [saveError, setSaveError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Load open exercises to find this one (uses cached data from home page).
  const { data: exercisesData, isLoading } = trpc.exercise.openForStudent.useQuery();
  const exercise = exercisesData?.items.find((e) => e.id === exerciseId);

  const saveDraftMut = trpc.submission.saveDraft.useMutation({
    onSuccess() {
      setSaveError('');
    },
    onError(err) {
      setSaveError(err.message || 'Không thể lưu nháp.');
    },
  });

  const submitMut = trpc.submission.submit.useMutation({
    onSuccess() {
      setSubmitError('');
      setSubmitted(true);
    },
    onError(err) {
      setSubmitError(err.message || 'Không thể nộp bài.');
    },
  });

  function saveDraft() {
    if (!exerciseId) return;
    setSaveError('');
    // annotationLayer carries the answer as a structured JSON object.
    // This minimal shape keeps payload well under the 1MB cap.
    saveDraftMut.mutate({
      exerciseId,
      annotationLayer: { answerText },
      answerText,
    });
  }

  function submitAnswer() {
    if (!exerciseId) return;
    setSubmitError('');
    // Save latest draft first, then submit.
    saveDraftMut.mutate(
      { exerciseId, annotationLayer: { answerText }, answerText },
      {
        onSuccess() {
          submitMut.mutate({ exerciseId });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <Box className="lms-shell" style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader />
      </Box>
    );
  }

  if (!exercise) {
    return (
      <Box className="lms-shell" style={{ padding: '1.5rem' }}>
        <Alert color="orange" variant="light" title="Bài tập không tồn tại hoặc chưa mở">
          Bài tập này chưa mở hoặc không thuộc về tài khoản của bạn.
        </Alert>
        <Button variant="subtle" mt="md" onClick={() => navigate('/student/home')}>
          ← Quay lại
        </Button>
      </Box>
    );
  }

  if (submitted) {
    return (
      <Box className="lms-shell" style={{ padding: '1.5rem' }}>
        <Alert color="green" variant="light" title="Đã nộp bài thành công!">
          Bài làm của bạn đã được gửi. Giáo viên sẽ chấm điểm sớm nhất có thể.
        </Alert>
        <Button mt="md" onClick={() => navigate('/student/home')}>
          ← Về trang chủ
        </Button>
      </Box>
    );
  }

  return (
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Anchor size="sm" onClick={() => navigate('/student/home')}>← Bài tập</Anchor>
        <Text className="lms-topbar__brand">Làm bài</Text>
        <Box w={60} />
      </Box>

      <Box className="lms-page">
        <Group justify="space-between" mb="xs">
          <Title order={4} style={{ margin: 0 }}>{exercise.type}</Title>
          <Badge color="blue" variant="light">
            {exercise.starReward} sao
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" mb="lg">
          Điểm tối đa: {exercise.maxScore}
        </Text>

        {/* PDF base reference — full PDF render is P2-debt */}
        {exercise.basePdfRef && (
          <Alert color="blue" variant="light" mb="md">
            Tệp bài tập:{' '}
            <Anchor href={exercise.basePdfRef} target="_blank" size="sm">
              Xem PDF
            </Anchor>
            {' '}(tính năng viết tay trực tiếp trên PDF sẽ có trong phiên bản tiếp theo)
          </Alert>
        )}

        <Stack gap="md">
          <Textarea
            label="Bài làm của bạn"
            placeholder="Nhập câu trả lời ở đây..."
            minRows={6}
            maxRows={16}
            value={answerText}
            onChange={(e) => setAnswerText(e.currentTarget.value)}
            maxLength={MAX_ANSWER_TEXT}
            disabled={submitMut.isPending || submitted}
          />
          <Text size="xs" c="dimmed" ta="right">
            {answerText.length}/{MAX_ANSWER_TEXT}
          </Text>

          {saveError && <Alert color="red" variant="light">{saveError}</Alert>}
          {submitError && <Alert color="red" variant="light">{submitError}</Alert>}

          {saveDraftMut.isSuccess && !submitMut.isPending && (
            <Alert color="green" variant="light" p="xs">
              <Text size="xs">Đã lưu nháp.</Text>
            </Alert>
          )}

          <Group>
            <Button
              variant="outline"
              loading={saveDraftMut.isPending && !submitMut.isPending}
              onClick={saveDraft}
              disabled={!answerText || submitMut.isPending}
            >
              Lưu nháp
            </Button>
            <Button
              loading={submitMut.isPending || (saveDraftMut.isPending && submitMut.isIdle)}
              onClick={submitAnswer}
              disabled={!answerText}
            >
              Nộp bài
            </Button>
          </Group>
        </Stack>
      </Box>
    </Box>
  );
}
