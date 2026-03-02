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

# Bootstrap default — used for the initial `terraform apply` before the real image is built.
# Once deployed, image updates are managed via `gcloud run services update --image=...` in CI/CD.
# Do not run `terraform apply` without setting this in terraform.tfvars if a real image is deployed.
variable "image" {
  description = "Docker image to deploy to Cloud Run"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
