<script setup>
import { ref } from 'vue'
const dialog = ref(null)
function open() { dialog.value?.showModal() }
function close() { dialog.value?.close() }
function backdrop(event) {
  if (event.target !== dialog.value) return
  const r = dialog.value.getBoundingClientRect()
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close()
}
defineExpose({ open, close })
</script>
<template>
  <dialog id="rulesDialog" ref="dialog" @click="backdrop">
    <button class="close quiet" id="closeRules" aria-label="关闭玩法说明" @click="close">×</button>
    <div class="eyebrow">调查开始之前</div><h2>一句话，也能露出破绽。</h2>
    <ol><li>每关都有 12 人。关卡会告诉你隐瞒者的准确人数。</li><li>在当前一轮笔录中，隐瞒者的整句证词为假，其余人的整句证词为真。身份只针对本轮，不代表好坏；下一章可能变化。</li><li>搜证档案中的记录与手账中的已知条件已经核实，全部为真。人物证词可能与物证冲突，也可能互相冲突。</li><li>先重建事件的时间、行动与工具，再判断哪些人在说假话。选择不满足指定人数时不能提交。</li><li>一句证词如果包含“且”，所有部分都成立才算真；“或”表示至少一个部分成立。说假话不代表每个分句都假。</li><li>点击人物卡片作标记，再提交判断；朗读按钮不会改变选择。答案不对也可以继续尝试。</li><li>卡住时可以逐步查看线索。推理过程会揭示答案与后续剧情，查看后本章记为“已揭晓”，也能继续故事。</li></ol>
    <p>你不需要任何专业知识。只需要让每个人的身份与证词保持一致。</p><button id="startBtn" class="primary" @click="close">开始调查 →</button>
  </dialog>
</template>
