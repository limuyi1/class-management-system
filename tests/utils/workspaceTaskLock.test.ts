import { describe, expect, it } from 'vitest'

import {
  assertWorkspaceTasksFinished,
  blockWorkspaceChanges
} from '../../src/utils/workspaceSessionUtil'

describe('工作区导出任务锁', () => {
  it('导出期间阻止工作区切换，多任务分别结束后恢复切换', () => {
    const releaseReports = blockWorkspaceChanges('报告正在生成')
    const releaseCards = blockWorkspaceChanges('卡片正在导出')
    try {
      expect(() => assertWorkspaceTasksFinished()).toThrow('报告正在生成')
      releaseReports()
      expect(() => assertWorkspaceTasksFinished()).toThrow('卡片正在导出')
    } finally {
      releaseReports()
      releaseCards()
    }
    expect(() => assertWorkspaceTasksFinished()).not.toThrow()
  })
})
