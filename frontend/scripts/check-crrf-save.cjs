// Exercise the page's save handler with synthetic state and mocked API responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/pages/CrrfWorkspacePage.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

async function check(failSave) {
  const document = { id: 'doc', fileName: 'synthetic.pdf' };
  const record = { riskRating: 'LOW', internalComment: 'Unsaved comment', dmlroComment: '', mlroComment: '', documents: [] };
  const workspace = { clientInfo: { clientName: 'Example' }, record };
  const state = [workspace, '', '', '', [{ name: 'synthetic.pdf' }]];
  let hook = 0;
  let payload;
  let uploads = 0;
  const jsx = (type, props) => ({ type, props });
  const context = { exports: {}, require: (name) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useEffect: () => {}, useRef: () => ({ current: null }), useState: () => { const index = hook++; return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; } };
    if (name === 'react-router-dom') return { useParams: () => ({ id: 'case' }), Link: 'a' };
    if (name.endsWith('/useAuth')) return { useAuth: () => ({ user: {} }) };
    if (name.endsWith('/access-control')) return { hasAnyRole: () => true };
    if (name.endsWith('/ToastProvider')) return { useToast: () => ({ showToast: () => {} }) };
    if (name.endsWith('/api')) return { getApiErrorMessage: (error) => error.message };
    if (name.endsWith('/kyc-workflow.service')) return {
      uploadCrrfDocuments: async () => { uploads++; return { ...workspace, record: { ...record, riskRating: null, internalComment: '', documents: [document] } }; },
      saveCrrfWorkspace: async (_, draft) => { payload = draft; assert.equal(state[0].record.documents.length, 1, 'Uploaded document must display before save completes'); if (failSave) throw new Error('Synthetic save failure'); return { ...workspace, record: { ...record, ...draft, documents: [document] } }; }
    };
    return new Proxy({}, { get: (_, key) => String(key) });
  } };
  vm.runInNewContext(compiled, context);
  const tree = context.exports.CrrfWorkspacePage();
  const findSave = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'button' && JSON.stringify(node.props.children).includes('Save Draft')) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = findSave(child); if (found) return found; }
    return null;
  };
  await findSave(tree).props.onClick();
  assert.equal(payload.riskRating, 'LOW');
  assert.equal(payload.internalComment, 'Unsaved comment');
  assert.equal(state[0].record.documents.length, 1);
  assert.equal(state[0].record.riskRating, 'LOW');
  assert.equal(state[4].length, 0, 'Successfully uploaded files must not be queued for duplicate upload');
  assert.equal(state[3], '', 'Busy state must clear');
  assert.equal(uploads, 1);
  assert.equal(state[2], failSave ? 'Synthetic save failure' : '');
}
(async () => { await check(false); await check(true); console.log('CRRF upload visibility, unsaved fields and save-failure checks passed.'); })().catch((error) => { console.error(error); process.exitCode = 1; });
