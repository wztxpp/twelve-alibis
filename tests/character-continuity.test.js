import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import data from '../src/data/puzzles.json' with { type: 'json' }

test('character expansion preserves every V4 testimony and logical world exactly', () => {
  const logical = data.levels.map(l => ({id:l.id, statements:l.statements, worlds:l.worlds, answer:l.answer, solutionWorld:l.solutionWorld, liarCount:l.liarCount}))
  assert.equal(createHash('sha256').update(JSON.stringify(logical)).digest('hex'), 'dee7a964567e5ef90925a8b5ad3d494a9da80605b4a9868141307b4cb1fd70d5')
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
