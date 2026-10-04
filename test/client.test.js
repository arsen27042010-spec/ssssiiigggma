import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { makeCommandId } from '../public/client-utils.js';
test('command ids work on LAN HTTP without crypto.randomUUID',()=>{
 const insecureCrypto={getRandomValues:array=>webcrypto.getRandomValues(array)};
 const ids=new Set(Array.from({length:100},()=>makeCommandId(insecureCrypto)));
 assert.equal(ids.size,100);assert.ok([...ids].every(id=>typeof id==='string'&&id.length>=32&&id.length<=100));
});
