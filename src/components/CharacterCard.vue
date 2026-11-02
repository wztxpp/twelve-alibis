<script setup>
import { computed } from 'vue'
const props = defineProps({ id: Number, name: String, role: String, statement: String, selected: Boolean, speaking: Boolean, speechSupported: Boolean })
defineEmits(['toggle', 'speak'])
const number = computed(() => String(props.id + 1).padStart(2, '0'))
const portrait = computed(() => `${import.meta.env.BASE_URL}assets/cruise-${number.value}.webp`)
const quote = computed(() => props.statement.replaceAll('“', '「').replaceAll('”', '」'))
</script>
<template>
  <article class="dossier">
    <button type="button" class="card" :class="{ selected }" :data-id="id" :aria-pressed="selected" :aria-label="`${name}：${statement}，标记为隐瞒者`" @click="$emit('toggle', id)">
      <div class="portrait-wrap"><img class="character-art cruise-art" :src="portrait" :alt="`${name}的半身角色立绘`" loading="lazy" decoding="async" width="600" height="800"><span class="portrait-label">档案 {{ number }}</span></div>
      <div class="card-body"><div class="person"><span class="person-name">{{ name }}<small class="role">{{ role }}</small></span><span class="mark" aria-hidden="true">✓</span></div>
        <p class="quote">“{{ quote }}”</p><span class="card-foot">{{ selected ? '已标记 · 隐瞒者' : '点击标记 · 身份未定' }}</span></div>
    </button>
    <button type="button" class="speak-btn" :class="{ 'is-speaking': speaking }" :aria-pressed="speaking" :disabled="!speechSupported" :aria-label="`${speaking ? '停止朗读' : '朗读'}${name}的证词`" @click="$emit('speak', id)">{{ speaking ? '■ 停止朗读' : '▶ 听证词' }}</button>
  </article>
</template>
