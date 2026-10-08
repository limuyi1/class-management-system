import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { requestAIJson } from '../dist/services/ai/transport.js'

/** 模拟传输层验证协议、地址、端口及请求体，不监听端口或连接模型服务。 */
test('HTTP 模型目录和 HTTPS 模型调用均按配置地址及端口请求', async () => {
  const calls = []
  const respond = (protocol) => (url, options, callback) => {
    calls.push({ protocol, url, options })
    const req = new EventEmitter()
    req.end = (body) => {
      calls.at(-1).body = body
      const response = Readable.from([Buffer.from(JSON.stringify({ ok: true }))])
      response.statusCode = 200
      callback(response)
    }
    req.destroy = (error) => req.emit('error', error)
    return req
  }
  mock.method(http, 'request', respond('http'))
  mock.method(https, 'request', respond('https'))
  syncBuiltinESMExports()
  try {
    assert.deepEqual(
      await requestAIJson(new URL('http://127.0.0.1:11434/v1/models'), {}, undefined),
      { ok: true }
    )
    assert.equal(calls[0].protocol, 'http')
    assert.equal(calls[0].url.port, '11434')
    assert.equal(calls[0].options.method, 'GET')
    assert.equal(calls[0].body, undefined)
    await requestAIJson(
      new URL('https://model.local:8443/v1/chat/completions'),
      {},
      { model: 'local-model' }
    )
    assert.equal(calls[1].protocol, 'https')
    assert.equal(calls[1].url.port, '8443')
    assert.equal(calls[1].options.method, 'POST')
    assert.deepEqual(JSON.parse(calls[1].body), { model: 'local-model' })
  } finally {
    mock.restoreAll()
    syncBuiltinESMExports()
  }
})
