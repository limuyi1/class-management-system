# 成绩通知素材说明

正式素材已接入应用，统一保存在 [src/assets/score-notice](../../../src/assets/score-notice/)。本目录中与应用完全相同的 18 张图片副本已清理；下表文件名均指该应用素材目录。

报告固定画布为 `1448 × 1086` px。浏览器预览只做等比缩放，导出时使用原始尺寸，不单独拉伸任何装饰图片。

| 文件                                                                  | 页面建议尺寸 | 用途             | 复用方式                               |
| --------------------------------------------------------------------- | ------------ | ---------------- | -------------------------------------- |
| `report-paper-background.png`                                         | 1448 × 1086  | 纸张纹理底图     | `background-size: cover`               |
| `logo-transparent.png`                                                | 180 × 180    | 标题区校徽       | 等比缩放                               |
| `report-corner-ornament-2x.png`                                       | 180 × 180    | 报告内框角花     | 旋转复用四角                           |
| `paper-floral-watermark-2x.png`                                       | 240 × 240    | 纸张花卉暗纹     | 镜像复用，建议透明度 0.18              |
| `subject-card-corner-2x.png`                                          | 32 × 32      | 科目卡片切角     | 旋转复用四角                           |
| `grade-laurel-neutral-2x.png`                                         | 160 × 160    | 等级徽章公共月桂 | 所有科目公用                           |
| `grade-ribbon-{green,blue,orange,purple,gold,teal,rose,olive}-2x.png` | 160 × 60     | 等级徽章绶带     | 按科目色直接使用透明 PNG，兼容图片导出 |
| `ornament-laurel-2x.png`                                              | 80 × 32      | 标题分隔月桂     | 水平镜像复用                           |
| `ornament-star-2x.png`                                                | 32 × 32      | 公共金色星星     | 标题和徽章共用                         |
| `teacher-comment-badge-2x.png`                                        | 120 × 210    | 教师评语标签底板 | 文字由 HTML 覆盖                       |
| `comment-box-corner-2x.png`                                           | 48 × 48      | 评语框阶梯切角   | 旋转复用四角                           |

## 层级顺序

1. 纸张背景
2. 花卉暗纹
3. CSS 外框与四角花
4. Logo、标题和分隔装饰
5. 学生姓名与日期
6. 动态科目卡片
7. 教师评语框

标题、姓名、日期、科目、等级/分数、评价文字和教师评语全部保持为动态 HTML 内容。

## 制作参考

以下两张图片未接入应用，保留作制作参考：

- [素材总览](./assets-overview.png)
- [绶带蒙版](./grade-ribbon-mask-2x.png)
