<script setup>
defineProps({ resolution: Array, final: Boolean })
defineEmits(['continue'])
</script>
<template>
  <section id="chapterEnding" class="chapter-ending" tabindex="-1">
    <h3>{{ final ? '终章 · 归航' : '真相之后' }}</h3>
    <p v-for="(paragraph, index) in resolution" :key="index">{{ paragraph }}</p>
    <p v-if="final" class="story-complete">— 全篇完 —</p>
    <button v-else class="story-continue" @click="$emit('continue')">带着这份证据，继续下一章 →</button>
  </section>
</template>
