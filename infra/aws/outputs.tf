output "cloud_run_reader_role_arn" {
  description = "ARN of the role Cloud Run assumes to call AWS APIs"
  value       = aws_iam_role.cloud_run_reader.arn
}

output "github_infra_role_arn" {
  description = "ARN of the role GitHub Actions assumes to apply this terraform"
  value       = aws_iam_role.github_infra.arn
}
