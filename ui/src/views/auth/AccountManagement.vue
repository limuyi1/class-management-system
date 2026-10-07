<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import ManagementCard from '@/components/ManagementCard.vue'

import { apiRequest } from '@/api/client'
import type { AccountProfileType } from '@/types/Auth'

const users = ref<AccountProfileType[]>([])
const search = ref('')
const page = ref(1)
const total = ref(0)
const busy = ref(false)
const dialog = ref(false)
const editing = ref<AccountProfileType | null>(null)
const phone = ref('')
const nickname = ref('')

/** 查询条件变化后从第一页重新读取，避免旧页码导致空结果。 */
function searchUsers(): void {
  page.value = 1
  void load()
}

/** 后端分页限制响应大小；前端不下载所有账号再自行筛选。 */
async function load(): Promise<void> {
  busy.value = true
  try {
    const result = await apiRequest<{ items: AccountProfileType[]; total: number }>(
      `/admin/users?page=${page.value}&search=${encodeURIComponent(search.value)}`
    )
    users.value = result.items
    total.value = result.total
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}

/** 用户取消对话框不是异常；真正的接口失败必须明确显示。 */
function report(error: unknown): void {
  if (error === 'cancel' || error === 'close') return
  console.error('账号操作失败:', error)
  ElMessage.error(error instanceof Error ? error.message : '操作失败')
}

function open(user?: AccountProfileType): void {
  editing.value = user || null
  phone.value = user?.phone || ''
  nickname.value = user?.nickname || ''
  dialog.value = true
}

/** 创建响应中的一次性密码仅在当次弹窗显示，不写本地存储。 */
async function save(): Promise<void> {
  if (busy.value) return
  if (!/^1[3-9]\d{9}$/.test(phone.value.trim())) {
    ElMessage.error('请输入有效的手机号')
    return
  }
  if (
    (editing.value || nickname.value.trim()) &&
    (nickname.value.trim().length < 2 || nickname.value.trim().length > 30)
  ) {
    ElMessage.error('昵称需为 2–30 个字符')
    return
  }
  busy.value = true
  try {
    if (editing.value) {
      await apiRequest(`/admin/users/${editing.value.id}`, {
        method: 'PATCH',
        body: {
          phone: phone.value,
          nickname: nickname.value,
          version: editing.value.version
        }
      })
      ElMessage.success('账号已更新')
    } else {
      const result = await apiRequest<{ initialPassword: string }>('/admin/users', {
        method: 'POST',
        body: { phone: phone.value, ...(nickname.value ? { nickname: nickname.value } : {}) }
      })
      await ElMessageBox.alert(
        `初始密码：${result.initialPassword}。请交付给本人，首次登录必须修改。`,
        '账号已创建',
        { confirmButtonText: '已记录' }
      )
    }
    dialog.value = false
    await load()
  } catch (error) {
    report(error)
  } finally {
    busy.value = false
  }
}

/** 删除只软删除身份；已有教学数据仍保留在服务器。 */
async function remove(user: AccountProfileType): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除 ${user.nickname}（${user.phone}）？账号将立即下线，教学数据保留。`,
      '删除账号',
      { type: 'warning' }
    )
    await apiRequest(`/admin/users/${user.id}`, { method: 'DELETE' })
    await load()
  } catch (error) {
    report(error)
  }
}

async function toggle(user: AccountProfileType): Promise<void> {
  const status = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    await ElMessageBox.confirm(
      `${status === 'DISABLED' ? '禁用' : '启用'} ${user.nickname}（${user.phone}）？`,
      '账号状态',
      { type: 'warning' }
    )
    await apiRequest(`/admin/users/${user.id}/status`, { method: 'PATCH', body: { status } })
    await load()
  } catch (error) {
    report(error)
  }
}

async function resetPassword(user: AccountProfileType): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(
      `重置 ${user.nickname} 的密码，请输入你的管理员密码确认。`,
      '重置密码',
      { inputType: 'password' }
    )
    const result = await apiRequest<{ initialPassword: string }>(
      `/admin/users/${user.id}/reset-password`,
      { method: 'POST', body: { password: value } }
    )
    await ElMessageBox.alert(
      `新的初始密码：${result.initialPassword}。目标账号已下线，首次登录须改密。`,
      '重置成功'
    )
  } catch (error) {
    report(error)
  }
}
/** 管理员编辑账号时，也不能因切换用户而丢失尚未提交的表单。 */
async function canLeave(): Promise<boolean> {
  if (busy.value) {
    ElMessage.warning('请等待账号操作完成')
    return false
  }
  if (!dialog.value) return true
  const changed =
    phone.value !== (editing.value?.phone || '') ||
    nickname.value !== (editing.value?.nickname || '')
  if (changed) {
    try {
      await ElMessageBox.confirm('账号资料尚未保存，确认放弃修改？', '未保存的修改', {
        type: 'warning'
      })
    } catch {
      return false
    }
  }
  dialog.value = false
  return true
}
defineExpose({ canLeave })
onMounted(load)
</script>

<template>
  <ManagementCard
    class="account-management"
    title="系统账号"
    description="管理老师的账号资料与访问权限，管理员账号受保护。"
    v-loading="busy"
  >
    <div class="account-management__toolbar">
      <el-input v-model="search" clearable placeholder="手机号 / 昵称" @keyup.enter="searchUsers" />
      <el-button @click="searchUsers">搜索</el-button>
      <el-button type="primary" @click="open()">创建账号</el-button>
    </div>
    <el-table :data="users" row-key="id" empty-text="暂无匹配账号">
      <el-table-column prop="nickname" label="昵称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="phone" label="手机号" min-width="150" />
      <el-table-column label="角色"
        ><template #default="{ row }"
          ><el-tag :type="row.role === 'ADMIN' ? 'warning' : 'primary'" effect="light">{{
            row.role === 'ADMIN' ? '管理员' : '老师'
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="状态"
        ><template #default="{ row }"
          ><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" effect="light">{{
            row.status === 'ACTIVE' ? '正常' : '已禁用'
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="操作" width="330"
        ><template #default="{ row }">
          <template v-if="row.role !== 'ADMIN'">
            <el-button link type="primary" @click="open(row)">编辑</el-button>
            <el-button link @click="resetPassword(row)">重置密码</el-button>
            <el-button link @click="toggle(row)">{{
              row.status === 'ACTIVE' ? '禁用' : '启用'
            }}</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
          <span v-else>管理员账号受保护</span>
        </template></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :page-size="50"
      :total="total"
      layout="prev, pager, next, total"
      @current-change="load"
    />
    <el-dialog v-model="dialog" :title="editing ? '编辑账号' : '创建账号'" width="min(420px, 92vw)">
      <el-form label-position="top">
        <el-form-item label="手机号"><el-input v-model="phone" maxlength="11" /></el-form-item>
        <el-form-item label="昵称"
          ><el-input v-model="nickname" maxlength="30" placeholder="创建时留空将自动生成"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="busy" @click="save">保存</el-button></template
      >
    </el-dialog>
  </ManagementCard>
</template>

<style scoped lang="scss">
.account-management {
  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
  }
  &__toolbar .el-input {
    max-width: 280px;
  }
  .el-pagination {
    margin-top: 20px;
  }
}
</style>
