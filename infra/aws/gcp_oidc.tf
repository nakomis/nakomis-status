# Allows Cloud Run (running as the default compute service account) to call AWS APIs
# by exchanging a GCP identity token for temporary AWS credentials via STS.
#
# Cloud Run fetches a token from the metadata server with audience "sts.amazonaws.com",
# then calls sts:AssumeRoleWithWebIdentity. The sub condition locks this to our specific
# service account — no other GCP identity can assume this role.

resource "aws_iam_openid_connect_provider" "google" {
  url = "https://accounts.google.com"

  # Cloud Run will request tokens with this audience
  client_id_list = ["sts.amazonaws.com"]

  # SHA-1 thumbprint of Google's root CA certificate.
  # AWS uses its own CA trust store for well-known providers so this is not
  # actively validated, but Terraform requires a non-empty value.
  thumbprint_list = ["08745487e891c19e3078c1f2a07e452950ef36f6"]
}

resource "aws_iam_role" "cloud_run_reader" {
  name        = "nakomis-status-cloud-run-reader"
  description = "Assumed by nakomis-status Cloud Run to read AWS service health"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.google.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            # Lock to the specific service account — numeric ID is stable even if email changes
            "accounts.google.com:sub" = var.gcp_compute_sa_id
            "accounts.google.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "cloud_run_reader" {
  name = "nakomis-status-cloud-run-reader-policy"
  role = aws_iam_role.cloud_run_reader.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:ListFunctions",
          "s3:ListAllMyBuckets",
          "s3:GetBucketLocation",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "apigateway:GET",
        ]
        Resource = "*"
      }
    ]
  })
}
