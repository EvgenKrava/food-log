# Single table (spec §7), on-demand. gsi1 = barcode lookup, gsi2 = owner's items. History expires via `ttl`.
resource "aws_dynamodb_table" "main" {
  name         = var.project
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  dynamic "attribute" {
    for_each = ["pk", "sk", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk"]
    content {
      name = attribute.value
      type = "S"
    }
  }

  global_secondary_index {
    name            = "gsi1"
    projection_type = "ALL"
    key_schema {
      attribute_name = "gsi1pk"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "gsi1sk"
      key_type       = "RANGE"
    }
  }

  global_secondary_index {
    name            = "gsi2"
    projection_type = "ALL"
    key_schema {
      attribute_name = "gsi2pk"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "gsi2sk"
      key_type       = "RANGE"
    }
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Off on purpose: PITR bills backup storage; history is disposable by policy.
  point_in_time_recovery { enabled = false }
  deletion_protection_enabled = true
}
