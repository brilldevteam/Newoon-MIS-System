// Reproduces current readiness gaps with mocked persistence. Passing means the gap was observed,
// NOT that the application is secure. Replace these observations with rejection tests when fixed.
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { JwtStrategy } = require('../dist/auth/jwt.strategy');
const { SelfPasswordService } = require('../dist/auth/self-password.controller');

async function main() {
  const user = { id:'synthetic-user', tenantId:'synthetic-tenant', email:'sample@example.test', status:'ACTIVE', sessionVersion:0, roles:[{role:{name:'OPERATING_TEAM'}}], tenant:{isActive:false} };
  const calls=[];
  const strategy = new JwtStrategy({get:()=> 'synthetic-test-secret-only-not-for-production'}, {user:{findUnique:async query=>{calls.push(query);return user;}}});
  const token={sub:user.id,email:user.email,tenantId:user.tenantId,roles:['OPERATING_TEAM'],sv:0};
  assert.equal((await strategy.validate(token)).id,user.id);
  assert.equal(calls[0].include.tenant,undefined);
  console.log('OBSERVED S-01: inactive-tenant session is accepted; strategy does not request tenant activation status (mocked database).');

  const currentPassword='Synthetic-only-old-pass-42!';
  const newPassword='Synthetic-only-new-pass-97!';
  user.passwordHash=await bcrypt.hash(currentPassword,4);
  let change;
  const tx={user:{updateMany:async query=>{change=query;user.passwordHash=query.data.passwordHash;return {count:1};}},auditLog:{create:async()=>({})}};
  const prisma={user:{findUnique:async()=>user},$transaction:async callback=>callback(tx)};
  await new SelfPasswordService(prisma).change(user.id,{currentPassword,newPassword,confirmPassword:newPassword});
  assert.equal(change.data.sessionVersion,undefined);
  assert.ok(await bcrypt.compare(newPassword,user.passwordHash));
  assert.equal((await strategy.validate(token)).id,user.id);
  console.log('OBSERVED S-04: active self-password handler does not increment sessionVersion; old token remains accepted (mocked persistence, real bcrypt/JWT strategy).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
