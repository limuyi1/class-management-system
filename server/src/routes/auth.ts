import { isAllowedOrigin } from '../auth/origin.js'
import { CAPTCHA_WIDTH, CAPTCHA_PIECE_SIZE } from '../auth/captchaImage.js'
import { randomBytes } from 'node:crypto'

import { createChallenge, verifyChallenge, consumeTicket } from '../auth/captcha.js'
import { rateLimit } from '../auth/limits.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { createSession, refreshTokens, tokenHash, REFRESH_SECONDS } from '../auth/tokens.js'
import { profile, validatePhone } from '../services/accounts.js'
import { BusinessError } from '../services/errors.js'
import { actorFor, objectSchema, textSchema } from './helpers.js'
import type { AccountRecordType, DatabaseType } from '../types/Account.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/** 登录、轮换和注销复用同一令牌服务；Web 不返回刷新令牌到正文。 */
export async function registerAuth(
  app: FastifyInstance,
  database: DatabaseType,
  origin: string
): Promise<void> {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/v1/auth',
    maxAge: REFRESH_SECONDS
  }
  const dummyHash = await hashPassword(randomBytes(24).toString('base64url'))
  const checkOrigin = (request: FastifyRequest) => {
    if (!isAllowedOrigin(request.headers.origin, origin))
      throw new BusinessError(403, 'INVALID_ORIGIN', '请求来源无效')
    if (request.headers['x-csrf-protection'] !== '1')
      throw new BusinessError(403, 'CSRF_REQUIRED', '请求校验失败')
    if (request.headers['x-managed-account-id'] || request.headers['x-managed-session'])
      throw new BusinessError(400, 'INVALID_CONTEXT', '此接口不支持账号代管')
  }
  const respond = (reply: FastifyReply, tokens: ReturnType<typeof createSession>) => {
    reply.setCookie('cms_refresh', tokens.refreshToken, cookieOptions)
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn }
  }

  app.post<{ Body: { phone: string } }>(
    '/auth/captcha/challenges',
    {
      schema: { body: objectSchema({ phone: textSchema }, ['phone']) }
    },
    async (request) => {
      rateLimit(database, `challenge:${request.ip}`, 20, 60000)
      return createChallenge(database, validatePhone(request.body.phone))
    }
  )
  app.post<{ Body: { challengeId: string; position: number } }>(
    '/auth/captcha/verify',
    {
      schema: {
        body: objectSchema(
          {
            challengeId: textSchema,
            position: { type: 'integer', minimum: 0, maximum: CAPTCHA_WIDTH - CAPTCHA_PIECE_SIZE }
          },
          ['challengeId', 'position']
        )
      }
    },
    async (request) => {
      rateLimit(database, `captcha:${request.ip}`, 20, 60000)
      return { ticket: verifyChallenge(database, request.body.challengeId, request.body.position) }
    }
  )
  app.post<{ Body: { phone: string; password: string; ticket: string } }>(
    '/auth/login',
    {
      schema: {
        body: objectSchema({ phone: textSchema, password: textSchema, ticket: textSchema }, [
          'phone',
          'password',
          'ticket'
        ])
      }
    },
    async (request, reply) => {
      checkOrigin(request)
      rateLimit(database, `login-ip:${request.ip}`, 10, 60000)
      const phone = validatePhone(request.body.phone)
      rateLimit(database, `login-account:${tokenHash(phone)}`, 5, 15 * 60000)
      consumeTicket(database, request.body.ticket, phone)
      const user = database.prepare('SELECT * FROM users WHERE phone=?').get(phone) as
        | AccountRecordType
        | undefined
      const valid = await verifyPassword(request.body.password, user?.passwordHash || dummyHash)
      if (!user || !valid || user.status !== 'ACTIVE')
        throw new BusinessError(401, 'LOGIN_FAILED', '手机号或密码错误')
      const tokens = createSession(database, user)
      return { ...respond(reply, tokens), user: profile(user) }
    }
  )
  app.post('/auth/refresh', async (request, reply) => {
    checkOrigin(request)
    rateLimit(database, `refresh:${request.ip}`, 60, 60000)
    const refresh = request.cookies.cms_refresh
    if (!refresh) throw new BusinessError(401, 'UNAUTHENTICATED', '请先登录')
    try {
      return respond(reply, refreshTokens(database, refresh))
    } catch (error) {
      reply.clearCookie('cms_refresh', { path: cookieOptions.path })
      throw error
    }
  })
  app.get('/auth/me', async (request) => profile(actorFor(database, request, true)))
  app.post('/auth/logout', async (request, reply) => {
    checkOrigin(request)
    const refresh = request.cookies.cms_refresh
    if (refresh)
      database
        .prepare(
          `UPDATE auth_sessions SET revoked=1 WHERE id IN
      (SELECT sessionId FROM auth_tokens WHERE hash=? AND kind='REFRESH')`
        )
        .run(tokenHash(refresh))
    reply.clearCookie('cms_refresh', { path: cookieOptions.path })
    return { success: true }
  })
}
