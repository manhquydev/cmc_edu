// See button-only.tsx for context.
import { Table } from '@astryxdesign/core/Table';

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
}

const rows: Row[] = [{ id: '1', name: 'A' }];

export default function TableOnly() {
  return (
    <Table<Row>
      data={rows}
      idKey="id"
      columns={[{ key: 'name', header: 'Tên', width: { type: 'proportional', value: 1 } }]}
    />
  );
}
