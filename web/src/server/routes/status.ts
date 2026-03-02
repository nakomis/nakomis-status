import { Router } from 'express'
import { checkHeartbeat } from '../../services/heartbeat'
import { checkRdsStatus } from '../../services/rdsStatus'

const router = Router()

const HTTP_SERVICES = [
  { name: 'nakom.is', url: 'https://nakom.is' },
  { name: 'sandbox.nakomis.com', url: 'https://sandbox.nakomis.com' },
  { name: 'blog.nakom.is', url: 'https://blog.nakom.is' },
  { name: 'admin.nakom.is', url: 'https://admin.nakom.is' },
]

router.get('/', async (_req, res) => {
  const [httpResults, rdsResult] = await Promise.all([
    Promise.all(HTTP_SERVICES.map(({ name, url }) => checkHeartbeat(name, url))),
    checkRdsStatus('analytics DB'),
  ])
  res.json([...httpResults, rdsResult])
})

export { router as statusRouter }
