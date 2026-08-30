/**
 * Vitest 全局测试 setup
 * 为所有组件测试注册 font-awesome-icon 的全局桩（stub），
 * 避免挂载组件时渲染真实的字体图标组件。
 */

import { config } from '@vue/test-utils'

config.global.stubs = {
  ...config.global.stubs,
  'font-awesome-icon': true
}
