import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PagesEnum } from '@/types/Common'

import { getPageSize, pageSizeInPixels } from '@/utils/pageSizeInPixelUtil'

describe('getPageSize', () => {
  it('纵向返回原始尺寸', () => {
    expect(getPageSize(PagesEnum.A4, 'portrait')).toEqual({ width: 595.28, height: 841.89 })
    expect(getPageSize(PagesEnum.A3, 'portrait')).toEqual({ width: 841.89, height: 1190.55 })
  })

  it('横向交换宽高', () => {
    expect(getPageSize(PagesEnum.A4, 'landscape')).toEqual({ width: 841.89, height: 595.28 })
    expect(getPageSize(PagesEnum.B4, 'landscape')).toEqual({ width: 1000.63, height: 708.66 })
  })
})

describe('pageSizeInPixels', () => {
  beforeEach(() => {
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options)

      if (tagName.toLowerCase() === 'div') {
        Object.defineProperty(element, 'offsetWidth', { value: 96, configurable: true })
      }

      return element
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('按 96 DPI 将 A4 毫米换算为像素', () => {
    expect(pageSizeInPixels(PagesEnum.A4)).toEqual({ width: 794, height: 1123 })
  })
})
