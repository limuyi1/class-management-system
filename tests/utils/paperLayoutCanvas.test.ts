import { describe, expect, it } from 'vitest'

import {
  arrangePaperItems,
  buildPaperLayoutPages,
  clampPaperItemPosition
} from '../../src/views/tools/utils/paperLayoutCanvas'
import type { PaperLayoutCanvasItemType } from '../../src/types/Tools'

const createItem = (
  id: string,
  overrides: Partial<PaperLayoutCanvasItemType> = {}
): PaperLayoutCanvasItemType => ({
  id,
  attachmentId: id,
  name: id,
  blob: new Blob(['image']),
  dataUrl: `blob:${id}`,
  mimeType: 'image/png',
  naturalWidth: 100,
  naturalHeight: 100,
  pageIndex: 0,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  zIndex: 0,
  ...overrides
})

describe('paperLayoutCanvas', () => {
  it('should arrange images by columns and paginate when the next row exceeds page height', () => {
    const arrangedItems = arrangePaperItems([createItem('a'), createItem('b'), createItem('c')], {
      pageSize: { width: 100, height: 100 },
      margin: 10,
      gap: 5,
      columns: 2,
      columnWidth: 40,
      contentHeight: 80
    })

    expect(arrangedItems.map((item) => [item.pageIndex, item.x, item.y, item.zIndex])).toEqual([
      [0, 10, 10, 1],
      [0, 55, 10, 2],
      [1, 10, 10, 3]
    ])
  })

  it('should keep a dragged item partly visible inside the page bounds', () => {
    const item = createItem('a', {
      width: 40,
      height: 30
    })

    expect(
      clampPaperItemPosition(
        item,
        { x: -100, y: 100 },
        { pageSize: { width: 120, height: 90 }, minVisibleMm: 8 }
      )
    ).toEqual({
      x: -32,
      y: 82
    })
  })

  it('should group pages and keep item order by zIndex', () => {
    const pages = buildPaperLayoutPages([
      createItem('back', { pageIndex: 0, zIndex: 1 }),
      createItem('front', { pageIndex: 0, zIndex: 3 }),
      createItem('middle', { pageIndex: 0, zIndex: 2 }),
      createItem('second-page', { pageIndex: 1, zIndex: 1 })
    ])

    expect(pages.map((page) => page.items.map((item) => item.id))).toEqual([
      ['back', 'middle', 'front'],
      ['second-page']
    ])
  })
})
