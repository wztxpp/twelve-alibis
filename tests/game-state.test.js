import test from 'node:test'
import assert from 'node:assert/strict'
import { useGame } from '../src/composables/useGame.js'

const PROGRESS_KEY = 'twelve-story-v5'
const NOTES_KEY = 'twelve-story-v5-notes'

function fixture(initial = {}) {
  const memory = new Map(Object.entries(initial))
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
  let stops = 0
  const game = useGame({ storage, stopAudio: () => stops++ })
  return { game, storage, memory, stops: () => stops }
}
function investigate(game) {
  assert.equal(game.scenePhase.value, 'opening')
  assert.equal(game.completeScene(), true)
  assert.equal(game.scenePhase.value, 'investigation')
}
function solve(game) { game.clear(); game.level.value.answer.forEach(game.toggle); assert.equal(game.submit(), true) }

test('openings, wrong-answer privacy and ending completion gate all three chapters', () => {
  const { game, storage, stops } = fixture()
  assert.equal(game.load(1), false)
  assert.equal(game.current.value, 0)
  assert.equal(game.canSubmit.value, false)
  assert.equal(game.startEnding(), false)
  assert.equal(game.reveal(true), false)
  game.toggle(0)
  assert.equal(game.selected.value.size, 0)
  investigate(game)
  const wrong = [...game.level.value.answer]
  wrong[0] = game.data.names.findIndex((_, id) => !wrong.includes(id))
  wrong.forEach(game.toggle)
  assert.equal(game.submit(), false)
  assert.equal(game.showEnding.value, false)
  assert.equal(game.showSolution.value, false)
  assert.equal(game.unlocked(1), false)
  assert.equal(game.scenePhase.value, 'investigation')
  assert.equal(game.feedback.value.kind, 'error')
  assert.deepEqual([...game.selected.value], wrong)
  assert.equal(game.completeScene(), false)

  for (let i = 0; i < 3; i++) {
    solve(game)
    assert.equal(game.showEnding.value, true)
    assert.equal(game.scenePhase.value, 'ending')
    assert.equal(game.progress.value[game.level.value.id], 'solved')
    const restored = useGame({ storage })
    assert.equal(restored.current.value, i)
    assert.equal(restored.scenePhase.value, 'ending')
    assert.equal(restored.solved.value, true)
    if (i < 2) {
      assert.equal(game.unlocked(i + 1), false)
      assert.equal(restored.unlocked(i + 1), false)
      assert.equal(game.load(i + 1), false)
    }
    assert.equal(game.completeScene(), true)
    assert.equal(game.scenePhase.value, 'closed')
    assert.equal(game.seenEndings.value[game.level.value.id], true)
    if (i < 2) {
      assert.equal(game.load(i + 1), true)
      assert.equal(game.showEnding.value, false)
      assert.equal(game.showSolution.value, false)
      investigate(game)
    }
  }
  assert.ok(stops() >= 5)
  assert.equal(game.load(3), false)
})

test('confirmed reveal keeps the explanation visible and requires explicit ending playback', () => {
  const { game, storage } = fixture()
  investigate(game)
  assert.equal(game.reveal(), false)
  assert.equal(game.showEnding.value, false)
  assert.equal(game.reveal(true), true)
  assert.equal(game.showEnding.value, true)
  assert.equal(game.showSolution.value, true)
  assert.equal(game.scenePhase.value, 'investigation')
  assert.equal(game.progress.value[game.level.value.id], 'revealed')
  assert.equal(game.unlocked(1), false)
  const restoredExplanation = useGame({ storage })
  assert.equal(restoredExplanation.scenePhase.value, 'investigation')
  assert.equal(restoredExplanation.showSolution.value, true)
  assert.equal(restoredExplanation.revealed.value, true)
  assert.equal(restoredExplanation.solved.value, false)
  assert.equal(restoredExplanation.unlocked(1), false)
  assert.equal(game.completeScene(), false)
  assert.equal(game.startEnding(), true)
  assert.equal(game.scenePhase.value, 'ending')
  assert.equal(game.completeScene(), true)
  assert.equal(game.unlocked(1), true)
  const restoredClosed = useGame({ storage })
  assert.equal(restoredClosed.scenePhase.value, 'closed')
  assert.equal(restoredClosed.unlocked(1), true)
  assert.equal(restoredClosed.progress.value[game.level.value.id], 'revealed')
  assert.equal(restoredClosed.solved.value, false)
  solve(game)
  assert.equal(game.progress.value[game.level.value.id], 'revealed')
})

test('investigation selections, hints, record visits and notes survive refresh without revealing answers', () => {
  const { game, storage } = fixture()
  investigate(game)
  game.note.value = '广播的声音未必来自现场'
  game.recordOpened(0)
  game.toggle(2)
  game.hint()
  const restored = useGame({ storage })
  assert.equal(restored.scenePhase.value, 'investigation')
  assert.deepEqual([...restored.selected.value], [2])
  assert.equal(restored.hintsShown.value, 1)
  assert.equal(restored.inspectedCount.value, 1)
  assert.equal(restored.note.value, '广播的声音未必来自现场')
  assert.equal(restored.showSolution.value, false)
  assert.equal(restored.showEnding.value, false)
  assert.equal(restored.unlocked(1), false)
})

test('chapter replay hides answers; scene replay returns to the prior phase; full reset clears V5', () => {
  const { game, storage } = fixture()
  investigate(game)
  game.note.value = '时间线需要交叉验证'
  game.recordOpened(0)
  solve(game)
  game.completeScene()
  assert.equal(game.startOpening(), true)
  const restored = useGame({ storage })
  assert.equal(restored.scenePhase.value, 'opening')
  restored.completeScene()
  assert.equal(restored.scenePhase.value, 'closed')
  assert.equal(restored.startEnding(), true)
  restored.completeScene()
  restored.load(0)
  assert.equal(restored.selected.value.size, 0)
  assert.equal(restored.showEnding.value, false)
  assert.equal(restored.showSolution.value, false)
  assert.equal(restored.note.value, '时间线需要交叉验证')
  assert.equal(restored.isInspected(0), true)
  assert.equal(restored.unlocked(1), true)
  restored.reset()
  assert.equal(restored.current.value, 0)
  assert.equal(restored.scenePhase.value, 'opening')
  assert.equal(restored.unlocked(1), false)
  assert.equal(restored.note.value, '')
  assert.equal(restored.inspectedCount.value, 0)
  assert.deepEqual(restored.seenEndings.value, {})
  assert.equal(storage.getItem(NOTES_KEY), undefined)
  const clean = useGame({ storage })
  assert.equal(clean.unlocked(1), false)
  assert.equal(clean.scenePhase.value, 'opening')
})

test('bad saved shapes, fake endings and prototype-like keys cannot grant progress', () => {
  const first = fixture().game.level.value.id
  const { game } = fixture({
    [PROGRESS_KEY]: JSON.stringify({
      progress: { [first]: 'constructor', '__proto__': 'solved', unknown: 'solved' },
      seenEndings: { [first]: true },
      session: { current: 2, scenePhase: 'ending', solved: true, showSolution: true, selected: [1, '2', 99, -1, null] },
      inspected: ['unknown:0', `${first}:999`],
    }),
    [NOTES_KEY]: JSON.stringify({ [first]: { html: 'invalid' } }),
  })
  assert.equal(game.current.value, 0)
  assert.equal(game.scenePhase.value, 'opening')
  assert.deepEqual(game.progress.value, {})
  assert.deepEqual(game.seenEndings.value, {})
  assert.equal(game.selected.value.size, 0)
  assert.equal(game.solved.value, false)
  assert.equal(game.showSolution.value, false)
  assert.equal(game.note.value, '')
  assert.equal(game.inspectedCount.value, 0)
  for (const index of [-1, 0.1, NaN, Infinity, '0', null, undefined, {}, 3]) {
    assert.equal(game.unlocked(index), false)
    assert.equal(game.load(index), false)
  }
})

test('invalid selections and record indices are ignored; partial valid session values are sanitized', () => {
  const { game } = fixture({
    [PROGRESS_KEY]: JSON.stringify({ session: { current: 0, scenePhase: 'investigation', selected: [1, 1, '2', 2.5, 99, null], hintsShown: 999 } }),
  })
  assert.deepEqual([...game.selected.value], [1])
  assert.equal(game.hintsShown.value, game.level.value.hints.length)
  for (const invalid of [-1, 0.5, NaN, Infinity, '1', null, undefined, 99]) {
    game.toggle(invalid)
    game.recordOpened(invalid)
  }
  assert.deepEqual([...game.selected.value], [1])
  assert.equal(game.inspectedCount.value, 0)
})

test('broken progress chains cannot retain completion beyond an unfinished scene', () => {
  const ids = fixture().game.data.levels.map(level => level.id)
  const { game } = fixture({
    [PROGRESS_KEY]: JSON.stringify({
      progress: { [ids[0]]: 'solved', [ids[1]]: 'solved', [ids[2]]: 'solved' },
      seenEndings: { [ids[1]]: true, [ids[2]]: true },
      session: { current: 0, scenePhase: 'ending' },
    }),
  })
  assert.equal(game.scenePhase.value, 'ending')
  assert.deepEqual(game.progress.value, { [ids[0]]: 'solved' })
  assert.deepEqual(game.seenEndings.value, {})
  game.completeScene()
  assert.equal(game.unlocked(1), true)
  assert.equal(game.unlocked(2), false)
})

test('old V4 completions never unlock the rewritten story', () => {
  const { game } = fixture({
    'twelve-story-v4': JSON.stringify({ 'empty-seat-1': 'solved', 'empty-seat-2': 'solved' }),
    'twelve-story-v4-notes': JSON.stringify({ 'empty-seat-1': 'old answer' }),
  })
  assert.equal(game.current.value, 0)
  assert.equal(game.unlocked(1), false)
  assert.equal(game.note.value, '')
})

test('unavailable local storage never blocks play, hints or reset', () => {
  const { game } = fixture({ [PROGRESS_KEY]: 'true', [NOTES_KEY]: '[1]' })
  assert.deepEqual(game.progress.value, {})
  investigate(game)
  for (let i = 0; i < 100; i++) game.hint()
  assert.equal(game.hintsShown.value, game.level.value.hints.length)
  const blocked = useGame({ storage: { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') }, removeItem() { throw Error('blocked') } } })
  investigate(blocked)
  solve(blocked)
  blocked.completeScene()
  assert.equal(blocked.unlocked(1), true)
  blocked.note.value = 'still usable'
  blocked.reset()
  assert.equal(blocked.unlocked(1), false)
  assert.equal(blocked.scenePhase.value, 'opening')
})
