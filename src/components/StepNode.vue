<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { StepNodeData } from '../graph/mapper'
import { resolveStepIcon } from '../icons/stepIcons'

const props = defineProps<{ data: StepNodeData }>()

const icon = computed(() => resolveStepIcon({ type: props.data.type, kind: props.data.kind }))
const isSpecial = computed(() => props.data.kind === 'entry' && props.data.type === 'SPECIAL')
const displayName = computed(() => {
  const name = props.data.name ?? ''
  if (name.length <= 16) return name

  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) {
    return `${name.slice(0, 16)}\n${name.slice(16)}`.trimEnd()
  }

  let firstLine = ''
  let nextIndex = 0

  for (let i = 0; i < words.length; i += 1) {
    const candidate = firstLine.length === 0 ? words[i] : `${firstLine} ${words[i]}`
    if (candidate.length > 16) break
    firstLine = candidate
    nextIndex = i + 1
  }

  if (!firstLine) {
    return `${name.slice(0, 16)}\n${name.slice(16)}`.trimEnd()
  }

  const secondLine = words.slice(nextIndex).join(' ')
  return `${firstLine}\n${secondLine}`.trimEnd()
})
</script>

<template>
  <div class="step-node">
    <div class="step-node-card" :class="[`kind-${data.kind}`, { 'is-special': isSpecial }]">
      <Handle type="target" :position="Position.Left" />
      <img class="step-icon" :src="icon" :alt="data.type" />
      <Handle type="source" :position="Position.Right" />
    </div>
    <span class="step-name" :title="data.name">{{ displayName }}</span>
  </div>
</template>

<style scoped>
.step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.step-node-card {
  width: 34px;
  height: 34px;
  background: #fcfdff;
  border: 1px solid #8d97a9;
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  color: #1f2937;
  white-space: normal;
  text-align: center;
}

.step-node-card.kind-entry {
  border-color: #64748b;
  background: #f5f7fb;
}

.step-node-card.is-special {
  border-color: #2b944f;
  background: #f2fbf4;
}
.step-icon {
  width: 26px;
  height: 26px;
  flex: none;
  object-fit: contain;
}
.step-name {
  font-size: 9px;
  line-height: 1.15;
  text-align: center;
  overflow: hidden;
  max-width: 94px;
  width: 100%;
  white-space: pre-line;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.1;
  color: #334155;
  cursor: default;
}

.step-node-card:deep(.vue-flow__handle) {
  width: 9px;
  height: 9px;
  border-width: 1px;
}
</style>
