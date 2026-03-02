variable "aws_region" {
  description = "AWS region"
  default     = "eu-west-1"
}

variable "aws_profile" {
  description = "AWS CLI profile (used for local runs; ignored in CI)"
  default     = "nakom.is"
}

variable "gcp_compute_sa_id" {
  description = "Numeric unique ID of the GCP default compute service account (sub claim in OIDC tokens)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo allowed to assume the infra deployment role (org/repo)"
  default     = "nakomis/nakomis-status"
}
