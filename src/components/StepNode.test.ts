import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StepNode from './StepNode.vue'

describe('StepNode', () => {
  it('renders the icon image and the node name', () => {
    const wrapper = mount(StepNode, {
      props: {
        data: { name: 'Table input', type: 'TableInput', kind: 'step' },
      },
      global: {
        stubs: { Handle: true },
      },
    })

    expect(wrapper.find('img.step-icon').exists()).toBe(true)
    expect(wrapper.text()).toContain('Table input')
  })

  it('adds the special styling for SPECIAL job entries', () => {
    const wrapper = mount(StepNode, {
      props: {
        data: { name: 'START', type: 'SPECIAL', kind: 'entry' },
      },
      global: {
        stubs: { Handle: true },
      },
    })

    expect(wrapper.classes()).toContain('is-special')
  })
})
