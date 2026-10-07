import type { StudentDataType } from './StudentData'
import type {
  ScoreSettingsRecord,
  ScoreNoticeStorageRecord,
  SeatingChartStorageRecord,
  DutyRosterStorageRecord,
  OverviewAnalysisCacheRecord
} from './Database'
import type { ConfigurationType } from './Configuration'

/** 历史参照只记录来源，不复制成绩。 */
export interface WorkspaceReferenceType {
  periodId: string
  prop: string
}

/** 同一个带班工作区长期延续，各期保存当时的班名。 */
export interface ClassWorkspaceType {
  id: string
  lastPeriodId: string
}

export interface WorkspacePeriodType {
  id: string
  classId: string
  className: string
  termName: string
  createdAt: string
  references: WorkspaceReferenceType[]
}

export interface WorkspaceCatalogType {
  id: string
  activePeriodId: string
  revision: string
  classes: ClassWorkspaceType[]
  periods: WorkspacePeriodType[]
  migrationReviewed: boolean
  updatedAt: string
}

/** 业务配置跟随学期；字体、主题、AI 和版式仍共用。 */
export type WorkspacePreferencesType = Pick<
  ConfigurationType,
  'inputScoreTab' | 'recentScoreEntries' | 'scoreFullMark'
>

export interface WorkspaceSnapshotType {
  id: string
  students: StudentDataType[]
  setting?: ScoreSettingsRecord
  preferences: WorkspacePreferencesType
  scoreNotice?: ScoreNoticeStorageRecord
  seatingCharts?: SeatingChartStorageRecord
  dutyRosters?: DutyRosterStorageRecord
  overviewAnalysis?: OverviewAnalysisCacheRecord
  updatedAt: string
}

export interface CreateWorkspaceOptionsType {
  className: string
  termName: string
  newClass: boolean
  inheritStudents: boolean
  inheritColumns: boolean
  useReference: boolean
}
