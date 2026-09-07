import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useScoreDistributionActions } from '../../src/hooks/useScoreDistributionActions'
import type { ScoreStatisticsType } from '../../src/hooks/useScoreStatistics'

/**
 * useScoreDistributionActions 组合式函数测试
 * 测试目标：成绩分布复制与低分学生图片导出
 * 覆盖功能：剪贴板文本组装与排序、复制失败提示、空列表提示、
 * 含分数/仅姓名两种导出模板、下载文件名、遮罩生命周期与容器清理
 */

const domtoimageMocks = vi.hoisted(() => ({
  toPng: vi.fn()
}))
vi.mock('dom-to-image', () => ({
  default: { toPng: domtoimageMocks.toPng }
}))

const loadingMocks = vi.hoisted(() => ({
  startLoading: vi.fn(),
  stopLoading: vi.fn()
}))
vi.mock('@/hooks/useLoading', () => loadingMocks)

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn()
}))
vi.mock('element-plus', () => ({
  ElMessage: messageMocks
}))

/** 构造成绩统计 fixture */
const createScoreStats = (): ScoreStatisticsType => ({
  maxScore: 98,
  maxScoreCount: 1,
  topStudents: ['张三'],
  minScore: 45,
  minScoreCount: 1,
  bottomStudents: ['王五'],
  avgScore: '72.5',
  ranges: [{ label: '90-100分', min: 90, max: 100, color: '#67c23a', count: 1 }],
  lowScoreRanges: [{ label: '40-49分', min: 40, max: 49, color: '#f56c6c', count: 1 }],
  lowScoreTotal: 1,
  allLowScoreStudents: ['王五'],
  maxCount: 1,
  totalCount: 3
})

/** 构造低分学生 fixture，分数取自定义字段 */
const createStudent = (name: string, score: number) => ({
  studentId: `id_${name}`,
  name,
  xing4_ming2: name,
  score
})

describe('useScoreDistributionActions', () => {
  let writeText: ReturnType<typeof vi.fn>
  let linkClickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    domtoimageMocks.toPng.mockReset().mockResolvedValue('data:image/png;base64,xxx')
    loadingMocks.startLoading.mockClear()
    loadingMocks.stopLoading.mockClear()
    messageMocks.success.mockClear()
    messageMocks.warning.mockClear()
    messageMocks.error.mockClear()

    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })
    linkClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    // 让下载流程中“等待下一帧”立即完成
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    linkClickSpy.mockRestore()
  })

  const createHook = (overrides: Partial<Parameters<typeof useScoreDistributionActions>[0]> = {}) => {
    const students = ref([
      createStudent('王五', 45),
      createStudent('李四', 55),
      createStudent('赵六', 50)
    ])
    return useScoreDistributionActions({
      scoreStats: computed(() => createScoreStats()),
      belowThresholdStudents: computed(() => students.value),
      threshold: ref(60),
      getScore: (item) => (item as { score: number }).score,
      ...overrides
    })
  }

  it('copies assembled statistics text to the clipboard', async () => {
    const hook = createHook()

    hook.copyToClipboard()
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledTimes(1)
    const text = writeText.mock.calls[0][0]
    expect(text).toContain('成绩分布统计（共3人）')
    expect(text).toContain('最高分：98分（1人）张三')
    expect(text).toContain('平均分：72.5分')
    expect(text).toContain('90-100分：1人')
    expect(text).toContain('40-49分：1人')
    expect(messageMocks.success).toHaveBeenCalledWith('复制成功！')
  })

  it('shows an error message when clipboard write fails', async () => {
    writeText.mockRejectedValue(new Error('拒绝访问'))
    const hook = createHook()

    hook.copyToClipboard()
    await Promise.resolve()
    await Promise.resolve()

    expect(messageMocks.error).toHaveBeenCalledWith('复制失败')
  })

  it('does nothing when score stats are missing', () => {
    const hook = createHook({ scoreStats: computed(() => null) })

    hook.copyToClipboard()

    expect(writeText).not.toHaveBeenCalled()
  })

  it('warns and skips export when there are no students', async () => {
    const students = ref<Array<{ studentId: string; name: string; score: number }>>([])
    const hook = createHook({ belowThresholdStudents: computed(() => students.value) })

    await hook.downloadImage('withScore')

    expect(messageMocks.warning).toHaveBeenCalledWith('暂无学生数据')
    expect(domtoimageMocks.toPng).not.toHaveBeenCalled()
  })

  it('exports a sorted table with score column and downloads the image', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const createElementSpy = vi.spyOn(document, 'createElement')
    const hook = createHook()

    await hook.downloadImage('withScore')

    // 通过 spy 捕获导出期间创建并已清理的离屏容器
    const container = appendSpy.mock.results[0]?.value as HTMLElement
    expect(container).toBeTruthy()
    const cells = Array.from(container.querySelectorAll('td'))
    // 学生按分数从高到低排序：李四(55)、赵六(50)、王五(45)
    expect(cells).toHaveLength(6)
    expect(cells[0].textContent).toBe('李四')
    expect(cells[1].textContent).toBe('55分')
    expect(cells[2].textContent).toBe('赵六')
    expect(cells[4].textContent).toBe('王五')
    expect(container.querySelectorAll('th')).toHaveLength(2)

    expect(domtoimageMocks.toPng).toHaveBeenCalledTimes(1)
    const anchors = createElementSpy.mock.results
      .map((result) => result.value)
      .filter((element): element is HTMLAnchorElement => element?.tagName === 'A')
    expect(anchors[0]?.download).toBe('低分学生_60分.png')
    expect(linkClickSpy).toHaveBeenCalled()
    expect(loadingMocks.startLoading).toHaveBeenCalledWith('正在导出图片，请稍后...')
    expect(loadingMocks.stopLoading).toHaveBeenCalled()
    expect(messageMocks.success).toHaveBeenCalledWith('下载成功')
    // 导出后清理离屏容器
    expect(container.isConnected).toBe(false)

    appendSpy.mockRestore()
    createElementSpy.mockRestore()
  })

  it('exports only names in nameOnly mode', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const hook = createHook()

    await hook.downloadImage('nameOnly')

    const container = appendSpy.mock.results[0]?.value as HTMLElement
    expect(container.querySelectorAll('th')).toHaveLength(1)
    expect(container.querySelector('td')?.textContent).toBe('李四')
    expect(container.innerHTML).not.toContain('分')

    appendSpy.mockRestore()
  })

  it('stops the overlay and removes the container when rendering fails', async () => {
    domtoimageMocks.toPng.mockRejectedValue(new Error('渲染失败'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hook = createHook()

    await hook.downloadImage('withScore')

    expect(loadingMocks.stopLoading).toHaveBeenCalled()
    expect(messageMocks.error).toHaveBeenCalledWith('下载失败')
    expect(document.body.children).toHaveLength(0)
    consoleSpy.mockRestore()
  })
})
