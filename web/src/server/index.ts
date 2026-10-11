import express from 'express'
import path from 'path'
import { statusRouter } from './routes/status'

const app = express()
const port = parseInt(process.env.PORT ?? '8080', 10)

// The Status panel of nakomis-shell (app.nakomis.com) reads the API cross-origin.
export const CORS_ORIGINS = ['https://app.nakomis.com', 'https://app.sandbox.nakomis.com']

app.use(express.json())
app.use('/api/status', (req, res, next) => {
  const origin = req.headers.origin
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  next()
})
app.use('/api/status', statusRouter)

const clientDist = path.join(__dirname, '../../dist')
app.use(express.static(clientDist))
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
