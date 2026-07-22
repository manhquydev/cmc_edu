// Reads the admin nav registry as source rather than importing it.
//
// Importing the module would work at runtime but drags the admin app's whole
// type graph — @cmc/ui's .tsx components, React types — into this package,
// which has no React in it. Reading the source with ts-morph keeps the two
// packages decoupled and mirrors how routes are already discovered.
//
// The registry stays the single source of truth either way: nothing about the
// nav is duplicated here, only parsed.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, SyntaxKind, type ObjectLiteralExpression } from 'ts-morph';
import type { NavEntryLike } from './screen-role-matrix.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const NAV_REGISTRY_PATH = path.join(here, '..', '..', 'admin', 'src', 'shell', 'nav-registry.ts');

function stringProp(object: ObjectLiteralExpression, name: string): string | undefined {
  const property = object.getProperty(name);
  const initializer = property?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
  return initializer?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
}

/** Every nav entry that names a path, with its permission gate when it has one. */
export function scanNavEntries(navRegistryPath: string = NAV_REGISTRY_PATH): NavEntryLike[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: false } });
  const source = project.addSourceFileAtPath(navRegistryPath);

  const entries: NavEntryLike[] = [];
  for (const object of source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    const entryPath = stringProp(object, 'path');
    if (!entryPath) continue;

    const permissionObject = object
      .getProperty('permission')
      ?.asKind(SyntaxKind.PropertyAssignment)
      ?.getInitializer()
      ?.asKind(SyntaxKind.ObjectLiteralExpression);

    const module = permissionObject ? stringProp(permissionObject, 'module') : undefined;
    const action = permissionObject ? stringProp(permissionObject, 'action') : undefined;

    entries.push({
      path: entryPath,
      ...(module && action ? { permission: { module, action } } : {}),
    });
  }

  return entries;
}
