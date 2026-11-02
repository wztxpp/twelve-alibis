import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForSpeech } from '../src/audio/normalize.js';
import { createSpeechController, matchingRecording, rankChineseVoices } from '../src/audio/speech.js';

test('time pronunciation expands valid times without changing logical words', () => {
  assert.equal(normalizeForSpeech('“19:05在场，00:00不在场；22:15或者19:00。”'), '十九点零五分在场，零点整不在场；二十二点十五分或者十九点整。');
  assert.equal(normalizeForSpeech('不是23:59；恰好一件。'), '不是二十三点五十九分；恰好一件。');
  assert.equal(normalizeForSpeech('25:61 不应变成有效时刻'), '25:61 不应变成有效时刻');
  assert.equal(normalizeForSpeech('如果甲则乙\n不是两件都成立'), '如果甲则乙。不是两件都成立');
});

test('natural Mandarin preferred without mixing arbitrary character index voices', () => {
  const basic={name:'Mandarin Basic',lang:'zh-CN',voiceURI:'basic',localService:true};
  const natural={name:'Mandarin Natural',lang:'zh-CN',voiceURI:'natural',localService:false};
  const cantonese={name:'Cantonese Premium',lang:'zh-HK',voiceURI:'hk'};
  assert.deepEqual(rankChineseVoices([cantonese,basic,{name:'English Neural',lang:'en-US'},natural]),[natural,basic,cantonese]);
  const h=harness({voices:[basic,natural]});
  h.api.play({id:11,chapterId:'a',text:'19:05不在场',name:'甲'});
  assert.equal(h.utterances[0].voice,natural); assert.equal(h.utterances[0].pitch,1);assert.equal(h.utterances[0].rate,1);
  h.api.setVoice('basic');assert.equal(h.api.getState().activeId,null);
  h.api.play({id:0,text:'证词',voiceProfile:{rate:0.5}});
  assert.equal(h.utterances[1].voice,basic);assert.equal(h.utterances[1].rate,0.9);
  h.api.destroy();
});

function harness({recordings={}, voices=[], speech=true, rejectPlay=false, throwAudio=false, allowSystemSpeech=true}={}){
  const audios=[],utterances=[],events=new Map(),timers=new Map();let tick=0,cancels=0,voiceReads=0;
  const win={addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k),
    Audio:class {constructor(src){if(throwAudio)throw new Error('unavailable');this.src=src;this.pauses=0;audios.push(this)} play(){this.played=true;return rejectPlay?Promise.reject(new Error('blocked')):Promise.resolve()}pause(){this.pauses++}}};
  if(speech){win.speechSynthesis={getVoices:()=>{voiceReads++;return voices},cancel:()=>cancels++,speak:u=>utterances.push(u),addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};win.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};}
  const doc={hidden:false,addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
  const api=createSpeechController({windowRef:win,documentRef:doc,recordings,allowSystemSpeech,setTimer:(f,ms)=>{timers.set(++tick,{f,ms});return tick},clearTimer:k=>timers.delete(k)});
  return {api,audios,utterances,events,doc,timers,get cancels(){return cancels},get voiceReads(){return voiceReads}};
}
const request={id:0,chapterId:'first',text:'十九点时我不在场。',name:'甲'};
const manifest={'first:0':{src:'/audio/first-0.mp3',text:request.text},'second:0':{src:'/audio/second-0.mp3',text:request.text}};
test('local recordings require exact original text and safe local asset path',()=>{
  assert.ok(matchingRecording(manifest,'first',0,request.text));
  assert.equal(matchingRecording(manifest,'first',0,'不同证词'),null);
  for(const src of ['https://example.com/a.mp3','/audio/../secret.mp3','/audio/a.mp3?token=x','//example.com/a.mp3'])
    assert.equal(matchingRecording({'first:0':{src,text:request.text}},'first',0,request.text),null);
});
test('recording playback is explicit, exclusive and stale events cannot affect new speaker',()=>{
  const h=harness({recordings:manifest});assert.equal(h.audios.length,0);
  h.api.play(request);const first=h.audios[0],lateEnd=first.onended,lateError=first.onerror;
  assert.equal(h.api.getState().mode,'recording');assert.equal(h.utterances.length,0);first.onplaying();
  h.api.play({...request,chapterId:'second'});const second=h.audios[1];assert.ok(first.pauses>0);
  lateEnd();lateError();assert.equal(h.api.getState().activeId,0);assert.equal(h.api.getState().mode,'recording');
  h.api.play({...request,chapterId:'second'});assert.equal(h.api.getState().activeId,null);assert.ok(second.pauses>0);
  h.api.destroy();assert.equal(h.timers.size,0);
});
test('rejected recording never automatically speaks; explicit next click uses system fallback',async()=>{
  const voice={lang:'zh-CN',name:'Mandarin'};
  const h=harness({recordings:manifest,voices:[voice],rejectPlay:true});h.api.play(request);
  await Promise.resolve();await Promise.resolve();
  assert.equal(h.api.getState().activeId,null);assert.equal(h.utterances.length,0);assert.match(h.api.getState().message,/再次点击/);
  h.api.play(request);assert.equal(h.utterances.length,1);assert.equal(h.api.getState().mode,'system');h.api.destroy();
});
test('stale recording text falls back; hidden/pagehide stops actual audio without system speech',()=>{
  const h=harness({recordings:manifest,voices:[{lang:'zh-CN',name:'中文'}]});
  h.api.play({...request,text:'修改后的证词'});assert.equal(h.audios.length,0);assert.equal(h.utterances.length,1);h.api.stop();
  h.api.play(request);h.doc.hidden=true;h.events.get('visibilitychange')();assert.ok(h.audios[0].pauses>0);
  h.api.play(request);h.events.get('pagehide')();assert.equal(h.api.getState().activeId,null);h.api.destroy();
});
test('local recordings work when speech synthesis is absent',()=>{
  const h=harness({recordings:manifest,speech:false});assert.equal(h.api.supported,true);
  h.api.play(request);assert.equal(h.audios.length,1);h.audios[0].onended();assert.equal(h.api.getState().activeId,null);h.api.destroy();
});

test('recordings-only mode plays exact recordings without querying or selecting system voices',()=>{
  const h=harness({recordings:manifest,voices:[{lang:'zh-CN',name:'中文'}],allowSystemSpeech:false});
  assert.equal(h.api.supported,true);
  assert.equal(h.events.has('voiceschanged'),false);
  assert.equal(h.timers.size,0);
  h.api.setVoice('中文');
  assert.equal(h.api.getState().selectedVoice,'');
  h.api.play(request);
  assert.equal(h.audios.length,1);
  assert.equal(h.audios[0].src,manifest['first:0'].src);
  assert.equal(h.api.getState().mode,'recording');
  h.audios[0].onplaying();
  h.audios[0].onended();
  h.api.destroy();
  assert.equal(h.voiceReads,0);
  assert.equal(h.utterances.length,0);
  assert.equal(h.cancels,0);
});

test('recordings-only mode leaves missing or revised testimony silent even with system voices available',()=>{
  const h=harness({recordings:manifest,voices:[{lang:'zh-CN',name:'中文'}],allowSystemSpeech:false});
  for(const change of [{chapterId:'rewritten'},{text:'新版证词'}]) {
    h.api.play({...request,...change});
    assert.equal(h.api.getState().activeId,null);
    assert.match(h.api.getState().message,/配音待更新/);
  }
  assert.equal(h.audios.length,0);
  assert.equal(h.utterances.length,0);
  assert.equal(h.voiceReads,0);
  h.api.destroy();
});

for(const failure of ['rejected','constructor','error']) test(`recordings-only mode never falls back after ${failure} audio failure`,async()=>{
  const h=harness({recordings:manifest,voices:[{lang:'zh-CN',name:'中文'}],allowSystemSpeech:false,
    rejectPlay:failure==='rejected',throwAudio:failure==='constructor'});
  h.api.play(request);
  if(failure==='error')h.audios[0].onerror();
  await Promise.resolve();await Promise.resolve();
  assert.equal(h.api.getState().activeId,null);
  assert.doesNotMatch(h.api.getState().message,/再次点击|设备中文|系统/);
  h.api.play(request);
  assert.equal(h.api.getState().activeId,null);
  assert.match(h.api.getState().message,/无法播放/);
  assert.equal(h.utterances.length,0);
  assert.equal(h.voiceReads,0);
  h.api.destroy();
});
