import { describe, expect, it } from 'vitest'

import {
  createPrintSceneNode,
  serializePrintNode
} from '../../src/utils/print-template/sceneDomUtil'
import { getNoticeTemplateFields } from '../../src/utils/print-template/noticeTemplateFieldsUtil'
import { ScoreNoticeModeEnum, ScoreNoticeCommentStatusEnum } from '../../src/types/ScoreNotice'
import { getDefaultGradeRule } from '../../src/utils/score-notice/scoreNoticeGradeUtil'

import type { PrintTemplateSceneType } from '../../src/types/PrintTemplateScene'

const empty: PrintTemplateSceneType = {
  version: 1,
  pixelWidth: 1448,
  pixelHeight: 1086,
  assets: {},
  root: { tag: 'article', attributes: {}, children: [] }
}

describe('素材文档保存与恢复边界', () => {
  it('变量文本不会变成可执行 HTML，事件属性不进入恢复节点', () => {
    const element = document.createElement('div')
    element.textContent = '<img src=x onerror=alert(1)>'
    element.setAttribute('onclick', 'alert(1)')
    const tree = serializePrintNode(element)
    const recovered = createPrintSceneNode(tree, empty) as HTMLElement
    expect(recovered.textContent).toBe(element.textContent)
    expect(recovered.querySelector('img')).toBeNull()
    expect(recovered.getAttribute('onclick')).toBeNull()
  })
  it('从备份恢复拒绝脚本节点和外链样式；去重图片恢复为独立快照', () => {
    expect(() =>
      createPrintSceneNode({ tag: 'script', attributes: {}, children: [] }, empty)
    ).toThrow('不支持')
    expect(() =>
      createPrintSceneNode(
        {
          tag: 'style',
          attributes: {},
          children: [
            {
              tag: '#text',
              text: '@import url(https://example.com/a.css)',
              attributes: {},
              children: []
            }
          ]
        },
        empty
      )
    ).toThrow('不安全')
    const node = createPrintSceneNode(
      { tag: 'img', attributes: { src: 'asset:paper', onerror: 'alert(1)' }, children: [] },
      { ...empty, assets: { paper: 'data:image/png;base64,AAAA' } }
    ) as HTMLImageElement
    expect(node.getAttribute('src')).toBe('data:image/png;base64,AAAA')
    expect(node.hasAttribute('onerror')).toBe(false)
  })
  it('成绩变量区分 0 分和缺失值，评语换行完整保留', () => {
    const subjects = ['语文', '数学'].map((label, index) => ({
      id: `s${index}`,
      label,
      sourceColumn: label,
      rule: getDefaultGradeRule(label)
    }))
    const fields = getNoticeTemplateFields(
      {
        id: 'student-1',
        name: '同名学生',
        rawValues: { s0: 0, s1: null },
        gradeValues: { s0: 'C', s1: null },
        comment: '第一行\n第二行',
        commentStatus: ScoreNoticeCommentStatusEnum.Manual
      },
      subjects,
      ScoreNoticeModeEnum.Score,
      '考试通知',
      '2026-10-04'
    )
    expect(fields.成绩1).toBe('0')
    expect(fields.成绩2).toBe('--')
    expect(fields.等级描述1).toBe('继续努力')
    expect(fields.评语).toBe('第一行\n第二行')
  })
})
