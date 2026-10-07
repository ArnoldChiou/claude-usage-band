import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage, SessionCost, SessionRateLimit } from 'claude-code'

import type { Usage } from '../types'

const usage = atom({ plugin: 'usage-band', key: 'usage' } as const, null)

const LABELS: Record<string, { name: string; icon: string; color: string }> = {
  five_hour: { name: '5 小時額度', icon: '◷', color: '#5FD7FF' },
  seven_day: { name: '7 天額度', icon: '◫', color: '#AF87FF' },
  spend_limit: { name: '花費上限', icon: '◈', color: '#FFAF5F' },
}

const BAR = 20

// 剩餘量的漸層：綠 → 黃綠 → 黃 → 橘 → 紅（依格子位置上色）
const HEAT = ['#5FD787', '#87D75F', '#AFD75F', '#D7D75F', '#FFD75F', '#FFAF5F', '#FF875F', '#FF5F5F']
// Context 用藍紫漸層
const COOL = ['#5FAFFF', '#5F87FF', '#875FFF', '#AF5FFF', '#D75FFF']

const toUsage = (context: SessionContextUsage, rateLimits: SessionRateLimit[], cost?: SessionCost): Usage => ({
  tokens: context.tokens,
  window: context.window,
  percent: context.percent,
  limits: rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
  usd: cost?.usd,
})

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

// 重置時間：今天顯示 HH:MM，其他日子顯示 M/D HH:MM
const fmtReset = (iso: string, now: number) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return new Date(now).toDateString() === d.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

const pick = (palette: string[], ratio: number) =>
  palette[Math.min(palette.length - 1, Math.floor(ratio * palette.length))] ?? palette[0]!

const levelColor = (used: number) => (used >= 90 ? '#FF5F5F' : used >= 70 ? '#FFAF5F' : '#5FD787')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const u = await $.session.usage()
    await update($, usage, () => toUsage(u.context, u.rateLimits, u.cost))
    return r
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => toUsage(e.context, e.rateLimits, e.cost))
    if (e.changed.includes('rateLimits')) {
      for (const r of e.rateLimits) {
        if (r.percentUsed >= 90) $.ui.toast(`${LABELS[r.kind]?.name ?? r.kind}已用 ${r.percentUsed}%`)
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, usage)
    if (e.props.hasSurvey || u === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    // filled 格依位置套漸層，其餘為暗色底
    const bar = (id: string, ratio: number, palette: string[]) => {
      const filled = Math.round(Math.max(0, Math.min(1, ratio)) * BAR)
      return (
        <Box key={id}>
          {Array.from({ length: BAR }, (_, i) =>
            i < filled ? (
              <Text key={`${id}-${i}`} color={pick(palette, i / BAR)}>
                █
              </Text>
            ) : (
              <Text key={`${id}-${i}`} color="#3A3A3A">
                ░
              </Text>
            ),
          )}
        </Box>
      )
    }

    const label = (icon: string, name: string, color: string) => (
      <Box width={13}>
        <Text color={color} bold>
          {`${icon} ${name}`}
        </Text>
      </Box>
    )

    const ctxPct = u.percent ?? 0

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="#875FFF" paddingX={1}>
        <Box justifyContent="space-between">
          <Text color="#D75FFF" bold>
            ✦ Claude 用量
          </Text>
          {u.usd !== undefined ? (
            <Text>
              <Text color="#8A8A8A">本次花費 </Text>
              <Text color="#FFD75F" bold>{`$${u.usd.toFixed(2)}`}</Text>
            </Text>
          ) : null}
        </Box>

        <Box columnGap={1}>
          {label('◉', 'Context', '#5FAFFF')}
          {bar('ctx', ctxPct / 100, COOL)}
          <Box width={8}>
            <Text color={levelColor(ctxPct)} bold>{` ${ctxPct}%`}</Text>
          </Box>
          <Text color="#8A8A8A">
            {u.tokens === undefined ? `— / ${fmtTokens(u.window)}` : `${fmtTokens(u.tokens)} / ${fmtTokens(u.window)}`}
          </Text>
        </Box>

        {u.limits.length === 0 ? (
          <Text color="#8A8A8A" italic>
            ◌ 尚無訂閱額度資料（收到第一次回應後顯示）
          </Text>
        ) : null}

        {u.limits.map(l => {
          const meta = LABELS[l.kind] ?? { name: l.kind, icon: '◇', color: '#D7D7D7' }
          const left = Math.max(0, Math.round((100 - l.percentUsed) * 10) / 10)
          const reset = l.resetsAt ? fmtReset(l.resetsAt, now) : ''
          return (
            <Box key={l.kind} columnGap={1}>
              {label(meta.icon, meta.name, meta.color)}
              {bar(l.kind, l.percentUsed / 100, HEAT)}
              <Box width={8}>
                <Text color={levelColor(l.percentUsed)} bold>{`剩 ${left}%`}</Text>
              </Box>
              {reset ? <Text color="#8A8A8A">{`↻ ${reset}`}</Text> : null}
            </Box>
          )
        })}
      </Box>
    )
  })
}
