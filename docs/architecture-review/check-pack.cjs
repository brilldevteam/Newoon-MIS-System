const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf8'));
assert.equal(data.endpoints.length, 118);
assert.equal(data.routes.length, 30);
assert.equal(data.models.length, 47);
assert.equal(new Set(data.endpoints.map((v) => v.id)).size, data.endpoints.length);
const files = fs.readdirSync(__dirname).filter((name) => name.endsWith('.md'));
let links = 0;
for (const file of files) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  assert.equal((source.match(/^```/gm) || []).length % 2, 0, file + ' has unbalanced code fences');
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const url = match[1]; if (/^https?:/.test(url)) continue;
    const [target, anchor] = url.split('#');
    const p = path.resolve(__dirname, target || file);
    assert.ok(fs.existsSync(p), 'Missing link: ' + file + ' -> ' + url);
    if (anchor && /^L\d+$/.test(anchor)) assert.ok(Number(anchor.slice(1)) <= fs.readFileSync(p, 'utf8').split('\n').length, 'Invalid line ' + url);
    links++;
  }
}
const qa = fs.readFileSync(path.join(__dirname, 'ENDPOINT_QA_MATRIX.md'), 'utf8');
for (const e of data.endpoints) assert.ok(qa.includes(e.id));
const registered = new Set(data.registeredControllers);
function scan(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const p = path.join(folder, entry.name);
    if (entry.isDirectory()) scan(p);
    else if (p.endsWith('.controller.ts')) {
      const ast = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const n of ast.statements) if (ts.isClassDeclaration(n) && n.name && (ts.getDecorators(n) || []).some((d) => d.getText().startsWith('@Controller('))) {
        assert.ok(registered.has(n.name.text), 'Unregistered controller on disk requires explicit coverage decision: ' + n.name.text);
      }
    }
  }
}
scan(path.join(root, 'backend/src'));
console.log(`Pack checks passed: ${data.endpoints.length} unique operations, ${data.routes.length} routes, ${registered.size} registered controllers and ${links} local references checked.`);
