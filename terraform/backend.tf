terraform {
  backend "gcs" {
    bucket = "nakomis-status-tfstate"
    prefix = "terraform/state"
  }
}
