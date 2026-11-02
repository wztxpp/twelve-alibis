<script setup>
defineProps({ levels: Array, current: Number, progress: Object, unlocked: Function })
defineEmits(['select'])
</script>
<template>
  <nav id="levels" aria-label="选择关卡">
    <button v-for="(chapter, index) in levels" :key="chapter.id" class="level" :class="{ active: current === index }"
      :aria-current="current === index ? 'step' : 'false'" :disabled="!unlocked(index)" @click="$emit('select', index)">
      <span class="level-num">0{{ index + 1 }}</span>
      <span><strong>{{ chapter.title }}</strong><small>{{ !unlocked(index) ? '前章破案后开启' : progress[chapter.id] === 'solved' ? '已破案 ✓' : progress[chapter.id] === 'revealed' ? '已揭晓' : '待调查' }}</small></span>
    </button>
  </nav>
</template>
