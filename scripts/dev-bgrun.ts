import { createServer } from 'net'
import { dirname, resolve } from 'path'

const repoRoot = resolve(dirname(import.meta.dir))
const basePort = parseInt(process.env.LOCAL_BUN_PORT || process.env.BUN_PORT || '3412', 10)
const maxPort = basePort + 25
const processName = process.env.BGRUN_NAME || 'geeksy-landing-local'
const command = process.env.BGRUN_COMMAND || 'bun run server.ts'
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run') || args.has('--print')

async function isPortFree(port: number) {
  return await new Promise<boolean>((resolvePromise) => {
    const server = createServer()

    server.once('error', () => resolvePromise(false))
    server.once('listening', () => {
      server.close(() => resolvePromise(true))
    })

    server.listen(port, '127.0.0.1')
  })
}

async function findFreePort(start: number, end: number) {
  for (let port = start; port <= end; port++) {
    if (await isPortFree(port)) return port
  }
  throw new Error(`No free port found between ${start} and ${end}`)
}

const port = await findFreePort(basePort, maxPort)
const bgrunArgs = [
  'bgrun',
  '--name', processName,
  '--directory', repoRoot,
  '--command', command,
  '--force',
]

console.log(`[dev-bgrun] repo=${repoRoot}`)
console.log(`[dev-bgrun] process=${processName}`)
console.log(`[dev-bgrun] port=${port}`)
console.log(`[dev-bgrun] command=${command}`)

if (dryRun) {
  console.log(`[dev-bgrun] dry-run: ${bgrunArgs.join(' ')}`)
  process.exit(0)
}

const proc = Bun.spawn(bgrunArgs, {
  cwd: repoRoot,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...Bun.env,
    BUN_PORT: String(port),
  },
})

const exitCode = await proc.exited
process.exit(exitCode)
