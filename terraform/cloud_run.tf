locals {
  image_path = "${var.region}-docker.pkg.dev/${var.project_id}/nakomis-status/app"
}

resource "google_cloud_run_v2_service" "app" {
  name     = "nakomis-status"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
        cpu_idle = true
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
  }
}

# NOTE: The allUsers IAM binding is blocked by a GCP organisation policy
# (constraints/iam.allowedPolicyMemberDomains). The Cloud Run service is
# currently not publicly accessible via IAM. To enable public access, the
# org policy constraint must be relaxed or an exception granted, then this
# resource can be re-added.
#
# resource "google_cloud_run_v2_service_iam_binding" "public" {
#   name     = google_cloud_run_v2_service.app.name
#   location = google_cloud_run_v2_service.app.location
#   role     = "roles/run.invoker"
#   members  = ["allUsers"]
# }

resource "google_cloud_run_domain_mapping" "app" {
  location = var.region
  name     = var.domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
