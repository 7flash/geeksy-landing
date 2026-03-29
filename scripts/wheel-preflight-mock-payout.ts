const repoRoot = import.meta.dir.replace(/[\\/]scripts$/, '')

const defaultMockCommand = process.platform === 'win32'
  ? 'set PAYOUT_MOCK_MODE=claimed && bun run scripts/payout-command.mock.ts'
  : 'PAYOUT_MOCK_MODE=claimed bun run scripts/payout-command.mock.ts'

const proc = Bun.spawn([
  'bun',
  'run',
  'scripts/wheel-preflight.ts',
], {
  cwd: repoRoot,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...Bun.env,
    TREASURY_PAYOUT_COMMAND: Bun.env.TREASURY_PAYOUT_COMMAND || defaultMockCommand,
  },
})

const exitCode = await proc.exited
process.exit(exitCode)
