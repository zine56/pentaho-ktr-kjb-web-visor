<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { StepNodeData } from '../graph/mapper'
import { resolveStepIcon } from '../icons/stepIcons'

const props = defineProps<{ data: StepNodeData }>()

const icon = computed(() => resolveStepIcon({ type: props.data.type, kind: props.data.kind }))
const isSpecial = computed(() => props.data.kind === 'entry' && props.data.type === 'SPECIAL')
</script>

<template>
  <div class="step-node" :class="[`kind-${data.kind}`, { 'is-special': isSpecial }]">
    <Handle type="target" :position="Position.Left" />
    <img class="step-icon" :src="icon" :alt="data.type" />
    <span class="step-name">{{ data.name }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 5px 5px 7px;
  min-width: 86px;
  max-width: 108px;
  min-height: 58px;
  background: #fcfdff;
  border: 1px solid #8d97a9;
  border-radius: 3px;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  color: #1f2937;
  white-space: normal;
  text-align: center;
  box-sizing: border-box;
}
.step-node.kind-entry {
  border-color: #64748b;
  background: #f5f7fb;
}
.step-node.is-special {
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
  overflow: hidden;
  text-wrap: balance;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  max-width: 94px;
  min-height: 2.4em;
  color: #334155;
  letter-spacing: 0.01em;
}

.step-node:deep(.vue-flow__handle) {
  width: 9px;
  height: 9px;
  border-width: 1px;
}
</style>
