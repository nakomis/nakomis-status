import express from 'express'
import path from 'path'
import { statusRouter } from './routes/status'

const app = express()
const port = parseInt(process.env.PORT ?? '8080', 10)

app.use(express.json())
app.use('/api/status', statusRouter)

const clientDist = path.join(__dirname, '../../dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
