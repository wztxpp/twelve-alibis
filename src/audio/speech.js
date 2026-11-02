/** Device Chinese speech synthesis; no microphone, hosted recording, or autoplay. */
export const SPEECH_DISCLOSURE = '证词朗读使用设备自带的中文合成语音，并非专属配音；不同设备的音色与可用性不同。无需麦克风。';

export function createSpeechController({
  onStateChange = () => {},
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  const synth = windowRef?.speechSynthesis;
  const supported = !!(synth && windowRef?.SpeechSynthesisUtterance);
  let voices = [], active = null, generation = 0, destroyed = false, waitingForVoices = false;
  let message = supported ? '点击人物卡片下方的“听证词”开始；再次点击可停止。' : '此浏览器不支持语音朗读；所有证词仍可直接阅读。';
  const getState = () => ({ supported, activeId: active?.id ?? null, message, chineseVoices: voices.length });
  const emit = nextMessage => {
    if (nextMessage !== undefined) message = nextMessage;
    if (!destroyed) onStateChange(getState());
  };
  function refreshVoices() {
    if (!supported || destroyed) return;
    try {
      voices = synth.getVoices().filter(v => /^zh(?:[-_]|$)|^cmn(?:[-_]|$)/i.test(v.lang || ''))
        .sort((a,b) => {
          const score = v => (/^(zh[-_](CN|SG)|cmn)/i.test(v.lang) ? 0 : 2) + (v.localService ? 0 : 1);
          return score(a)-score(b) || String(a.voiceURI || a.name).localeCompare(String(b.voiceURI || b.name));
        });
      if (!active && voices.length && waitingForVoices) {
        waitingForVoices = false;
        emit('中文语音已就绪，请点击人物卡片下的“听证词”。');
      } else emit();
    } catch { voices = []; emit(); }
  }
  function cleanup(item) { clearTimer(item.startTimer); clearTimer(item.endTimer); }
  function stop(nextMessage) {
    generation++;
    const old = active; active = null;
    if (old) cleanup(old);
    if (supported) { try { synth.cancel(); } catch {} }
    emit(nextMessage ?? (old ? '朗读已停止。' : message));
  }
  function finish(item,nextMessage,cancel=false) {
    if (destroyed || active !== item || item.token !== generation) return;
    active = null; generation++; cleanup(item);
    if (cancel) { try { synth.cancel(); } catch {} }
    emit(nextMessage);
  }
  function play({id,text,index=0,name='人物'}) {
    if (destroyed) return;
    if (active?.id === id) { stop('朗读已停止。'); return; }
    stop();
    if (!supported) { emit('此浏览器不支持语音朗读，请直接阅读证词。'); return; }
    refreshVoices();
    if (!voices.length) {
      waitingForVoices = true;
      emit('暂未检测到中文语音。请在设备的语音设置中启用中文语音后重试；也可直接阅读证词。语音列表可能仍在加载。');
      return;
    }
    waitingForVoices = false;
    const mandarin = voices.filter(v=>/^(zh[-_](CN|SG|TW)|cmn)/i.test(v.lang));
    const pool = mandarin.length ? mandarin : voices;
    const voiceIndex = Math.abs(Math.trunc(Number(index) || 0));
    const voice = pool[voiceIndex % pool.length];
    const utterance = new windowRef.SpeechSynthesisUtterance(String(text));
    utterance.voice = voice; utterance.lang = voice.lang || 'zh-CN';
    utterance.rate = [0.94,0.98,0.92,0.96][voiceIndex % 4];
    utterance.pitch = [1.02,0.96,1.04,0.99][voiceIndex % 4];
    utterance.volume = 1;
    const item = {id,utterance,token:++generation,startTimer:null,endTimer:null};
    active = item; emit(`正在准备朗读${name}的证词…`);
    utterance.onstart = () => {
      if (destroyed || active !== item || item.token !== generation) return;
      clearTimer(item.startTimer);
      emit(`正在朗读：${name}。再次点击可停止。`);
      item.endTimer = setTimer(()=>finish(item,'朗读超时，已停止。请重试或直接阅读证词。',true),120000);
    };
    utterance.onend = () => finish(item,`${name}的证词朗读完毕。`);
    utterance.onerror = event => {
      const messages = {
        'not-allowed':'浏览器阻止了声音。请再次点击“听证词”，并检查网站声音权限。',
        'language-unavailable':'设备的中文语音不可用，请安装或启用中文语音后重试。',
        'voice-unavailable':'所选中文音色不可用，请检查设备语音设置后重试。',
        network:'语音服务网络异常，请稍后重试，或改用设备离线中文语音。',
        'audio-busy':'音频设备正被占用，请结束其他播放后重试。',
        'audio-hardware':'无法使用音频设备，请检查声音输出设置。',
      };
      finish(item,messages[event.error] || '朗读未能完成，请检查音量与中文语音设置后重试；文字证词仍可阅读。',true);
    };
    item.startTimer = setTimer(()=>finish(item,'语音未能启动。请检查设备音量、网站声音权限及中文语音设置，再点击重试。',true),10000);
    try {
      // Stay within the originating click gesture for iOS and other mobile browsers.
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    } catch { finish(item,'无法启动朗读，请直接阅读证词，或换用支持中文语音的浏览器。',true); }
  }
  const onPageHide = () => stop();
  const onVisibility = () => { if (documentRef?.hidden) stop(); };
  const oldVoicesChanged = synth?.onvoiceschanged;
  if (supported) {
    if (synth.addEventListener) synth.addEventListener('voiceschanged',refreshVoices);
    else synth.onvoiceschanged = refreshVoices;
  }
  windowRef?.addEventListener?.('pagehide',onPageHide);
  documentRef?.addEventListener?.('visibilitychange',onVisibility);
  refreshVoices();
  const retryTimers = supported ? [setTimer(refreshVoices,250),setTimer(refreshVoices,1000)] : [];
  emit();
  function destroy() {
    if (destroyed) return;
    stop(); destroyed = true;
    retryTimers.forEach(clearTimer);
    synth?.removeEventListener?.('voiceschanged',refreshVoices);
    if (supported && !synth.addEventListener && synth.onvoiceschanged === refreshVoices) synth.onvoiceschanged = oldVoicesChanged;
    windowRef?.removeEventListener?.('pagehide',onPageHide);
    documentRef?.removeEventListener?.('visibilitychange',onVisibility);
  }
  return {play,stop,destroy,supported,getState};
}
