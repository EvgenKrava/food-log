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
variable "history_days" {
  description = "How long free users' diary and weight entries are kept (core retention policy)."
  type        = number
  default     = 365
}
