import type { ScoreNoticeStudentType, ScoreNoticeSubjectType } from '@/types/ScoreNotice'

/** 保留自然分段，但压缩连续空行，避免成绩通知版面被多余空白撑高。 */
export const normalizeScoreNoticeComment = (comment: string): string =>
  comment.replace(/\r\n/g, '\n').replace(/\n[\t ]*\n+/g, '\n').trim()

/**
 * 返回不能直接发送给家长的评语原因。
 *
 * 成绩通知只展示等级，因此禁止出现具体分数、百分比和排名；同时限制长度，避免版面溢出。
 */
export const getScoreNoticeCommentValidationReasons = (comment: string): string[] => {
  const reasons: string[] = []
  const content = comment.trim()
  const length = content.replace(/\s/g, '').length
  if (!content) reasons.push('评语内容为空')
  if (content && length < 180) reasons.push('评语少于180字')
  if (length > 320) reasons.push('评语超过320字')
  if (/\d|百分之/.test(content)) reasons.push('包含具体数字或百分比')
  if (/第[一二三四五六七八九十]+名|名次|排名/.test(content)) reasons.push('包含名次或排名信息')
  if (/平均分|分数|考了多少分/.test(content)) reasons.push('包含具体分数相关表述')
  return [...new Set(reasons)]
}

export const buildGradeSummary = (
  student: ScoreNoticeStudentType,
  subjects: ScoreNoticeSubjectType[]
): string => {
  return subjects
    .map((subject) => `${subject.label}：${student.gradeValues[subject.id] || '缺少数据'}`)
    .join('；')
}

export const buildTemplateScoreNoticeComment = (
  student: ScoreNoticeStudentType,
  subjects: ScoreNoticeSubjectType[]
): string => {
  const subjectNamesByGrade = (grade: string): string[] =>
    subjects
      .filter((subject) => student.gradeValues[subject.id] === grade)
      .map((subject) => subject.label)
  const excellentSubjects = subjectNamesByGrade('A')
  const stableSubjects = subjectNamesByGrade('B')
  const concernSubjects = subjectNamesByGrade('C')
  const grades = [...excellentSubjects, ...stableSubjects, ...concernSubjects]
  const formatSubjects = (items: string[]): string => items.join('、')

  if (!grades.length) {
    return `${student.name}，目前本次考试的学科信息还不够完整，暂时无法对各科表现作出全面判断。面对尚未明确的学习情况，最重要的是保持日常学习节奏，认真完成每一次课堂练习和课后整理，及时记录不理解的内容，并主动寻求老师的帮助。

希望你在后续学习中继续重视基础知识的积累，把预习、听讲、复习和订正落实到每天的学习过程里。待考试信息补充完整后，再结合各科实际表现查找优势与不足，制定更有针对性的改进计划，相信踏实做好每一个环节，就能让学习状态变得更加稳定。`
  }
  if (concernSubjects.length) {
    const strengths = [...excellentSubjects, ...stableSubjects]
    const strengthText = strengths.length
      ? `${formatSubjects(strengths)}展现出较为扎实或稳定的学习状态`
      : '部分学习内容已经具备一定基础'
    return `${student.name}，从本次考试的整体情况来看，${strengthText}，说明你能够理解并运用不少已经学过的知识。${formatSubjects(concernSubjects)}还有进一步提升的空间，这些学科中的薄弱之处需要在接下来的学习中得到更多关注。

建议你先认真整理本次考试中出现的问题，区分知识掌握不牢、审题不够细致和答题习惯不稳定等不同原因，再通过回顾课本、订正错题和针对性练习逐项巩固。保持优势学科的学习节奏，同时把更多时间安排给需要加强的内容，遇到疑问及时请教。老师相信，只要把每次发现的问题真正解决，你的各科表现会逐渐更加均衡、扎实。`
  }
  if (excellentSubjects.length >= Math.ceil(grades.length / 2)) {
    return `${student.name}，本次考试中，${formatSubjects(excellentSubjects)}表现突出，能够看出你对相关知识掌握得比较扎实，也具备较好的理解和运用能力。${stableSubjects.length ? `${formatSubjects(stableSubjects)}发挥较为稳定，整体学习状态比较均衡。` : '各科整体发挥较为稳定，展现出了良好的学习基础。'}

取得较好表现之后，也要继续关注答题过程中的细节，认真检查容易忽略的条件和步骤，及时整理仍有疑问的知识点。建议你保持现在的学习节奏，在巩固优势学科的同时主动挑战更有难度的内容，并通过归纳错题和总结方法提升学习效率。期待你把这份认真和稳定延续到今后的每一次学习任务中。`
  }
  return `${student.name}，本次考试中，${formatSubjects(stableSubjects)}整体发挥较为稳定，说明你对各科基础知识已经有了一定掌握，也能够完成相应的学习任务。当前各科表现比较均衡，但在知识理解的深度、答题的细致程度和学习方法的运用上，仍然可以继续向前迈进一步。

建议你结合本次考试认真回顾每一道出现问题的题目，不仅订正答案，还要弄清错误产生的原因，并把容易混淆的知识及时归纳整理。平时学习中要保持专注，遇到不确定的内容主动提问，通过持续复习和适量练习让知识掌握得更加牢固。老师期待你在稳定的基础上逐步形成自己的学习方法，取得更加扎实的进步。`
}
