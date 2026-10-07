import { randomInt } from 'node:crypto'

export const CAPTCHA_WIDTH = 320
export const CAPTCHA_HEIGHT = 160
export const CAPTCHA_PIECE_SIZE = 48
export const CAPTCHA_PIECE_Y = 56

/** 缺口与移动拼图共用同一条路径，形状变化不会影响横向答案坐标。 */
export const CAPTCHA_PATHS = [
  'M24 2 A22 22 0 1 1 24 46 A22 22 0 1 1 24 2 Z',
  'M24 2 L46 46 L2 46 Z',
  'M24 2 L46 24 L24 46 L2 24 Z',
  'M12 3 L36 3 L47 24 L36 45 L12 45 L1 24 Z',
  'M24 1 L31 16 L47 18 L35 30 L38 47 L24 39 L10 47 L13 30 L1 18 L17 16 Z',
  'M10 3 H38 Q45 3 45 10 V38 Q45 45 38 45 H10 Q3 45 3 38 V10 Q3 3 10 3 Z'
]

/** 生成 2:1 图片和对应拼图路径；背景与阴影直接使用 SVG，无额外图片资源。 */
export function createCaptchaImage(answer: number) {
  const piecePath = CAPTCHA_PATHS[randomInt(CAPTCHA_PATHS.length)]!
  const hue = randomInt(165, 225)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CAPTCHA_WIDTH}" height="${CAPTCHA_HEIGHT}" viewBox="0 0 320 160"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="hsl(${hue} 55% 76%)"/><stop offset="1" stop-color="#e8f4e9"/></linearGradient></defs><rect width="320" height="160" fill="url(#sky)"/><circle cx="${randomInt(35, 285)}" cy="30" r="18" fill="#fff4c5"/><path d="M0 125 L65 45 L140 135 L205 65 L320 135 V160 H0Z" fill="#7aa7a0"/><path d="M0 145 Q80 95 170 145 T320 125 V160 H0Z" fill="#477a75"/><path d="${piecePath}" transform="translate(${answer} ${CAPTCHA_PIECE_Y})" fill="#17352f" fill-opacity=".7" stroke="#fff" stroke-opacity=".9" stroke-width="2"/></svg>`
  return {
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    width: CAPTCHA_WIDTH,
    height: CAPTCHA_HEIGHT,
    pieceSize: CAPTCHA_PIECE_SIZE,
    pieceY: CAPTCHA_PIECE_Y,
    piecePath
  }
}
