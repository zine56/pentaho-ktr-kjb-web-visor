<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { StepNodeData } from '../graph/mapper'
import { resolveStepIcon } from '../icons/stepIcons'

const props = defineProps<{ data: StepNodeData }>()

const icon = computed(() => resolveStepIcon({ type: props.data.type, kind: props.data.kind }))
const isSpecial = computed(() => props.data.kind === 'entry' && props.data.type === 'SPECIAL')
const isHighlighted = computed(() => props.data.highlighted ?? false)
const maxLineChars = 16
const handlePositions = [
  { id: 'left', position: Position.Left },
  { id: 'right', position: Position.Right },
  { id: 'top', position: Position.Top },
  { id: 'bottom', position: Position.Bottom },
] as const
const tooltip = computed(() =>
  isHighlighted.value
    ? `${props.data.name} (uid: ${props.data.uid}) [deeplink match]`
    : `${props.data.name} (uid: ${props.data.uid})`,
)
const displayName = computed(() => {
  const name = props.data.name ?? ''
  if (name.length <= maxLineChars) return name

  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) {
    const firstLine = name.slice(0, maxLineChars)
    const secondLineRaw = name.slice(maxLineChars)
    return `${firstLine}\n${secondLineRaw.length > maxLineChars - 3 ? `${secondLineRaw.slice(0, maxLineChars - 3)}...` : secondLineRaw}`
  }

  let firstLine = ''
  let nextIndex = 0

  for (let i = 0; i < words.length; i += 1) {
    const candidate = firstLine.length === 0 ? words[i] : `${firstLine} ${words[i]}`
    if (candidate.length > maxLineChars) break
    firstLine = candidate
    nextIndex = i + 1
  }

  if (!firstLine) {
    const firstLine = name.slice(0, maxLineChars)
    const secondLineRaw = name.slice(maxLineChars)
    return `${firstLine}\n${secondLineRaw.length > maxLineChars - 3 ? `${secondLineRaw.slice(0, maxLineChars - 3)}...` : secondLineRaw}`
  }

  const secondLine = words.slice(nextIndex).join(' ')
  const trimmedSecond = secondLine.length > maxLineChars ? `${secondLine.slice(0, maxLineChars - 3)}...` : secondLine
  return `${firstLine}\n${trimmedSecond}`.trimEnd()
})
</script>

<template>
  <div class="step-node" :title="tooltip" :data-node-uid="data.uid" :class="{ highlighted: isHighlighted }">
    <div class="step-node-card" :class="[`kind-${data.kind}`, { 'is-special': isSpecial }]">
      <Handle
        v-for="handle in handlePositions"
        :id="`target-${handle.id}`"
        :key="`target-${handle.id}`"
        type="target"
        :position="handle.position"
        class="target-handle"
      />
      <img class="step-icon" :src="icon" :alt="data.type" />
      <Handle
        v-for="handle in handlePositions"
        :id="`source-${handle.id}`"
        :key="`source-${handle.id}`"
        type="source"
        :position="handle.position"
        class="source-handle"
      />
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

.step-node.highlighted {
  filter: saturate(1.08);
}

.step-node-card {
  position: relative;
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

.step-node.highlighted .step-node-card {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25), 0 4px 14px rgba(37, 99, 235, 0.3);
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
  border-color: transparent;
  background: transparent;
}
</style>
