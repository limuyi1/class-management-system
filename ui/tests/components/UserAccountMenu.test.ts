import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import UserAccountMenu from '@/components/UserAccountMenu.vue'
import type { AccountProfileType } from '@/types/Auth'

const user: AccountProfileType = {
  id: 'admin',
  phone: '13800000000',
  nickname: '测试管理员',
  role: 'ADMIN',
  status: 'ACTIVE',
  version: 1,
  superVip: false,
  mustChangePassword: false
}
afterEach(() => {
  document.body.innerHTML = ''
})
it('悬停头像展示登录者信息，并提供用户信息和退出入口', async () => {
  const wrapper = mount(UserAccountMenu, {
    props: { user },
    attachTo: document.body,
    global: { plugins: [ElementPlus] }
  })
  const avatar = wrapper.get('button[aria-label="测试管理员的账号菜单"]')
  await avatar.trigger('mouseenter')
  await flushPromises()
  await vi.waitFor(() => {
    const menu = document.querySelector('.user-account-menu__panel')
    expect(menu?.textContent).toContain('13800000000')
    expect(menu?.textContent).toContain('管理员')
  })
  const info = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
    (item) => item.textContent === '用户信息'
  )!
  info.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
  expect(wrapper.emitted('profile')).toHaveLength(1)
  expect(wrapper.emitted('logout')).toBeUndefined()
  await avatar.trigger('mouseenter')
  await flushPromises()
  const logout = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
    (item) => item.textContent === '退出登录'
  )!
  logout.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
  expect(wrapper.emitted('logout')).toHaveLength(1)
  wrapper.unmount()
})

it('从头像移入下拉面板后保持打开，离开面板才关闭', async () => {
  const wrapper = mount(UserAccountMenu, {
    props: { user },
    attachTo: document.body,
    global: { plugins: [ElementPlus] }
  })
  const avatar = wrapper.get('button[aria-label="测试管理员的账号菜单"]')
  await avatar.trigger('mouseenter')
  await vi.waitFor(() => expect(document.querySelector('.user-account-menu__panel')).not.toBeNull())
  const content = document
    .querySelector('.user-account-menu__panel')!
    .closest('.el-popper') as HTMLElement
  await avatar.trigger('mouseleave')
  content.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 350))
  expect(content.style.display).not.toBe('none')
  content.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
  await vi.waitFor(() => expect(content.style.display).toBe('none'))
  wrapper.unmount()
})
