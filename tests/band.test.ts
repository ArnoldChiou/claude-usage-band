import { expect, mock, test } from 'claude-code/testing'

test('橫條顯示 context token 與訂閱額度剩餘，額度過 90% 跳提示', async ($, on) => {
  const toasts: string[] = []
  mock.clock(on, { now: Date.parse('2026-10-07T08:00:00Z') })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.render', () => null as never)

  await $.session.measure({
    context: { tokens: 45000, window: 200000, percent: 23 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 35 },
      { kind: 'seven_day', percentUsed: 92.5 },
    ],
    cost: { usd: 1.234 },
    changed: ['context', 'rateLimits', 'cost'],
  })
  expect(toasts).toEqual(['7 天額度已用 92.5%'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'usage-band',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never,
    })
    expect(await ui.find({ type: 'Text', text: /45k \/ 200k/ })).not.toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /剩 65%/ })).not.toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /剩 7.5%/ })).not.toBeUndefined()
    await ui.unmount()
  }
})

test('每個 turn 的 token 用量累加後顯示在橫條上', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  mock.clock(on, { now: Date.parse('2026-10-07T08:00:00Z') })
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000 }, rateLimits: [] } }))
  on('turn.complete', (_, e) => ({ text: e.answer, usage: e.usage }))
  on('ui.render', () => null as never)

  await $.session.measure({
    context: { tokens: 45000, window: 200000, percent: 23 },
    rateLimits: [],
    changed: ['context'],
  })
  const usage = { model: 'claude-opus-5-5', input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 40000, cache_creation_input_tokens: 3000 }
  await $.turn.complete({ answer: 'a', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', usage })
  await $.turn.complete({ answer: 'b', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer', usage, agentId: 'sub' })
  await $.turn.complete({ answer: 'c', durationMs: 1, isAborted: true, turnId: 't3', reason: 'aborted' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'usage-band',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10 } as never,
    })
    // 輸入 = (1200 + 40000 + 3000) × 2 = 88.4k → 88k；輸出 1600 → 2k
    expect(await ui.find({ type: 'Text', text: /^88k$/ })).not.toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /快取讀 80k・寫 6k/ })).not.toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^2k$/ })).not.toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /2 回合/ })).not.toBeUndefined()
    await ui.unmount()
  }
})
