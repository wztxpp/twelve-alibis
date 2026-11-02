import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import * as Vue from 'vue'
import puzzles from '../src/data/puzzles.json' with { type: 'json' }
import { story } from '../src/data/story.js'

const { descriptor } = parse(readFileSync(new URL('../src/components/StoryScene.vue', import.meta.url), 'utf8'))
// Execute the component's actual setup and event handlers with Vue reactivity.
// Only lifecycle registration and browser element methods need a test host.
const setupSource = compileScript(descriptor, { id: 'story-scene-tests' }).content
  .replace(/import\s*\{([\s\S]*?)\}\s*from\s*['"]vue['"]/g, (_, names) => `const { ${names.replace(/\bas\b/g, ':')} } = Vue`)
  .replace('export default', 'return')
  .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/'))
const makeComponent = new Function('Vue', setupSource)
const render = new Function('Vue', compile(descriptor.template.content, { mode: 'function' }).code)(Vue)

async function player(t) {
  const events = []
  const cleanups = []
  const props = Vue.reactive({
    scene: { id: 'test-opening', title: '初始场景', location: '晚宴厅', time: '21:00', beats: [
      { speaker: null, text: '门刚刚打开。' },
      { speaker: 0, text: '先保护现场。' },
      { speaker: 5, text: '我看见了。' },
      { speaker: 11, text: '尚未读到的证言。' },
    ] },
    characters: puzzles.characters,
    label: '开始调查',
  })
  const component = makeComponent({ ...Vue, onBeforeUnmount: cleanup => cleanups.push(cleanup) })
  const scope = Vue.effectScope()
  const bindings = scope.run(() => component.setup(props, { expose() {}, emit: (...args) => events.push(args) }))
  let focused = 0
  let scrolled = 0
  bindings.container.value = { focus() { focused++ } }
  bindings.logDialog.value = {
    open: false,
    showModal() { this.open = true },
    close() { this.open = false },
    querySelector() { return { scrollIntoView() { scrolled++ } } },
  }
  const ctx = Vue.proxyRefs({ ...bindings,
    get scene() { return props.scene }, get characters() { return props.characters }, get label() { return props.label },
  })
  function nodes() {
    const result = []
    function walk(node) {
      if (!node || typeof node !== 'object') return
      result.push(node)
      if (Array.isArray(node.children)) node.children.forEach(walk)
      else if (typeof node.children?.default === 'function') node.children.default().forEach(walk)
    }
    walk(render(ctx, []))
    return result
  }
  const find = className => nodes().find(node => String(node.props?.class || '').split(' ').includes(className))
  const click = className => {
    const node = find(className)
    assert.ok(node, `Missing rendered control: ${className}`)
    assert.notEqual(node.props.disabled, true, `${className} should be usable`)
    return node.props.onClick()
  }
  function key(key, overrides = {}) {
    let prevented = false
    const event = { key, target: bindings.container.value, preventDefault() { prevented = true }, ...overrides }
    find('story-scene').props.onKeydown(event)
    return prevented
  }
  t.after(() => { cleanups.forEach(cleanup => cleanup()); scope.stop() })
  await Vue.nextTick()
  return { bindings, props, events, find, nodes, click, key, focused: () => focused, scrolled: () => scrolled }
}

test('every rewritten chapter has complete, distinct opening and ending scenes with valid speakers', () => {
  assert.deepEqual(Object.keys(story).sort(), puzzles.levels.map(level => level.id).sort())
  const ids = new Set()
  const characterIds = new Set(puzzles.characters.map(character => character.id))
  for (const level of puzzles.levels) {
    const chapter = story[level.id]
    assert.ok(chapter.prologue.trim())
    assert.ok(chapter.recap.length > 0 && chapter.recap.every(line => typeof line === 'string' && line.trim()))
    for (const phase of ['opening', 'ending']) {
      const scene = chapter[phase]
      for (const key of ['id', 'title', 'location', 'time']) assert.ok(typeof scene[key] === 'string' && scene[key].trim(), `${level.id}: missing ${phase}.${key}`)
      assert.equal(ids.has(scene.id), false, `Duplicate scene id: ${scene.id}`)
      ids.add(scene.id)
      assert.ok(scene.beats.length >= 2, `${scene.id}: scene needs an opening and a conclusion`)
      for (const beat of scene.beats) {
        assert.ok(typeof beat.text === 'string' && beat.text.trim(), `${scene.id}: empty story beat`)
        if (typeof beat.speaker === 'number') assert.ok(characterIds.has(beat.speaker), `${scene.id}: unknown character ${beat.speaker}`)
        else assert.ok(beat.speaker === null || (typeof beat.speaker === 'string' && beat.speaker.trim()), `${scene.id}: invalid speaker`)
        if (beat.stage !== undefined) assert.ok(typeof beat.stage === 'string' && beat.stage.trim())
      }
    }
    assert.equal(chapter.resolution.length, chapter.ending.beats.length, 'The archive fallback must contain the entire ending')
  }
  assert.equal(ids.size, puzzles.levels.length * 2)
})

test('previous and history respect the reading position without showing future lines or portraits', async t => {
  const view = await player(t)
  assert.equal(view.find('scene-text').children, '门刚刚打开。')
  assert.deepEqual(view.bindings.actors.value, [])
  assert.equal(view.bindings.history.value.length, 1)
  assert.equal(view.find('scene-tool').props.disabled, true)
  view.click('scene-next')
  view.click('scene-next')
  assert.equal(view.find('scene-text').children, '我看见了。')
  assert.deepEqual(view.bindings.actors.value.map(actor => actor.id), [5, 0])
  view.find('scene-tool').props.onClick()
  assert.equal(view.find('scene-text').children, '先保护现场。')
  assert.deepEqual(view.bindings.actors.value.map(actor => actor.id), [0])
  assert.deepEqual(view.bindings.history.value.map(beat => beat.text), ['门刚刚打开。', '先保护现场。', '我看见了。'])
  assert.equal(view.nodes().some(node => node.children === '尚未读到的证言。'), false)
  const logButton = view.nodes().find(node => node.type === 'button' && node.children === '回看记录')
  await logButton.props.onClick()
  assert.equal(view.bindings.logDialog.value.open, true)
  assert.equal(view.scrolled(), 1)
  assert.deepEqual(view.events, [])
})

test('skip stops at the last line; only the explicit final button completes, exactly once', async t => {
  const view = await player(t)
  view.click('scene-skip')
  assert.equal(view.find('scene-text').children, '尚未读到的证言。')
  assert.equal(view.find('scene-skip').props.disabled, true)
  assert.equal(view.bindings.history.value.length, 4)
  assert.deepEqual(view.events, [])
  for (const key of [' ', 'ArrowRight', 'Enter']) {
    assert.equal(view.key(key), true)
    assert.deepEqual(view.events, [])
  }
  view.click('scene-next')
  assert.deepEqual(view.events, [['complete']])
  assert.equal(view.find('scene-next').props.disabled, true)
  view.find('scene-next').props.onClick()
  assert.deepEqual(view.events, [['complete']])
})

test('keyboard navigation ignores native controls, modifiers and held keys', async t => {
  const view = await player(t)
  for (const overrides of [{ target: {} }, { repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { defaultPrevented: true }]) {
    assert.equal(view.key(' ', overrides), false)
    assert.equal(view.bindings.position.value, 0)
  }
  assert.equal(view.key('ArrowLeft'), true)
  assert.equal(view.bindings.position.value, 0)
  assert.equal(view.key('ArrowRight'), true)
  assert.equal(view.bindings.position.value, 1)
  assert.equal(view.key('ArrowLeft'), true)
  assert.equal(view.bindings.position.value, 0)
  assert.deepEqual(view.events, [])
})

test('changing scenes resets reading history and completion while closing the old log', async t => {
  const view = await player(t)
  view.click('scene-skip')
  view.click('scene-next')
  view.bindings.logDialog.value.showModal()
  const focusBefore = view.focused()
  view.props.scene = {
    id: 'test-ending', title: '新的场景', location: '甲板', time: '22:00',
    beats: [{ speaker: null, text: '新场景开头。' }, { speaker: 0, text: '新场景结尾。' }],
  }
  await Vue.nextTick()
  await Vue.nextTick()
  assert.equal(view.find('scene-text').children, '新场景开头。')
  assert.equal(view.bindings.position.value, 0)
  assert.equal(view.bindings.furthest.value, 0)
  assert.equal(view.bindings.completed.value, false)
  assert.equal(view.bindings.logDialog.value.open, false)
  assert.ok(view.focused() > focusBefore)
  assert.equal(view.bindings.history.value.length, 1)
  assert.deepEqual(view.bindings.actors.value, [])
  view.click('scene-next')
  assert.deepEqual(view.events, [['complete']])
  view.click('scene-next')
  assert.deepEqual(view.events, [['complete'], ['complete']])
})
