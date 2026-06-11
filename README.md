# arb-prediction-market

Arbitrage detection and execution tooling for prediction markets.

This project scans prediction-market venues for mispricings — both within a
single market (e.g. YES + NO priced below \$1.00) and across venues for the
same event — and surfaces actionable arbitrage opportunities.

## Status

Early scaffold. Core types and the opportunity scanner live in `src/`.

## Getting started

```bash
npm install
npm run build
npm test
npm run dev
```

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Run the entrypoint with `tsx`        |
| `npm run build` | Type-check and emit to `dist/`       |
| `npm test`      | Run the test suite with `vitest`     |
| `npm run lint`  | Type-check without emitting          |

## Project layout

```
src/
  index.ts        Entrypoint / demo
  types.ts        Core domain types (Market, Quote, Opportunity)
  arbitrage.ts    Opportunity-detection logic
  arbitrage.test.ts
```

## License

MIT — see [LICENSE](./LICENSE).
