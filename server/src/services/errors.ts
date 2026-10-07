/** 预期业务错误由统一错误处理器转换，不向客户端泄漏 SQL 或堆栈。 */
export class BusinessError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
