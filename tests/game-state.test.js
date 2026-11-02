import test from 'node:test'
import assert from 'node:assert/strict'
import { useGame } from '../src/composables/useGame.js'

function fixture(initial = {}) {
  const memory = new Map(Object.entries(initial))
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
  let stops = 0
  const game = useGame({ storage, stopAudio: () => stops++ })
  return { game, storage, memory, stops: () => stops }
}
function solve(game) { game.level.value.answer.forEach(game.toggle); assert.equal(game.submit(), true) }

test('gates, wrong-answer privacy, correct story and three-chapter continuation', () => {
  const { game, stops } = fixture()
  assert.equal(game.load(1), false)
  assert.equal(game.current.value, 0)
  assert.equal(game.canSubmit.value, false)
  ;[0, 2, 3].forEach(game.toggle)
  assert.equal(game.submit(), false)
  assert.equal(game.showEnding.value, false)
  assert.equal(game.showSolution.value, false)
  assert.equal(game.unlocked(1), false)
  assert.equal(game.feedback.value.kind, 'error')
  game.clear()
  for (let i = 0; i < 3; i++) {
    solve(game)
    assert.equal(game.showEnding.value, true)
    assert.equal(game.progress.value[game.level.value.id], 'solved')
    if (i < 2) { assert.equal(game.load(i + 1), true); assert.equal(game.showEnding.value, false) }
  }
  assert.ok(stops() >= 5)
  assert.equal(game.load(3), false)
})

test('reveal requires explicit confirmation, unlocks story without marking solved', () => {
  const { game } = fixture()
  assert.equal(game.reveal(), false)
  assert.equal(game.showEnding.value, false)
  assert.equal(game.reveal(true), true)
  assert.equal(game.showEnding.value, true)
  assert.equal(game.progress.value[game.level.value.id], 'revealed')
  solve(game)
  assert.equal(game.progress.value[game.level.value.id], 'revealed')
  assert.equal(game.unlocked(1), true)
})

test('notes/progress persist; replay hides spoilers; full reset erases notebook and inspection', () => {
  const { game, storage } = fixture()
  game.note.value = '时间线需要交叉验证'
  game.recordOpened(0)
  assert.equal(game.inspectedCount.value, 1)
  solve(game)
  game.load(0)
  assert.equal(game.selected.value.size, 0)
  assert.equal(game.showEnding.value, false)
  assert.equal(game.showSolution.value, false)
  assert.equal(game.note.value, '时间线需要交叉验证')
  assert.equal(game.isInspected(0), true)
  const restored = useGame({ storage })
  assert.equal(restored.unlocked(1), true)
  assert.equal(restored.note.value, '时间线需要交叉验证')
  game.reset()
  assert.equal(game.current.value, 0)
  assert.equal(game.unlocked(1), false)
  assert.equal(game.note.value, '')
  assert.equal(game.inspectedCount.value, 0)
  assert.equal(storage.getItem('twelve-story-v4-notes'), undefined)
})

test('bad or unavailable local storage does not prevent play; hints are bounded', () => {
  const { game } = fixture({ 'twelve-story-v4': 'true', 'twelve-story-v4-notes': '[1]' })
  assert.deepEqual(game.progress.value, {})
  for (let i = 0; i < 100; i++) game.hint()
  assert.equal(game.hintsShown.value, game.level.value.hints.length)
  const blocked = useGame({ storage: { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') }, removeItem() { throw Error('blocked') } } })
  solve(blocked)
  blocked.note.value = 'still usable'
  blocked.reset()
  assert.equal(blocked.unlocked(1), false)
})
