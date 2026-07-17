// Parses apps/api/src/router.ts's `appRouter` object literal as the single
// source of namespace -> router truth. Follows the import graph to each
// router's real file regardless of filename (no glob on `router*.ts` —
// red-team R1 #4/#7 showed that misses ~7 real routers and mis-keys
// namespace<->filename). Resolves `mergeRouters(a, b)` and multi-export
// files (one file exporting several named router consts) by import-name
// lookup, not file-path convention.

import { Project, SyntaxKind, type Identifier, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
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
        for (const p of subProcedures) procedures.add(`${key}.${p}`);
      }
    } catch {
      unresolved.push(key);
    }
  }

  return { namespaces, procedures, unresolved };
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
): string[] | null {
  if (value.isKind(SyntaxKind.Identifier)) {
    const routerObj = resolveIdentifierToRouterObject(hostFile, value.asKindOrThrow(SyntaxKind.Identifier));
    return getObjectPropertyNames(routerObj);
  }

  if (value.isKind(SyntaxKind.CallExpression)) {
    const call = value.asKindOrThrow(SyntaxKind.CallExpression);
    if (call.getExpression().getText() === 'mergeRouters') {
      const merged = new Set<string>();
      for (const arg of call.getArguments()) {
        if (!arg.isKind(SyntaxKind.Identifier)) {
          throw new Error(`mergeRouters argument is not a plain identifier: ${arg.getText()}`);
        }
        const routerObj = resolveIdentifierToRouterObject(hostFile, arg.asKindOrThrow(SyntaxKind.Identifier));
        for (const name of getObjectPropertyNames(routerObj)) merged.add(name);
      }
      return [...merged];
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

function getObjectPropertyNames(obj: ObjectLiteralExpression): string[] {
  const names: string[] = [];
  for (const prop of obj.getProperties()) {
    if (
      prop.isKind(SyntaxKind.PropertyAssignment) ||
      prop.isKind(SyntaxKind.ShorthandPropertyAssignment) ||
      prop.isKind(SyntaxKind.MethodDeclaration)
    ) {
      names.push(prop.getName());
    }
  }
  return names;
}
