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
  // Everything is bundled: the Bedrock SDK pulls AWS packages the Lambda runtime does not ship
  // (e.g. @aws-sdk/util-utf8-browser). Some CJS deps call require() at runtime, so give them one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  sourcemap: false,
});
