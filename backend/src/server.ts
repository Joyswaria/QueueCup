import { buildApp } from './app.ts'
import { openDatabase } from './db.ts'

const pool = openDatabase()
const app = buildApp(pool, true)

pool.on('error', error => app.log.error({ err: error }, 'Idle database connection failed'))

async function stop() {
  try {
    await app.close()
  } finally {
    await pool.end()
  }
}

function onSignal() {
  void stop().catch(error => {
    app.log.error(error)
    process.exitCode = 1
  })
}

process.once('SIGINT', onSignal)
process.once('SIGTERM', onSignal)

try {
  await app.listen({
    host: process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.PORT ?? 3000),
  })
} catch (error) {
  app.log.error(error)
  await stop()
  process.exitCode = 1
}
