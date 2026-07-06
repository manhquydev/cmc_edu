// CMC MCP server — stdio transport entry point.
//
// WALK-PHASE STUB: @modelcontextprotocol/sdk is not yet installed in this
// monorepo. This file contains the intended implementation shape. To activate:
//
//   1. pnpm --filter @cmc/mcp-server add @modelcontextprotocol/sdk
//   2. Uncomment the real imports below and delete the stub block.
//   3. Wire real tRPC callers in src/tools.ts with an 'ai:recon' principal.
//
// Intended implementation (uncomment after installing the SDK):
//
// import { Server } from '@modelcontextprotocol/sdk/server/index.js';
// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// import { tools, callTool } from './tools.js';
//
// const server = new Server(
//   { name: 'cmc-mcp', version: '0.1.0' },
//   { capabilities: { tools: {} } },
// );
// server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
// server.setRequestHandler(CallToolRequestSchema, async (req) =>
//   callTool(req.params.name, req.params.arguments ?? {}),
// );
// const transport = new StdioServerTransport();
// await server.connect(transport);

// Stub: exits cleanly until the SDK is installed and real handlers are wired.
import { tools, callTool } from './tools.js';

// Expose tool metadata so package consumers can inspect the surface without
// needing the MCP runtime (useful for documentation / registry tooling).
export { tools, callTool };

// When executed directly as a bin entry point, emit the tool list to stdout
// so a caller can verify the package is installed correctly.
if (process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts')) {
  process.stdout.write(
    JSON.stringify({ status: 'skeleton', tools: tools.map((t) => t.name) }, null, 2) + '\n',
  );
  process.stdout.write(
    '// NOTE: @modelcontextprotocol/sdk not installed — run walk-phase setup.\n',
  );
}
