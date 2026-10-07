<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

import { apiRequest, setAccessToken } from '@/api/client'
import logo from '@/assets/main/logo.png'
import SliderCaptcha from './components/SliderCaptcha.vue'
import type { AccountProfileType } from '@/types/Auth'

const emit = defineEmits<{ login: [user: AccountProfileType] }>()
const props = defineProps<{ initialPhone?: string }>()
const phone = ref(props.initialPhone || ''),
  password = ref(''),
  errorMessage = ref('')
const busy = ref(false),
  captchaVisible = ref(false)
let generation = 0
let attempt: { phone: string; password: string; generation: number } | undefined

/** 先检查输入并固定本次账号，点击登录只打开验证码，不提前请求真实登录。 */
function startLogin(): void {
  if (busy.value || captchaVisible.value) return
  errorMessage.value = ''
  const account = phone.value.trim()
  if (!/^1[3-9]\d{9}$/.test(account)) {
    errorMessage.value = '请输入正确的手机号'
    return
  }
  if (!password.value) {
    errorMessage.value = '请输入密码'
    return
  }
  attempt = { phone: account, password: password.value, generation: ++generation }
  captchaVisible.value = true
}

/** 关闭弹窗立即废弃该次验证，输入内容保留，重新点击登录会生成新挑战。 */
function cancelVerification(): void {
  if (busy.value) return
  generation++
  attempt = undefined
}

/** 滑块释放并通过服务端校验后，消费本次票据；同一验证不能重复提交登录。 */
async function completeLogin(ticket: string): Promise<void> {
  if (!ticket || !attempt || !captchaVisible.value || busy.value) return
  const submitted = attempt
  busy.value = true
  try {
    const result = await apiRequest<{ accessToken: string; user: AccountProfileType }>(
      '/auth/login',
      { method: 'POST', body: { phone: submitted.phone, password: submitted.password, ticket } },
      false
    )
    if (submitted.generation !== generation) return
    setAccessToken(result.accessToken)
    password.value = ''
    emit('login', result.user)
  } catch (error) {
    if (submitted.generation === generation)
      errorMessage.value = error instanceof Error ? error.message : '登录失败'
  } finally {
    if (submitted.generation === generation) {
      busy.value = false
      captchaVisible.value = false
      attempt = undefined
    }
  }
}
onBeforeUnmount(() => {
  generation++
  attempt = undefined
  password.value = ''
})
</script>

<template>
  <el-scrollbar height="100svh">
    <main class="login-page">
      <section class="login-page__card" aria-labelledby="login-title">
        <img class="login-page__logo" :src="logo" alt="班务管理系统图标" />
        <h1 id="login-title">班务管理系统</h1>
        <p class="login-page__intro">管理班级，记录每一份成长</p>
        <el-form
          label-position="top"
          size="large"
          :disabled="busy || captchaVisible"
          @submit.prevent="startLogin"
        >
          <el-form-item label="手机号">
            <el-input
              v-model="phone"
              autocomplete="username"
              inputmode="tel"
              maxlength="11"
              placeholder="请输入手机号"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="password"
              type="password"
              autocomplete="current-password"
              show-password
              placeholder="请输入密码"
            />
          </el-form-item>
          <p v-if="errorMessage" class="login-page__error" role="alert">{{ errorMessage }}</p>
          <el-button
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="busy || captchaVisible"
            class="login-page__submit"
            >登录</el-button
          >
        </el-form>
        <p class="login-page__help">账号由管理员创建，忘记密码请联系管理员</p>
      </section>
      <el-dialog
        v-model="captchaVisible"
        title="安全验证"
        :width="'min(400px, calc(100vw - 32px))'"
        align-center
        destroy-on-close
        :show-close="!busy"
        :close-on-click-modal="!busy"
        :close-on-press-escape="!busy"
        @close="cancelVerification"
      >
        <SliderCaptcha
          v-if="attempt"
          :key="attempt.generation"
          :phone="attempt.phone"
          auto-load
          @verified="completeLogin"
        />
        <p v-if="busy" class="login-page__verifying" role="status">验证通过，正在登录…</p>
      </el-dialog>
    </main>
  </el-scrollbar>
</template>

<style scoped lang="scss">
@use '@/assets/styles/auth-page.scss';
</style>
