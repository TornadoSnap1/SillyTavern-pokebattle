import {spawnSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),engine=join(root,'source/engine');
for(const args of [['scripts/build-switch-studio.mjs'],['node_modules/webpack-cli/bin/cli.js','--config','webpack.config.js']]){
 const result=spawnSync(process.execPath,args,{cwd:engine,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
for(const name of ['battle-switch-studio.html','battle-switch-studio.css','battle-switch-studio.js','battle-utilities.css','battle-NOTICES.txt'])copyFileSync(join(engine,'src',name),join(root,name));
const page=join(root,'battle-switch-studio.html');writeFileSync(page,readFileSync(page,'utf8').replace(/<nav class="design-switcher"[\s\S]*?<\/nav>/,''));
mkdirSync(join(root,'dist'),{recursive:true});
for(const name of ['bundle.js','bundle.js.LICENSE.txt'])copyFileSync(join(engine,'dist',name),join(root,'dist',name));
console.log('Runtime rebuilt. Regenerate FILES-SHA256.json before publishing.');
