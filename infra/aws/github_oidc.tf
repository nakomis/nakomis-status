# Allows GitHub Actions (nakomis/nakomis-status) to apply this terraform without
# storing AWS credentials as secrets — same keyless OIDC pattern as GitHub→GCP.
#
# Bootstrap note: this role is created by terraform, so the very first apply must
# be run locally with `terraform apply` using your nakom.is AWS CLI profile.
# All subsequent applies can run in CI via the infra.yml workflow.

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  # Default audience used by aws-actions/configure-aws-credentials@v4
  client_id_list = ["sts.amazonaws.com"]

  # SHA-1 thumbprint of GitHub Actions' OIDC root CA.
  # As with Google, AWS doesn't actively validate this for well-known providers.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_infra" {
  name        = "nakomis-status-github-infra"
  description = "Assumed by GitHub Actions to apply nakomis-status AWS infra"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            # Allow any branch/ref in this repo (plan on PRs, apply on main)
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "github_infra" {
  name = "nakomis-status-github-infra-policy"
  role = aws_iam_role.github_infra.id

  # Scoped to only the IAM resources this project manages
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iam:*"]
        Resource = [
          aws_iam_openid_connect_provider.google.arn,
          aws_iam_openid_connect_provider.github.arn,
          aws_iam_role.cloud_run_reader.arn,
          "${aws_iam_role.cloud_run_reader.arn}/*",
          aws_iam_role.github_infra.arn,
          "${aws_iam_role.github_infra.arn}/*",
        ]
      }
    ]
  })
}
