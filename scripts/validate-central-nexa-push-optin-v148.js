'use strict';
const fs=require('fs');
const assert=require('node:assert/strict');
const push=fs.readFileSync('src/lib/nexaCentralPush.ts','utf8');
const ui=fs.readFileSync('app/central-nexa.tsx','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
assert.equal(app.version,'2.0.43');
assert.equal(app.android.versionCode,148);
for(const name of ['expo-notifications','expo-secure-store','expo-crypto','expo-constants']){
  assert.ok(pkg.dependencies[name],'Dependency already present: '+name);
}
assert.match(push,/getPermissionsAsync/);
assert.match(push,/getExpoPushTokenAsync/);
assert.match(push,/getItemAsync\(DEVICE_KEY\)/);
assert.match(push,/setItemAsync\(DEVICE_KEY/);
assert.match(push,/central-nexa\/push\/register/);
assert.match(push,/central-nexa\/push\/unregister/);
assert.match(push,/servicePushOptIn:true/);
assert.match(push,/servicePushOptIn:false/);
assert.doesNotMatch(push,/sendPushNotificationsAsync|console\.log\(.{0,30}(?:token|push)/i);
assert.match(ui,/ensureNexaNotificationPermission/);
assert.match(ui,/registerNexaCentralServicePush/);
assert.match(ui,/revokeNexaCentralServicePush/);
assert.match(ui,/não autoriza publicidade/);
assert.match(ui,/ofertas continuam desativadas/);
console.log('Central Nexa push registration: opt-in and disabled-delivery contract PASS');
