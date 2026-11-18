terraform {
  required_version = ">= 1.10"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 6.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.7" }
  }
  # State lives in the shared Only Tools state bucket (created by only-tools-core/infra/bootstrap).
  backend "s3" {
    bucket       = "onlytools-tfstate-898836755334"
    key          = "foodlog/main.tfstate"
    region       = "us-east-1"
    profile      = "yevhenii"
    use_lockfile = true
  }
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile
  default_tags {
    tags = { Project = var.project, ManagedBy = "terraform" }
  }
}

data "aws_caller_identity" "current" {}
data "aws_route53_zone" "main" { name = var.zone_name }

# Sign-in is the shared Only Tools pool (only-tools-core/infra/main/auth.tf publishes these).
data "aws_ssm_parameter" "issuer" { name = "/onlytools/auth/issuer" }
data "aws_ssm_parameter" "client" { name = "/onlytools/auth/clients/foodlog" }

locals {
  account_id = data.aws_caller_identity.current.account_id
  app_url    = "https://${var.web_domain}"
}
