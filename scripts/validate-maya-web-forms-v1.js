const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const ts = require('typescript');
const source = fs.readFileSync('src/maya-actions/webFormContracts.ts','utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const cjs = {};
vm.runInNewContext(js, { exports: cjs, URL, Set, Error });
const input = {
  targetUrl:'https://exemplo.org/inscricao',
  organization:'Escola de exemplo',purpose:'Inscrição para um curso',
  fields:[{id:'nome', label:'Nome completo',type:'text',value:'Pessoa de exemplo',required:true}]
};
const x = cjs.prepareWebFormReview(input);
assert.strictEqual(x.stage, 'awaiting_review');
assert.strictEqual(x.submitted,false);
assert.strictEqual(x.fields.length,1);
assert.strictEqual(x.warnings.length,3);
assert.throws(() => cjs.prepareWebFormReview({...input,targetUrl:'http://exemplo.org'}));
assert.throws(() => cjs.prepareWebFormReview({...input,targetUrl:'https://127.0.0.1/app'}));
assert.throws(() => cjs.prepareWebFormReview({...input,fields:[input.fields[0],input.fields[0]]}));
assert.throws(() => cjs.prepareWebFormReview({...input,fields:[{...input.fields[0],id:'otp',label:'Código de verificação'}]}));
assert(!/(fetch\(|axios\.|submitForm\(|sendPix|executePayment)/.test(source));
console.log('PASS Maya Forms 10: review-only, HTTPS, no duplicate/secret fields or form submission');
