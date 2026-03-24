import { start } from 'melina'
import path from 'path'

await start({
  port: parseInt(process.env.BUN_PORT || '3400'),
  appDir: path.join(import.meta.dir, 'app'),
  defaultTitle: 'Geeksy — Your AI that actually does things',
})
