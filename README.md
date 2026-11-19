# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/RaihanPratama-comp/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/RaihanPratama-comp/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A program plus a static dashboard that ranks pre-token protocols by implied
value, derived only from the snapshot's own numbers: TVL, 7-day change,
listing age, and the median market-cap/TVL ratio of token-recorded peers in
the same category inside the same snapshot. Protocols are described as
"not recorded as having a token" when the snapshot carries no symbol,
listing or market cap for them. The program reads the snapshot from
`$MAKEFUN_INPUT_DIR`, `/input`, or the local kit input fallback; writes
`board.json`, the dashboard and its data, and `dossier.json` to the output
directory. No network, deterministic.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
