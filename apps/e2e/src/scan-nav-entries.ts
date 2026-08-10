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
import { Project, SyntaxKind, type ArrayLiteralExpression, type ObjectLiteralExpression } from 'ts-morph';
import type { NavEntryLike } from './screen-role-matrix.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const NAV_REGISTRY_PATH = path.join(here, '..', '..', 'admin', 'src', 'shell', 'nav-registry.ts');

function stringProp(object: ObjectLiteralExpression, name: string): string | undefined {
  const property = object.getProperty(name);
  const initializer = property?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
  return initializer?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
}

function stringArrayProp(object: ObjectLiteralExpression, name: string): string[] | undefined {
  const initializer = object
    .getProperty(name)
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializer()
    ?.asKind(SyntaxKind.ArrayLiteralExpression);
  if (!initializer) return undefined;

  return initializer.getElements().flatMap((element) => {
    const value = element.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
    return value === undefined ? [] : [value];
  });
}

export interface ScannedNavChild extends NavEntryLike {
  id: string;
  label: string;
}

export interface ScannedNavModule {
  id: string;
  label: string;
  path: string;
  roles?: readonly string[];
  children: readonly ScannedNavChild[];
}

function scanChildren(array: ArrayLiteralExpression | undefined): ScannedNavChild[] {
  if (!array) return [];

  return array.getElements().flatMap((element) => {
    const object = element.asKind(SyntaxKind.ObjectLiteralExpression);
    if (!object) return [];

    const id = stringProp(object, 'id');
    const label = stringProp(object, 'label');
    const entryPath = stringProp(object, 'path');
    if (!id || !label || !entryPath) return [];

    const permissionObject = object
      .getProperty('permission')
      ?.asKind(SyntaxKind.PropertyAssignment)
      ?.getInitializer()
      ?.asKind(SyntaxKind.ObjectLiteralExpression);
    const module = permissionObject ? stringProp(permissionObject, 'module') : undefined;
    const action = permissionObject ? stringProp(permissionObject, 'action') : undefined;

    return [
      {
        id,
        label,
        path: entryPath,
        ...(module && action ? { permission: { module, action } } : {}),
      },
    ];
  });
}

/** Parses the canonical `NAV_MODULES` hierarchy without importing the admin
 * app's React graph. Consumers retain the parent roles/landing and child
 * permission relationship instead of flattening duplicate paths into a map. */
export function scanNavModules(navRegistryPath: string = NAV_REGISTRY_PATH): ScannedNavModule[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: false } });
  const source = project.addSourceFileAtPath(navRegistryPath);
  const modules = source
    .getVariableDeclaration('NAV_MODULES')
    ?.getInitializer()
    ?.asKind(SyntaxKind.ArrayLiteralExpression);
  if (!modules) return [];

  return modules.getElements().flatMap((element) => {
    const object = element.asKind(SyntaxKind.ObjectLiteralExpression);
    if (!object) return [];

    const id = stringProp(object, 'id');
    const label = stringProp(object, 'label');
    const entryPath = stringProp(object, 'path');
    if (!id || !label || !entryPath) return [];

    return [
      {
        id,
        label,
        path: entryPath,
        ...(stringArrayProp(object, 'roles') ? { roles: stringArrayProp(object, 'roles') } : {}),
        children: scanChildren(
          object
            .getProperty('children')
            ?.asKind(SyntaxKind.PropertyAssignment)
            ?.getInitializer()
            ?.asKind(SyntaxKind.ArrayLiteralExpression),
        ),
      },
    ];
  });
}

/** Every nav entry that names a path, with its permission gate when it has one. */
export function scanNavEntries(navRegistryPath: string = NAV_REGISTRY_PATH): NavEntryLike[] {
  return scanNavModules(navRegistryPath).flatMap((module) => [
    { path: module.path },
    ...module.children.map(({ path: childPath, permission }) => ({
      path: childPath,
      ...(permission ? { permission } : {}),
    })),
  ]);
}
