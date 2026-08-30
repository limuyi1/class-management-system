<script setup lang="ts">
/** 随机排座模式弹窗 — 在“全部重排”与“补充空座位”之间选择 */
import SeatingDialogHeader from '@/views/seating-chart/components/SeatingDialogHeader.vue'

defineProps<{
  /** 弹窗显隐状态（v-model 双向绑定） */
  modelValue: boolean
  /** 已安排学生数 */
  assignedCount: number
  /** 待安排学生数 */
  unassignedCount: number
}>()

/** 事件：更新显隐 / 全部重新安排 / 补充空座位 */
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'randomize-all': []
  supplement: []
}>()
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="620px"
    class="random-mode-dialog"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header><seating-dialog-header icon="shuffle" title="随机安排" description="选择重新排座或只补充当前空座位" /></template>
    <!-- 已安排与待安排统计概览 -->
    <div class="random-dialog__hero">
      <span><strong>{{ assignedCount }}</strong> 已安排</span>
      <i></i>
      <span><strong>{{ unassignedCount }}</strong> 待安排</span>
    </div>

    <!-- 两种随机模式入口 -->
    <div class="random-mode-options">
      <button class="random-mode-card random-mode-card--all" type="button" @click="emit('randomize-all')">
        <span class="random-mode-card__icon"><font-awesome-icon :icon="['solid', 'dice']" /></span>
        <span class="random-mode-card__content">
          <strong>全部重新安排</strong>
          <small>清空当前座位并重新打乱全部学生</small>
        </span>
        <font-awesome-icon class="random-mode-card__arrow" :icon="['solid', 'arrow-right']" />
      </button>

      <button class="random-mode-card random-mode-card--supplement" type="button" @click="emit('supplement')">
        <span class="random-mode-card__icon"><font-awesome-icon :icon="['solid', 'user-plus']" /></span>
        <span class="random-mode-card__content">
          <strong>补充空座位</strong>
          <small>保留已安排学生，预览剩余学生的随机方案</small>
        </span>
        <font-awesome-icon class="random-mode-card__arrow" :icon="['solid', 'arrow-right']" />
      </button>
    </div>

    <!-- 补充模式的说明提示 -->
    <div class="random-dialog__note">
      <font-awesome-icon :icon="['regular', 'lightbulb']" />
      补充模式可反复换方案，确认前不会修改当前座位表。
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.random-dialog__hero { display:flex; align-items:center; justify-content:center; gap:18px; margin-bottom:12px; padding:9px 12px; color:#746880; background:#f8f6fb; border:1px solid #ebe5f0; border-radius:10px; font-size:11px; }.random-dialog__hero span { display:flex; align-items:baseline; gap:5px; }.random-dialog__hero strong { color:#5e379c; font-size:17px; }.random-dialog__hero i { width:1px; height:18px; background:#ddd4e5; }

.random-mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.random-mode-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 13px;
  text-align: left;
  background: #fff;
  border: 1px solid #e8e1f0;
  border-radius: 14px;
  cursor: pointer;
  transition: 0.2s ease;
}

.random-mode-card:hover {
  border-color: #a78bdb;
  box-shadow: 0 12px 28px rgba(61, 40, 109, 0.1);
  transform: translateY(-2px);
}

.random-mode-card__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: #6840ae;
  background: #f1eaff;
  border-radius: 12px;
  font-size: 15px;
}

.random-mode-card--supplement .random-mode-card__icon {
  color: #c45c1b;
  background: #fff0e5;
}

.random-mode-card__content {
  display: grid;
  gap: 5px;
}

.random-mode-card__content strong {
  color: #31283c;
  font-size: 13px;
}

.random-mode-card__content small {
  color: #8d8497;
  line-height: 1.5;
}

.random-mode-card__arrow {
  color: #ad9fba;
}

.random-dialog__note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 10px;
  color: #746880;
  background: #f8f6fb;
  border-radius: 10px;
  font-size: 12px;
}
</style>
