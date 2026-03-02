output "image_base" {
  description = "Base image path — append :<tag> when pushing"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/nakomis-status/app"
}
