<script setup>
import { computed } from 'vue'
const props = defineProps({ id: Number, name: String, role: String, statement: String, source: String, selected: Boolean, speaking: Boolean, speechSupported: Boolean, character: Object })
defineEmits(['toggle', 'speak'])
const number = computed(() => String(props.id + 1).padStart(2, '0'))
const portrait = computed(() => `${import.meta.env.BASE_URL}assets/cruise-${number.value}.webp`)
const quote = computed(() => props.statement.replaceAll('“', '「').replaceAll('”', '」'))
</script>
<template>
  <article class="dossier">
    <div class="card" :class="{ selected }" :data-id="id">
      <button type="button" class="portrait-wrap portrait-button" :class="{ 'is-speaking': speaking }" :aria-pressed="speaking" :disabled="!speechSupported" :aria-label="`${speaking ? '停止朗读' : '朗读'}${name}的证词（立绘）`" @click="$emit('speak', id)"><img class="character-art cruise-art" :src="portrait" :alt="`${name}的半身角色立绘`" loading="lazy" decoding="async" width="600" height="800"><span class="portrait-label">档案 {{ number }} · {{ speaking ? '■ 正在朗读 · 点击停止' : '▶ 点击立绘听证词' }}</span></button>
      <button type="button" class="card-body selection-button" :aria-pressed="selected" :aria-label="`${name}：${statement}，${selected ? '取消标记' : '标记为隐瞒者'}`" @click="$emit('toggle', id)"><span class="person"><span class="person-name">{{ name }}<small class="role">{{ character?.age ? `${character.age}岁 · ` : '' }}{{ role }}</small></span><span class="mark" aria-hidden="true">✓</span></span>
        <span class="quote">“{{ quote }}”</span><span class="card-foot">{{ selected ? '已标记 · 隐瞒者' : '点击姓名或证词标记' }}</span></button>
    </div>
    <p v-if="source" class="testimony-source">{{ source }}</p>
    <details v-if="character" class="character-profile">
      <summary>{{ name }} · 人物档案</summary>
      <p>{{ character.publicBio }}</p><p v-if="character.habit"><b>小习惯：</b>{{ character.habit }}</p>
      <p v-if="character.voiceProfile?.description"><b>说话方式：</b>{{ character.voiceProfile.description }}</p>
    </details>
    <button type="button" class="speak-btn" :class="{ 'is-speaking': speaking }" :aria-pressed="speaking" :disabled="!speechSupported" :aria-label="`${speaking ? '停止朗读' : '朗读'}${name}的证词`" @click="$emit('speak', id)">{{ speaking ? '■ 停止朗读' : '▶ 听证词' }}</button>
  </article>
</template>
