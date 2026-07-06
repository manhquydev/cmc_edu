// MCP tool definitions — 3 read-only tools for the CMC agent surface.
//
// WALK-PHASE NOTE: @modelcontextprotocol/sdk is not yet installed in this
// monorepo. The tool stubs below define the shape (name, description,
// inputSchema) and return placeholder text. Real DB calls will be wired
// in walk-phase by importing the tRPC caller with an 'ai:recon' principal.
//
// To activate:
//   1. pnpm --filter @cmc/mcp-server add @modelcontextprotocol/sdk
//   2. Remove the skeleton response from callTool() and wire real callers.

export const tools = [
  {
    name: 'crm_opportunity_lookup',
    description: 'Look up a CRM opportunity by ID (read-only)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        opportunityId: { type: 'string', description: 'UUID of the Opportunity to look up' },
      },
      required: ['opportunityId'],
    },
  },
  {
    name: 'finance_receipt_list',
    description: 'List receipts for a facility (read-only)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        facilityId: { type: 'string', description: 'UUID of the Facility to scope the query' },
        status: {
          type: 'string',
          enum: ['draft', 'approved', 'sent', 'cancelled'],
          description: 'Optional status filter',
        },
      },
      required: ['facilityId'],
    },
  },
  {
    name: 'reconciliation_list_flags',
    description: 'List open reconciliation flags for review (read-only)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        facilityId: { type: 'string', description: 'UUID of the Facility to scope the query' },
      },
      required: ['facilityId'],
    },
  },
];

/**
 * Dispatches a tool call by name. Returns a skeleton response until the
 * real tRPC caller is wired in walk-phase (see header comment above).
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Skeleton: tools validated but DB calls wired in walk-phase with real agent principal.
  return {
    content: [
      {
        type: 'text',
        text: `Tool ${name} called with ${JSON.stringify(args)} — skeleton response`,
      },
    ],
  };
}
