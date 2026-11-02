import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate,valid} from '../src/logic/puzzle.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/puzzles.json',import.meta.url),'utf8'));
function permutations(values) {
  return values.length ? values.flatMap((value, i) => permutations(values.filter((_, j) => j !== i)).map(rest => [value, ...rest])) : [[]];
}
function publicWorlds(level) {
  const {events,slots,choices,constraints=[]}=level.worldSpec;
  let worlds=permutations(slots.map((_,i)=>i)).map(order=>Object.fromEntries(events.map((e,i)=>[e.field,order[i]])));
  for(const choice of choices) worlds=worlds.flatMap(w=>choice.values.map((_,i)=>({...w,[choice.field]:i})));
  return worlds.filter(w=>constraints.every(expr=>evaluate(expr,w)));
}
function possibleMasks(level, speakers) {
  const result=new Set();
  for(const w of level.worlds) {
    for(let mask=0;mask<4096;mask++) {
      if(mask.toString(2).replaceAll('0','').length!==level.liarCount) continue;
      if(speakers.every(i=>evaluate(level.statements[i].expr,w)===!(mask&(1<<i))))result.add(mask);
    }
  }
  return result;
}
for(const level of data.levels) {
  test(`${level.id}: all and only physically possible public worlds are included`,()=>{
    assert.deepEqual(level.worlds,publicWorlds(level));
    assert.equal(level.verification.worldCount,level.worlds.length);
    assert.equal(new Set(level.worlds.map(w=>JSON.stringify(w))).size,level.worlds.length);
    assert.deepEqual(level.statements.map(s=>s.speaker).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i));
  });
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
    for(const s of level.statements)assert.ok(s.source && s.aside);
    assert.deepEqual(level.lieReasons.map(r=>r.speaker),level.answer);
    assert.ok(level.timeline.length>=4);
    assert.notEqual(level.solutionSummary,level.briefing);
    for(let i=1;i<=12;i++)assert.ok(fs.existsSync(new URL(`../public/assets/cruise-${String(i).padStart(2,'0')}.webp`,import.meta.url)));
  });
  test(`${level.id}: first three testimonies do not reveal an identity set`,()=>{
    assert.ok(possibleMasks(level,[0,1,2]).size>=20);
  });
  test(`${level.id}: narrated contradiction steps really exceed the lie allowance`,()=>{
    for(const speaker of level.physicallyFalseSpeakers || []) {
      assert.ok(level.worlds.every(w=>!evaluate(level.statements[speaker].expr,w)));
    }
    for(const step of level.contradictionSteps) {
      const candidates=level.worlds.filter(w=>evaluate(level.statements[step.assumeTrueSpeaker].expr,w)
        && step.establishedFalseSpeakers.every(i=>!evaluate(level.statements[i].expr,w)));
      // A nonempty branch makes the explanation a real contradiction argument,
      // rather than a claim already prohibited by the public physical facts.
      assert.ok(candidates.length>0);
      assert.ok(candidates.every(w=>level.statements.filter(s=>!evaluate(s.expr,w)).length>=step.minimumFalseCount));
      assert.ok(step.minimumFalseCount>level.liarCount);
    }
  });
}
test('unknown DSL operator fails explicitly',()=>assert.throws(()=>evaluate({type:'unknown'},{})));
