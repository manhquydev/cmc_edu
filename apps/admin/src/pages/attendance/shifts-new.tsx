// Compose Work Schedule — /hr/shifts/new
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@cmc/ui';
import { links, shiftRegistrationsPath } from '@cmc/links';
import { SubmitTab } from './shifts.js';

export default function ShiftsNewPage() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Soạn phiếu đăng ký ca"
        subtitle="Work Schedule · gửi → mở form chi tiết"
        breadcrumbs={[
          { label: 'Nhân sự' },
          { label: 'Work Schedule', href: shiftRegistrationsPath() },
          { label: 'Soạn mới' },
        ]}
      />
      <SubmitTab
        onSubmittedId={(id) => {
          navigate(links.shiftRegistration(id), { replace: true });
        }}
      />
    </>
  );
}
