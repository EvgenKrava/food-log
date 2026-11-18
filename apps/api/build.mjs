// Bundles the Lambda handler into one ESM file; Terraform zips dist/api.
import { build } from 'esbuild';

await build({
  entryPoints: { 'api/index': 'src/lambda.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  minify: true,
  // The Node.js Lambda runtime ships AWS SDK v3.
  external: ['@aws-sdk/*'],
  sourcemap: false,
});
