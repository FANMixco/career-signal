const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const {planBuilds} = require('./package-desktop.cjs');
test('dual Windows builds pair each architecture with one builder invocation', () => {
 const builds = planBuilds(['--win','--x64','--arm64','--publish=never']);
 assert.deepEqual(builds.map(b=>b.arch), ['x64','arm64']);
 for(const b of builds) {
   assert.ok(b.args.includes(`--${b.arch}`));
   assert.equal(b.args.filter(a=>['--x64','--arm64'].includes(a)).length,1);
   assert.equal(b.output,path.resolve(__dirname,'../release'));
 }
});
test('explicit output supports equals and separate arguments without leaking builder staging',()=>{
 for(const option of [['--config.directories.output=release/store-build/1.3.0/upload'],['-c.directories.output','release/store-build/1.3.0/upload']]) {
  const [build] = planBuilds(['--win','--arm64',...option]);
  assert.equal(build.output,path.resolve(__dirname,'../release/store-build/1.3.0/upload'));
  assert.deepEqual(build.args,['--win','--arm64']);
 }
 assert.throws(()=>planBuilds(['--config.directories.output']),/Missing output/);
});
test('host architecture defaults and mac target arguments are preserved',()=>{
 assert.equal(planBuilds(['--win','--dir'],'arm64')[0].arch,'arm64');
 assert.deepEqual(planBuilds(['--mac','dmg','zip'],'x64')[0].args,['--mac','dmg','zip']);
});
test('release commands select both architectures and keep private helpers optional',()=>{
 const {scripts}=require('../package.json');
 assert.match(scripts['desktop:dist'],/--x64 --arm64/);
 assert.match(scripts['desktop:store'],/-Architecture all/);
 assert.match(scripts['desktop:sideload'],/-Architecture all -SkipTrust/);
 assert.equal(scripts['desktop:release:all'],'npm run desktop:dist && npm run desktop:sideload');
});
