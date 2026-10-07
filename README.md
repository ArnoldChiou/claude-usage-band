# usage-band

Claude Code 的 mod：在提示框上方顯示一個用量面板。

```
╭──────────────────────────────────────────────────────────╮
│ ✦ Claude 用量                            本次花費 $1.23  │
│ ◉ Context     ████▓░░░░░░░░░░░░░░░  23%    45k / 200k    │
│ ◷ 5 小時額度  ███████░░░░░░░░░░░░░  剩 65%  ↻ 13:00      │
│ ◫ 7 天額度    ██████████████████░░  剩 7.5% ↻ 10/9 08:00 │
╰──────────────────────────────────────────────────────────╯
```

- Context：目前對話的 token 用量與模型上限
- 訂閱額度：5 小時／7 天額度剩餘百分比與重置時間（需以訂閱帳號登入）
- 本次 session 估計花費
- 額度用量達 90% 時跳出提示

## 安裝

在 Claude Code 的提示框輸入：

```
/plugin install usage-band --marketplace ArnoldChiou/claude-usage-band
```

出現 `Add marketplace?` 時按 `y`，再選安裝範圍（user 範圍會在之後每個 session 都啟用）。

## 開發

```
claude plugin validate .
claude plugin test .
```
