variable "region" {
  type    = string
  default = "us-east-1"
}
variable "aws_profile" {
  type    = string
  default = "yevhenii"
}
variable "project" {
  type    = string
  default = "foodlog"
}
variable "zone_name" {
  type    = string
  default = "onlytools.click"
}
variable "web_domain" {
  type    = string
  default = "foodlog.onlytools.click"
}
variable "lambda_runtime" {
  description = "nodejs24.x until nodejs26.x is GA."
  type        = string
  default     = "nodejs24.x"
}


variable "scan_limit_global" {
  description = "AI label scans the whole service may run per UTC day (caps the Bedrock bill)."
  type        = number
  default     = 300
}
