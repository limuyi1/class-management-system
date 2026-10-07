/** 拼图尺寸使用服务端原图坐标，客户端按容器宽度等比例显示。 */
export interface CaptchaChallengeType {
  challengeId: string
  image: string
  width: number
  height: number
  pieceSize: number
  pieceY: number
  piecePath: string
  expiresIn: number
}
