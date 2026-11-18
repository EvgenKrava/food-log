output "web_bucket" { value = aws_s3_bucket.web.bucket }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.web.id }
output "app_url" { value = local.app_url }
output "table_name" { value = aws_dynamodb_table.main.name }
output "cognito_client_id" { value = nonsensitive(data.aws_ssm_parameter.client.value) }
output "cognito_authority" { value = nonsensitive(data.aws_ssm_parameter.issuer.value) }
