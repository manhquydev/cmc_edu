// Walks apps/admin/src/routes/index.tsx and apps/lms/src/routes/index.tsx
// (React Router `createBrowserRouter([...])` trees) and composes full URL
// paths from the nested `path` segments. Route files use RELATIVE segments
// (`path: 'new'`, `index: true`) composed by a parent `{ path: 'finance',
// children: financeRoutes }` — a flat glob on the module files would not see
// the composed prefix, so this scanner follows the same import graph the
// app actually uses (finance.routes.tsx etc. imported into index.tsx).

import { Project, SyntaxKind, type ArrayLiteralExpression, type Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const ADMIN_ROUTES_ENTRY = path.join(REPO_ROOT, 'apps/admin/src/routes/index.tsx');
const LMS_ROUTES_ENTRY = path.join(REPO_ROOT, 'apps/lms/src/routes/index.tsx');

export function scanUiRoutes(): Set<string> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const routes = new Set<string>();

  for (const entry of [ADMIN_ROUTES_ENTRY, LMS_ROUTES_ENTRY]) {
    const file = project.addSourceFileAtPath(entry);
    const arr = findCreateBrowserRouterArray(file);
    if (arr) walkRouteArray(file, arr, '', routes);
  }

  return routes;
}

function findCreateBrowserRouterArray(file: SourceFile): ArrayLiteralExpression | undefined {
  const call = file
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((c) => c.getExpression().getText() === 'createBrowserRouter');
  const arg = call?.getArguments()[0];
  return arg?.isKind(SyntaxKind.ArrayLiteralExpression) ? arg.asKindOrThrow(SyntaxKind.ArrayLiteralExpression) : undefined;
}

function walkRouteArray(hostFile: SourceFile, arr: ArrayLiteralExpression, prefix: string, out: Set<string>): void {
  for (const el of arr.getElements()) {
    if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    walkRouteObject(hostFile, el.asKindOrThrow(SyntaxKind.ObjectLiteralExpression), prefix, out);
  }
}

function walkRouteObject(hostFile: SourceFile, obj: ObjectLiteralExpression, prefix: string, out: Set<string>): void {
  const pathProp = obj.getProperty('path');
  const indexProp = obj.getProperty('index');
  const childrenProp = obj.getProperty('children');

  let nextPrefix = prefix;
  if (pathProp?.isKind(SyntaxKind.PropertyAssignment)) {
    const init = pathProp.getInitializer();
    const raw = init && init.isKind(SyntaxKind.StringLiteral) ? init.getLiteralText() : undefined;
    if (raw !== undefined && raw !== '*') {
      nextPrefix = composePath(prefix, raw);
      out.add(nextPrefix);
    } else if (raw === '*') {
      // Wildcard fallback route — not a real business flow, skip.
      return;
    }
  }

  if (
    indexProp?.isKind(SyntaxKind.PropertyAssignment) &&
    indexProp.getInitializer()?.getText() === 'true'
  ) {
    out.add(prefix || '/');
  }

  if (!childrenProp?.isKind(SyntaxKind.PropertyAssignment)) return;
  const childrenValue = childrenProp.getInitializer();
  if (!childrenValue) return;

  if (childrenValue.isKind(SyntaxKind.ArrayLiteralExpression)) {
    walkRouteArray(hostFile, childrenValue.asKindOrThrow(SyntaxKind.ArrayLiteralExpression), nextPrefix, out);
    return;
  }

  if (childrenValue.isKind(SyntaxKind.Identifier)) {
    const resolved = resolveImportedRouteArray(hostFile, childrenValue);
    if (resolved) walkRouteArray(resolved.file, resolved.arr, nextPrefix, out);
  }
}

function resolveImportedRouteArray(
  hostFile: SourceFile,
  identifier: Node,
): { file: SourceFile; arr: ArrayLiteralExpression } | undefined {
  const name = identifier.getText();
  const namedImport = hostFile
    .getImportDeclarations()
    .flatMap((imp) => imp.getNamedImports())
    .find((ni) => (ni.getAliasNode()?.getText() ?? ni.getName()) === name);
  if (!namedImport) return undefined;
  // Look up the target file by the ORIGINAL exported name, not the local
  // alias — see trpc-scanner.ts for the same fix and rationale.
  const exportedName = namedImport.getName();
  const importDecl = namedImport.getImportDeclaration();

  const moduleSpecifier = importDecl.getModuleSpecifierValue();
  if (!moduleSpecifier.startsWith('.')) return undefined;
  const targetPath = path.resolve(path.dirname(hostFile.getFilePath()), `${moduleSpecifier.replace(/\.js$/, '')}.tsx`);

  const project = hostFile.getProject();
  const targetFile = project.getSourceFile(targetPath) ?? project.addSourceFileAtPath(targetPath);
  const decl = targetFile.getVariableDeclaration(exportedName);
  const init = decl?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  return init ? { file: targetFile, arr: init } : undefined;
}

function composePath(prefix: string, segment: string): string {
  if (segment.startsWith('/')) return segment;
  const base = prefix === '' ? '' : prefix;
  return `${base}/${segment}`.replace(/\/{2,}/g, '/');
}
