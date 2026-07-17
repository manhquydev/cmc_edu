import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { VerificationResult } from './types.js';
import { renderLayout } from './templates/layout.js';
import { renderBuilderTab } from './templates/builder-tab.js';
import { renderAcceptanceTab } from './templates/acceptance-tab.js';

export function render(result: VerificationResult, outputDir: string): void {
  const html = renderLayout({
    generatedAt: result.generatedAt,
    commit: result.commit,
    acceptanceTabHtml: renderAcceptanceTab(result),
    builderTabHtml: renderBuilderTab(result),
  });
  writeFileSync(path.join(outputDir, 'index.html'), html);
}
