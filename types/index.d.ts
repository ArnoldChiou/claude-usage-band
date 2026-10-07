export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Usage = {
  tokens?: number
  window: number
  percent?: number
  limits: Limit[]
  usd?: number
}
// 本次 session 累計的 token 用量（每個 turn 的 usage 加總，含子代理）
export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  turns: number
  // 累計起點（session 的 startedAt），/clear 後會變，用來歸零
  since: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { usage: Usage | null; tokens: Tokens }
  }
}
