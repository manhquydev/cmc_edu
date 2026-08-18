// CMC MCP server — stdio transport entry point.
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
