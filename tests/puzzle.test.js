import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate,valid} from '../src/logic/puzzle.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/puzzles.json',import.meta.url),'utf8'));
for(const level of data.levels) {
  test(`${level.id}: exact one world and accepted identity set`,()=>{
    assert.equal(level.statements.length,12);
    assert.equal(level.castRoles.length,12);
    const worlds=level.worlds.filter(w=>level.statements.filter(s=>!evaluate(s.expr,w)).length===level.liarCount);
    assert.equal(worlds.length,1);
    assert.deepEqual(worlds[0],level.solutionWorld);
    const answer=level.statements.filter(s=>!evaluate(s.expr,worlds[0])).map(s=>s.speaker).sort((a,b)=>a-b);
    assert.deepEqual(answer,level.answer);
    let accepted=0;
    for(let mask=0;mask<4096;mask++) {
      const selected=new Set(Array.from({length:12},(_,i)=>i).filter(i=>mask&(1<<i)));
      if(valid(selected,level))accepted++;
    }
    assert.equal(accepted,1);
  });
  test(`${level.id}: assets, narrative and spoiler fields complete`,()=>{
    assert.ok(level.prologue && level.briefing && level.records.length);
    assert.ok(level.resolution.length>=5);
    assert.ok(level.hints.length && level.solution.length);
    for(const record of level.records)assert.ok(record.title && record.text);
    for(let i=1;i<=12;i++)assert.ok(fs.existsSync(new URL(`../public/assets/cruise-${String(i).padStart(2,'0')}.webp`,import.meta.url)));
  });
}
test('unknown DSL operator fails explicitly',()=>assert.throws(()=>evaluate({type:'unknown'},{})));
