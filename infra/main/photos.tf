# Item photos (one personal photo per product or dish). The browser uploads to `uploads/` with a
# presigned POST; the API copies the file to `photos/` when it is attached. CloudFront serves
# `photos/` at /photos/* on the app domain. Unattached uploads expire after a day.
resource "aws_s3_bucket" "photos" {
  bucket = "${var.project}-photos-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket                  = aws_s3_bucket.photos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id
  rule {
    id     = "expire-unattached-uploads"
    status = "Enabled"
    filter { prefix = "uploads/" }
    expiration { days = 1 }
  }
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

# The browser POSTs straight to the bucket, so it needs CORS for the app origin (and local dev).
resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id
  cors_rule {
    allowed_methods = ["POST"]
    allowed_origins = [local.app_url, "http://localhost:5173"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

data "aws_iam_policy_document" "photos_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.photos.arn}/photos/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "photos" {
  bucket = aws_s3_bucket.photos.id
  policy = data.aws_iam_policy_document.photos_bucket.json
}
