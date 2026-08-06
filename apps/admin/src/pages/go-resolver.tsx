// Canonical deep-link entry: /go/:entity/:id → real admin path or 404 EmptyState.
// Lives inside Shell so chrome is consistent; redirect is replace so /go does
// not pollute history.

import { Navigate, useParams } from 'react-router-dom';
import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';
import { resolveGo } from '@cmc/links';
import { safeReturnTo } from '../lib/safe-return-to.js';

export default function GoResolverPage() {
  const { entity = '', id = '' } = useParams<{ entity: string; id: string }>();
  const target = resolveGo(entity, id);

  if (target == null) {
    return (
      <>
        <PageHeader title="Liên kết" breadcrumbs={[{ label: 'Liên kết' }]} />
        <EmptyState
          title="Liên kết không tồn tại"
          description="Loại đối tượng hoặc id trong URL không hợp lệ. Kiểm tra lại liên kết được chia sẻ."
          icon={<LineIcon name="globe" size={28} />}
        />
      </>
    );
  }

  // Second redirect sink: always pass through the same open-redirect policy
  // as login returnTo, even though resolveGo only emits our builders today.
  return <Navigate to={safeReturnTo(target)} replace />;
}
