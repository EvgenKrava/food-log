#!/usr/bin/env bash
# Build → terraform apply → web env from outputs → vite build → s3 sync → CloudFront invalidation.
set -euo pipefail
unset AWS_BEARER_TOKEN_BEDROCK
export AWS_PROFILE=yevhenii AWS_REGION=us-east-1
root="$(cd "$(dirname "$0")/.." && pwd)"

pnpm --dir "$root" --filter @foodlog/api build

cd "$root/infra/main"
terraform init -input=false >/dev/null
terraform apply -input=false -auto-approve
out() { terraform output -raw "$1"; }
bucket=$(out web_bucket)
dist_id=$(out cloudfront_distribution_id)
authority=$(out cognito_authority)
client_id=$(out cognito_client_id)

cat > "$root/apps/web/.env.production" <<ENV
VITE_COGNITO_AUTHORITY=$authority
VITE_COGNITO_CLIENT_ID=$client_id
VITE_COGNITO_DOMAIN=https://auth.onlytools.click
ENV

pnpm --dir "$root" --filter @foodlog/web build
# Hashed assets cache forever; everything else (shell, service worker, css, icons) revalidates.
aws s3 sync "$root/apps/web/dist/assets" "s3://$bucket/assets" --cache-control 'public,max-age=31536000,immutable'
aws s3 sync "$root/apps/web/dist" "s3://$bucket" --delete --exclude 'assets/*' --cache-control 'no-cache'
aws cloudfront create-invalidation --distribution-id "$dist_id" --paths '/*' >/dev/null
echo "Deployed: $(out app_url)"
