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
  gap: 4px;
  padding: 6px 6px 8px;
  min-width: 88px;
  max-width: 110px;
  min-height: 56px;
  background: #ffffff;
  border: 1px solid #94a3b8;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
  font-size: 11px;
  color: #0f172a;
  white-space: normal;
  text-align: center;
}
.step-node.kind-entry {
  border-color: #64748b;
  background: #f8fafc;
}
.step-node.is-special {
  border-color: #16a34a;
  background: #f0fdf4;
}
.step-icon {
  width: 24px;
  height: 24px;
  flex: none;
  object-fit: contain;
}
.step-name {
  font-size: 10px;
  line-height: 1.2;
  overflow: hidden;
  text-wrap: balance;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  max-width: 96px;
  min-height: 2.4em;
  color: #334155;
}
</style>
