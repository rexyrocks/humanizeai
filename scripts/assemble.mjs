import {readFileSync,writeFileSync} from 'node:fs';
const core=readFileSync('src/core.js','utf8'),server=readFileSync('src/server.js','utf8'),page=readFileSync('src/page.html','utf8'),app=readFileSync('src/app.js','utf8');
writeFileSync('worker/index.js',core+'\nconst PAGE='+JSON.stringify(page)+';\nconst APP='+JSON.stringify(app)+';\n'+server);
