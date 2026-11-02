<script setup>
defineProps({ level: Object, records: Array, inspectedCount: Number, isInspected: Function, note: String })
defineEmits(['inspect', 'update:note'])
</script>
<template>
  <section class="case-story">
    <div class="eyebrow">现场简报</div>
    <p id="prologue" class="prologue">{{ level.prologue }}</p><p id="briefing">{{ level.briefing }}</p>
    <div class="archive-heading"><strong>搜证档案</strong><span id="recordCount">已查阅 {{ inspectedCount }} / {{ records.length }}</span></div>
    <p class="archive-help">逐份打开现场记录，寻找条件与关联。所有推理条件都在记录和证词中，不需寻找隐藏像素。</p>
    <div id="evidence" class="record-grid">
      <details v-for="(record, index) in records" :key="`${level.id}:${index}`" class="record" :class="{ read: isInspected(index) }" @toggle="event => event.target.open && $emit('inspect', index)">
        <summary>{{ record.title }}</summary><p>{{ record.text }}</p>
      </details>
    </div>
    <details class="journal"><summary>调查手账 · 前情与已确认线索</summary><div id="journal">
      <p v-for="clue in level.carryClues" :key="clue">{{ clue }}</p>
      <p v-if="!level.carryClues?.length">从第一份现场记录开始。已确认的跨章线索会保存在这里。</p>
    </div></details>
    <details class="journal"><summary>我的推理便签 · 仅保存在此浏览器</summary>
      <textarea id="deductionNotes" :value="note" @input="$emit('update:note', $event.target.value)" rows="4" placeholder="记下人物关系、候选顺序、需要交叉核对的说法……" aria-label="我的推理便签"></textarea>
    </details>
  </section>
</template>
