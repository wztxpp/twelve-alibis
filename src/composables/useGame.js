import { computed, ref } from 'vue'
import data from '../data/puzzles.json' with { type: 'json' }
import { valid } from '../logic/puzzle.js'

const PROGRESS_KEY = 'twelve-story-v4'
const NOTES_KEY = 'twelve-story-v4-notes'
const readObject = (storage, key) => {
  try {
    const value = JSON.parse(storage?.getItem(key) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

/** Reactive game state; storage and audio are injected for deterministic tests. */
function defaultStorage() { try { return globalThis.localStorage } catch { return undefined } }

export function useGame({ storage = defaultStorage(), stopAudio = () => {} } = {}) {
  const current = ref(0)
  const selected = ref(new Set())
  const hintsShown = ref(0)
  const revealed = ref(false)
  const solved = ref(false)
  const showSolution = ref(false)
  const showEnding = ref(false)
  const feedback = ref(null)
  const progress = ref(readObject(storage, PROGRESS_KEY))
  const notes = ref(readObject(storage, NOTES_KEY))
  const inspected = ref(new Set())
  const level = computed(() => data.levels[current.value])
  const canSubmit = computed(() => selected.value.size === level.value.liarCount)
  const records = computed(() => level.value.records || level.value.evidence.map((text, i) => ({ title: `现场记录 ${i + 1}`, text })))
  const inspectedCount = computed(() => records.value.filter((_, i) => inspected.value.has(`${level.value.id}:${i}`)).length)
  const note = computed({
    get: () => notes.value[level.value.id] || '',
    set(value) { notes.value = { ...notes.value, [level.value.id]: value }; persist(NOTES_KEY, notes.value) },
  })
  function persist(key, value) { try { storage?.setItem(key, JSON.stringify(value)) } catch { /* Private mode / quota: continue in memory. */ } }
  function unlocked(index) { return index === 0 || ['solved', 'revealed'].includes(progress.value[data.levels[index - 1]?.id]) }
  function load(index) {
    if (index < 0 || index >= data.levels.length || !unlocked(index)) return false
    stopAudio()
    current.value = index
    selected.value = new Set()
    hintsShown.value = 0
    revealed.value = false
    solved.value = false
    showSolution.value = false
    showEnding.value = false
    feedback.value = null
    return true
  }
  function toggle(id) {
    const next = new Set(selected.value)
    next.has(id) ? next.delete(id) : next.add(id)
    selected.value = next
    feedback.value = null
  }
  function clear() { selected.value = new Set(); feedback.value = null }
  function recordOpened(index) { inspected.value = new Set([...inspected.value, `${level.value.id}:${index}`]) }
  function isInspected(index) { return inspected.value.has(`${level.value.id}:${index}`) }
  function submit() {
    if (!canSubmit.value) return false
    if (!valid(selected.value, level.value)) {
      feedback.value = { kind: 'error', title: '这份推断还不能成立。', text: '按你的身份分配，没有任何事件经过能同时满足全部物证与证词。请重新检查时间顺序和行动条件；标记已保留，不直接提示哪位人物选错。' }
      return false
    }
    stopAudio()
    solved.value = true
    if (!revealed.value) { progress.value = { ...progress.value, [level.value.id]: 'solved' }; persist(PROGRESS_KEY, progress.value) }
    showEnding.value = true
    feedback.value = {
      kind: 'success', title: revealed.value ? '答案吻合 · 本关已揭晓' : '案件告破。',
      text: `${[...selected.value].sort((a, b) => a - b).map(i => data.names[i]).join('、')} 是隐瞒者。你的判断让全部 12 份证词与身份一致。`,
    }
    return true
  }
  function hint() { hintsShown.value = Math.min(hintsShown.value + 1, level.value.hints.length) }
  function reveal(confirmed = false) {
    if (showSolution.value) { showSolution.value = false; return true }
    if (!solved.value && !revealed.value && !confirmed) return false
    stopAudio()
    if (!solved.value) {
      revealed.value = true
      if (progress.value[level.value.id] !== 'solved') progress.value = { ...progress.value, [level.value.id]: 'revealed' }
      persist(PROGRESS_KEY, progress.value)
    }
    showSolution.value = true
    showEnding.value = true
    return true
  }
  function reset() {
    stopAudio()
    progress.value = {}; notes.value = {}; inspected.value = new Set()
    persist(PROGRESS_KEY, {})
    try { storage?.removeItem(NOTES_KEY) } catch { /* Keep reset usable without storage. */ }
    load(0)
  }
  return { data, current, level, selected, hintsShown, revealed, solved, showSolution, showEnding, feedback,
    progress, note, records, inspectedCount, canSubmit, unlocked, load, toggle, clear, recordOpened, isInspected, submit, hint, reveal, reset }
}
