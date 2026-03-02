import { Router } from 'express'
import { checkHeartbeat } from '../../services/heartbeat'

const router = Router()

const SERVICES = [
  { name: 'nakom.is', url: 'https://nakom.is' },
]

router.get('/', async (_req, res) => {
  const results = await Promise.all(
    SERVICES.map(({ name, url }) => checkHeartbeat(name, url))
  )
  res.json(results)
})

export { router as statusRouter }
