<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  scene: { type: Object, required: true },
  characters: { type: Array, default: () => [] },
  label: { type: String, default: '开始调查 →' },
})
const emit = defineEmits(['complete'])
const position = ref(0)
const furthest = ref(0)
const completed = ref(false)
const container = ref(null)
const logDialog = ref(null)
const beats = computed(() => props.scene.beats || [])
const beat = computed(() => beats.value[position.value] || { text: '' })
const atEnd = computed(() => position.value >= beats.value.length - 1)
const character = id => props.characters.find(person => person.id === id)
const speakerName = speaker => typeof speaker === 'number' ? character(speaker)?.name || '未知人物' : speaker || '旁白'
const portrait = id => `${import.meta.env.BASE_URL}assets/cruise-${String(id + 1).padStart(2, '0')}.webp`
const activeSpeaker = computed(() => typeof beat.value.speaker === 'number' ? beat.value.speaker : null)
// Keep the two most recent speakers on stage during their conversation. A narrator
// does not conjure a new character or reveal one from a later line.
const actors = computed(() => {
  const ids = []
  for (let i = position.value; i >= 0 && ids.length < 2; i--) {
    const id = beats.value[i]?.speaker
    if (typeof id === 'number' && character(id) && !ids.includes(id)) ids.push(id)
  }
  return ids.map((id, index) => ({ id, name: speakerName(id), side: index === 0 ? 'near' : 'far' }))
})
const history = computed(() => beats.value.slice(0, furthest.value + 1))

function focus() { container.value?.focus({ preventScroll: true }) }
function next() {
  if (!atEnd.value) {
    position.value++
    furthest.value = Math.max(furthest.value, position.value)
  } else if (!completed.value) {
    completed.value = true
    emit('complete')
  }
}
function previous() { position.value = Math.max(0, position.value - 1) }
function skip() {
  position.value = Math.max(0, beats.value.length - 1)
  furthest.value = position.value
  focus()
}
async function showLog() {
  logDialog.value?.showModal()
  await nextTick()
  const last = logDialog.value?.querySelector('.scene-log-entry:last-of-type')
  last?.scrollIntoView({ block: 'nearest' })
}
function closeLog() { logDialog.value?.close() }
function onKeydown(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
  // Native buttons retain their own Space/Enter action; never advance twice.
  if (event.target !== container.value) return
  if (event.key === 'ArrowLeft') { event.preventDefault(); previous() }
  if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    // The final chapter transition is always an explicit button action.
    if (!atEnd.value) next()
  }
}
watch(() => props.scene.id, async () => {
  position.value = 0
  furthest.value = 0
  completed.value = false
  closeLog()
  await nextTick()
  focus()
}, { immediate: true })
onBeforeUnmount(closeLog)
defineExpose({ focus })
</script>

<template>
  <section ref="container" class="story-scene" :data-mood="scene.mood || 'storm'" tabindex="0"
    :aria-label="`${scene.title}，剧情阅读区；空格或右箭头继续，左箭头回看`" @keydown="onKeydown">
    <header class="scene-heading">
      <div>
        <div class="scene-eyebrow">LAST VOYAGE <span aria-hidden="true">/</span> {{ scene.time }}</div>
        <h3>{{ scene.title }}</h3>
        <p>{{ scene.location }}</p>
      </div>
      <button type="button" class="scene-skip" :disabled="atEnd" @click="skip">跳至场尾 <span aria-hidden="true">↠</span></button>
    </header>

    <div class="scene-stage" aria-hidden="true">
      <div class="scene-window"><div class="scene-horizon"></div></div>
      <div class="scene-reflection"></div>
      <TransitionGroup name="actor" tag="div" class="scene-actors">
        <figure v-for="actor in actors" :key="actor.id" class="scene-actor" :class="[actor.side, { active: actor.id === activeSpeaker }]">
          <img :src="portrait(actor.id)" alt="" width="600" height="800" decoding="async">
          <figcaption>{{ actor.name }}</figcaption>
        </figure>
      </TransitionGroup>
      <div class="scene-grain"></div>
      <div class="scene-stage-caption">{{ scene.location }}<span>{{ scene.time }}</span></div>
    </div>

    <div class="scene-dialogue">
      <div class="scene-speaker-row">
        <span class="scene-speaker" :class="{ narration: !beat.speaker && beat.speaker !== 0 }">{{ speakerName(beat.speaker) }}</span>
        <span class="scene-line-count" aria-hidden="true">{{ position + 1 }} <span>/ {{ beats.length }}</span></span>
      </div>
      <div :key="`${scene.id}:${position}`" class="scene-line" aria-live="polite" aria-atomic="true">
        <p v-if="beat.stage" class="scene-direction">{{ beat.stage }}</p>
        <p class="scene-text" :class="{ narration: !beat.speaker && beat.speaker !== 0 }">{{ beat.text }}</p>
      </div>
      <div class="scene-controls">
        <div class="scene-reading-tools">
          <button type="button" class="scene-tool" :disabled="position === 0" @click="previous" aria-label="上一句">← <span>上一句</span></button>
          <button type="button" class="scene-tool" @click="showLog">回看记录</button>
        </div>
        <button type="button" class="scene-next" :disabled="completed" @click="next">{{ atEnd ? label : '继续' }} <span v-if="!atEnd" aria-hidden="true">▸</span></button>
      </div>
      <progress class="scene-progress" :value="position + 1" :max="Math.max(1, beats.length)" aria-label="场景阅读进度"></progress>
    </div>
    <div class="scene-keyboard-hint">空格 / → 继续 · ← 回看 <span>剧情随手动推进</span></div>

    <dialog ref="logDialog" class="scene-log" :aria-label="`${scene.title} · 本场记录`" @click="event => { if (event.target === logDialog) closeLog() }">
      <div class="scene-log-heading"><h3>本场记录</h3><button type="button" class="scene-tool" @click="closeLog" autofocus>返回剧情 ✕</button></div>
      <p class="scene-log-description">{{ scene.title }} · {{ scene.location }} · 仅显示已走过的段落</p>
      <div class="scene-log-scroll">
        <article v-for="(line, index) in history" :key="index" class="scene-log-entry" :class="{ current: index === position }">
          <span>{{ speakerName(line.speaker) }}</span>
          <p v-if="line.stage" class="scene-log-direction">{{ line.stage }}</p>
          <p>{{ line.text }}</p>
        </article>
      </div>
    </dialog>
  </section>
</template>
