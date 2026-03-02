# nakomis-status

A status page for nakomis projects. Domains:
- `status.nakom.is` — phase 1 (current)
- `status.nakomis.com` — phase 2 (future)

## Purpose

Centralised visibility into the health of the various nakomis projects. Because the projects themselves are all AWS-based (mostly `eu-west-1`), this status page deliberately runs on **Google Cloud Platform (GCP)** — a separate provider gives the status page independence from any AWS-wide issues.

## Technology Choices

### IaC

**Terraform** — chosen for its maturity, GCP support, and portfolio value. HCL is familiar to the project owner.

### AWS → GCP Service Mapping

| AWS | GCP | Notes |
|-----|-----|-------|
| Lambda | **Cloud Functions** / **Cloud Run** | Cloud Run preferred — container-based, more flexible, no cold start quirks |
| SSM Parameter Store | *(no direct equivalent)* | GCP doesn't separate config from secrets; use **Secret Manager** for both, or env vars |
| Secrets Manager | **Secret Manager** | Direct equivalent |
| API Gateway | **API Gateway** | GCP has a product with this exact name; **Cloud Endpoints** is the older alternative; **Apigee** for enterprise |
| Route 53 | **Cloud DNS** | Direct equivalent; **Cloud Domains** for registrar functionality |

## Stack

- **Cloud Run** — serves the Node.js/Express server (handles HTTPS + custom domain natively, no load balancer needed)
- **Express** — serves the compiled SPA static files + `/api/status` endpoint
- **React + Vite** — SPA frontend, fetches `/api/status` from same origin (no CORS issues)
- **Artifact Registry** — stores Docker images (AWS equivalent: ECR)
- **Cloud DNS** — points `status.nakom.is` (and later `status.nakomis.com`) at the service
- **Terraform** — IaC

Status checks are made **server-side** by Express, not client-side. Browser fetches `/api/status` from Cloud Run (same origin). Cloud Run fetches monitored services. This eliminates CORS issues and enables future authenticated AWS API calls from the server.

## Monitored Services

- Phase 1: `nakom.is` — simple HTTP 200 check (no dedicated `/heartbeat` endpoint yet; CORS headers required on nakom.is)
- Future: dedicated `/heartbeat` endpoints on each service; expand to all nakomis projects

## DNS

- `status.nakom.is`: delegated from `nakom.is` Route 53 hosted zone → GCP Cloud DNS nameservers
- `status.nakomis.com`: delegated from `nakomis.com` Route 53 hosted zone → GCP Cloud DNS nameservers (phase 2)

## User Context

- Owner knows AWS well but not GCP — use AWS analogies when explaining GCP concepts
- Prefers TypeScript/NodeJS

## Repo

Public GitHub repo, CC-0 licence. **No secrets committed.**
