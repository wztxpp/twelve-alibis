<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import ChapterNav from './components/ChapterNav.vue'
import EvidenceArchive from './components/EvidenceArchive.vue'
import CharacterCard from './components/CharacterCard.vue'
import ChapterEnding from './components/ChapterEnding.vue'
import RulesDialog from './components/RulesDialog.vue'
import { useGame } from './composables/useGame.js'
import { createSpeechController, SPEECH_DISCLOSURE } from './audio/speech.js'

const speechState = ref({ activeId: null, supported: false, message: '点击人物卡片下方的“听证词”开始。' })
const speech = createSpeechController({ onStateChange: state => { speechState.value = state } })
const game = useGame({ stopAudio: () => speech.stop() })
const { data, current, level, selected, hintsShown, revealed, solved, showSolution, showEnding, feedback,
  progress, note, records, inspectedCount, canSubmit, unlocked, toggle, clear, recordOpened, isInspected } = game
const rulesDialog = ref(null)
const resultPanel = ref(null)
const hintPanel = ref(null)
const solutionPanel = ref(null)
const endingPanel = ref(null)
const smooth = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
async function scrollTo(target) { await nextTick(); (target.value?.$el || target.value)?.scrollIntoView({ behavior: smooth(), block: 'start' }) }
function selectChapter(index) { if (game.load(index)) window.scrollTo({ top: 0, behavior: smooth() }) }
function speak(id) {
  const statement = level.value.statements.find((s, index) => (s.speaker ?? index) === id)
  speech.play({ id, index: id, text: statement.text, name: data.names[id] })
}
async function submit() { const success = game.submit(); await scrollTo(success ? endingPanel : resultPanel) }
async function hint() { game.hint(); await scrollTo(hintPanel) }
async function toggleSolution() {
  const needsConfirmation = !showSolution.value && !solved.value && !revealed.value
  if (needsConfirmation && !window.confirm('推理过程会揭示答案和本章后续剧情，并把本章记为“已揭晓”。确定查看吗？')) return
  game.reveal(true)
  if (showSolution.value) await scrollTo(solutionPanel)
}
function reset() {
  if (!window.confirm('重新开始会清除本篇破案进度、已揭晓状态、已查阅记录和推理便签。确定吗？')) return
  game.reset()
  window.scrollTo({ top: 0, behavior: smooth() })
}
onBeforeUnmount(() => speech.destroy())
</script>

<template>
  <div class="app-shell" :data-scene="current">
    <header class="top"><a class="brand" href="#">十二份证词<span>THE TWELVE STATEMENTS</span></a><button class="quiet" id="rulesBtn" @click="rulesDialog.open()">玩法说明 <span>↗</span></button></header>
    <main>
      <aside>
        <div class="case-label">逻辑调查局 / 案件档案</div><h1>空席。<br>最后一航。</h1><p class="intro">十二位乘客，十三套餐具。<br>每个人都欠过去一句真话。</p>
        <ChapterNav :levels="data.levels" :current="current" :progress="progress" :unlocked="unlocked" @select="selectChapter" />
        <div class="field-note"><span>调查员守则</span><p>不要凭直觉指认。<br>让每一份证词，都经得起检验。</p><div class="stamp">逻辑验证<br><b>唯一解</b></div></div><div class="side-foot">连续悬疑 · VOL. 04<br>无需注册 · 进度保存在此浏览器</div>
      </aside>
      <section class="workspace">
        <div class="case-head"><div><div id="caseTag" class="eyebrow">CHAPTER 0{{ current + 1 }} / {{ data.storyTitle || '空席' }}</div><h2 id="title">{{ level.title }}</h2><p id="story">{{ level.subtitle }}</p></div><span class="case-number" id="caseNum">0{{ current + 1 }}</span></div>
        <EvidenceArchive :key="level.id" :level="level" :records="records" :inspected-count="inspectedCount" :is-inspected="isInspected" v-model:note="note" @inspect="recordOpened" />
        <div class="brief"><span class="brief-icon">!</span><p>十二人中恰有 <strong id="liarCount">{{ level.liarCount }}</strong> 位隐瞒者。<b>隐瞒者的证词为假，其余人的证词为真。</b></p><button id="hintBtn" class="quiet" :disabled="hintsShown >= level.hints.length" @click="hint">{{ !hintsShown ? '给我线索 ✧' : hintsShown === level.hints.length ? '线索已全部展开' : `下一条线索 ${hintsShown}/${level.hints.length}` }}</button></div>
        <div class="evidence-header"><h3>证词记录 <span>12 份</span></h3><span>点击卡片，标记隐瞒者</span></div>
        <div class="audio-notice">{{ SPEECH_DISCLOSURE }}</div><p id="audioStatus" role="status" aria-live="polite">{{ speechState.message }}</p>
        <div id="cards" class="cards">
          <CharacterCard v-for="(statement, index) in level.statements" :key="`${level.id}:${statement.speaker ?? index}`"
            :id="statement.speaker ?? index" :name="data.names[statement.speaker ?? index]" :role="level.castRoles[statement.speaker ?? index]"
            :statement="statement.text" :selected="selected.has(statement.speaker ?? index)" :speaking="speechState.activeId === (statement.speaker ?? index)"
            :speech-supported="speechState.supported" @toggle="toggle" @speak="speak" />
        </div>
        <section v-if="hintsShown" id="hintPanel" ref="hintPanel" class="hint-panel" aria-live="polite"><h3>调查线索</h3><p v-for="(clue, index) in level.hints.slice(0, hintsShown)" :key="index">{{ index + 1 }}. {{ clue }}</p><small>线索逐步展开，不会扣除任何机会。</small></section>
        <section v-if="feedback" id="result" ref="resultPanel" class="result" :class="feedback.kind" aria-live="polite"><h3>{{ feedback.title }}</h3><p>{{ feedback.text }}</p></section>
        <section v-if="showSolution" id="solution" ref="solutionPanel" class="solution"><h3>推理手记</h3><p>隐瞒者：{{ level.answer.map(id => data.names[id]).join('、') }}。</p><p class="case-answer">{{ level.solutionSummary }}</p><ol><li v-for="(step, index) in level.solution" :key="index">{{ step }}</li></ol></section>
        <ChapterEnding v-if="showEnding" ref="endingPanel" :resolution="level.resolution" :final="current === data.levels.length - 1" @continue="selectChapter(current + 1)" />
        <div class="actions"><div class="selection"><span class="selection-dot"></span><div>已标记 <strong id="selectedCount">{{ selected.size }}</strong> / <span id="targetCount">{{ level.liarCount }}</span> 人<small id="selectionNote">{{ canSubmit ? '人数已齐，可以提交判断。' : '仔细比对证词，再提交你的判断。' }}</small></div></div><div class="action-buttons"><button id="clearBtn" class="quiet" :disabled="selected.size === 0" @click="clear">清空</button><button id="submitBtn" class="primary" :disabled="!canSubmit" @click="submit">提交判断 <span>→</span></button></div></div>
        <div class="below"><button id="solutionBtn" class="quiet" @click="toggleSolution">{{ showSolution ? '收起推理过程' : '查看推理过程' }}</button><button id="replayBtn" class="quiet" @click="selectChapter(current)">重查本章 ↻</button><button id="newGameBtn" class="quiet" @click="reset">重新开始全篇</button></div>
        <footer>物证、时间线与全部证词，共同锁定唯一真相。<span>人物与场景均为虚构。</span></footer>
      </section>
    </main>
    <RulesDialog ref="rulesDialog" />
  </div>
</template>
