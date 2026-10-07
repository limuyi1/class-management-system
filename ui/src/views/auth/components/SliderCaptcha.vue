<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { apiRequest } from '@/api/client'
import { useCaptchaDrag } from './useCaptchaDrag'
import type { CaptchaChallengeType } from '../../../../../packages/shared/src/Captcha'

const props = defineProps<{ phone: string; autoLoad?: boolean }>()
const emit = defineEmits<{ verified: [ticket: string] }>()
const image = ref('')
const challengeId = ref('')
const geometry = ref({ width: 320, height: 160, pieceSize: 48, pieceY: 56, piecePath: '' })
const message = ref('正在获取验证拼图…')
const busy = ref(false)
const verified = ref(false)
let generation = 0
const { position, track, dragging, maximum, start, move, finish, cancel, keydown, keyup } =
  useCaptchaDrag(
    computed(() => geometry.value.width),
    computed(() => geometry.value.pieceSize),
    computed(() => busy.value || verified.value || !challengeId.value),
    () => void verify()
  )
const offset = computed(() => `${(position.value / geometry.value.width) * 100}%`)
const pieceWidth = computed(() => `${(geometry.value.pieceSize / geometry.value.width) * 100}%`)

/** 手机号变化使旧挑战失效，晚到响应不能覆盖新手机号的验证状态。 */
function reset(): void {
  generation++
  image.value = ''
  challengeId.value = ''
  verified.value = false
  cancel()
  busy.value = false
  emit('verified', '')
}
watch(() => props.phone, reset)

/** 后端生成挑战，不在前端计算或保存正确答案。 */
async function load(): Promise<void> {
  reset()
  const current = generation
  busy.value = true
  try {
    const result = await apiRequest<CaptchaChallengeType>('/auth/captcha/challenges', {
      method: 'POST',
      body: { phone: props.phone }
    })
    if (current !== generation) return
    geometry.value = {
      width: result.width,
      height: result.height,
      pieceSize: result.pieceSize,
      pieceY: result.pieceY,
      piecePath: result.piecePath
    }
    image.value = result.image
    challengeId.value = result.challengeId
    position.value = 0
    message.value = '拖动滑块，使拼图与缺口重合后松开'
  } catch (error) {
    if (current === generation)
      message.value = error instanceof Error ? error.message : '获取验证失败'
  } finally {
    if (current === generation) busy.value = false
  }
}

/** 验证票据只有一次使用机会；失败通过刷新申请新挑战。 */
async function verify(): Promise<void> {
  if (busy.value || verified.value || !challengeId.value) return
  const current = generation
  busy.value = true
  try {
    const result = await apiRequest<{ ticket: string }>('/auth/captcha/verify', {
      method: 'POST',
      body: { challengeId: challengeId.value, position: position.value }
    })
    if (current !== generation) return
    verified.value = true
    emit('verified', result.ticket)
    message.value = '验证通过'
  } catch (error) {
    if (current === generation) {
      challengeId.value = ''
      emit('verified', '')
      message.value = error instanceof Error ? error.message : '验证失败'
    }
  } finally {
    if (current === generation) busy.value = false
  }
}
onMounted(() => {
  if (props.autoLoad) void load()
})
onBeforeUnmount(() => {
  generation++
  cancel()
})
defineExpose({ reset })
</script>

<template>
  <div class="slider-captcha">
    <div
      v-if="image"
      class="slider-captcha__picture"
      :style="{ aspectRatio: `${geometry.width} / ${geometry.height}` }"
    >
      <img :src="image" alt="滑块拼图：请将拼图移动至缺口位置" draggable="false" />
      <svg
        class="slider-captcha__piece"
        :viewBox="`0 0 ${geometry.pieceSize} ${geometry.pieceSize}`"
        :style="{
          left: offset,
          width: pieceWidth,
          top: `${(geometry.pieceY / geometry.height) * 100}%`
        }"
        aria-hidden="true"
      >
        <path :d="geometry.piecePath" />
      </svg>
    </div>
    <div
      v-if="image"
      ref="track"
      class="slider-captcha__track"
      :class="{ 'is-dragging': dragging }"
    >
      <span aria-hidden="true">{{ verified ? '验证通过' : '按住滑块，拖动完成拼图' }}</span>
      <button
        type="button"
        class="slider-captcha__handle"
        role="slider"
        aria-label="拼图位置，方向键移动，回车验证"
        :aria-valuemin="0"
        :aria-valuemax="maximum"
        :aria-valuenow="position"
        :disabled="busy || verified || !challengeId"
        :style="{ left: offset, width: pieceWidth }"
        @pointerdown.prevent="start"
        @pointermove.prevent="move"
        @pointerup.prevent="finish"
        @pointercancel="cancel"
        @lostpointercapture="dragging && cancel()"
        @keydown="keydown"
        @keyup="keyup"
      >
        ↔
      </button>
    </div>
    <div class="slider-captcha__footer">
      <span role="status">{{ message }}</span>
      <el-button text :loading="busy" :disabled="!/^1[3-9]\d{9}$/.test(phone)" @click="load">{{
        image ? '刷新' : '获取拼图'
      }}</el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.slider-captcha {
  width: 320px;
  max-width: 100%;
  margin: 0 auto;
  &__picture {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    user-select: none;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
  }
  &__piece {
    position: absolute;
    aspect-ratio: 1;
    overflow: visible;
    pointer-events: none;
    filter: drop-shadow(0 1px 3px #17352f66);
    path {
      fill: var(--el-color-primary);
      stroke: white;
      stroke-width: 2px;
    }
  }
  &__track {
    position: relative;
    height: 44px;
    margin-top: 16px;
    border-radius: 8px;
    background: var(--el-fill-color-light);
    box-shadow: inset 0 0 0 1px var(--el-border-color);
    display: grid;
    place-items: center;
    font-size: 12px;
    color: var(--text-secondary);
    user-select: none;
  }
  &__handle {
    position: absolute;
    top: 0;
    height: 44px;
    padding: 0;
    border: 1px solid var(--el-color-primary);
    border-radius: 8px;
    color: white;
    background: var(--el-color-primary);
    font-size: 24px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    &:disabled {
      cursor: default;
      opacity: 0.65;
    }
    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 3px;
    }
  }
  .is-dragging &__handle {
    cursor: grabbing;
  }
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
}
</style>
