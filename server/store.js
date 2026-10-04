import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export function createStore(directory) {
  mkdirSync(directory,{recursive:true});const file=join(directory,'matches.json');
  let data=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{version:1,matches:{},sessions:{}};
  if(data.version!==1||!data.matches||!data.sessions)throw new Error('Неподдерживаемый формат сохранения');
  return {
    get data(){return data;},
    transaction(fn) {
      const next=structuredClone(data),result=fn(next);
      writeFileSync(file+'.tmp',JSON.stringify(next),'utf8');renameSync(file+'.tmp',file);data=next;return result;
    },
  };
}
