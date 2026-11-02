import { computed, ref } from 'vue'
import puzzles from '../data/puzzles.json' with { type: 'json' }
import { story } from '../data/story.js'
import { valid } from '../logic/puzzle.js'

const data = { ...puzzles, levels: puzzles.levels.map(level => ({ ...level, ...story[level.id] })) }
const PROGRESS_KEY = 'twelve-story-v5'
const NOTES_KEY = 'twelve-story-v5-notes'
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const chapterIndex = index => Number.isInteger(index) && index >= 0 && index < data.levels.length
const readObject = (storage, key) => {
  try {
    const value = JSON.parse(storage?.getItem(key) || '{}')
    return isObject(value) ? value : {}
  } catch { return {} }
}
const chapterValues = (source, accepts) => Object.fromEntries(data.levels
  .filter(level => isObject(source) && Object.hasOwn(source, level.id) && accepts(source[level.id]))
  .map(level => [level.id, source[level.id]]))
const completed = value => value === 'solved' || value === 'revealed'

function defaultStorage() { try { return globalThis.localStorage } catch { return undefined } }

/** Story, investigation and persistence stay together so refresh cannot skip a scene gate. */
export function useGame({ storage = defaultStorage(), stopAudio = () => {} } = {}) {
  const saved = readObject(storage, PROGRESS_KEY)
  const session = isObject(saved.session) ? saved.session : {}
  const progress = ref(chapterValues(saved.progress, completed))
  const seenEndings = ref(chapterValues(saved.seenEndings, value => value === true))
  let reachable = true
  for (const chapter of data.levels) {
    if (!reachable) delete progress.value[chapter.id]
    if (!completed(progress.value[chapter.id])) delete seenEndings.value[chapter.id]
    reachable = reachable && seenEndings.value[chapter.id] === true
  }
  const current = ref(chapterIndex(session.current) && unlocked(session.current) ? session.current : 0)
  const level = computed(() => data.levels[current.value])
  const restored = current.value === session.current
  const authorizedEnding = () => completed(progress.value[level.value.id])
  const savedPhase = restored ? session.scenePhase : 'opening'
  const scenePhase = ref(['opening', 'investigation'].includes(savedPhase) ? savedPhase
    : savedPhase === 'ending' && authorizedEnding() ? 'ending'
      : savedPhase === 'closed' && seenEndings.value[level.value.id] ? 'closed' : 'opening')
  let openingReturn = restored && session.openingReturn === 'closed' && seenEndings.value[level.value.id] ? 'closed' : 'investigation'
  const selected = ref(new Set(restored && Array.isArray(session.selected)
    ? session.selected.filter(id => Number.isInteger(id) && id >= 0 && id < data.names.length) : []))
  const hintsShown = ref(restored && Number.isInteger(session.hintsShown)
    ? Math.max(0, Math.min(session.hintsShown, level.value.hints.length)) : 0)
  const revealed = ref(restored && session.revealed === true && authorizedEnding())
  const solved = ref(restored && session.solved === true && authorizedEnding())
  const showSolution = ref(restored && session.showSolution === true && authorizedEnding())
  const showEnding = ref(restored && authorizedEnding() && (session.showEnding === true || scenePhase.value === 'ending' || scenePhase.value === 'closed'))
  const feedback = ref(null)
  const notes = ref(chapterValues(readObject(storage, NOTES_KEY), value => typeof value === 'string'))
  const validRecordIds = new Set(data.levels.flatMap(l => (l.records || l.evidence || []).map((_, i) => `${l.id}:${i}`)))
  const inspected = ref(new Set(Array.isArray(saved.inspected) ? saved.inspected.filter(id => validRecordIds.has(id)) : []))
  const investigating = () => scenePhase.value === 'investigation' || scenePhase.value === 'closed'
  const canSubmit = computed(() => investigating() && selected.value.size === level.value.liarCount)
  const records = computed(() => level.value.records || level.value.evidence.map((text, i) => ({ title: `现场记录 ${i + 1}`, text })))
  const inspectedCount = computed(() => records.value.filter((_, i) => inspected.value.has(`${level.value.id}:${i}`)).length)
  const note = computed({
    get: () => notes.value[level.value.id] || '',
    set(value) { notes.value = { ...notes.value, [level.value.id]: String(value) }; persist(NOTES_KEY, notes.value) },
  })
  function persist(key, value) { try { storage?.setItem(key, JSON.stringify(value)) } catch { /* Private mode / quota: continue in memory. */ } }
  function save() {
    persist(PROGRESS_KEY, {
      progress: progress.value, seenEndings: seenEndings.value, inspected: [...inspected.value],
      session: { current: current.value, scenePhase: scenePhase.value, openingReturn, selected: [...selected.value],
        hintsShown: hintsShown.value, revealed: revealed.value, solved: solved.value,
        showSolution: showSolution.value, showEnding: showEnding.value },
    })
  }
  function unlocked(index) {
    return chapterIndex(index) && data.levels.slice(0, index).every(chapter =>
      completed(progress.value[chapter.id]) && seenEndings.value[chapter.id] === true)
  }
  function load(index) {
    if (!unlocked(index)) return false
    stopAudio()
    current.value = index
    selected.value = new Set()
    hintsShown.value = 0
    revealed.value = false
    solved.value = false
    showSolution.value = false
    showEnding.value = false
    feedback.value = null
    openingReturn = 'investigation'
    scenePhase.value = 'opening'
    save()
    return true
  }
  function completeScene() {
    if (scenePhase.value === 'opening') {
      scenePhase.value = openingReturn
    } else if (scenePhase.value === 'ending' && authorizedEnding()) {
      seenEndings.value = { ...seenEndings.value, [level.value.id]: true }
      scenePhase.value = 'closed'
      showSolution.value = true
    } else return false
    save()
    return true
  }
  function startOpening() {
    if (!investigating()) return false
    stopAudio()
    openingReturn = scenePhase.value
    scenePhase.value = 'opening'
    save()
    return true
  }
  function startEnding() {
    if (!authorizedEnding()) return false
    stopAudio()
    showEnding.value = true
    scenePhase.value = 'ending'
    save()
    return true
  }
  function toggle(id) {
    if (!investigating() || !Number.isInteger(id) || id < 0 || id >= data.names.length) return
    const next = new Set(selected.value)
    next.has(id) ? next.delete(id) : next.add(id)
    selected.value = next
    feedback.value = null
    save()
  }
  function clear() { selected.value = new Set(); feedback.value = null; save() }
  function recordOpened(index) {
    if (!Number.isInteger(index) || index < 0 || index >= records.value.length) return
    inspected.value = new Set([...inspected.value, `${level.value.id}:${index}`])
    save()
  }
  function isInspected(index) { return inspected.value.has(`${level.value.id}:${index}`) }
  function submit() {
    if (!canSubmit.value) return false
    if (!valid(selected.value, level.value)) {
      feedback.value = { kind: 'error', title: '这份推断还不能成立。', text: '这组判断无法同时解释全部物证与证词。标记已保留，请再核对谁看见了什么，以及事情发生的顺序。' }
      return false
    }
    stopAudio()
    solved.value = true
    if (!revealed.value && progress.value[level.value.id] !== 'revealed') {
      progress.value = { ...progress.value, [level.value.id]: 'solved' }
    }
    showEnding.value = true
    scenePhase.value = 'ending'
    feedback.value = {
      kind: 'success', title: revealed.value || progress.value[level.value.id] === 'revealed' ? '答案吻合 · 本章已揭晓' : '证词的裂缝，终于接上了。',
      text: `${[...selected.value].sort((a, b) => a - b).map(i => data.names[i]).join('、')} 的本轮证词为假。接下来的对质会揭开他们各自隐瞒的事。`,
    }
    save()
    return true
  }
  function hint() {
    if (!investigating()) return
    hintsShown.value = Math.min(hintsShown.value + 1, level.value.hints.length)
    save()
  }
  function reveal(confirmed = false) {
    if (!investigating()) return false
    if (showSolution.value) { showSolution.value = false; save(); return true }
    if (!solved.value && !revealed.value && !confirmed) return false
    stopAudio()
    if (!solved.value) {
      revealed.value = true
      if (progress.value[level.value.id] !== 'solved') progress.value = { ...progress.value, [level.value.id]: 'revealed' }
    }
    showSolution.value = true
    showEnding.value = true
    save()
    return true
  }
  function reset() {
    stopAudio()
    progress.value = {}; seenEndings.value = {}; notes.value = {}; inspected.value = new Set()
    try { storage?.removeItem(NOTES_KEY) } catch { /* Keep reset usable without storage. */ }
    load(0)
  }
  return { data, current, level, selected, hintsShown, revealed, solved, showSolution, showEnding, feedback,
    progress, seenEndings, scenePhase, note, records, inspectedCount, canSubmit,
    unlocked, load, completeScene, startOpening, startEnding, toggle, clear, recordOpened, isInspected, submit, hint, reveal, reset }
}
