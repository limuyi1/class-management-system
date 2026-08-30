import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import CommentExcelImportDialog from '@/views/evaluation/components/CommentExcelImportDialog.vue'

/**
 * CommentExcelImportDialog 组件测试
 * 测试目标：评语 Excel 导入对话框
 * 覆盖功能：进入评语处理按钮的禁用状态——在 Excel 文件解析完成前禁止进入下一步
 */
describe('CommentExcelImportDialog', () => {
  it('disables entering before an Excel file is parsed', () => {
    const wrapper = mount(CommentExcelImportDialog, {
      props: {
        modelValue: true
      },
      global: {
        stubs: {
          // 用保留默认插槽与 footer 插槽的简化模板替身 ElDialog，以渲染底部按钮
          ElDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          // 替身 ElButton，保留 type 与 disabled 属性以便断言按钮禁用状态
          ElButton: {
            props: ['type', 'disabled'],
            template:
              '<button :class="{ primary: type === \'primary\' }" :disabled="disabled"><slot /></button>'
          },
          ElAlert: true,
          ElSelect: true,
          ElOption: true,
          // 文件拖拽上传区与表头选择器使用空替身，本用例只关注对话框按钮行为
          ExcelFileDropzone: true,
          ExcelHeaderRowPicker: true
        },
        directives: {
          // 注册空的 loading 指令，避免组件挂载时因缺少指令而报错
          loading: {}
        }
      }
    })

    const enterButton = wrapper.get('button.primary')
    expect(enterButton.attributes('disabled')).toBeDefined()
    expect(enterButton.text()).toContain('进入评语处理')
  })
})
