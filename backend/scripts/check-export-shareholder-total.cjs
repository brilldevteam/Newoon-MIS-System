const assert = require('node:assert/strict');
const { buildKycDocumentModel } = require('../dist/kyc/export/kyc-document-model');

async function main() {
  const payload = { kycCaseId: 'synthetic-case', sectionA: {}, sectionB: {}, sectionC: {}, sectionD: {}, sectionE: {}, sectionF: {}, sectionG: {}, sectionH: {} };
  for (const totalOwnershipPercentage of [undefined, 0, 17, 100]) {
    const model = await buildKycDocumentModel({ ...payload, sectionB: {
      totalOwnershipPercentage,
      shareholders: [
        { id: 'a', fullName: 'Company A', shareholderType: 'Corporate Entity', shareholderPercentage: '50' },
        { id: 'b', fullName: 'Company B', shareholderType: 'Corporate Entity', ownershipPercentage: '50' },
        { id: 'c', fullName: 'Indirect owner', parentRowId: 'a', ownershipPercentage: '100' }
      ]
    } }, 1);
    const section = model.blocks.find((block) => block.kind === 'section' && block.title.startsWith('B.'));
    const summary = section.blocks.find((block) => block.kind === 'para').line.parts[0].text;
    assert.match(summary, /^Total shareholder %: 100%/, 'Use direct shareholder rows, not cached totals or nested interests');
  }
  console.log('Export shareholder total checks passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
