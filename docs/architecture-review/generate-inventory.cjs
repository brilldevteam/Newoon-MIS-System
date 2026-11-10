// Read-only source analysis; writes documentation only. Never loads the application or environment.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const out = __dirname;
const rel = (p) => path.relative(root, p).replaceAll('\\', '/');
const parse = (p) => ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, p.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const walk = (node, fn) => { fn(node); ts.forEachChild(node, (child) => walk(child, fn)); };
const decs = (n) => ts.canHaveDecorators(n) ? ts.getDecorators(n) || [] : [];
const dec = (n, name) => decs(n).find((d) => ts.isCallExpression(d.expression) && d.expression.expression.getText() === name)?.expression;
const vals = (d) => d ? d.arguments.map((a) => ts.isStringLiteral(a) ? a.text : a.getText()) : [];
const flat = (s) => s.replace(/\s+/g, ' ').replaceAll('|', '\\|');
const uid = (prefix, s) => prefix + '-' + crypto.createHash('sha1').update(s).digest('hex').slice(0, 8).toUpperCase();
const link = (p, n) => `[${rel(p)}:${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1}](../../${rel(p)}#L${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1})`;
const sources = new Map();
function load(p) {
  if (sources.has(p)) return;
  const ast = parse(p); sources.set(p, ast);
  for (const n of ast.statements) if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith('.')) {
    const base = path.resolve(path.dirname(p), n.moduleSpecifier.text);
    const target = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(fs.existsSync);
    if (target) load(target);
  }
}
load(path.join(root, 'backend/src/app.module.ts'));
const classes = new Map();
for (const [p, ast] of sources) for (const n of ast.statements) if (ts.isClassDeclaration(n) && n.name) classes.set(n.name.text, { p, n });
const registered = new Set(); const modules = new Set();
function register(name) {
  if (modules.has(name)) return; modules.add(name);
  const item = classes.get(name); if (!item) return;
  const config = dec(item.n, 'Module')?.arguments[0];
  if (!config || !ts.isObjectLiteralExpression(config)) return;
  for (const prop of config.properties) if (ts.isPropertyAssignment(prop) && ts.isArrayLiteralExpression(prop.initializer)) {
    if (prop.name.getText() === 'controllers') prop.initializer.elements.forEach((v) => registered.add(v.getText()));
    if (prop.name.getText() === 'imports') prop.initializer.elements.forEach((v) => { if (ts.isIdentifier(v)) register(v.text); });
  }
}
register('AppModule');
function analyze(item, method, visited = new Set()) {
  const key = item.n.name.text + '.' + method; if (visited.has(key)) return [];
  visited.add(key);
  const m = item.n.members.find((x) => ts.isMethodDeclaration(x) && x.name.getText() === method);
  if (!m) return [];
  const result = [{ item, m }];
  walk(m, (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) result.push(...analyze(item, node.expression.name.text, visited));
  });
  return result;
}
const endpoints = [];
for (const name of [...registered].sort()) {
  const item = classes.get(name); if (!item) throw new Error('Unresolved registered controller ' + name);
  const prefix = vals(dec(item.n, 'Controller'))[0] || '';
  const ctor = item.n.members.find(ts.isConstructorDeclaration);
  const dependencies = Object.fromEntries((ctor?.parameters || []).map((p) => [p.name.getText(), p.type?.getText()]));
  for (const m of item.n.members.filter(ts.isMethodDeclaration)) {
    const http = ['Get', 'Post', 'Patch', 'Put', 'Delete', 'Options', 'Head', 'All'].find((v) => dec(m, v)); if (!http) continue;
    const route = '/api/' + [prefix, vals(dec(m, http))[0]].filter(Boolean).join('/');
    const roles = vals(dec(m, 'Roles') || dec(item.n, 'Roles'));
    const guards = [...vals(dec(item.n, 'UseGuards')), ...vals(dec(m, 'UseGuards'))];
    const delegates = [];
    walk(m, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
      const e = node.expression.expression;
      if (ts.isPropertyAccessExpression(e) && e.expression.kind === ts.SyntaxKind.ThisKeyword && dependencies[e.name.text]) {
        const service = classes.get(dependencies[e.name.text]);
        if (service) delegates.push(...analyze(service, node.expression.name.text));
      }
    });
    const unique = [...new Map(delegates.map((d) => [d.item.n.name.text + '.' + d.m.name.getText(), d])).values()];
    const body = unique.map((d) => d.m.getText()).join('\n');
    const requestFields = [...new Set([...body.matchAll(/\bdto\.(\w+)/g)].map((m) => m[1]))].sort();
    const writes = [...new Set([...body.matchAll(/\b(?:this\.prisma|tx|prisma|db)\.(\w+)\.(createMany|create|upsert|updateMany|update|deleteMany|delete)\s*\(/g)].map((m) => m[1] + '.' + m[2]))];
    const errors = [...new Set([...body.matchAll(/throw new (\w+Exception)\(([^;\n]*)/g)].map((m) => m[1] + ': ' + m[2].slice(0, 220)))];
    const checks = unique.filter((d) => /^(assert|require|validate|tenant|formTenant|recordTenant|documentTenant|notificationWhere|canModify|isLegacy|hasAnyRole|enumValue|requiredText|numberValue)/.test(d.m.name.getText()));
    endpoints.push({ id: uid('API', http.toUpperCase() + route), method: http.toUpperCase(), route, controller: name, handler: m.name.getText(), roles, guards, source: link(item.p, m), parameters: m.parameters.map((p) => flat(p.getText())), requestFields, declaredReturn: m.type?.getText() || 'Inferred by TypeScript; no explicit response DTO', delegates: unique.map((d) => ({ method: d.item.n.name.text + '.' + d.m.name.getText(), source: link(d.item.p, d.m) })), checks: checks.map((d) => d.m.name.getText()), writes, errors, response: m.getText().includes('.send(') ? 'Response.send binary/HTML; see controller MIME and Content-Disposition' : 'JSON returned from delegated service; inferred fields in linked implementation', classification: http !== 'Get' ? 'Command (may mutate)' : writes.length || /writeFileSync|ensureCatalog/.test(body) ? 'GET WITH SIDE EFFECTS' : 'Read candidate (static scan only)' });
  }
}
endpoints.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));
if (new Set(endpoints.map((e) => e.method + e.route)).size !== endpoints.length) throw new Error('Duplicate route');
const frontend = path.join(root, 'frontend/src/routes/router.tsx'); const fa = parse(frontend); const routes = [];
function visitRoutes(node, guards = []) {
  let next = guards;
  if (ts.isObjectLiteralExpression(node)) {
    const props = Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(), p.initializer]));
    const element = props.element?.getText() || '';
    if (/ProtectedRoute|RequireAccess|RequireRoles/.test(element)) next = [...guards, flat(element)];
    if (props.path && ts.isStringLiteral(props.path)) routes.push({ id: uid('UI', props.path.text), path: props.path.text, element: flat(element), guards: next, source: link(frontend, node) });
  }
  ts.forEachChild(node, (child) => visitRoutes(child, next));
}
visitRoutes(fa);
const schemaPath = path.join(root, 'backend/prisma/schema.prisma'); const schema = fs.readFileSync(schemaPath, 'utf8');
const enums = [...schema.matchAll(/enum (\w+)\s*\{([^}]+)\}/g)].map((m) => ({ name: m[1], values: m[2].split(/\r?\n/).map((v) => v.trim()).filter(Boolean) }));
const models = [...schema.matchAll(/model (\w+)\s*\{([^}]+)\}/g)].map((m) => ({ name: m[1], fields: m[2].split(/\r?\n/).map((v) => v.trim()).filter(Boolean) }));
const commit = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const branch = cp.execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
const data = { baseline: { commit, branch, reviewDate: '2026-10-27', basis: 'Static source inspection, not server attestation' }, registeredControllers: [...registered].sort(), modules: [...modules].sort(), endpoints, routes, enums, models };
fs.writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(data, null, 2) + '\n');
let md = '# Technical Workflow and API Appendix\n\nBaseline `' + commit + '` on `' + branch + '`. Review date 27 October 2026.\n\n';
md += `Coverage: ${registered.size} registered controllers, ${endpoints.length} HTTP operations, ${routes.length} frontend routes, ${models.length} database models, ${enums.length} enums. Resolved from AppModule imports and module controllers; no application startup or database access.\n\n`;
md += '## How to interpret this inventory\n\nThis is a source-derived contract index, not an OpenAPI specification or a claim that every endpoint has passed QA. IDs are stable hashes of method/path. Source links are relative to this repository. DTO declarations below define decorator validation; Record<string, unknown> bodies depend on service checks. Output schemas are generally inferred rather than explicit DTOs: linked controller/service methods are authoritative. QA must capture redacted real response shapes on staging before freezing a client API contract.\n\nRoles below are FALLBACK DECORATORS, not an unconditional allow-list. RolesGuard can replace them with area grants when configured. JWT validates current user roles/status. Methods without @Roles bypass RolesGuard area enforcement. Service role/status and tenant checks still apply where implemented. Global error shape is {statusCode,timestamp,path,error}; error can be an object or message. Typical failures: 400 validation/state, 401 session, 403 role, 404 scoped resource, 413/415 upload limits/types where implemented, 500 unhandled/DB errors, 503 PDF renderer. Exact errors detected below are candidate branches, not promised for every input.\n\nGET classification follows same-service helper calls and detected Prisma writes; it is not a proof of purity or complete dependency traversal. File writes and database writes are not one transaction. Audit/notification entries appear in the detected writes, not a guarantee every successful action emits them. Standard JSON success defaults follow Nest (POST 201, others 200 unless overridden); binary responses follow controller.\n\nRead the [workflow specification](WORKFLOWS.md), [findings](FINDINGS.md) and [QA checklist](QA_HANDOVER.md) alongside this appendix.\n\n## Frontend entry points\n\n| ID | Route | Page or redirect | Inherited presentation guard | Evidence |\n|---|---|---|---|---|\n';
for (const r of routes) md += `| ${r.id} | \`${r.path}\` | \`${r.element}\` | \`${r.guards.join('; ') || 'No explicit wrapper here'}\` | ${r.source} |\n`;
md += '\n## API operation index\n\n| ID | Method and path | Handler | Classification |\n|---|---|---|---|\n';
for (const e of endpoints) md += `| [${e.id}](#${e.id.toLowerCase()}) | \`${e.method} ${e.route}\` | ${e.controller}.${e.handler} | ${e.classification} |\n`;
for (const e of endpoints) {
  md += `\n## ${e.id}\n\n**${e.method} ${e.route}** - ${e.controller}.${e.handler}\n\n`;
  md += `- Entry/auth: ${e.guards.join('; ') || 'No controller/method guard detected (public)'}; fallback roles: ${e.roles.join(', ') || 'none declared; authenticated-only when JWT applies'}.\n- Inputs: ${e.parameters.map((p) => '\`' + p + '\`').join('; ') || 'none'}.\n- Output: ${e.response}. ${e.declaredReturn}.\n- Behavior: ${e.classification}; detected reachable writes: ${e.writes.join(', ') || 'none detected'}.\n- Tenant/role/state/validation helper candidates: ${e.checks.join(', ') || 'none detected; inspect implementation before acceptance'}.\n- Error branch candidates: ${flat(e.errors.join('; ')) || 'none explicitly thrown in resolved methods; global errors still apply'}.\n- Evidence: ${e.source}.\n- Logic chain: ${e.delegates.map((d) => d.method + ' ' + d.source).join('; ') || 'Controller-only implementation'}.\n- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.\n`;
  md += `- DTO field-access candidates: ${e.requestFields.join(', ') || 'none resolved'}. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.\n`;
}
md += '\n## Request DTO contracts\n\nGlobal ValidationPipe uses whitelist, forbidNonWhitelisted and transform. These decorators apply to concrete DTO classes, not erased TypeScript Record bodies. Optionality here is transport-level, not necessarily workflow completeness.\n';
for (const [name, item] of [...classes].sort()) if (/Dto$/.test(name)) {
  md += `\n### ${name}\n\n${link(item.p, item.n)}\n\n| Field | Type | Validation decorators |\n|---|---|---|\n`;
  for (const p of item.n.members.filter(ts.isPropertyDeclaration)) md += `| ${p.name.getText()}${p.questionToken ? '?' : ''} | ${flat(p.type?.getText() || 'inferred')} | ${flat(decs(p).map((d) => d.getText()).join(' '))} |\n`;
}
md += '\n## Persisted status and decision vocabulary\n\nEnum membership alone does not authorize a transition; use service guard and decision tables in WORKFLOWS.\n';
for (const e of enums) md += `\n### ${e.name}\n\n${e.values.map((v) => '\`' + v + '\`').join(', ')}\n`;
md += '\n## Data model and relationships\n\nPrisma schema excerpt per model includes scalar fields, relations, cascade behavior and unique/index constraints. No database contents are read. File paths are storage references, not a backup of file bytes.\n';
for (const m of models) md += `\n### ${m.name}\n\n\`\`\`prisma\n${m.fields.join('\n')}\n\`\`\`\n`;
fs.writeFileSync(path.join(out, 'TECHNICAL_APPENDIX.md'), md);
let qa = '# Endpoint Coverage Matrix\n\nAll rows are NOT RUN on staging. Q-API in QA_HANDOVER.md defines mandatory steps; each endpoint also needs its successful workflow-specific input. This matrix is coverage assignment, not test execution evidence.\n\n| Endpoint ID | Operation | Workflow family | Required test set | Result | Evidence |\n|---|---|---|---|---|---|\n';
for (const e of endpoints) qa += `| ${e.id} | \`${e.method} ${e.route}\` | ${e.controller} | Q-API${e.method !== 'GET' ? ', Q-NEG, Q-RACE' : ', Q-READ'} | NOT RUN | Pending |\n`;
fs.writeFileSync(path.join(out, 'ENDPOINT_QA_MATRIX.md'), qa);
console.log(JSON.stringify({ controllers: registered.size, endpoints: endpoints.length, routes: routes.length, models: models.length, enums: enums.length, commit }));
