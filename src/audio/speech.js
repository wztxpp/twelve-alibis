import { normalizeForSpeech } from './normalize.js';
import { recordings as bundledRecordings } from './recordings.js';

export const SPEECH_DISCLOSURE = '36份证词均配有本地生成的原创角色配音，按12位人物的年龄与表达方式设计，并非真人录音。播放异常时可再次点击改用设备中文语音；无需麦克风。';
const isChinese = voice => /^zh(?:[-_]|$)|^cmn(?:[-_]|$)/i.test(voice.lang || '');
const voiceId = voice => voice.voiceURI || voice.name;
export function rankChineseVoices(all) {
  const score = voice => {
    const quality = /natural|neural|premium|enhanced|自然|神经|高质量|高品質/i.test(voice.name || '') ? 0 : 10;
    const dialect = /^(zh[-_](CN|SG)|cmn)/i.test(voice.lang || '') ? 0 : /^zh[-_]TW/i.test(voice.lang || '') ? 30 : 60;
    return dialect + quality;
  };
  return all.filter(isChinese).sort((a, b) => score(a) - score(b) || String(voiceId(a)).localeCompare(String(voiceId(b))));
}
export function matchingRecording(manifest, chapterId, id, text) {
  const entry = manifest?.[`${chapterId}:${id}`];
  // Only project-local audio assets, never arbitrary endpoints or path traversal.
  return entry && entry.text === String(text) && /^\/audio\/[\w/-]+\.(mp3|ogg|wav|m4a)$/i.test(entry.src || '') && !entry.src.includes('..') ? entry : null;
}
export function createSpeechController({
  onStateChange = () => {}, windowRef = globalThis.window, documentRef = globalThis.document,
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout,
  recordings = bundledRecordings,
} = {}) {
  const synth = windowRef?.speechSynthesis;
  const systemSupported = !!(synth && windowRef?.SpeechSynthesisUtterance);
  const recordingSupported = typeof windowRef?.Audio === 'function';
  const supported = systemSupported || (recordingSupported && Object.keys(recordings).length > 0);
  let voices = [], active = null, generation = 0, destroyed = false, waitingForVoices = false, selectedVoice = '';
  const failedRecordings = new Set();
  let message = supported ? '点击立绘或“听证词”开始，再次点击停止；点击姓名或证词只切换标记。' : '此浏览器不支持语音朗读；所有证词仍可直接阅读。';
  const getState = () => ({ supported, activeId: active?.id ?? null, message, chineseVoices: voices.length,
    selectedVoice, voices: voices.map(v => ({id: voiceId(v), name: v.name, lang: v.lang, localService: !!v.localService})),
    mode: active?.kind ?? null });
  const emit = nextMessage => { if (nextMessage !== undefined) message = nextMessage; if (!destroyed) onStateChange(getState()); };
  function refreshVoices() {
    if (!systemSupported || destroyed) return;
    try {
      voices = rankChineseVoices(synth.getVoices());
      if (!active && voices.length && waitingForVoices) { waitingForVoices = false; emit('中文语音已就绪，请点击人物卡片下的“听证词”。'); }
      else emit();
    } catch { voices = []; emit(); }
  }
  function cleanup(item) {
    clearTimer(item.startTimer); clearTimer(item.endTimer);
    if (item.audio) { item.audio.onplaying = item.audio.onended = item.audio.onerror = null; try { item.audio.pause(); item.audio.currentTime = 0; } catch {} }
  }
  function stop(nextMessage) {
    generation++; const old = active; active = null;
    if (old) cleanup(old);
    if (systemSupported) { try { synth.cancel(); } catch {} }
    emit(nextMessage ?? (old ? '朗读已停止。' : message));
  }
  const isCurrent = item => !destroyed && active === item && item.token === generation;
  function finish(item, nextMessage, cancel = false) {
    if (!isCurrent(item)) return;
    active = null; generation++; cleanup(item);
    if (cancel && systemSupported) { try { synth.cancel(); } catch {} }
    emit(nextMessage);
  }
  function setVoice(id = '') {
    if (destroyed) return;
    stop(); refreshVoices();
    const voice = voices.find(v => voiceId(v) === id || v.name === id);
    selectedVoice = voice ? voiceId(voice) : '';
    emit(voice ? `已选择：${voice.name}。点击证词试听。` : id ? '该音色暂不可用，已恢复自动选择。' : '已恢复自动选择设备提供的优质普通话音色。');
  }
  function playRecording(entry, request, key) {
    let audio;
    try { audio = new windowRef.Audio(entry.src); } catch { failedRecordings.add(key); emit('角色录音无法打开。再次点击将使用设备中文语音。'); return; }
    const item = {id:request.id, key, kind:'recording', audio, token:++generation, startTimer:null, endTimer:null};
    active = item; emit(`正在加载${request.name}的角色录音…`);
    const fail = () => { if (!isCurrent(item)) return; failedRecordings.add(key); finish(item, '角色录音未能播放。再次点击将使用设备中文语音；不会自动切换播放。'); };
    audio.onplaying = () => {
      if (!isCurrent(item)) return;
      clearTimer(item.startTimer); emit(`正在播放：${request.name}的角色录音。再次点击可停止。`);
      item.endTimer = setTimer(fail,120000);
    };
    audio.onended = () => finish(item,`${request.name}的证词播放完毕。`);
    audio.onerror = fail;
    item.startTimer = setTimer(fail,10000);
    try { audio.preload='none'; const pending = audio.play(); pending?.catch?.(fail); } catch { fail(); }
  }
  function play({id,chapterId='',text,name='人物',voiceProfile={}}) {
    if (destroyed) return;
    const key = `${chapterId}:${id}`;
    if (active?.key === key) { stop('朗读已停止。'); return; }
    stop();
    const entry = matchingRecording(recordings,chapterId,id,text);
    if (recordingSupported && entry && !failedRecordings.has(key)) { playRecording(entry,{id,name},key); return; }
    if (!systemSupported) { emit('此浏览器不支持语音朗读，请直接阅读证词。'); return; }
    refreshVoices();
    if (!voices.length) { waitingForVoices = true; emit('暂未检测到中文语音。请在设备语音设置中启用中文语音后重试；文字证词仍可阅读。'); return; }
    waitingForVoices = false;
    const requested = selectedVoice || voiceProfile?.voiceName;
    const voice = voices.find(v=>voiceId(v)===requested || v.name===requested) || voices[0];
    const utterance = new windowRef.SpeechSynthesisUtterance(normalizeForSpeech(text));
    utterance.voice = voice; utterance.lang = voice.lang || 'zh-CN';
    // Character direction may modestly adjust pacing; never fabricate voices by random pitch.
    const rate = Number(voiceProfile?.rate);
    utterance.rate = Number.isFinite(rate) && rate > 0 ? Math.max(0.9,Math.min(1.08,rate)) : 1;
    utterance.pitch = 1; utterance.volume = 1;
    const item = {id,key,kind:'system',utterance,token:++generation,startTimer:null,endTimer:null};
    active = item; emit(`正在准备朗读${name}的证词…`);
    utterance.onstart = () => {
      if (!isCurrent(item)) return;
      clearTimer(item.startTimer); emit(`正在朗读：${name} · ${voice.name}。再次点击可停止。`);
      item.endTimer = setTimer(()=>finish(item,'朗读超时，已停止。请重试或直接阅读证词。',true),120000);
    };
    utterance.onend = () => finish(item,`${name}的证词朗读完毕。`);
    utterance.onerror = event => {
      const messages = {'not-allowed':'浏览器阻止了声音。请再次点击“听证词”，并检查网站声音权限。',
        'language-unavailable':'设备的中文语音不可用，请启用中文语音后重试。', 'voice-unavailable':'所选中文音色不可用，请改选其他音色。',
        network:'语音服务网络异常，可尝试设备离线中文音色。', 'audio-busy':'音频设备正被占用，请结束其他播放后重试。',
        'audio-hardware':'无法使用音频设备，请检查声音输出设置。'};
      finish(item,messages[event.error] || '朗读未能完成，请检查音量与中文音色；文字证词仍可阅读。',true);
    };
    item.startTimer = setTimer(()=>finish(item,'语音未能启动。请检查声音权限与中文音色，再点击重试。',true),10000);
    try { if(synth.paused)synth.resume(); synth.speak(utterance); } catch { finish(item,'无法启动朗读，请直接阅读证词。',true); }
  }
  const onPageHide=()=>stop(),onVisibility=()=>{if(documentRef?.hidden)stop()};
  const oldVoicesChanged=synth?.onvoiceschanged;
  if(systemSupported){if(synth.addEventListener)synth.addEventListener('voiceschanged',refreshVoices);else synth.onvoiceschanged=refreshVoices;}
  windowRef?.addEventListener?.('pagehide',onPageHide); documentRef?.addEventListener?.('visibilitychange',onVisibility);
  refreshVoices(); const retryTimers=systemSupported?[setTimer(refreshVoices,250),setTimer(refreshVoices,1000)]:[]; emit();
  function destroy(){if(destroyed)return;stop();destroyed=true;retryTimers.forEach(clearTimer);synth?.removeEventListener?.('voiceschanged',refreshVoices);if(systemSupported&&!synth.addEventListener&&synth.onvoiceschanged===refreshVoices)synth.onvoiceschanged=oldVoicesChanged;windowRef?.removeEventListener?.('pagehide',onPageHide);documentRef?.removeEventListener?.('visibilitychange',onVisibility);}
  return {play,stop,destroy,setVoice,supported,getState};
}
