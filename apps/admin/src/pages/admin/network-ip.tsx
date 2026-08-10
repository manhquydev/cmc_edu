import { useState } from 'react';
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  DataTable,
  DetailPage,
  Dialog,
  DialogHeader,
  EmptyState,
  HStack,
  LineIcon,
  PageHeader,
  SettingsSection,
  SettingsShell,
  Stack,
  Text,
  TextInput,
} from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { captureGeolocation } from '../../lib/capture-geolocation.js';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

interface NetworkRow {
  id: string;
  cidr: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
  [key: string]: unknown;
}

interface CreateForm {
  cidr: string;
  label: string;
}

const EMPTY_CREATE_FORM: CreateForm = { cidr: '', label: '' };

/** Prefix bits for IPv4 CIDR; null if unparsable. */
export function cidrPrefixBits(cidr: string): number | null {
  const m = cidr.trim().match(/\/(\d{1,2})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 0 && n <= 32 ? n : null;
}

interface GeofenceRow {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  accuracyMaxM: number;
  label: string;
  isActive: boolean;
  [key: string]: unknown;
}

interface GeoCreateForm {
  lat: string;
  lng: string;
  radiusM: string;
  accuracyMaxM: string;
  label: string;
}

const EMPTY_GEO_FORM: GeoCreateForm = {
  lat: '',
  lng: '',
  radiusM: '200',
  accuracyMaxM: '200',
  label: '',
};

function NetworkIpContent() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.facilityNetwork.list.useQuery();
  const geoQuery = trpc.facilityGeofence.list.useQuery();
  const detectQuery = trpc.facilityNetwork.detectMyIp.useQuery(undefined, { enabled: false });
  const [settingsNav, setSettingsNav] = useState<'list' | 'geo' | 'guide'>('list');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [detectNotice, setDetectNotice] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<NetworkRow | null>(null);
  const [editForm, setEditForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [deleteTarget, setDeleteTarget] = useState<NetworkRow | null>(null);

  const [geoCreateOpen, setGeoCreateOpen] = useState(false);
  const [geoForm, setGeoForm] = useState<GeoCreateForm>(EMPTY_GEO_FORM);
  const [geoAccuracyHint, setGeoAccuracyHint] = useState<string | null>(null);
  const [geoCreatedBanner, setGeoCreatedBanner] = useState(false);
  const [geoDeleteTarget, setGeoDeleteTarget] = useState<GeofenceRow | null>(null);
  const [activateConfirm, setActivateConfirm] = useState<GeofenceRow | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<GeofenceRow | null>(null);
  const [testResults, setTestResults] = useState<
    Array<{
      id: string;
      label: string;
      distanceM: number;
      accuracyOk: boolean;
      within: boolean;
      accuracyMaxM: number;
    }> | null
  >(null);
  const [testLoading, setTestLoading] = useState(false);

  const createMut = trpc.facilityNetwork.create.useMutation({
    onSuccess: () => {
      closeCreateModal();
      void utils.facilityNetwork.list.invalidate();
    },
  });
  const updateMut = trpc.facilityNetwork.update.useMutation({
    onSuccess: () => {
      setEditRow(null);
      void utils.facilityNetwork.list.invalidate();
    },
  });
  const deleteMut = trpc.facilityNetwork.delete.useMutation({
    onSuccess: () => void utils.facilityNetwork.list.invalidate(),
  });

  const geoCreateMut = trpc.facilityGeofence.create.useMutation({
    onSuccess: () => {
      setGeoCreateOpen(false);
      setGeoForm(EMPTY_GEO_FORM);
      setGeoAccuracyHint(null);
      setGeoCreatedBanner(true);
      void utils.facilityGeofence.list.invalidate();
    },
  });
  const geoUpdateMut = trpc.facilityGeofence.update.useMutation({
    onSuccess: () => {
      setActivateConfirm(null);
      setDeactivateConfirm(null);
      void utils.facilityGeofence.list.invalidate();
    },
  });
  const geoDeleteMut = trpc.facilityGeofence.delete.useMutation({
    onSuccess: () => {
      setGeoDeleteTarget(null);
      void utils.facilityGeofence.list.invalidate();
    },
  });
  function closeCreateModal() {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setDetectNotice(null);
  }

  function openEditModal(row: NetworkRow) {
    setEditRow(row);
    setEditForm({ cidr: row.cidr, label: row.label });
  }

  async function handleDetect() {
    const result = await detectQuery.refetch();
    const suggested = result.data?.suggestedCidr32;
    if (suggested) {
      setCreateForm((f) => ({ ...f, cidr: suggested }));
      setDetectNotice(null);
    } else {
      setDetectNotice('Không xác định được IP tự động — vui lòng nhập tay theo hướng dẫn bên dưới.');
    }
  }

  async function handleUseCurrentLocation() {
    const geo = await captureGeolocation();
    if (!geo) {
      setGeoAccuracyHint('Không lấy được vị trí — dán tọa độ từ Google Maps hoặc thử lại.');
      return;
    }
    setGeoForm((f) => ({
      ...f,
      lat: geo.lat.toFixed(6),
      lng: geo.lng.toFixed(6),
    }));
    if (geo.accuracyM > 100) {
      setGeoAccuracyHint(
        `Sai số GPS ±${Math.round(geo.accuracyM)}m — khuyến cáo ra ngoài trời hoặc tăng ngưỡng sai số.`,
      );
    } else {
      setGeoAccuracyHint(`Đã điền vị trí hiện tại (sai số ±${Math.round(geo.accuracyM)}m).`);
    }
  }

  async function handleTestPosition() {
    setTestLoading(true);
    setTestResults(null);
    const geo = await captureGeolocation();
    if (!geo) {
      setTestResults([]);
      setTestLoading(false);
      return;
    }
    // Use utils client fetch — the hook above is only for typing; call via mutation-style refetch with input.
    try {
      const rows = await utils.facilityGeofence.testMyPosition.fetch({
        lat: geo.lat,
        lng: geo.lng,
        accuracyM: geo.accuracyM,
      });
      setTestResults(rows);
    } catch {
      setTestResults([]);
    } finally {
      setTestLoading(false);
    }
  }

  const rows = (data as NetworkRow[] | undefined) ?? [];
  const geoRows = (geoQuery.data as GeofenceRow[] | undefined) ?? [];
  const activeNetworks = rows.filter((r) => r.isActive).length;
  const activeGeofences = geoRows.filter((r) => r.isActive).length;

  function requestToggleGeofence(row: GeofenceRow) {
    if (!row.isActive) {
      // Activating
      if (activeGeofences === 0 && activeNetworks === 0) {
        setActivateConfirm(row);
        return;
      }
      geoUpdateMut.mutate({ id: row.id, isActive: true });
      return;
    }
    // Deactivating
    if (activeGeofences === 1 && activeNetworks === 0) {
      setDeactivateConfirm(row);
      return;
    }
    geoUpdateMut.mutate({ id: row.id, isActive: false });
  }

  function requestDeleteGeofence(row: GeofenceRow) {
    if (row.isActive && activeGeofences === 1 && activeNetworks === 0) {
      setDeactivateConfirm(row); // reuse open-mode warning; delete after confirm path
      // Actually plan: confirm on last active delete too — store as delete after confirm
      setGeoDeleteTarget(row);
      setDeactivateConfirm(row);
      return;
    }
    setGeoDeleteTarget(row);
  }

  const COLUMNS: TableColumn<NetworkRow>[] = [
    { key: 'cidr', label: 'CIDR', width: 180 },
    { key: 'label', label: 'Nhãn' },
    {
      key: 'isActive',
      label: 'Trạng thái',
      width: 120,
      render: (v) => (
        <Badge label={Boolean(v) ? 'Đang bật' : 'Đang tắt'} variant={Boolean(v) ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'id',
      label: 'Hành động',
      width: 220,
      render: (_v, row) => (
        <HStack gap={1}>
          <Button
            label={row.isActive ? 'Tắt' : 'Bật'}
            size="sm"
            variant="secondary"
            onClick={() => updateMut.mutate({ id: row.id, isActive: !row.isActive })}
          />
          <Button label="Sửa" size="sm" variant="secondary" onClick={() => openEditModal(row)} />
          <Button label="Xoá" size="sm" variant="secondary" onClick={() => setDeleteTarget(row)} />
        </HStack>
      ),
    },
  ];

  const GEO_COLUMNS: TableColumn<GeofenceRow>[] = [
    { key: 'label', label: 'Nhãn' },
    {
      key: 'lat',
      label: 'Tọa độ',
      width: 180,
      render: (_v, row) => `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`,
    },
    { key: 'radiusM', label: 'Bán kính (m)', width: 110 },
    { key: 'accuracyMaxM', label: 'Ngưỡng sai số', width: 120 },
    {
      key: 'isActive',
      label: 'Trạng thái',
      width: 110,
      render: (v) => (
        <Badge label={Boolean(v) ? 'Đang bật' : 'Đang tắt'} variant={Boolean(v) ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'id',
      label: 'Hành động',
      width: 160,
      render: (_v, row) => (
        <HStack gap={1}>
          <Button
            label={row.isActive ? 'Tắt' : 'Bật'}
            size="sm"
            variant="secondary"
            onClick={() => requestToggleGeofence(row)}
          />
          <Button label="Xoá" size="sm" variant="secondary" onClick={() => requestDeleteGeofence(row)} />
        </HStack>
      ),
    },
  ];

  const canSubmitCreate = createForm.cidr.trim().length > 0;
  const canSubmitEdit = editForm.cidr.trim().length > 0;
  const createPrefix = cidrPrefixBits(createForm.cidr);
  const editPrefix = cidrPrefixBits(editForm.cidr);
  const canSubmitGeo =
    geoForm.lat.trim().length > 0 &&
    geoForm.lng.trim().length > 0 &&
    Number(geoForm.radiusM) >= 100 &&
    Number(geoForm.accuracyMaxM) >= 50;

  return (
    <>
      <DetailPage
        density="ops"
        header={
          <PageHeader
            title="Chấm công & vị trí"
            subtitle="Dải IP và vùng GPS được phép chấm công tại cơ sở"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Chấm công & vị trí' }]}
            actions={
              settingsNav === 'list' ? (
                <Button label="Thêm dải mạng" size="sm" variant="primary" onClick={() => setCreateOpen(true)} />
              ) : settingsNav === 'geo' ? (
                <Button
                  label="Thêm vùng GPS"
                  size="sm"
                  variant="primary"
                  onClick={() => setGeoCreateOpen(true)}
                />
              ) : undefined
            }
          />
        }
      >
        <SettingsShell
          title="Chấm công & vị trí"
          activeId={settingsNav}
          onSelect={(id) => setSettingsNav(id as 'list' | 'geo' | 'guide')}
          items={[
            { id: 'list', label: 'Dải mạng', description: 'Thêm, sửa, xoá CIDR / bật tắt' },
            { id: 'geo', label: 'Vùng GPS', description: 'Geofence · kiểm tra vị trí' },
            { id: 'guide', label: 'Hướng dẫn', description: 'CIDR · GPS · ngoài mạng' },
          ]}
        >
          {settingsNav === 'list' ? (
            <Stack gap={2} padding={4}>
              <Banner
                status="info"
                title="Ảnh hưởng khi bật dải mạng / vùng GPS"
                description="Bật dải mạng hoặc vùng GPS sẽ kết thúc chế độ mở: chấm công ngoài mạng/vùng cần nhập lý do + tạo yêu cầu duyệt. Thêm mới mặc định tắt — kiểm tra trước khi bật."
              />
              {updateMut.error && !editRow && <Banner status="error" title={updateMut.error.message} />}
              {deleteMut.error && <Banner status="error" title={deleteMut.error.message} />}
              <DataTable<NetworkRow>
                columns={COLUMNS}
                data={rows}
                loading={isLoading}
                error={error?.message}
                empty="Chưa có dải mạng nào"
              />
            </Stack>
          ) : settingsNav === 'geo' ? (
            <Stack gap={2} padding={4}>
              <Banner
                status="info"
                title="Vùng vị trí GPS"
                description="Nhân viên trong bán kính + sai số GPS hợp lệ được chấm như trong mạng. Vùng mới mặc định TẮT."
              />
              {geoCreatedBanner && (
                <Banner
                  status="warning"
                  title="Vùng đang TẮT"
                  description="Bấm Kiểm tra vị trí rồi bật vùng khi đã đứng đúng tại cơ sở."
                />
              )}
              <HStack gap={1}>
                <Button
                  label={testLoading ? 'Đang kiểm tra…' : 'Kiểm tra vị trí hiện tại'}
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleTestPosition()}
                  isDisabled={testLoading}
                />
              </HStack>
              {testResults && testResults.length === 0 && (
                <Banner status="warning" title="Không lấy được vị trí hoặc chưa có vùng." />
              )}
              {testResults && testResults.length > 0 && (
                <Stack gap={1}>
                  {testResults.map((r) => {
                    let msg: string;
                    if (r.within) {
                      msg = `TRONG vùng — cách tâm ${Math.round(r.distanceM)}m`;
                    } else if (!r.accuracyOk) {
                      msg = `Trong bán kính nhưng sai số vượt ngưỡng ${r.accuracyMaxM}m — cách tâm ${Math.round(r.distanceM)}m`;
                    } else {
                      msg = `NGOÀI vùng — cách tâm ${Math.round(r.distanceM)}m`;
                    }
                    return (
                      <Text key={r.id} type="supporting" size="2xs">
                        {r.label || r.id.slice(0, 8)}: {msg}
                      </Text>
                    );
                  })}
                </Stack>
              )}
              <DataTable<GeofenceRow>
                columns={GEO_COLUMNS}
                data={geoRows}
                loading={geoQuery.isLoading}
                error={geoQuery.error?.message}
                empty="Chưa có vùng GPS nào"
              />
            </Stack>
          ) : (
            <Stack gap={3} padding={4} style={{ maxWidth: 640 }}>
              <SettingsSection
                title="Hướng dẫn nhập CIDR"
                description="Dùng khi nút tự dò không chính xác (proxy / CDN / IP di động)."
              >
                <Text type="body" size="sm">
                  CIDR là dải IP, ví dụ <code>192.168.1.0/24</code> (cả dải văn phòng) hoặc một IP
                  đơn <code>10.0.0.5/32</code>. Có thể tự tra IP công cộng (vd. whatismyip) rồi nhập
                  tay trong form Thêm dải mạng. Dải rộng hơn /29 có cảnh báo CGNAT.
                </Text>
              </SettingsSection>
              <SettingsSection title="Vùng GPS" description="Đường dự phòng khi WiFi/IP cơ sở hỏng.">
                <Text type="body" size="sm">
                  Tại cơ sở: dùng «Vị trí hiện tại». Từ xa: dán lat/lng từ Google Maps. Bật vùng đầu
                  tiên khi chưa có mạng active sẽ tắt chế độ mở — xác nhận rõ trước khi bật.
                </Text>
              </SettingsSection>
              <SettingsSection title="Hệ quả khi bật" description="Liên quan chấm công ngoài mạng/vùng.">
                <Text type="body" size="sm">
                  Khi có dải hoặc vùng đang bật, chấm công ngoài mạng/vùng yêu cầu lý do và tạo yêu
                  cầu duyệt. Luôn kiểm tra kỹ trước khi bật.
                </Text>
              </SettingsSection>
              <Button
                label="Quay lại danh sách"
                size="sm"
                variant="secondary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setSettingsNav('list')}
              />
            </Stack>
          )}
        </SettingsShell>
      </DetailPage>

      {/* Network create */}
      <Dialog
        isOpen={createOpen}
        onOpenChange={(next) => {
          if (!next && !createMut.isPending) closeCreateModal();
        }}
        purpose="form"
        width={420}
      >
        <DialogHeader
          title="Thêm dải mạng"
          onOpenChange={(next) => {
            if (!next && !createMut.isPending) closeCreateModal();
          }}
        />
        <Stack gap={2} padding={4}>
          <Button
            label="Lấy IP hiện tại của tôi"
            size="sm"
            variant="secondary"
            onClick={() => void handleDetect()}
          />
          {detectNotice && <Banner status="warning" title={detectNotice} />}
          <TextInput
            label="CIDR"
            placeholder="VD: 10.0.0.5/32 hoặc 192.168.1.0/24"
            value={createForm.cidr}
            onChange={(v) => setCreateForm((f) => ({ ...f, cidr: v }))}
            isRequired
          />
          {createPrefix !== null && createPrefix < 29 && (
            <Banner
              status="warning"
              title="Dải rất rộng"
              description="CGNAT có thể cho cả thuê bao khác của ISP vào 'trong mạng'. Khuyến nghị /32."
            />
          )}
          <TextInput
            label="Nhãn"
            placeholder="VD: Văn phòng chính"
            value={createForm.label}
            onChange={(v) => setCreateForm((f) => ({ ...f, label: v }))}
          />
          {createMut.error && (
            <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>{createMut.error.message}</span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
            <Button label="Hủy" variant="secondary" onClick={closeCreateModal} isDisabled={createMut.isPending} />
            <Button
              label="Tạo"
              variant="primary"
              onClick={() =>
                createMut.mutate({ cidr: createForm.cidr.trim(), label: createForm.label.trim() })
              }
              isLoading={createMut.isPending}
              isDisabled={!canSubmitCreate}
            />
          </HStack>
        </Stack>
      </Dialog>

      {/* Network edit */}
      <Dialog
        isOpen={editRow !== null}
        onOpenChange={(next) => {
          if (!next && !updateMut.isPending) setEditRow(null);
        }}
        purpose="form"
        width={420}
      >
        <DialogHeader
          title="Sửa dải mạng"
          onOpenChange={(next) => {
            if (!next && !updateMut.isPending) setEditRow(null);
          }}
        />
        <Stack gap={2} padding={4}>
          <TextInput
            label="CIDR"
            value={editForm.cidr}
            onChange={(v) => setEditForm((f) => ({ ...f, cidr: v }))}
            isRequired
          />
          {editPrefix !== null && editPrefix < 29 && (
            <Banner
              status="warning"
              title="Dải rất rộng"
              description="CGNAT có thể cho cả thuê bao khác của ISP vào 'trong mạng'. Khuyến nghị /32."
            />
          )}
          <TextInput
            label="Nhãn"
            value={editForm.label}
            onChange={(v) => setEditForm((f) => ({ ...f, label: v }))}
          />
          {updateMut.error && (
            <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>{updateMut.error.message}</span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
            <Button label="Hủy" variant="secondary" onClick={() => setEditRow(null)} isDisabled={updateMut.isPending} />
            <Button
              label="Lưu"
              variant="primary"
              onClick={() =>
                editRow &&
                updateMut.mutate({ id: editRow.id, cidr: editForm.cidr.trim(), label: editForm.label.trim() })
              }
              isLoading={updateMut.isPending}
              isDisabled={!canSubmitEdit}
            />
          </HStack>
        </Stack>
      </Dialog>

      {/* Geofence create */}
      <Dialog
        isOpen={geoCreateOpen}
        onOpenChange={(next) => {
          if (!next && !geoCreateMut.isPending) {
            setGeoCreateOpen(false);
            setGeoForm(EMPTY_GEO_FORM);
            setGeoAccuracyHint(null);
          }
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title="Thêm vùng vị trí GPS"
          onOpenChange={(next) => {
            if (!next && !geoCreateMut.isPending) {
              setGeoCreateOpen(false);
              setGeoForm(EMPTY_GEO_FORM);
              setGeoAccuracyHint(null);
            }
          }}
        />
        <Stack gap={2} padding={4}>
          <Button
            label="Dùng vị trí hiện tại"
            size="sm"
            variant="secondary"
            onClick={() => void handleUseCurrentLocation()}
          />
          {geoAccuracyHint && <Banner status="info" title={geoAccuracyHint} />}
          <TextInput
            label="Vĩ độ (lat)"
            placeholder="21.02851"
            value={geoForm.lat}
            onChange={(v) => setGeoForm((f) => ({ ...f, lat: v }))}
            isRequired
          />
          <TextInput
            label="Kinh độ (lng)"
            placeholder="105.85420"
            value={geoForm.lng}
            onChange={(v) => setGeoForm((f) => ({ ...f, lng: v }))}
            isRequired
          />
          <TextInput
            label="Bán kính (m)"
            placeholder="200"
            value={geoForm.radiusM}
            onChange={(v) => setGeoForm((f) => ({ ...f, radiusM: v }))}
          />
          <TextInput
            label="Ngưỡng sai số GPS (m)"
            placeholder="200"
            value={geoForm.accuracyMaxM}
            onChange={(v) => setGeoForm((f) => ({ ...f, accuracyMaxM: v }))}
          />
          <Text type="supporting" size="2xs">
            Tăng ngưỡng nếu nhân viên trong nhà hay bị báo sai số vượt ngưỡng (50–1000m).
          </Text>
          <TextInput
            label="Nhãn"
            placeholder="VD: Cổng chính"
            value={geoForm.label}
            onChange={(v) => setGeoForm((f) => ({ ...f, label: v }))}
          />
          {geoCreateMut.error && (
            <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>{geoCreateMut.error.message}</span>
          )}
          <HStack justify="end" gap={1} style={{ marginTop: 'var(--cmc-space-2)' }}>
            <Button
              label="Hủy"
              variant="secondary"
              onClick={() => {
                setGeoCreateOpen(false);
                setGeoForm(EMPTY_GEO_FORM);
              }}
              isDisabled={geoCreateMut.isPending}
            />
            <Button
              label="Tạo"
              variant="primary"
              onClick={() =>
                geoCreateMut.mutate({
                  lat: Number(geoForm.lat),
                  lng: Number(geoForm.lng),
                  radiusM: Number(geoForm.radiusM) || 200,
                  accuracyMaxM: Number(geoForm.accuracyMaxM) || 200,
                  label: geoForm.label.trim(),
                })
              }
              isLoading={geoCreateMut.isPending}
              isDisabled={!canSubmitGeo}
            />
          </HStack>
        </Stack>
      </Dialog>

      <ConfirmDialog
        opened={deleteTarget !== null}
        title="Xoá dải mạng"
        message={
          deleteTarget
            ? `Xoá dải "${deleteTarget.cidr}"${deleteTarget.label ? ` (${deleteTarget.label})` : ''}? Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        loading={deleteMut.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate({ id: deleteTarget.id });
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        opened={activateConfirm !== null}
        title="Bật vùng GPS đầu tiên"
        message="Kích hoạt vùng đầu tiên sẽ TẮT chế độ mở: punch từ máy bàn không GPS / ngoài vùng sẽ thành offsite và cần lý do. Nhân viên đã punch sáng nay theo chế độ mở có thể mất credit nếu punch chiều offsite — nên bật ngoài giờ làm."
        confirmLabel="Bật vùng"
        cancelLabel="Hủy"
        loading={geoUpdateMut.isPending}
        onCancel={() => setActivateConfirm(null)}
        onConfirm={() => {
          if (activateConfirm) geoUpdateMut.mutate({ id: activateConfirm.id, isActive: true });
        }}
      />

      <ConfirmDialog
        opened={deactivateConfirm !== null && geoDeleteTarget === null}
        title="Tắt vùng GPS cuối cùng"
        message="Cơ sở sẽ về CHẾ ĐỘ MỞ: mọi punch từ bất kỳ đâu đều hợp lệ và được tính công đầy đủ, không ai review."
        confirmLabel="Tắt vùng"
        cancelLabel="Hủy"
        loading={geoUpdateMut.isPending}
        onCancel={() => setDeactivateConfirm(null)}
        onConfirm={() => {
          if (deactivateConfirm) geoUpdateMut.mutate({ id: deactivateConfirm.id, isActive: false });
        }}
      />

      <ConfirmDialog
        opened={geoDeleteTarget !== null}
        title="Xoá vùng GPS"
        message={
          geoDeleteTarget
            ? `Xoá vùng "${geoDeleteTarget.label || geoDeleteTarget.id.slice(0, 8)}"?${
                geoDeleteTarget.isActive && activeGeofences === 1 && activeNetworks === 0
                  ? ' Đây là vùng active cuối cùng — cơ sở sẽ về chế độ mở.'
                  : ''
              }`
            : ''
        }
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        loading={geoDeleteMut.isPending}
        onCancel={() => {
          setGeoDeleteTarget(null);
          setDeactivateConfirm(null);
        }}
        onConfirm={() => {
          if (geoDeleteTarget) geoDeleteMut.mutate({ id: geoDeleteTarget.id });
        }}
      />
    </>
  );
}

export default function NetworkIpPage() {
  const { canDo } = useSession();

  if (!canDo('facilityNetwork', 'manage')) {
    return (
      <>
        <PageHeader
          title="Chấm công & vị trí"
          breadcrumbs={[{ label: 'Quản trị' }, { label: 'Chấm công & vị trí' }]}
        />
        <EmptyState
          title="Không có quyền truy cập"
          description="Trang này chỉ dành cho Super Admin."
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  return <NetworkIpContent />;
}
