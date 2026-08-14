import { useState } from 'react';
import { Button, Text } from '../primitives.js';

export interface RecordTimelineItem {
  id: string;
  kind: string;
  actor: string;
  payload: unknown;
  createdAt: Date | string;
  label: string;
}

export interface RecordTimelineProps {
  items: RecordTimelineItem[];
  nextCursor: string | null;
  onLoadMore?: () => void;
  onAddNote?: (body: string) => void;
  pending?: boolean;
  /** Epoch marker for records that predate event recording. */
  historySince?: Date | null;
}

function formatHistorySince(date: Date): string {
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatWhen(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function noteBody(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'body' in payload) {
    const body = (payload as { body: unknown }).body;
    return typeof body === 'string' ? body : null;
  }
  return null;
}

/** Presentational chatter/timeline. Entity is hardcoded by the caller; no tRPC. */
export function RecordTimeline({
  items,
  nextCursor,
  onLoadMore,
  onAddNote,
  pending = false,
  historySince = null,
}: RecordTimelineProps) {
  const [draft, setDraft] = useState('');

  const submitNote = () => {
    const body = draft.trim();
    if (!body || !onAddNote || pending) return;
    onAddNote(body);
    setDraft('');
  };

  return (
    <div className="console-record-timeline" data-testid="record-timeline">
      {onAddNote ? (
        <form
          className="console-record-timeline-note"
          onSubmit={(e) => {
            e.preventDefault();
            submitNote();
          }}
        >
          <label className="console-record-timeline-field" htmlFor="record-timeline-note">
            Ghi chú
          </label>
          <textarea
            id="record-timeline-note"
            className="console-record-timeline-textarea"
            placeholder="Thêm ghi chú (chỉ chữ thuần)…"
            value={draft}
            maxLength={2000}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            label="Thêm ghi chú"
            size="sm"
            variant="primary"
            isLoading={pending}
            isDisabled={!draft.trim()}
            onClick={submitNote}
          />
        </form>
      ) : null}

      {historySince ? (
        <p className="console-record-timeline-epoch">
          Lịch sử ghi từ {formatHistorySince(historySince)}
        </p>
      ) : null}

      {items.length === 0 && !historySince ? (
        <Text type="supporting" size="sm">
          Chưa có sự kiện trên bản ghi này.
        </Text>
      ) : (
        <ol className="console-record-timeline-list">
          {items.map((item) => {
            const body = item.kind === 'note' ? noteBody(item.payload) : null;
            return (
              <li key={item.id} className="console-record-timeline-item">
                <span className="console-record-timeline-label">{item.label}</span>
                <span className="console-record-timeline-meta">
                  {formatWhen(item.createdAt)}
                  {item.actor ? ` · ${item.actor}` : ''}
                </span>
                {body ? <p className="console-record-timeline-body">{body}</p> : null}
              </li>
            );
          })}
        </ol>
      )}

      {nextCursor && onLoadMore ? (
        <Button
          label="Xem thêm"
          size="sm"
          variant="secondary"
          onClick={onLoadMore}
          isDisabled={pending}
        />
      ) : null}
    </div>
  );
}
