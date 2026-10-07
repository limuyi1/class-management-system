<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { apiRequest } from '@/api/client'
import logo from '@/assets/main/logo.png'
import type { InitialAdminInputType } from '../../../../packages/shared/src/Setup'
import type { AccountProfileType } from '@/types/Auth'
const props = defineProps<{ available: boolean }>()
const emit = defineEmits<{ initialized: [phone: string] }>()
const phone = ref(''),
  nickname = ref(''),
  busy = ref(false),
  created = ref(false),
  error = ref(''),
  copied = ref(false)
/** 使用浏览器密码学随机源生成安装独立的默认密码，用户无需手动设置初始密码。 */
const password = ref(
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_') + '!Aa1'
)
let alive = true
let pending: { body: InitialAdminInputType; key: string; fingerprint: string } | undefined
/** 网络重试保留原密码及幂等键，后端回执只保存账号资料，不保存明文密码。 */
async function create(): Promise<void> {
  if (busy.value || created.value || !props.available) return
  error.value = ''
  if (!/^1[3-9]\d{9}$/.test(phone.value.trim())) {
    error.value = '请输入正确的手机号'
    return
  }
  const body: InitialAdminInputType = {
    phone: phone.value.trim(),
    initialPassword: password.value,
    ...(nickname.value.trim() ? { nickname: nickname.value.trim() } : {})
  }
  const fingerprint = JSON.stringify(body)
  if (pending?.fingerprint !== fingerprint)
    pending = { body, key: crypto.randomUUID(), fingerprint }
  busy.value = true
  try {
    await apiRequest<{ user: AccountProfileType }>(
      '/setup/admin',
      { method: 'POST', body: pending.body, idempotencyKey: pending.key },
      false
    )
    if (alive) created.value = true
  } catch (reason) {
    if (alive) error.value = reason instanceof Error ? reason.message : '创建失败，请重试'
  } finally {
    if (alive) busy.value = false
  }
}
/** 明文仅在当前页面展示，不进入浏览器持久化或日志。 */
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(password.value)
    copied.value = true
  } catch {
    error.value = '复制失败，请选中并复制临时密码'
  }
}
onBeforeUnmount(() => {
  alive = false
  password.value = ''
  pending = undefined
})
</script>
<template>
  <el-scrollbar height="100svh">
    <main class="login-page">
      <section class="login-page__card" aria-labelledby="setup-title">
        <img class="login-page__logo" :src="logo" alt="班务管理系统图标" />
        <h1 id="setup-title">{{ created ? '管理员已创建' : '首次使用设置' }}</h1>
        <p class="login-page__intro">
          {{ created ? '保存临时密码后，即可登录系统' : '创建管理员，开始管理班级' }}
        </p>
        <template v-if="created">
          <p>管理员账号：{{ phone.trim() }}</p>
          <el-input :model-value="password" readonly aria-label="临时密码" />
          <el-button class="setup-page__copy" @click="copy">{{
            copied ? '已复制' : '复制临时密码'
          }}</el-button>
          <p class="login-page__help">临时密码仅在此展示，首次登录后需要修改密码。</p>
          <el-button
            type="primary"
            class="login-page__submit"
            @click="emit('initialized', phone.trim())"
            >已保存密码，前往登录</el-button
          >
        </template>
        <el-form
          v-else-if="available"
          label-position="top"
          size="large"
          :disabled="busy"
          @submit.prevent="create"
        >
          <el-form-item label="管理员手机号"
            ><el-input
              v-model="phone"
              maxlength="11"
              inputmode="tel"
              autocomplete="username"
              placeholder="手机号作为登录用户名"
          /></el-form-item>
          <el-form-item label="昵称（可选）"
            ><el-input v-model="nickname" maxlength="30" placeholder="默认：管理员"
          /></el-form-item>
          <p class="login-page__help">系统自动生成临时密码，创建成功后可查看并复制。</p>
          <el-button type="primary" native-type="submit" class="login-page__submit" :loading="busy"
            >创建管理员</el-button
          >
        </el-form>
        <el-alert
          v-else
          type="info"
          :closable="false"
          title="首次设置请在服务器本机访问；生产部署使用管理员初始化命令。"
        />
        <p v-if="error" class="login-page__error" role="alert">{{ error }}</p>
      </section>
    </main>
  </el-scrollbar>
</template>
<style scoped lang="scss">
@use '@/assets/styles/auth-page.scss';
.setup-page__copy {
  margin-top: 12px;
}
</style>
