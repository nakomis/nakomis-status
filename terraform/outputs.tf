output "image_base" {
  description = "Base image path — append :<tag> when pushing"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/nakomis-status/app"
}

output "cloud_run_url" {
  description = "The default *.run.app URL (useful for testing before DNS is set up)"
  value       = google_cloud_run_v2_service.app.uri
}

output "domain_mapping_records" {
  description = "DNS records to create in Cloud DNS for the custom domain"
  value       = google_cloud_run_domain_mapping.app.status[0].resource_records
}

output "name_servers" {
  description = "GCP nameservers for this zone — add as NS record in Route 53 to delegate status.nakom.is"
  value       = google_dns_managed_zone.app.name_servers
}
