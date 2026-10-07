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
