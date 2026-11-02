import test from 'node:test'
import assert from 'node:assert/strict'
import data from '../src/data/puzzles.json' with { type: 'json' }

test('rewritten chapters preserve the same twelve people and isolate old saves and audio', () => {
  assert.deepEqual(data.levels.map(l => l.id), ['last-voyage-1', 'last-voyage-2', 'last-voyage-3'])
  for (const chapter of data.levels) {
    assert.deepEqual(chapter.statements.map(s => s.speaker).sort((a,b) => a-b), Array.from({length:12},(_,i)=>i))
    assert.deepEqual(chapter.castRoles, data.characters.map(c => c.role))
  }
})
test('twelve distinct adult character directions align with names and public cards', () => {
  assert.equal(data.characters.length, 12)
  assert.equal(new Set(data.characters.map(c => c.id)).size, 12)
  for (const c of data.characters) {
    assert.equal(c.name, data.names[c.id])
    assert.ok(c.age >= 18)
    assert.ok(c.publicBio?.length > 15)
    assert.ok(c.voiceProfile?.description?.length > 5)
  }
  assert.ok(Math.max(...data.characters.map(c => c.age)) - Math.min(...data.characters.map(c => c.age)) >= 30)
})
