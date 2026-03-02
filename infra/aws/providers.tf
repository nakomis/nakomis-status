terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  # No profile set — in CI, credentials come from configure-aws-credentials via env vars.
  # Locally, set AWS_PROFILE=nakom.is-admin before running terraform.
}
