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
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Text,
  Title,
} from '@mantine/core';
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
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Anchor size="sm" onClick={() => navigate('/student/home')}>← Trang chủ</Anchor>
        <Text className="lms-topbar__brand">Đổi quà</Text>
        <Box w={60} />
      </Box>

      <Box className="lms-page">
        {/* Star balance hero */}
        <Box className="lms-star-hero" mb="lg">
          {isLoading ? (
            <Loader color="white" size="sm" />
          ) : (
            <>
              <Text className="lms-star-hero__value">⭐ {starBalance}</Text>
              <Text className="lms-star-hero__label">Số sao hiện có</Text>
            </>
          )}
        </Box>

        <Title order={4} className="lms-page__title">Danh sách quà</Title>

        {isLoading && <Group justify="center"><Loader /></Group>}

        {error && (
          <Alert color="red" variant="light" title="Lỗi">
            {error.message}
          </Alert>
        )}

        {redeemMut.isError && (
          <Alert color="red" variant="light" mb="md">
            {redeemMut.error.message}
          </Alert>
        )}

        {redeemMut.isSuccess && (
          <Alert color="green" variant="light" mb="md">
            Đổi quà thành công! Nhân viên sẽ xác nhận và giao quà cho bạn.
          </Alert>
        )}

        {gifts.length === 0 && !isLoading && (
          <Alert color="gray" variant="light">
            Chưa có quà nào trong danh mục.
          </Alert>
        )}

        <SimpleGrid cols={2} spacing="sm">
          {gifts.map((gift) => {
            const canAfford = starBalance >= gift.starsRequired;
            const outOfStock = gift.stock === 0;
            return (
              <Box
                key={gift.id}
                p="sm"
                style={{
                  border: '1px solid var(--cmc-border)',
                  borderRadius: 'var(--cmc-radius-xs)',
                  background: 'var(--cmc-surface)',
                  opacity: outOfStock ? 0.5 : 1,
                }}
              >
                {gift.imageUrl && (
                  <Image
                    src={gift.imageUrl}
                    alt={gift.name}
                    h={80}
                    fit="cover"
                    radius="sm"
                    mb="xs"
                  />
                )}
                <Text fw={600} size="sm" mb={4} lineClamp={2}>
                  {gift.name}
                </Text>
                <Group gap={4} mb="xs">
                  <Badge size="sm" color={canAfford ? 'green' : 'gray'} variant="light">
                    ⭐ {gift.starsRequired}
                  </Badge>
                  {outOfStock && (
                    <Badge size="xs" color="red" variant="light">Hết hàng</Badge>
                  )}
                  {gift.stock > 0 && (
                    <Badge size="xs" color="blue" variant="light">Còn {gift.stock}</Badge>
                  )}
                </Group>
                <Button
                  size="xs"
                  fullWidth
                  disabled={!canAfford || outOfStock || redeemMut.isPending}
                  loading={redeemMut.isPending && redeemMut.variables?.giftId === gift.id}
                  onClick={() => redeemMut.mutate({ giftId: gift.id })}
                >
                  {canAfford ? 'Đổi quà' : 'Chưa đủ sao'}
                </Button>
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
