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
const ROUTE_ENTRIES = {
  admin: ADMIN_ROUTES_ENTRY,
  lms: LMS_ROUTES_ENTRY,
} as const;

export type UiRouteApp = keyof typeof ROUTE_ENTRIES;
export type UiRouteKind = 'screen' | 'redirect' | 'dynamic-redirect' | 'placeholder' | 'fallback';

/** A route that exists, and whether what it renders is a real screen.
 *
 *  A flow whose screen is a placeholder is not built, however complete its
 *  procedures and models look — counting it as built is how the ledger ends up
 *  claiming a feature nobody can use. */
export interface UiRouteInfo {
  path: string;
  app: UiRouteApp;
  kind: UiRouteKind;
  placeholder: boolean;
  /** `coming-soon`: the route renders the shared ComingSoon element directly.
   *  `empty-state`: the page file renders an EmptyState and calls no procedure. */
  placeholderKind?: 'coming-soon' | 'empty-state';
  /** Page file backing the route, when one could be resolved. */
  pageFile?: string;
  /** A static redirect target when the route renders `<Navigate to="…" />`. */
  redirectTarget?: string;
  /** A dynamic resolver can redirect valid parameters but render an explicit
   * fallback for invalid values. This is not a missing screen. */
  fallbackKind?: 'invalid-id-empty-state';
}

export function scanUiRoutes(): Set<string> {
  return new Set(scanUiRoutesDetailed().keys());
}

export function scanUiRoutesDetailed(): Map<string, UiRouteInfo> {
  return scanUiRoutesDetailedFor(['admin', 'lms']);
}

/** Admin-only route inventory for ERP-specific auditing. This avoids collisions
 * with LMS routes such as `/` and `/login`, which share a path but not an app
 * origin or shell contract. */
export function scanAdminUiRoutesDetailed(): Map<string, UiRouteInfo> {
  return scanUiRoutesDetailedFor(['admin']);
}

function scanUiRoutesDetailedFor(apps: readonly UiRouteApp[]): Map<string, UiRouteInfo> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const routes = new Map<string, UiRouteInfo>();

  for (const app of apps) {
    const entry = ROUTE_ENTRIES[app];
    const file = project.addSourceFileAtPath(entry);
    const arr = findCreateBrowserRouterArray(file);
    if (arr) walkRouteArray(file, arr, '', routes, app);
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

function walkRouteArray(
  hostFile: SourceFile,
  arr: ArrayLiteralExpression,
  prefix: string,
  out: Map<string, UiRouteInfo>,
  app: UiRouteApp,
): void {
  for (const el of arr.getElements()) {
    if (el.isKind(SyntaxKind.ObjectLiteralExpression)) {
      walkRouteObject(hostFile, el.asKindOrThrow(SyntaxKind.ObjectLiteralExpression), prefix, out, app);
      continue;
    }

    // The router composes `/go/:entity/:id` with `...goRoutes`. Ignoring
    // spread elements silently made that real authorization-sensitive path
    // disappear from route inventory and acceptance evidence.
    if (el.isKind(SyntaxKind.SpreadElement)) {
      const resolved = resolveImportedRouteArray(hostFile, el.getExpression());
      if (resolved) walkRouteArray(resolved.file, resolved.arr, prefix, out, app);
    }
  }
}

function walkRouteObject(
  hostFile: SourceFile,
  obj: ObjectLiteralExpression,
  prefix: string,
  out: Map<string, UiRouteInfo>,
  app: UiRouteApp,
): void {
  const pathProp = obj.getProperty('path');
  const indexProp = obj.getProperty('index');
  const childrenProp = obj.getProperty('children');

  let nextPrefix = prefix;
  if (pathProp?.isKind(SyntaxKind.PropertyAssignment)) {
    const init = pathProp.getInitializer();
    const raw = init && init.isKind(SyntaxKind.StringLiteral) ? init.getLiteralText() : undefined;
    if (raw !== undefined && raw !== '*') {
      nextPrefix = composePath(prefix, raw);
      record(out, nextPrefix, hostFile, obj, app);
    } else if (raw === '*') {
      // Wildcard fallback route — not a real business flow, skip.
      return;
    }
  }

  if (
    indexProp?.isKind(SyntaxKind.PropertyAssignment) &&
    indexProp.getInitializer()?.getText() === 'true'
  ) {
    record(out, prefix || '/', hostFile, obj, app);
  }

  if (!childrenProp?.isKind(SyntaxKind.PropertyAssignment)) return;
  const childrenValue = childrenProp.getInitializer();
  if (!childrenValue) return;

  if (childrenValue.isKind(SyntaxKind.ArrayLiteralExpression)) {
    walkRouteArray(hostFile, childrenValue.asKindOrThrow(SyntaxKind.ArrayLiteralExpression), nextPrefix, out, app);
    return;
  }

  if (childrenValue.isKind(SyntaxKind.Identifier)) {
    const resolved = resolveImportedRouteArray(hostFile, childrenValue);
    if (resolved) walkRouteArray(resolved.file, resolved.arr, nextPrefix, out, app);
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
  app: UiRouteApp,
): void {
  const classified = classifyElement(hostFile, obj);
  const existing = out.get(routePath);

  // A path is often recorded twice: once by the parent that owns the segment
  // (`{ path: 'hr', children }`, which renders nothing itself) and once by the
  // child that actually renders it (`{ index: true, element }`). Keep whichever
  // record carries an element, or the parent would mask the index route's
  // ComingSoon and every such screen would count as built.
  if (existing && (!classified || existingHasElement(existing))) return;
  out.set(routePath, { path: routePath, app, ...(classified ?? { kind: 'screen', placeholder: false }) });
}

function classifyElement(
  hostFile: SourceFile,
  obj: ObjectLiteralExpression,
): Omit<UiRouteInfo, 'app' | 'path'> | undefined {
  const elementProp = obj.getProperty('element');
  if (!elementProp?.isKind(SyntaxKind.PropertyAssignment)) return undefined;
  const initializer = elementProp.getInitializer();
  if (!initializer) return undefined;

  const tags = renderedTags(initializer);

  // Every real route wraps its page in `<Suspense fallback={<Fallback />}>`,
  // and that Fallback renders ComingSoon. Matching tags anywhere in the element
  // would therefore mark every screen a placeholder — `renderedTags` skips
  // anything inside a JSX attribute for exactly this reason.
  if (tags.includes(COMING_SOON_TAG)) {
    return { kind: 'placeholder', placeholder: true, placeholderKind: 'coming-soon' };
  }

  const redirectTarget = staticNavigateTarget(initializer);
  if (redirectTarget) {
    return { kind: 'redirect', placeholder: false, redirectTarget };
  }

  for (const tag of tags) {
    const pageFile = resolveLazyPageFile(hostFile, tag);
    if (!pageFile) continue;
    const pagePath = path.relative(REPO_ROOT, pageFile);
    const fallbackKind = resolverFallbackKind(pagePath);
    if (fallbackKind) {
      return {
        kind: 'dynamic-redirect',
        placeholder: false,
        fallbackKind,
        pageFile: pagePath,
      };
    }

    const placeholder = isEmptyStatePlaceholder(pageFile);
    return {
      kind: placeholder ? 'placeholder' : 'screen',
      placeholder,
      ...(placeholder ? { placeholderKind: 'empty-state' as const } : {}),
      pageFile: pagePath,
    };
  }

  return { kind: 'screen', placeholder: false };
}

/** Whether a recorded route already resolved to something renderable. */
function existingHasElement(info: UiRouteInfo): boolean {
  return info.placeholder || info.pageFile !== undefined;
}

function staticNavigateTarget(node: Node): string | undefined {
  for (const element of [
    ...(node.isKind(SyntaxKind.JsxSelfClosingElement)
      ? [node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement)]
      : []),
    ...node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]) {
    if (element.getTagNameNode().getText() !== 'Navigate') continue;
    const target = element
      .getAttribute('to')
      ?.asKind(SyntaxKind.JsxAttribute)
      ?.getInitializer()
      ?.asKind(SyntaxKind.StringLiteral)
      ?.getLiteralValue();
    if (target) return target;
  }
  return undefined;
}

/** Source-audited exception to the generic EmptyState rule. The `/go` page
 * dynamically resolves valid entity/id pairs, and its EmptyState only handles
 * invalid pairs; treating the route as a placeholder would erase valid
 * deep-link navigation from acceptance evidence. */
function resolverFallbackKind(pagePath: string): UiRouteInfo['fallbackKind'] {
  return pagePath === 'apps/admin/src/pages/go-resolver.tsx'
    ? 'invalid-id-empty-state'
    : undefined;
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
