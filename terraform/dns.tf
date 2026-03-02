resource "google_dns_managed_zone" "app" {
  name        = "nakomis-status"
  dns_name    = "${var.domain}."
  description = "nakomis-status public zone"
}

# A CNAME cannot be placed at a zone apex (status.nakom.is.).
# Cloud Run domain mappings for apex domains require A records pointing to
# Google's well-known ghs.googlehosted.com IPs instead.
resource "google_dns_record_set" "app_a" {
  name         = "${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.app.name
  rrdatas = [
    "216.239.32.21",
    "216.239.34.21",
    "216.239.36.21",
    "216.239.38.21",
  ]
}
