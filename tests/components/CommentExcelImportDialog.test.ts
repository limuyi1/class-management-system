import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import CommentExcelImportDialog from '@/views/evaluation/components/CommentExcelImportDialog.vue'

describe('CommentExcelImportDialog', () => {
  it('disables entering before an Excel file is parsed', () => {
    const wrapper = mount(CommentExcelImportDialog, {
      props: {
        modelValue: true
      },
      global: {
        stubs: {
          ElDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          ElButton: {
            props: ['type', 'disabled'],
            template:
              '<button :class="{ primary: type === \'primary\' }" :disabled="disabled"><slot /></button>'
          },
          ElAlert: true,
          ElSelect: true,
          ElOption: true,
          ExcelFileDropzone: true,
          ExcelHeaderRowPicker: true
        },
        directives: {
          loading: {}
        }
      }
    })

    const enterButton = wrapper.get('button.primary')
    expect(enterButton.attributes('disabled')).toBeDefined()
    expect(enterButton.text()).toContain('进入评语处理')
  })
})
