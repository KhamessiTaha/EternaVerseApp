// src/devLog.js
//
// Dev-only logging. `import.meta.env.DEV` is `true` under `vite dev` and `false`
// in a production `vite build`, so in the shipped bundle `dlog` is a no-op and
// the console stays clean for players. Use dlog for progress/telemetry chatter;
// keep console.error / console.warn (they should always surface real problems).
export const dlog = import.meta.env.DEV
  ? (...args) => console.log(...args)
  : () => {};
