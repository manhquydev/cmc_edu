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
import { Badge, Banner, Button, Heading, HStack, Spinner, Stack, Text, TextArea } from '@cmc/ui';
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
      <div className="lms-shell" style={{ padding: '2rem', textAlign: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="lms-shell" style={{ padding: '1.5rem' }}>
        <Banner status="warning" title="Bài tập không tồn tại hoặc chưa mở" description="Bài tập này chưa mở hoặc không thuộc về tài khoản của bạn." />
        <Button
          variant="ghost"
          style={{ marginTop: 16 }}
          label="← Quay lại"
          onClick={() => navigate('/student/home')}
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="lms-shell" style={{ padding: '1.5rem' }}>
        <Banner status="success" title="Đã nộp bài thành công!" description="Bài làm của bạn đã được gửi. Giáo viên sẽ chấm điểm sớm nhất có thể." />
        <Button
          style={{ marginTop: 16 }}
          label="← Về trang chủ"
          onClick={() => navigate('/student/home')}
        />
      </div>
    );
  }

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Button variant="ghost" size="sm" label="← Bài tập" onClick={() => navigate('/student/home')} />
        <Text className="lms-topbar__brand">Làm bài</Text>
        <div style={{ width: 60 }} />
      </div>

      <div className="lms-page">
        <HStack justify="between" style={{ marginBottom: 8 }}>
          <Heading level={4} style={{ margin: 0 }}>{exercise.type}</Heading>
          <Badge label={`${exercise.starReward} sao`} variant="blue" />
        </HStack>
        <Text type="supporting" size="2xs" display="block" style={{ marginBottom: 24 }}>
          Điểm tối đa: {exercise.maxScore}
        </Text>

        {/* PDF base reference — full PDF render is P2-debt */}
        {exercise.basePdfRef && (
          <Banner
            status="info"
            title={
              <>
                Tệp bài tập:{' '}
                <Button
                  variant="ghost"
                  size="sm"
                  label="Xem PDF"
                  href={exercise.basePdfRef}
                  target="_blank"
                  rel="noopener noreferrer"
                />
                {' '}(tính năng viết tay trực tiếp trên PDF sẽ có trong phiên bản tiếp theo)
              </>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Stack gap={2}>
          {/* TODO(astryx-review): Astryx TextArea has no minRows/maxRows auto-grow
              equivalent (fixed `rows` only) — approximated with rows={6}; the
              16-row growth cap from the original minRows/maxRows pair is dropped. */}
          <TextArea
            label="Bài làm của bạn"
            placeholder="Nhập câu trả lời ở đây..."
            rows={6}
            value={answerText}
            onChange={(value) => setAnswerText(value)}
            maxLength={MAX_ANSWER_TEXT}
            isDisabled={submitMut.isPending || submitted}
          />
          <Text type="supporting" size="2xs" justify="end" display="block">
            {answerText.length}/{MAX_ANSWER_TEXT}
          </Text>

          {saveError && <Banner status="error" title={saveError} />}
          {submitError && <Banner status="error" title={submitError} />}

          {saveDraftMut.isSuccess && !submitMut.isPending && (
            <Banner status="success" title="Đã lưu nháp." />
          )}

          <HStack gap={2}>
            <Button
              variant="secondary"
              label="Lưu nháp"
              isLoading={saveDraftMut.isPending && !submitMut.isPending}
              onClick={saveDraft}
              isDisabled={!answerText || submitMut.isPending}
            />
            <Button
              label="Nộp bài"
              isLoading={submitMut.isPending || (saveDraftMut.isPending && submitMut.isIdle)}
              onClick={submitAnswer}
              isDisabled={!answerText}
            />
          </HStack>
        </Stack>
      </div>
    </div>
  );
}
