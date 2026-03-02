resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "nakomis-status"
  format        = "DOCKER"
  description   = "Docker images for nakomis-status"
}
