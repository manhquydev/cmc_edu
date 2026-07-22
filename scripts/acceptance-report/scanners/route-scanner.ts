// Walks apps/admin/src/routes/index.tsx and apps/lms/src/routes/index.tsx
// (React Router `createBrowserRouter([...])` trees) and composes full URL
// paths from the nested `path` segments. Route files use RELATIVE segments
// (`path: 'new'`, `index: true`) composed by a parent `{ path: 'finance',
// children: financeRoutes }` — a flat glob on the module files would not see
// the composed prefix, so this scanner follows the same import graph the
// app actually uses (finance.routes.tsx etc. imported into index.tsx).

import { Project, SyntaxKind, type ArrayLiteralExpression, type Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const ADMIN_ROUTES_ENTRY = path.join(REPO_ROOT, 'apps/admin/src/routes/index.tsx');
const LMS_ROUTES_ENTRY = path.join(REPO_ROOT, 'apps/lms/src/routes/index.tsx');

/** A route that exists, and whether what it renders is a real screen.
 *
 *  A flow whose screen is a placeholder is not built, however complete its
 *  procedures and models look — counting it as built is how the ledger ends up
 *  claiming a feature nobody can use. */
export interface UiRouteInfo {
  path: string;
  placeholder: boolean;
  /** `coming-soon`: the route renders the shared ComingSoon element directly.
   *  `empty-state`: the page file renders an EmptyState and calls no procedure. */
  placeholderKind?: 'coming-soon' | 'empty-state';
  /** Page file backing the route, when one could be resolved. */
  pageFile?: string;
}

export function scanUiRoutes(): Set<string> {
  return new Set(scanUiRoutesDetailed().keys());
}

export function scanUiRoutesDetailed(): Map<string, UiRouteInfo> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const routes = new Map<string, UiRouteInfo>();

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

function walkRouteArray(hostFile: SourceFile, arr: ArrayLiteralExpression, prefix: string, out: Map<string, UiRouteInfo>): void {
  for (const el of arr.getElements()) {
    if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    walkRouteObject(hostFile, el.asKindOrThrow(SyntaxKind.ObjectLiteralExpression), prefix, out);
  }
}

function walkRouteObject(hostFile: SourceFile, obj: ObjectLiteralExpression, prefix: string, out: Map<string, UiRouteInfo>): void {
  const pathProp = obj.getProperty('path');
  const indexProp = obj.getProperty('index');
  const childrenProp = obj.getProperty('children');

  let nextPrefix = prefix;
  if (pathProp?.isKind(SyntaxKind.PropertyAssignment)) {
    const init = pathProp.getInitializer();
    const raw = init && init.isKind(SyntaxKind.StringLiteral) ? init.getLiteralText() : undefined;
    if (raw !== undefined && raw !== '*') {
      nextPrefix = composePath(prefix, raw);
      record(out, nextPrefix, hostFile, obj);
    } else if (raw === '*') {
      // Wildcard fallback route — not a real business flow, skip.
      return;
    }
  }

  if (
    indexProp?.isKind(SyntaxKind.PropertyAssignment) &&
    indexProp.getInitializer()?.getText() === 'true'
  ) {
    record(out, prefix || '/', hostFile, obj);
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

/** Shared element rendered where a screen has not been built yet. */
const COMING_SOON_TAG = 'ComingSoon';

function record(
  out: Map<string, UiRouteInfo>,
  routePath: string,
  hostFile: SourceFile,
  obj: ObjectLiteralExpression,
): void {
  const classified = classifyElement(hostFile, obj);
  const existing = out.get(routePath);

  // A path is often recorded twice: once by the parent that owns the segment
  // (`{ path: 'hr', children }`, which renders nothing itself) and once by the
  // child that actually renders it (`{ index: true, element }`). Keep whichever
  // record carries an element, or the parent would mask the index route's
  // ComingSoon and every such screen would count as built.
  if (existing && (!classified || existingHasElement(existing))) return;
  out.set(routePath, { path: routePath, ...(classified ?? { placeholder: false }) });
}

function classifyElement(
  hostFile: SourceFile,
  obj: ObjectLiteralExpression,
): { placeholder: boolean; placeholderKind?: UiRouteInfo['placeholderKind']; pageFile?: string } | undefined {
  const elementProp = obj.getProperty('element');
  if (!elementProp?.isKind(SyntaxKind.PropertyAssignment)) return undefined;
  const initializer = elementProp.getInitializer();
  if (!initializer) return undefined;

  const tags = renderedTags(initializer);

  // Every real route wraps its page in `<Suspense fallback={<Fallback />}>`,
  // and that Fallback renders ComingSoon. Matching tags anywhere in the element
  // would therefore mark every screen a placeholder — `renderedTags` skips
  // anything inside a JSX attribute for exactly this reason.
  if (tags.includes(COMING_SOON_TAG)) return { placeholder: true, placeholderKind: 'coming-soon' };

  for (const tag of tags) {
    const pageFile = resolveLazyPageFile(hostFile, tag);
    if (!pageFile) continue;
    return {
      placeholder: isEmptyStatePlaceholder(pageFile),
      ...(isEmptyStatePlaceholder(pageFile) ? { placeholderKind: 'empty-state' as const } : {}),
      pageFile: path.relative(REPO_ROOT, pageFile),
    };
  }

  return { placeholder: false };
}

/** Whether a recorded route already resolved to something renderable. */
function existingHasElement(info: UiRouteInfo): boolean {
  return info.placeholder || info.pageFile !== undefined;
}

/** JSX tag names actually rendered by this element, ignoring anything passed as
 *  an attribute value (`fallback={<Fallback />}` is not what the route shows). */
function renderedTags(node: Node): string[] {
  const tags: string[] = [];
  // `getDescendantsOfKind` excludes the node itself, and a route element is
  // often exactly one self-closing tag (`element: <ComingSoon />`) — omitting
  // self made every such route look like an ordinary screen.
  const selfNodes = node.isKind(SyntaxKind.JsxSelfClosingElement)
    ? [node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement)]
    : [];
  for (const opening of [
    ...selfNodes,
    ...node.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]) {
    if (opening.getFirstAncestorByKind(SyntaxKind.JsxAttribute)) continue;
    tags.push(opening.getTagNameNode().getText());
  }
  return tags;
}

/** Resolves `const X = lazy(() => import('../pages/...js'))` to its page file.
 *  Wrappers (Suspense, PermissionGate, layout shells) are not lazy declarations,
 *  so they fall out of consideration without needing a maintained ignore list. */
function resolveLazyPageFile(hostFile: SourceFile, tagName: string): string | undefined {
  const decl = hostFile.getVariableDeclaration(tagName);
  const call = decl?.getInitializerIfKind(SyntaxKind.CallExpression);
  if (!call || call.getExpression().getText() !== 'lazy') return undefined;

  const specifier = call.getDescendantsOfKind(SyntaxKind.StringLiteral)[0]?.getLiteralText();
  if (!specifier?.startsWith('.')) return undefined;

  const base = path.resolve(path.dirname(hostFile.getFilePath()), specifier.replace(/\.js$/, ''));
  for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** A page that renders an EmptyState and calls no procedure is not a screen —
 *  it is a note saying the screen does not exist. Detecting it by behaviour
 *  rather than by wording survives someone rephrasing the message. */
function isEmptyStatePlaceholder(pageFile: string): boolean {
  const source = readFileSync(pageFile, 'utf8');
  return source.includes('EmptyState') && !/\btrpc\./.test(source);
}

function composePath(prefix: string, segment: string): string {
  if (segment.startsWith('/')) return segment;
  const base = prefix === '' ? '' : prefix;
  return `${base}/${segment}`.replace(/\/{2,}/g, '/');
}
