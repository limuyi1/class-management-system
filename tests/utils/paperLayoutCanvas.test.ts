import { describe, expect, it } from 'vitest'

import {
  arrangePaperItems,
  buildPaperLayoutPages,
  clampPaperItemPosition,
  getNextPaperLayoutZIndex,
  normalizePaperItemPosition,
  placePaperItemsOnPage
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
  documentY: 0,
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
        { x: -100, documentY: -100 },
        { pageSize: { width: 120, height: 90 }, minVisibleMm: 8 }
      )
    ).toEqual({
      x: -32,
      documentY: -22
    })
  })

  it('should group pages and keep item order by zIndex', () => {
    const pages = buildPaperLayoutPages(
      [
        createItem('back', { pageIndex: 0, documentY: 0, height: 20, zIndex: 1 }),
        createItem('front', { pageIndex: 0, documentY: 0, height: 20, zIndex: 3 }),
        createItem('middle', { pageIndex: 0, documentY: 0, height: 20, zIndex: 2 }),
        createItem('second-page', { pageIndex: 1, documentY: 100, height: 20, zIndex: 1 })
      ],
      { width: 100, height: 100 }
    )

    expect(pages.map((page) => page.items.map((item) => item.id))).toEqual([
      ['back', 'middle', 'front'],
      ['second-page']
    ])
  })

  it('should render one image on every page it intersects', () => {
    const pages = buildPaperLayoutPages(
      [createItem('split', { documentY: 80, y: 80, width: 40, height: 40, zIndex: 1 })],
      { width: 100, height: 100 }
    )

    expect(pages).toHaveLength(2)
    expect(pages.map((page) => page.items.map((item) => [item.id, item.localY]))).toEqual([
      [['split', 80]],
      [['split', -20]]
    ])
  })

  it('should normalize continuous document position into page-local fields', () => {
    const position = normalizePaperItemPosition(
      createItem('moved', { width: 20, height: 20 }),
      235,
      { width: 100, height: 100 }
    )

    expect(position).toEqual({
      pageIndex: 2,
      y: 35,
      documentY: 235
    })
  })

  it('should place newly selected images on the active page without changing existing items', () => {
    const existingItem = createItem('existing', {
      pageIndex: 0,
      x: 3,
      y: 4,
      documentY: 4,
      width: 20,
      height: 20,
      zIndex: 2
    })
    const placedItems = placePaperItemsOnPage(
      [createItem('new-a'), createItem('new-b')],
      2,
      {
        pageSize: { width: 100, height: 100 },
        margin: 10,
        gap: 5,
        columns: 2,
        columnWidth: 40
      },
      getNextPaperLayoutZIndex([existingItem])
    )

    expect(existingItem).toMatchObject({
      pageIndex: 0,
      x: 3,
      y: 4,
      documentY: 4,
      zIndex: 2
    })
    expect(placedItems.map((item) => [item.pageIndex, item.x, item.y, item.documentY])).toEqual([
      [2, 10, 10, 210],
      [2, 55, 10, 210]
    ])
    expect(placedItems.map((item) => item.zIndex)).toEqual([3, 4])
  })

  it('should calculate the next top z-index from existing canvas items', () => {
    expect(
      getNextPaperLayoutZIndex([createItem('a', { zIndex: 5 }), createItem('b', { zIndex: 2 })])
    ).toBe(6)
  })
})
