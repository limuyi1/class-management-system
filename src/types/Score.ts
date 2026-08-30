/**
 * 成绩页面展示阶段
 * - `noUnits`：尚未添加成绩单元列
 * - `noScores`：已有单元但未录入任何成绩
 * - `ready`：有单元且有成绩，可展示统计与分析
 */
export type ScorePageStageType = 'noUnits' | 'noScores' | 'ready'
