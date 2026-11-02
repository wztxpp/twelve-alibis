import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import data from '../src/data/puzzles.json' with { type: 'json' }
import { recordings } from '../src/audio/recordings.js'
import { matchingRecording } from '../src/audio/speech.js'

test('all 36 legacy recordings stay intact for later regeneration reference', () => {
  assert.equal(Object.keys(recordings).length, 36)
  const paths = new Set()
  for (const [key, entry] of Object.entries(recordings)) {
      const [chapterId, speaker] = key.split(':')
      assert.equal(matchingRecording(recordings, chapterId, Number(speaker), entry.text), entry)
      assert.ok(entry.src.endsWith('.mp3'))
      paths.add(entry.src)
      const bytes = readFileSync(new URL(`../public${entry.src}`, import.meta.url))
      assert.ok(bytes.length > 2000, `${entry.src} is empty or invalid`)
      assert.ok(bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 0xff, 'MP3 header expected')
      assert.equal(matchingRecording(recordings, chapterId, Number(speaker), entry.text + '已改动'), null)
  }
  assert.equal(paths.size, 36)
})

test('rewritten testimony never plays an unrelated legacy recording', () => {
  for (const chapter of data.levels) for (const statement of chapter.statements) {
    assert.equal(matchingRecording(recordings, chapter.id, statement.speaker, statement.text), null)
  }
})
