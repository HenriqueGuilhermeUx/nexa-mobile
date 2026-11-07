const {test}=require('node:test');
const assert=require('node:assert/strict');
const {checkPackageInventory}=require('./check-maya-qa-installed-package');
test('OTA requires exact installed package',()=>{
 assert.deepEqual(checkPackageInventory('package:br.com.trynexa.app\n','ota'),[]);
 assert.match(checkPackageInventory('package:br.com.trynexa.mayaqa\n','ota').join(' '),/not installed/);
});
test('standalone requires its own package',()=>{
 assert.deepEqual(checkPackageInventory('package:br.com.trynexa.mayaqa\n','standalone'),[]);
 assert.match(checkPackageInventory('package:br.com.trynexa.app\n','standalone').join(' '),/not installed/);
});
test('rejects prefix spoofing and malformed inventories',()=>{
 for(const data of ['package:br.com.trynexa.app.fake\n','br.com.trynexa.app\n','package:br.com.trynexa.app\nspoofed',''])
  assert.ok(checkPackageInventory(data,'ota').length);
});
test('unknown mode is fail closed',()=>assert.ok(checkPackageInventory('package:br.com.trynexa.app','production').length));

test('rejects duplicate ADB inventory lines even if expected package is present',()=>{
 const duplicated='package:br.com.trynexa.app\npackage:br.com.trynexa.app\n';
 assert.match(checkPackageInventory(duplicated,'ota').join(' '),/duplicate entries/);
 assert.deepEqual(checkPackageInventory('package:br.com.trynexa.app\npackage:br.com.trynexa.mayaqa\n','ota'),[]);
});

test('secondary inventory verifier rejects whitespace, blank records and oversized input',()=>{
 for (const data of ['package:br.com.trynexa.app \n','package:br.com.trynexa.app\n\n','\npackage:br.com.trynexa.app\n','package:br.com.trynexa.app\t\n','package:br.com.trynexa.app\n'+'x'.repeat(1024*1024)])
  assert.ok(checkPackageInventory(data,'ota').length);
 assert.deepEqual(checkPackageInventory('package:br.com.trynexa.app\r\n','ota'),[]);
});
