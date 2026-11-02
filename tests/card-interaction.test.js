import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import * as Vue from 'vue'

const { descriptor } = parse(readFileSync(new URL('../src/components/CharacterCard.vue', import.meta.url), 'utf8'))
const render = new Function('Vue', compile(descriptor.template.content, { mode: 'function' }).code)(Vue)
function card(overrides = {}) {
  const events = []
  const ctx = { id: 2, name: '白榆', role: '律师', statement: '证词', source: '', quote: '证词', number: '03', portrait: '/portrait.webp', selected: false, speaking: false, speechSupported: true, character: null, $emit: (...args) => events.push(args), ...overrides }
  const tree = render(ctx, [])
  const nodes = []
  function walk(node, ancestors = []) {
    if (!node || typeof node !== 'object') return
    nodes.push({ node, ancestors })
    if (Array.isArray(node.children)) node.children.forEach(child => walk(child, [...ancestors, node]))
  }
  walk(tree)
  const find = cls => nodes.find(({ node }) => node.props?.class?.split(' ').includes(cls)).node
  return { events, nodes, find }
}
test('portrait and explicit audio control emit speech only, text emits selection exactly once', () => {
  const { events, find } = card()
  find('portrait-button').props.onClick()
  assert.deepEqual(events.splice(0), [['speak', 2]])
  find('selection-button').props.onClick()
  assert.deepEqual(events.splice(0), [['toggle', 2]])
  find('selection-button').props.onClick()
  assert.deepEqual(events.splice(0), [['toggle', 2]])
  find('speak-btn').props.onClick()
  assert.deepEqual(events, [['speak', 2]])
})
test('name and testimony share one native selection button, without clickable ancestors or nested buttons', () => {
  const { nodes } = card()
  for (const { node, ancestors } of nodes) {
    if (node.type === 'button') assert.equal(ancestors.some(parent => parent.type === 'button' || parent.props?.onClick), false)
    if (node.props?.class === 'person-name' || node.props?.class === 'quote') {
      assert.equal(ancestors.filter(parent => parent.props?.onClick).length, 1)
      assert.match(ancestors.find(parent => parent.props?.onClick).props.class, /selection-button/)
    }
  }
})
test('playing and selected states are independent; disabled audio never disables selection', () => {
  for (const selected of [false, true]) for (const speaking of [false, true]) {
    const { find } = card({ selected, speaking, speechSupported: false })
    assert.equal(find('portrait-button').props['aria-pressed'], speaking)
    assert.equal(find('selection-button').props['aria-pressed'], selected)
    assert.equal(find('portrait-button').props.disabled, true)
    assert.equal(find('selection-button').props.disabled, undefined)
    assert.equal(find('selection-button').props.type, 'button')
  }
})
