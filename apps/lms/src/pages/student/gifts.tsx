// Gift catalog + redeem — student only (kind:'student').
//
// gift.listForStudent returns { gifts, starBalance } in one request.
// rewards.redeem({ giftId }) deducts stars atomically on the backend
// (SELECT FOR UPDATE + balance check — the UI reads balance from the cached
// query, which is invalidated on successful redeem so the hero updates).
//
// Star balance is read-only on the client — it comes from StarTransaction
// aggregation on the backend. The UI never computes balance locally.

import { useNavigate } from 'react-router-dom';
import { Badge, Banner, Button, Heading, HStack, Spinner, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

export default function GiftsPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.gift.listForStudent.useQuery();

  const redeemMut = trpc.rewards.redeem.useMutation({
    onSuccess() {
      // Invalidate so star balance + gift list reload after a successful redeem.
      void utils.gift.listForStudent.invalidate();
    },
  });

  const starBalance = data?.starBalance ?? 0;
  const gifts = data?.gifts ?? [];

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Button variant="ghost" size="sm" label="← Trang chủ" onClick={() => navigate('/student/home')} />
        <Text className="lms-topbar__brand">Đổi quà</Text>
        <div style={{ width: 60 }} />
      </div>

      <div className="lms-page">
        {/* Star balance hero */}
        <div className="lms-star-hero" style={{ marginBottom: 24 }}>
          {isLoading ? (
            <Spinner shade="onMedia" size="sm" />
          ) : (
            <>
              <Text className="lms-star-hero__value">⭐ {starBalance}</Text>
              <Text className="lms-star-hero__label">Số sao hiện có</Text>
            </>
          )}
        </div>

        <Heading level={4} className="lms-page__title">Danh sách quà</Heading>

        {isLoading && <HStack justify="center"><Spinner /></HStack>}

        {error && <Banner status="error" title="Lỗi" description={error.message} />}

        {redeemMut.isError && (
          <Banner status="error" title={redeemMut.error.message} style={{ marginBottom: 16 }} />
        )}

        {redeemMut.isSuccess && (
          <Banner
            status="success"
            title="Đổi quà thành công! Nhân viên sẽ xác nhận và giao quà cho bạn."
            style={{ marginBottom: 16 }}
          />
        )}

        {gifts.length === 0 && !isLoading && (
          <Banner status="info" title="Chưa có quà nào trong danh mục." />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {gifts.map((gift) => {
            const canAfford = starBalance >= gift.starsRequired;
            const outOfStock = gift.stock === 0;
            return (
              <div
                key={gift.id}
                style={{
                  padding: 12,
                  border: '1px solid var(--cmc-border)',
                  borderRadius: 'var(--cmc-radius-xs)',
                  background: 'var(--cmc-surface)',
                  opacity: outOfStock ? 0.5 : 1,
                }}
              >
                {gift.imageUrl && (
                  <img
                    src={gift.imageUrl}
                    alt={gift.name}
                    style={{
                      width: '100%',
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 'var(--cmc-radius-xs)',
                      marginBottom: 8,
                    }}
                  />
                )}
                <Text
                  weight="bold"
                  size="sm"
                  display="block"
                  maxLines={2}
                  style={{ marginBottom: 4 }}
                >
                  {gift.name}
                </Text>
                <HStack gap={0.5} style={{ marginBottom: 8 }}>
                  <Badge label={`⭐ ${gift.starsRequired}`} variant={canAfford ? 'green' : 'neutral'} />
                  {outOfStock && <Badge label="Hết hàng" variant="red" />}
                  {gift.stock > 0 && <Badge label={`Còn ${gift.stock}`} variant="blue" />}
                </HStack>
                <Button
                  size="sm"
                  style={{ width: '100%' }}
                  label={canAfford ? 'Đổi quà' : 'Chưa đủ sao'}
                  isDisabled={!canAfford || outOfStock || redeemMut.isPending}
                  isLoading={redeemMut.isPending && redeemMut.variables?.giftId === gift.id}
                  onClick={() => redeemMut.mutate({ giftId: gift.id })}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
