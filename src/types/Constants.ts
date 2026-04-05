import { pinyin } from 'pinyin-pro'

export const NAME_LABEL = '姓名'
export const NAME_PROP: 'xing4_ming2' = pinyin(NAME_LABEL, { toneType: 'num', type: 'array' }).join(
  '_'
) as 'xing4_ming2'
