import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechController} from '../src/audio/speech.js';
function setup(supported=true){
  let voices=[],utterances=[],cancels=0,tick=0;
  const timers=new Map(),events=new Map(),states=[];
  const add=(k,f)=>events.set(k,f),remove=k=>events.delete(k);
  const synth={getVoices:()=>voices,addEventListener:add,removeEventListener:remove,cancel:()=>cancels++,speak:u=>utterances.push(u),resume(){}};
  const win={addEventListener:add,removeEventListener:remove};
  if(supported){win.speechSynthesis=synth;win.SpeechSynthesisUtterance=function(text){this.text=text}};
  const doc={hidden:false,addEventListener:add,removeEventListener:remove};
  const api=createSpeechController({windowRef:win,documentRef:doc,onStateChange:s=>states.push(s),setTimer:(f,ms)=>{timers.set(++tick,{f,ms});return tick},clearTimer:id=>timers.delete(id)});
  return {api,states,utterances,timers,events,doc,setVoices(v){voices=v;events.get('voiceschanged')?.()},get cancels(){return cancels}};
}
const mandarin={lang:'zh-CN',name:'中文',localService:true};
const a={id:0,index:0,name:'甲',text:'甲的准确证词'};
const b={id:1,index:1,name:'乙',text:'乙的准确证词'};
test('no autoplay and no non-Chinese fallback; asynchronous voices load',()=>{
  const s=setup();assert.equal(s.utterances.length,0);
  s.setVoices([{lang:'en-US',name:'English'}]);s.api.play(a);
  assert.equal(s.utterances.length,0);assert.match(s.api.getState().message,/未检测到中文/);
  s.setVoices([mandarin]);assert.match(s.api.getState().message,/已就绪/);
  s.api.play(a);assert.equal(s.utterances[0].text,a.text);assert.equal(s.utterances[0].voice,mandarin);
  s.api.destroy();
});
test('one active utterance, same-id toggle, stale callbacks ignored',()=>{
  const s=setup();s.setVoices([mandarin]);s.api.play(a);const first=s.utterances[0];first.onstart();
  assert.equal(s.api.getState().activeId,0);
  s.api.play(b);const second=s.utterances[1];first.onend();first.onerror({error:'interrupted'});
  assert.equal(s.api.getState().activeId,1);assert.ok(s.cancels>=2);
  second.onstart();s.api.play({...b});assert.equal(s.api.getState().activeId,null);assert.match(s.api.getState().message,/停止/);
  second.onend();assert.match(s.api.getState().message,/停止/);s.api.destroy();
});
test('explicit errors and timeouts restore idle state',()=>{
  const s=setup();s.setVoices([mandarin]);s.api.play(a);s.utterances[0].onerror({error:'not-allowed'});
  assert.equal(s.api.getState().activeId,null);assert.match(s.api.getState().message,/阻止/);
  s.api.play(a);for(const [id,t] of s.timers)if(t.ms===10000){s.timers.delete(id);t.f()}
  assert.equal(s.api.getState().activeId,null);assert.match(s.api.getState().message,/未能启动/);s.api.destroy();
});
test('hidden page, pagehide and destroy cancel and remove listeners/timers',()=>{
  const s=setup();s.setVoices([mandarin]);s.api.play(a);s.doc.hidden=true;s.events.get('visibilitychange')();assert.equal(s.api.getState().activeId,null);
  s.api.play(a);s.events.get('pagehide')();assert.equal(s.api.getState().activeId,null);
  s.api.play(a);s.api.destroy();assert.equal(s.events.size,0);assert.equal(s.timers.size,0);
  const n=s.utterances.length;s.api.play(b);assert.equal(s.utterances.length,n);
});
test('unsupported and SSR environments fail gracefully',()=>{
  const s=setup(false);assert.equal(s.api.supported,false);s.api.play(a);assert.match(s.api.getState().message,/不支持/);s.api.destroy();
  const api=createSpeechController({windowRef:undefined,documentRef:undefined});assert.equal(api.supported,false);api.destroy();
});
