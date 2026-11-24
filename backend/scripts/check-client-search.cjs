// Synthetic relational-predicate checks. No database, environment, real IDs or documents.
const assert = require('node:assert/strict');
const { ComplianceClientsService } = require('../dist/compliance-clients/compliance-clients.service');
const { clientSearchWhere } = require('../dist/compliance-clients/client-search');
const actor = roles => ({ id:'staff-a',email:'sample@example.test',tenantId:'tenant-a',roles });
const role = (name,title='') => ({tenantId:'tenant-a',role:name,title});
const person = (overrides={}) => ({tenantId:'tenant-a',fullName:'Alex Morgan',title:'Dr',nationality:'Nepal',email:'alex.old@example.test',qidNumber:'20000000001',archivedAt:null,dateOfBirth:new Date('1990-10-21Z'),roles:[role('DIRECTOR'),role('AUTHORISED_SIGNATORY')],passports:[{tenantId:'tenant-a',passportNumber:'SYNPA12345',issuingCountry:'Nepal',expiryDate:new Date('2030-01-12Z')},{tenantId:'tenant-a',passportNumber:'OLDPA67890',issuingCountry:'Nepal'}],...overrides});
const client = (id,overrides={}) => ({id,tenantId:'tenant-a',name:'Company '+id,clientCode:'CL-'+id,status:'ACTIVE',activatedAt:new Date(),country:'Qatar',entityProfile:{tenantId:'tenant-a',legalForm:'LLC',taxIdentificationNo:'TAX-SYN-42',website:'https://example.test'},people:[person()],contacts:[{tenantId:'tenant-a',name:'Contact Sample',phone:'+974 5555 0101',position:'Finance Lead'}],engagements:[{tenantId:'tenant-a',engagementNumber:'ENG-001',serviceName:'Accounting',description:'Quarterly accounts'}],kycCases:[{tenantId:'tenant-a',kycNumber:'KYC-SYN-1'}],legalDocuments:[],documents:[],allocations:[{userId:'staff-a'}],...overrides});
const fixtures=[
  client('one'),client('two'),
  client('foreign',{tenantId:'tenant-b',people:[person({tenantId:'tenant-b',qidNumber:'29999999999',roles:[{tenantId:'tenant-b',role:'DIRECTOR'}]})]}),
  client('unallocated',{allocations:[],people:[person({qidNumber:'28888888888'})]}),
  client('ubo',{name:'Private Owner Company',clientCode:'CL-019',people:[person({fullName:'Hidden Beneficial Person',qidNumber:'27777777777',passports:[],roles:[role('UBO')]})]}),
  client('archive',{people:[person({fullName:'Archived Person',qidNumber:'26666666666',archivedAt:new Date()})]}),
  client('custom',{people:[person({fullName:'Sam Taylor',qidNumber:null,passports:[],roles:[role('OTHER','Compliance Officer')]})]}),
  client('legacy',{people:[person({fullName:'Legacy Person',qidNumber:null,passports:[],legacyIdentity:'LEGACY-ID-123'})]}),
  client('doc',{people:[],legalDocuments:[{tenantId:'tenant-a',personId:null,status:'CURRENT',typeKey:'CR_EXTRACT_EN',typeLabel:'Registration Certificate',documentNumber:'DOC-SYN-22',holderName:'Company',fileName:'synthetic-registration.pdf'}]}),
  client('deleted-doc',{people:[],legalDocuments:[{tenantId:'tenant-a',personId:null,status:'DELETED',typeLabel:'DeletedUniqueDocument'}]}),
  client('bad-child',{people:[person({tenantId:'tenant-b',qidNumber:'25555555555'})]}),
  client('bad-passport',{people:[person({passports:[{tenantId:'tenant-b',passportNumber:'FOREIGN-PASSPORT'}]})]}),
  client('aml-document',{people:[],documents:[{tenantId:'tenant-a',personId:null,identityType:null,deletedAt:null,section:{category:'SCREENING'},title:'SensitiveScreeningEvidence',storagePath:'/private/never-search-this-path'}]}),
  client('prospect',{status:'PROSPECT'})
];

function equal(a,b) {return a instanceof Date || b instanceof Date ? a!=null&&b!=null&&new Date(a).getTime()===new Date(b).getTime() : a===b;}
function matches(row,where) {
  return Object.entries(where).every(([key,filter])=>{
    if(key==='AND')return (Array.isArray(filter)?filter:[filter]).every(item=>matches(row,item));
    if(key==='OR')return filter.some(item=>matches(row,item));
    if(key==='NOT')return !(Array.isArray(filter)?filter:[filter]).some(item=>matches(row,item));
    const value=row?.[key];
    if(filter===null)return value==null;
    if(filter instanceof Date || typeof filter!=='object')return equal(value,filter);
    if('some' in filter)return Array.isArray(value)&&value.some(item=>matches(item,filter.some));
    if('is' in filter)return filter.is===null?value==null:value!=null&&matches(value,filter.is);
    if('contains' in filter)return typeof value==='string'&&(filter.mode==='insensitive'?value.toLowerCase().includes(filter.contains.toLowerCase()):value.includes(filter.contains));
    if('in' in filter)return filter.in.includes(value);
    if('not' in filter)return typeof filter.not==='object'?!matches({value},{value:filter.not}):!equal(value,filter.not);
    throw new Error('Unhandled predicate '+key+': '+JSON.stringify(filter));
  });
}

async function main() {
  const service=new ComplianceClientsService({});
  const find=async (roles,search,filters={})=>{
    const where=await service.buildWhere(actor(roles),{search,...filters});
    assert.deepEqual(where.AND[0].tenantId,'tenant-a');
    return fixtures.filter(row=>matches(row,where)).map(row=>row.id);
  };
  for(const term of ['20000000001','synpa12345','oldpa67890','alex morgan','Dr','Finance Lead','Accounting','TAX-SYN-42','example.test','Qatar','LLC','Quarterly accounts']) {
    const rows=await find(['AML_TEAM'],term);
    assert.ok(rows.includes('one')&&rows.includes('two'),'Find related clients by '+term);
    assert.ok(!rows.includes('foreign')&&!rows.includes('prospect'),'Scope '+term);
  }
  assert.ok((await find(['AML_TEAM'],'Alex director')).includes('one'),'Multiple words can match person name and role');
  assert.ok((await find(['AML_TEAM'],'authorized signatory')).includes('one'),'Human role labels and spelling alias');
  assert.ok((await find(['AML_TEAM'],'Compliance Officer')).includes('custom'),'Custom role position');
  assert.ok((await find(['AML_TEAM'],'21/10/1990')).includes('one'),'DOB in day/month/year');
  assert.ok((await find(['AML_TEAM'],'2030-01-12')).includes('one'),'Passport expiry');
  assert.ok((await find(['OPERATING_TEAM'],'SYNPA12345')).includes('one'),'Operations may search visible passports');
  assert.ok((await find(['ACCOUNTING_TEAM'],'20000000001')).includes('one'),'Allocated staff can search visible QID');
  assert.deepEqual(await find(['ACCOUNTING_TEAM'],'SYNPA12345'),[],'No passport oracle for allocated staff');
  assert.deepEqual(await find(['ACCOUNTING_TEAM'],'LEGACY-ID-123'),[],'No mixed legacy passport oracle');
  assert.deepEqual(await find(['ACCOUNTING_TEAM'],'28888888888'),[],'Allocation boundary');
  assert.deepEqual(await find(['OPERATING_TEAM'],'27777777777'),[],'Hidden UBO-only person cannot match');
  assert.ok((await find(['AML_TEAM'],'27777777777')).includes('ubo'),'Full access may search UBO');
  assert.deepEqual(await find(['OPERATING_TEAM'],'UBO'),[],'Hidden UBO role cannot match');
  assert.deepEqual(await find(['OPERATING_TEAM'],'SensitiveScreeningEvidence'),[],'Hidden screening folders cannot match');
  assert.ok((await find(['AML_TEAM'],'SensitiveScreeningEvidence')).includes('aml-document'),'Full access can search permitted folder metadata');
  assert.deepEqual(await find(['AML_TEAM'],'never-search-this-path'),[],'Storage paths are not searchable');
  assert.deepEqual(await find(['AML_TEAM'],'FOREIGN-PASSPORT'),[],'Passport tenant boundary');
  assert.deepEqual(await find(['AML_TEAM'],'26666666666'),[],'Archived person excluded');
  assert.deepEqual(await find(['AML_TEAM'],'25555555555'),[],'Malformed cross-tenant child cannot match');
  assert.deepEqual(await find(['AML_TEAM'],'29999999999'),[],'Other tenant cannot match');
  assert.deepEqual(await find(['AML_TEAM'],'DeletedUniqueDocument'),[],'Deleted metadata excluded');
  assert.deepEqual(await find(['AML_TEAM'],'DOC-SYN-22'),['doc'],'Legal register number');
  assert.deepEqual(await find(['AML_TEAM'],'20000000001',{status:'INACTIVE'}),[],'Existing filters remain ANDed');
  const superAdmin={...actor(['SUPER_ADMIN']),tenantId:null};
  assert.ok(fixtures.filter(row=>matches(row,clientSearchWhere(superAdmin,'29999999999'))).some(row=>row.id==='foreign'),'Explicit Super Admin cross-tenant behavior retained');
  assert.deepEqual(await find(['AML_TEAM'],"' OR 1=1 --"),[],'Search is literal Prisma data, not executable SQL');
  const edited=fixtures.find(row=>row.id==='one');
  const original=structuredClone(edited);
  edited.people[0].email='alex.updated@example.test';
  edited.people[0].qidNumber='20000000077';
  edited.people[0].passports[0].passportNumber='SYNUPDATED77';
  edited.entityProfile.email='company.updated@example.test';
  edited.contacts[0].email='contact.updated@example.test';
  for(const term of ['alex.updated@example.test','20000000077','SYNUPDATED77','company.updated@example.test','contact.updated@example.test'])assert.deepEqual(await find(['AML_TEAM'],term),['one'],'Search must read the latest saved value: '+term);
  for(const term of ['alex.old@example.test','20000000001','SYNPA12345'])assert.ok(!(await find(['AML_TEAM'],term)).includes('one'),'Old removed value must not match the edited record: '+term);
  Object.assign(edited,original);
  console.log('Client search checks passed: QID, both passports, current edited person/company/contact emails and IDs, names/titles/positions, multiple related clients, company/contact/engagement/legal metadata, dates, filters, tenant/allocation/privacy and archived/deleted exclusions. Synthetic predicates only; PostgreSQL staging execution remains required.');
}
module.exports={matches,fixtures,actor};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
