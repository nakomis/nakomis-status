# nakomis-status Initial Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and deploy a public status page at `status.nakom.is`, hosted on GCP Cloud Run, that proxies real-time health checks to monitored nakomis services server-side and serves a React SPA to display the results.

**Architecture:** A Node.js/Express server running on Cloud Run serves both the compiled React SPA (static files) and a `/api/status` endpoint that makes server-side HTTP requests to monitored services. No CORS issues — browser talks to Cloud Run, Cloud Run talks to the monitored services. No load balancer needed — Cloud Run handles HTTPS and custom domains natively. Future authenticated AWS API calls go in the server, not the client.

**Tech Stack:** TypeScript, React 18, Vite (client), Express (server), Vitest, React Testing Library, Terraform (GCP provider), GCP Cloud Run, GCP Artifact Registry, GCP Cloud DNS, GitHub Actions

---

## Project structure

```
nakomis-status/
├── src/
│   ├── server/
│   │   ├── index.ts          # Express entry point
│   │   └── routes/
│   │       └── status.ts     # /api/status route
│   ├── services/
│   │   └── heartbeat.ts      # Shared: HTTP health check logic
│   ├── components/
│   │   └── ServiceStatus.tsx # React component
│   ├── App.tsx
│   ├── main.tsx
│   └── test-setup.ts
├── terraform/
│   ├── backend.tf
│   ├── providers.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── artifact_registry.tf
│   ├── cloud_run.tf
│   └── dns.tf
├── Dockerfile
├── .github/workflows/deploy.yml
├── vite.config.ts
├── tsconfig.json             # Client (Vite)
├── tsconfig.server.json      # Server (tsc)
└── package.json
```

---

## Prerequisites (manual — do these before running any Terraform)

### Pre-1: Create a GCP project

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. `nakomis-status`)
3. Note the **Project ID** (GCP auto-generates a unique ID like `nakomis-status-123456` — distinct from the display name)
4. Enable billing on the project

### Pre-2: Enable required GCP APIs

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  dns.googleapis.com \
  storage.googleapis.com
```

> AWS equivalent: like enabling a service in your account — most AWS services are on by default, GCP requires explicit enablement.

### Pre-3: Create a Terraform state bucket (manual bootstrap)

Terraform needs somewhere to store its state file before it can manage anything. Create this bucket manually once:

```bash
gcloud storage buckets create gs://nakomis-status-tfstate \
  --project=YOUR_PROJECT_ID \
  --location=EU \
  --uniform-bucket-level-access
```

> AWS equivalent: the S3 bucket you create manually before setting up a Terraform S3 backend.

### Pre-4: Create a Terraform service account

```bash
gcloud iam service-accounts create terraform \
  --display-name="Terraform" \
  --project=YOUR_PROJECT_ID

for role in roles/run.admin roles/artifactregistry.admin roles/dns.admin roles/storage.admin; do
  gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:terraform@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="$role"
done

gcloud iam service-accounts keys create terraform-key.json \
  --iam-account=terraform@YOUR_PROJECT_ID.iam.gserviceaccount.com

export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/terraform-key.json"
```

> **Never commit `terraform-key.json`.** It is covered by `*.json` in `.gitignore`.

---

## Task 1: Repository scaffold and .gitignore

**Files:**
- Create: `.gitignore`
- Create: `terraform/terraform.tfvars.example`

### Step 1: Create .gitignore

```gitignore
# Terraform
terraform/.terraform/
terraform/.terraform.lock.hcl
terraform/terraform.tfvars
terraform/*.tfplan

# GCP credentials — never commit these
*.json

# Node
node_modules/
dist/
dist-server/

# Env
.env
.env.local
```

### Step 2: Create terraform/terraform.tfvars.example

```hcl
project_id = "your-gcp-project-id"
domain     = "status.nakom.is"
```

### Step 3: Commit

```bash
git add .gitignore terraform/terraform.tfvars.example
git commit -m "chore: initial repo scaffold"
```

---

## Task 2: Terraform — providers and backend

**Files:**
- Create: `terraform/providers.tf`
- Create: `terraform/backend.tf`
- Create: `terraform/variables.tf`
- Create: `terraform/outputs.tf`

### Step 1: Create providers.tf

```hcl
terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "europe-west1"
}
```

### Step 2: Create backend.tf

```hcl
terraform {
  backend "gcs" {
    bucket = "nakomis-status-tfstate"
    prefix = "terraform/state"
  }
}
```

> AWS equivalent: S3 backend. GCS is the GCP equivalent of S3 for state storage.

### Step 3: Create variables.tf

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "domain" {
  description = "Status page domain (e.g. status.nakom.is)"
  type        = string
  default     = "status.nakom.is"
}

variable "region" {
  description = "GCP region for Cloud Run and Artifact Registry"
  type        = string
  default     = "europe-west1"
}

variable "image" {
  description = "Docker image to deploy to Cloud Run"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
```

> The `image` variable defaults to Google's Cloud Run hello-world placeholder so that `terraform apply` succeeds before the real image is built. CI/CD will override this with the real image.

### Step 4: Create outputs.tf

```hcl
# Populated in later tasks
```

### Step 5: Create terraform/terraform.tfvars (local only — gitignored)

```hcl
project_id = "YOUR_ACTUAL_PROJECT_ID"
```

### Step 6: Initialise and validate

```bash
cd terraform
terraform init
terraform validate
```

Expected: `Success! The configuration is valid.`

### Step 7: Commit

```bash
git add terraform/providers.tf terraform/backend.tf terraform/variables.tf terraform/outputs.tf
git commit -m "feat: terraform providers, backend, and variables"
```

---

## Task 3: Terraform — Artifact Registry

> AWS equivalent: ECR (Elastic Container Registry). Stores Docker images that Cloud Run pulls from.

**Files:**
- Create: `terraform/artifact_registry.tf`
- Modify: `terraform/outputs.tf`

### Step 1: Create artifact_registry.tf

```hcl
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "nakomis-status"
  format        = "DOCKER"
  description   = "Docker images for nakomis-status"
}
```

### Step 2: Add output to outputs.tf

```hcl
output "image_base" {
  description = "Base image path — append :<tag> when pushing"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/nakomis-status/app"
}
```

### Step 3: Plan and apply

```bash
cd terraform
terraform plan -out=tfplan
terraform apply tfplan
```

Expected: 1 resource created.

### Step 4: Commit

```bash
git add terraform/artifact_registry.tf terraform/outputs.tf
git commit -m "feat: terraform Artifact Registry for Docker images"
```

---

## Task 4: Terraform — Cloud Run service

> AWS equivalent: ECS Fargate service + ECR image. Cloud Run is simpler — no task definitions, no clusters, no ALB needed for HTTPS.

**Files:**
- Create: `terraform/cloud_run.tf`
- Modify: `terraform/outputs.tf`

### Step 1: Create cloud_run.tf

```hcl
locals {
  image_path = "${var.region}-docker.pkg.dev/${var.project_id}/nakomis-status/app"
}

resource "google_cloud_run_v2_service" "app" {
  name     = "nakomis-status"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      # Uses the placeholder image until CI/CD pushes the real one
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
  }
}

# Allow unauthenticated (public) access
# AWS equivalent: making an API Gateway endpoint public
resource "google_cloud_run_v2_service_iam_binding" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}

# Map the custom domain to this service
# Cloud Run handles HTTPS and certificate provisioning automatically
resource "google_cloud_run_domain_mapping" "app" {
  location = var.region
  name     = var.domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
```

### Step 2: Add outputs to outputs.tf

```hcl
output "cloud_run_url" {
  description = "The default *.run.app URL (useful for testing before DNS is set up)"
  value       = google_cloud_run_v2_service.app.uri
}

output "domain_mapping_records" {
  description = "DNS records to create in Cloud DNS for the custom domain"
  value       = google_cloud_run_domain_mapping.app.status[0].resource_records
}
```

### Step 3: Plan and apply

```bash
cd terraform
terraform plan -out=tfplan
terraform apply tfplan
```

Expected: 3 resources created. Note the `cloud_run_url` output — you can test the placeholder hello-world page at this URL immediately, before DNS is configured.

### Step 4: Commit

```bash
git add terraform/cloud_run.tf terraform/outputs.tf
git commit -m "feat: terraform Cloud Run service with custom domain mapping"
```

---

## Task 5: Terraform — Cloud DNS

> AWS equivalent: Route 53 hosted zone + CNAME record. The NS delegation from Route 53 is a one-time manual step (Task 6).

**Files:**
- Create: `terraform/dns.tf`
- Modify: `terraform/outputs.tf`

### Step 1: Create dns.tf

```hcl
resource "google_dns_managed_zone" "app" {
  name        = "nakomis-status"
  dns_name    = "${var.domain}."
  description = "nakomis-status public zone"
}

# Cloud Run domain mapping for subdomains uses a CNAME to ghs.googlehosted.com
# (GCP's managed endpoint for Cloud Run custom domains)
resource "google_dns_record_set" "app_cname" {
  name         = "${var.domain}."
  type         = "CNAME"
  ttl          = 300
  managed_zone = google_dns_managed_zone.app.name
  rrdatas      = ["ghs.googlehosted.com."]
}
```

> Note: `ghs.googlehosted.com` is Google's stable CNAME target for Cloud Run custom domain mappings.
> Unlike the load balancer approach, there's no static IP — you use a CNAME instead of an A record.

### Step 2: Add DNS output to outputs.tf

```hcl
output "name_servers" {
  description = "GCP nameservers for this zone — add as NS record in Route 53 to delegate status.nakom.is"
  value       = google_dns_managed_zone.app.name_servers
}
```

### Step 3: Plan and apply

```bash
cd terraform
terraform plan -out=tfplan
terraform apply tfplan
```

Expected: 2 resources created.

### Step 4: Commit

```bash
git add terraform/dns.tf terraform/outputs.tf
git commit -m "feat: terraform Cloud DNS zone and CNAME record"
```

---

## Task 6: DNS delegation (manual)

### Step 1: Get the GCP nameservers

```bash
cd terraform
terraform output name_servers
```

You'll get 4 values like `ns-cloud-a1.googledomains.com.`

### Step 2: Add NS record in Route 53

In the AWS console, go to the **`nakom.is`** hosted zone and add:

| Name | Type | TTL | Value |
|------|------|-----|-------|
| `status.nakom.is` | NS | 300 | (all 4 GCP nameservers) |

### Step 3: Verify DNS propagation

```bash
dig NS status.nakom.is
```

Expected: the 4 GCP nameservers in the answer section. Allow a few minutes.

```bash
dig CNAME status.nakom.is
```

Expected: `ghs.googlehosted.com.`

### Step 4: Wait for SSL certificate provisioning

Cloud Run provisions a managed SSL certificate automatically once DNS resolves. Check domain mapping status:

```bash
gcloud run domain-mappings describe --domain=status.nakom.is --region=europe-west1
```

Look for `CERTIFICATE_PROVISIONING` → `ACTIVE`. Can take 10–30 minutes after DNS propagates.

---

## Task 7: Project scaffold (SPA + server)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.server.json`, `Dockerfile`
- Create: `src/main.tsx`, `src/App.tsx`, `src/test-setup.ts`

### Step 1: Initialise Vite project

```bash
npm create vite@latest . -- --template react-ts
```

### Step 2: Install dependencies

```bash
npm install express
npm install --save-dev \
  @types/express \
  @types/node \
  tsx \
  concurrently \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom
```

### Step 3: Replace vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, forward /api calls to the local Express server
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

### Step 4: Create tsconfig.server.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist-server",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/server/**/*", "src/services/**/*"]
}
```

### Step 5: Update package.json scripts

Replace the `scripts` section:

```json
{
  "scripts": {
    "dev:client": "vite",
    "dev:server": "tsx watch src/server/index.ts",
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "build:client": "vite build",
    "build:server": "tsc --project tsconfig.server.json",
    "build": "npm run build:client && npm run build:server",
    "start": "node dist-server/server/index.js",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

### Step 6: Create Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
EXPOSE 8080
CMD ["node", "dist-server/server/index.js"]
```

### Step 7: Create src/test-setup.ts

```typescript
import '@testing-library/jest-dom'
```

### Step 8: Verify the scaffold compiles

```bash
npm run build
```

Expected: `dist/` and `dist-server/` created (dist-server may be empty yet — that's fine).

### Step 9: Commit

```bash
git add .
git commit -m "feat: Vite + React + Express project scaffold with Dockerfile"
```

---

## Task 8: Heartbeat service (TDD)

This module is used by the Express server to check monitored services. It lives in `src/services/` so it is shared between server and client test code.

**Files:**
- Create: `src/services/heartbeat.ts`
- Create: `src/services/heartbeat.test.ts`

### Step 1: Write the failing test

```typescript
// src/services/heartbeat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkHeartbeat } from './heartbeat'

describe('checkHeartbeat', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns up when endpoint responds with 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('up')
    expect(result.service).toBe('nakom.is')
    expect(result.url).toBe('https://nakom.is')
  })

  it('returns down when endpoint responds with non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('down')
  })

  it('returns down when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('down')
  })

  it('returns down when fetch times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('down')
  })

  it('includes latency for successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.latencyMs).toBeTypeOf('number')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
```

### Step 2: Run test — verify it fails

```bash
npm run test:run
```

Expected: FAIL — `Cannot find module './heartbeat'`

### Step 3: Implement heartbeat.ts

```typescript
// src/services/heartbeat.ts
export interface HeartbeatResult {
  service: string
  url: string
  status: 'up' | 'down' | 'unknown'
  latencyMs?: number
}

export async function checkHeartbeat(service: string, url: string): Promise<HeartbeatResult> {
  const start = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return {
      service,
      url,
      status: response.ok ? 'up' : 'down',
      latencyMs: Date.now() - start,
    }
  } catch {
    return { service, url, status: 'down' }
  }
}
```

### Step 4: Run tests — verify they pass

```bash
npm run test:run
```

Expected: 5 tests pass.

### Step 5: Commit

```bash
git add src/services/heartbeat.ts src/services/heartbeat.test.ts
git commit -m "feat: heartbeat service with tests"
```

---

## Task 9: Express server

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/routes/status.ts`

### Step 1: Create src/server/routes/status.ts

```typescript
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
```

### Step 2: Create src/server/index.ts

```typescript
import express from 'express'
import path from 'path'
import { statusRouter } from './routes/status'

const app = express()
const port = parseInt(process.env.PORT ?? '8080', 10)

app.use(express.json())
app.use('/api/status', statusRouter)

// Serve compiled SPA — in production this is the Vite build output
const clientDist = path.join(__dirname, '../../dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
```

### Step 3: Verify the server builds

```bash
npm run build:server
```

Expected: `dist-server/` contains compiled JS. No errors.

### Step 4: Smoke-test locally

In one terminal:
```bash
npm run build:client
npm start
```

In another:
```bash
curl http://localhost:8080/api/status
```

Expected: JSON array with nakom.is status (likely `down` locally if CORS isn't set up yet — that's fine, the structure should be correct).

### Step 5: Commit

```bash
git add src/server/
git commit -m "feat: Express server with /api/status route"
```

---

## Task 10: ServiceStatus component (TDD)

**Files:**
- Create: `src/components/ServiceStatus.tsx`
- Create: `src/components/ServiceStatus.test.tsx`

### Step 1: Write the failing test

```typescript
// src/components/ServiceStatus.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ServiceStatus } from './ServiceStatus'

describe('ServiceStatus', () => {
  it('displays the service name', () => {
    render(<ServiceStatus service="nakom.is" status="up" />)
    expect(screen.getByText('nakom.is')).toBeInTheDocument()
  })

  it('applies status-up class when up', () => {
    render(<ServiceStatus service="nakom.is" status="up" />)
    expect(screen.getByTestId('status-indicator')).toHaveClass('status-up')
  })

  it('applies status-down class when down', () => {
    render(<ServiceStatus service="nakom.is" status="down" />)
    expect(screen.getByTestId('status-indicator')).toHaveClass('status-down')
  })

  it('applies status-unknown class when unknown', () => {
    render(<ServiceStatus service="nakom.is" status="unknown" />)
    expect(screen.getByTestId('status-indicator')).toHaveClass('status-unknown')
  })

  it('displays latency when provided', () => {
    render(<ServiceStatus service="nakom.is" status="up" latencyMs={42} />)
    expect(screen.getByText('42ms')).toBeInTheDocument()
  })

  it('does not display latency when not provided', () => {
    render(<ServiceStatus service="nakom.is" status="up" />)
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
  })
})
```

### Step 2: Run test — verify it fails

```bash
npm run test:run
```

Expected: FAIL — `Cannot find module './ServiceStatus'`

### Step 3: Implement ServiceStatus.tsx

```tsx
// src/components/ServiceStatus.tsx
import type { HeartbeatResult } from '../services/heartbeat'

type Props = Pick<HeartbeatResult, 'service' | 'status' | 'latencyMs'>

export function ServiceStatus({ service, status, latencyMs }: Props) {
  return (
    <div className="service-status">
      <span className="service-name">{service}</span>
      <span data-testid="status-indicator" className={`status-indicator status-${status}`}>
        {status}
      </span>
      {latencyMs !== undefined && (
        <span className="latency">{latencyMs}ms</span>
      )}
    </div>
  )
}
```

### Step 4: Run tests — verify they pass

```bash
npm run test:run
```

Expected: all tests pass.

### Step 5: Commit

```bash
git add src/components/
git commit -m "feat: ServiceStatus component with tests"
```

---

## Task 11: App integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

### Step 1: Replace App.tsx

The SPA now fetches from `/api/status` (same origin — no CORS) instead of calling heartbeat URLs directly:

```tsx
// src/App.tsx
import { useEffect, useState } from 'react'
import { ServiceStatus } from './components/ServiceStatus'
import type { HeartbeatResult } from './services/heartbeat'

export function App() {
  const [results, setResults] = useState<HeartbeatResult[]>([])

  useEffect(() => {
    async function refresh() {
      try {
        const response = await fetch('/api/status')
        const data: HeartbeatResult[] = await response.json()
        setResults(data)
      } catch {
        // Server unreachable — clear results and retry
        setResults([])
      }
    }

    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main>
      <h1>nakomis status</h1>
      {results.length === 0 ? (
        <p>Loading…</p>
      ) : (
        results.map((result) => (
          <ServiceStatus key={result.service} {...result} />
        ))
      )}
    </main>
  )
}
```

### Step 2: Update src/main.tsx

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### Step 3: Run all tests

```bash
npm run test:run
```

Expected: all tests pass.

### Step 4: Full local smoke-test

```bash
npm run build
npm start
```

Open http://localhost:8080 in a browser. The status page should load and show nakom.is status after polling `/api/status`.

### Step 5: Commit

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: App polls /api/status from server"
```

---

## Task 12: CI/CD — GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

### Step 1: Create deploy.yml

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:run

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Build image and push to Artifact Registry
        env:
          IMAGE: ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/nakomis-status/app:${{ github.sha }}
        run: |
          docker build -t $IMAGE .
          docker push $IMAGE

      - name: Deploy to Cloud Run
        env:
          IMAGE: ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/nakomis-status/app:${{ github.sha }}
        run: |
          gcloud run services update nakomis-status \
            --image=$IMAGE \
            --region=${{ secrets.GCP_REGION }}
```

### Step 2: Add GitHub Actions secrets

In the GitHub repo settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `GCP_SA_KEY` | Full contents of `terraform-key.json` |
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_REGION` | `europe-west1` |

### Step 3: Commit

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: GitHub Actions CI/CD pipeline"
```

---

## Task 13: First real deployment and verification

### Step 1: Build and push the first real image manually

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export REGION=europe-west1
export IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/nakomis-status/app:initial

gcloud auth configure-docker $REGION-docker.pkg.dev
docker build -t $IMAGE .
docker push $IMAGE
```

### Step 2: Update Cloud Run to use the real image

```bash
gcloud run services update nakomis-status \
  --image=$IMAGE \
  --region=$REGION
```

### Step 3: Test via the default run.app URL (before DNS)

```bash
terraform -chdir=terraform output cloud_run_url
# Then:
curl https://<your-service>.run.app/api/status
```

Expected: JSON array with nakom.is result.

### Step 4: Test via custom domain (after DNS + SSL cert active)

```bash
curl https://status.nakom.is/api/status
curl https://status.nakom.is/
```

Expected: JSON and HTML respectively, both over HTTPS.

### Step 5: Push to main and verify CI runs green

```bash
git push origin main
```

Watch the GitHub Actions run. Expected: green.

---

## Estimated GCP costs (very low traffic)

> Verify with the [GCP Pricing Calculator](https://cloud.google.com/products/calculator).

| Component | AWS equivalent | Estimated monthly cost | Notes |
|-----------|---------------|----------------------|-------|
| Cloud Run | ECS Fargate | **~$0.00** | 2M requests/month free; 360,000 GB-seconds free; scales to zero |
| Artifact Registry | ECR | ~$0.10 | $0.10/GB/month storage; a few Docker image layers = negligible |
| Cloud DNS (1 zone) | Route 53 Hosted Zone | ~$0.20 | $0.20/zone/month; query charges negligible |
| **Total** | | **~$0.30/month** | |

This is dramatically cheaper than the load balancer approach (~$5–20/month). At very low traffic Cloud Run is effectively free.

---

## Open questions / future work

- **CORS on nakom.is** — still needed if you ever want to call nakom.is directly from the browser. For the current architecture (server proxies all checks), it's not needed.
- **Dedicated heartbeat endpoints** — add `/heartbeat` to each nakomis project so checks are lightweight; update `SERVICES` in `src/server/routes/status.ts`
- **Authenticated AWS API calls** — add AWS SDK to the server; store credentials in GCP Secret Manager; mount as env vars in the Cloud Run service via Terraform
- **status.nakomis.com** — phase 2; add a second `google_dns_managed_zone` and `google_cloud_run_domain_mapping` resource; delegate from the `nakomis.com` Route 53 zone
- **UI design** — invoke `frontend-design` skill when styling the SPA
- **More services** — add to `SERVICES` in `src/server/routes/status.ts`
- **Workload Identity Federation** — replace the GCP service account key in GitHub Actions with keyless auth (no long-lived credentials in secrets)
- **Secret Manager** — for future AWS credentials: `google_secret_manager_secret` + mount in Cloud Run template
