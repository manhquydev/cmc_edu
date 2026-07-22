// Parses apps/api/src/router.ts's `appRouter` object literal as the single
// source of namespace -> router truth. Follows the import graph to each
// router's real file regardless of filename (no glob on `router*.ts` —
// red-team R1 #4/#7 showed that misses ~7 real routers and mis-keys
// namespace<->filename). Resolves `mergeRouters(a, b)` and multi-export
// files (one file exporting several named router consts) by import-name
// lookup, not file-path convention.

import { Project, SyntaxKind, type Identifier, type Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const ROUTER_ENTRY = path.join(REPO_ROOT, 'apps/api/src/router.ts');

export interface TrpcScanResult {
  /** All appRouter object keys, in source order (39 expected: health + 38 mounted routers). */
  namespaces: string[];
  /** "namespace.procedure" for resolved sub-router procedures; bare "namespace" for leaf procedures (e.g. "health"). */
  procedures: Set<string>;
  /** Namespaces ts-morph could not statically resolve — surfaced, never silently dropped. */
  unresolved: string[];
  /** "namespace.procedure" -> "module.action" for procedures gated by
   *  `requirePermission`. Procedures absent from this map are gated some other
   *  way (owner checks, LMS sessions, public) — absence means "the registry has
   *  no opinion", never "anyone may call it". */
  permissionKeys: Map<string, string>;
}

export function scanTrpcRouters(): TrpcScanResult {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const rootFile = project.addSourceFileAtPath(ROUTER_ENTRY);
  const appRouterDecl = rootFile.getVariableDeclarationOrThrow('appRouter');
  const initializer = appRouterDecl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const objArg = initializer.getArguments()[0];
  if (!objArg || !objArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
    throw new Error('appRouter initializer is not router({...}) — scanner assumption broken');
  }
  const obj = objArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  const namespaces: string[] = [];
  const procedures = new Set<string>();
  const unresolved: string[] = [];
  const permissionKeys = new Map<string, string>();

  for (const prop of obj.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
    const key = prop.getName();
    namespaces.push(key);
    const value = prop.getInitializer();
    if (!value) {
      unresolved.push(key);
      continue;
    }

    try {
      const subProcedures = resolveNamespaceProcedures(rootFile, value);
      if (subProcedures === null) {
        // Leaf procedure mounted directly on appRouter (e.g. `health`).
        procedures.add(key);
      } else {
        for (const p of subProcedures) {
          procedures.add(`${key}.${p.name}`);
          if (p.permission) permissionKeys.set(`${key}.${p.name}`, p.permission);
        }
      }
    } catch {
      unresolved.push(key);
    }
  }

  return { namespaces, procedures, unresolved, permissionKeys };
}

/**
 * Resolves an appRouter property value to the set of procedure names it
 * exposes. Returns null when the value is a leaf procedure (not a router
 * reference or mergeRouters(...) call) — the caller treats the namespace
 * itself as the procedure name in that case.
 */
function resolveNamespaceProcedures(
  hostFile: SourceFile,
  value: import('ts-morph').Node,
): ScannedProcedure[] | null {
  if (value.isKind(SyntaxKind.Identifier)) {
    const routerObj = resolveIdentifierToRouterObject(hostFile, value.asKindOrThrow(SyntaxKind.Identifier));
    return getObjectPropertyNames(routerObj);
  }

  if (value.isKind(SyntaxKind.CallExpression)) {
    const call = value.asKindOrThrow(SyntaxKind.CallExpression);
    if (call.getExpression().getText() === 'mergeRouters') {
      // Keyed by name so a procedure merged from two routers is not counted
      // twice, while still carrying its permission key through.
      const merged = new Map<string, ScannedProcedure>();
      for (const arg of call.getArguments()) {
        if (!arg.isKind(SyntaxKind.Identifier)) {
          throw new Error(`mergeRouters argument is not a plain identifier: ${arg.getText()}`);
        }
        const routerObj = resolveIdentifierToRouterObject(hostFile, arg.asKindOrThrow(SyntaxKind.Identifier));
        for (const proc of getObjectPropertyNames(routerObj)) merged.set(proc.name, proc);
      }
      return [...merged.values()];
    }
  }

  // Not a router reference — treat as a leaf procedure (e.g. health's
  // `publicProcedure.output(...).query(...)` chain).
  return null;
}

function resolveIdentifierToRouterObject(hostFile: SourceFile, identifier: Identifier): ObjectLiteralExpression {
  const name = identifier.getText();
  const namedImport = hostFile
    .getImportDeclarations()
    .flatMap((imp) => imp.getNamedImports())
    .find((ni) => (ni.getAliasNode()?.getText() ?? ni.getName()) === name);
  if (!namedImport) {
    throw new Error(`No import found for "${name}" in ${hostFile.getFilePath()}`);
  }
  // Look up the target file by the ORIGINAL exported name, not the local
  // alias — `import { fooRouter as bar }` exports `fooRouter`, not `bar`.
  const exportedName = namedImport.getName();
  const importDecl = namedImport.getImportDeclaration();

  const targetPath = resolveModuleToTsFile(hostFile.getFilePath(), importDecl.getModuleSpecifierValue());
  const project = hostFile.getProject();
  const targetFile = project.getSourceFile(targetPath) ?? project.addSourceFileAtPath(targetPath);
  const decl = targetFile.getVariableDeclarationOrThrow(exportedName);
  const init = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const objArg = init.getArguments()[0];
  if (!objArg || !objArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
    throw new Error(`"${name}" in ${targetPath} is not initialized with router({...})`);
  }
  return objArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
}

function resolveModuleToTsFile(fromFilePath: string, moduleSpecifier: string): string {
  if (!moduleSpecifier.startsWith('.')) {
    throw new Error(`Non-relative import unsupported by scanner: ${moduleSpecifier}`);
  }
  const withoutExt = moduleSpecifier.replace(/\.js$/, '');
  return path.resolve(path.dirname(fromFilePath), `${withoutExt}.ts`);
}

export interface ScannedProcedure {
  name: string;
  /** `module.action` when the procedure chains off `requirePermission(...)`. */
  permission?: string;
}

function getObjectPropertyNames(obj: ObjectLiteralExpression): ScannedProcedure[] {
  const names: ScannedProcedure[] = [];
  for (const prop of obj.getProperties()) {
    if (
      prop.isKind(SyntaxKind.PropertyAssignment) ||
      prop.isKind(SyntaxKind.ShorthandPropertyAssignment) ||
      prop.isKind(SyntaxKind.MethodDeclaration)
    ) {
      names.push({ name: prop.getName(), ...(readPermissionKey(prop) ? { permission: readPermissionKey(prop)! } : {}) });
    }
  }
  return names;
}

/** Reads `requirePermission('module', 'action')` out of a procedure definition.
 *  Returns undefined when the procedure is gated another way — that distinction
 *  is what lets the actor audit avoid claiming a role is locked out of a
 *  procedure the registry never governed. */
function readPermissionKey(prop: Node): string | undefined {
  for (const call of prop.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() !== 'requirePermission') continue;
    const args = call.getArguments();
    if (args.length < 2) continue;
    const mod = args[0]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
    const action = args[1]?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
    if (mod && action) return `${mod}.${action}`;
  }
  return undefined;
}
