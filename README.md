# nakomis-status

Service status page for Nakomis Softworks projects, live at **[status.nakom.is](https://status.nakom.is)**.

Deliberately hosted on **Google Cloud Platform** rather than AWS — keeping the status page independent of any AWS-wide issues that might affect the projects it monitors.

## Support

If you find this useful, please consider buying me a coffee:

[![Donate with PayPal](https://www.paypalobjects.com/en_GB/i/btn/btn_donate_SM.gif)](https://www.paypal.com/donate?hosted_button_id=Q3BESC73EWVNN&custom=nakomis-status)

## Architecture

```
Browser → status.nakom.is (Cloud Run)
               │
               ├── serves React SPA (compiled static files)
               └── /api/status → Express → checks each service → returns JSON
                                              │
                                              └── (future) AssumeRoleWithWebIdentity
                                                  → AWS APIs (Lambda, S3, CloudWatch)
```

The Express server proxies all status checks, so the browser never makes cross-origin requests.

## Repository layout

```
.github/workflows/
  deploy.yml        # build + deploy web app to Cloud Run on push to main
  infra-aws.yml     # apply AWS terraform on changes to infra/aws/

infra/
  gcp/              # Terraform — GCP infrastructure (Cloud Run, DNS, Artifact Registry)
  aws/              # Terraform — AWS IAM (OIDC trust, reader role)

web/                # React + Express app
  src/
    server/         # Express server (serves SPA + /api/status)
    services/       # shared logic (heartbeat checks)
    components/     # React components
```

## Stack

| Layer | Technology |
|-------|-----------|
| Hosting | GCP Cloud Run |
| IaC | Terraform (HCL) |
| Frontend | React 19 + TypeScript |
| Backend | Express 5 (Node 20) |
| Container registry | GCP Artifact Registry |
| DNS | GCP Cloud DNS (delegated from Route 53) |
| State backend | GCS (`nakomis-status-tfstate`) |
| CI/CD auth (GCP) | Workload Identity Federation — keyless |
| CI/CD auth (AWS) | OIDC → IAM role — keyless |
| Testing | Vitest + React Testing Library |

## Cross-cloud trust

A key piece of this project is the **keyless identity chain** — no long-lived credentials stored anywhere:

### GitHub → GCP (deploy workflow)
GitHub Actions holds an OIDC token. GCP Workload Identity Federation accepts it and exchanges it for a short-lived GCP credential scoped to the `terraform@nakomis-status` service account. This lets CI push Docker images and update Cloud Run without storing a GCP service account key.

### GitHub → AWS (infra workflow)
Same pattern in reverse. AWS IAM has an OIDC provider for `token.actions.githubusercontent.com`. GitHub Actions exchanges its OIDC token for temporary AWS credentials via `sts:AssumeRoleWithWebIdentity`, locked to the `nakomis/nakomis-status` repo.

### GCP → AWS (runtime — Cloud Run calling AWS APIs)
Cloud Run fetches an OIDC identity token from the GCP metadata server (audience: `sts.amazonaws.com`). AWS STS accepts it via the `accounts.google.com` OIDC provider, and returns temporary credentials for the `nakomis-status-cloud-run-reader` role — locked to the numeric unique ID of the Cloud Run compute service account. This will be used for richer health checks (Lambda status, CloudWatch metrics, etc.) once implemented.

```
GitHub Actions ──OIDC──▶ GCP WIF ──▶ short-lived GCP creds  (deploy)
GitHub Actions ──OIDC──▶ AWS STS ──▶ short-lived AWS creds  (infra)
Cloud Run      ──OIDC──▶ AWS STS ──▶ short-lived AWS creds  (runtime)
```

## Infrastructure

### GCP (`infra/gcp/`)

| Resource | Purpose |
|----------|---------|
| Cloud Run service | Serves the app; scales to zero when idle |
| Artifact Registry | Docker image repository |
| Cloud DNS zone | `status.nakom.is` managed zone |
| Cloud Run domain mapping | Maps custom domain; handles TLS automatically |

**Cost:** ~£0.25/month (dominated by the Cloud DNS zone fee; Cloud Run free tier covers expected traffic).

DNS is delegated from the `nakom.is` Route 53 hosted zone via NS records pointing at `ns-cloud-d{1-4}.googledomains.com`.

### AWS (`infra/aws/`)

| Resource | Purpose |
|----------|---------|
| `aws_iam_openid_connect_provider.google` | Trusts GCP identity tokens (`accounts.google.com`) |
| `aws_iam_openid_connect_provider.github` | Trusts GitHub Actions tokens (`token.actions.githubusercontent.com`) |
| `aws_iam_role.cloud_run_reader` | Assumed by Cloud Run; read-only access to Lambda, S3, CloudWatch |
| `aws_iam_role.github_infra` | Assumed by GitHub Actions to apply this terraform |

## Local development

```bash
cd web
npm install
npm run dev          # starts Vite (port 5173) + Express (port 8080) concurrently
```

The Vite dev server proxies `/api/*` to the Express server, so status checks work locally without CORS issues.

## CI/CD

### Web app (`deploy.yml`)
Triggers on every push to `main`. Runs tests, builds a Docker image tagged with the commit SHA, pushes to Artifact Registry, then updates the Cloud Run service.

### AWS infra (`infra-aws.yml`)
Triggers on push to `main` when files under `infra/aws/` change. Plans on PRs, applies on merge. Requires the `AWS_INFRA_ROLE_ARN` GitHub secret (set after the bootstrap apply).

### GCP infra
Currently applied manually:
```bash
cd infra/gcp
terraform init
terraform apply       # uses Application Default Credentials (gcloud auth application-default login)
```

## Bootstrap

The AWS infra has a one-time bootstrap requirement: the GitHub→AWS OIDC role is itself created by the terraform, so the very first `terraform apply` must be run locally with a profile that has IAM permissions:

```bash
cd infra/aws
terraform init
AWS_PROFILE=nakom.is-admin terraform apply   # credentials via env var, not provider config
# copy github_infra_role_arn from the outputs, then:
gh secret set AWS_INFRA_ROLE_ARN --repo nakomis/nakomis-status --body "<arn>"
```

After that, all subsequent changes to `infra/aws/` are applied automatically by CI.

## Support

If you find this useful, please consider buying me a coffee:

[![Donate with PayPal](https://www.paypalobjects.com/en_GB/i/btn/btn_donate_SM.gif)](https://www.paypal.com/donate?hosted_button_id=Q3BESC73EWVNN&custom=nakomis-status)
