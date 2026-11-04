import { build, context } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const dist = path.join(root, 'dist');

const pluginOptions = {
  entryPoints: [path.join(root, 'src/plugin/main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2019',
  platform: 'neutral',
  outfile: path.join(dist, 'code.js'),
  logLevel: 'info',
  legalComments: 'none',
};

const uiOptions = {
  entryPoints: [path.join(root, 'src/ui/app.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2019',
  platform: 'browser',
  write: false,
  minify: !watch,
  logLevel: 'silent',
  legalComments: 'none',
};

async function assembleUi(jsText) {
  const [html, css] = await Promise.all([
    readFile(path.join(root, 'src/ui/ui.html'), 'utf8'),
    readFile(path.join(root, 'src/ui/styles.css'), 'utf8'),
  ]);
  // Évite la fermeture prématurée de la balise <script>.
  const safeJs = jsText.replace(/<\/script/gi, '<\\/script');
  const out = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => safeJs);
  await writeFile(path.join(dist, 'ui.html'), out);
  console.log(`  ui.html  ${(Buffer.byteLength(out) / 1024).toFixed(1)} kB`);
}

async function buildUiOnce() {
  const result = await build(uiOptions);
  await assembleUi(result.outputFiles[0].text);
}

await mkdir(dist, { recursive: true });

if (watch) {
  const pluginCtx = await context(pluginOptions);
  await pluginCtx.watch();
  const uiCtx = await context({
    ...uiOptions,
    plugins: [
      {
        name: 'assemble-ui',
        setup(b) {
          b.onEnd(async (result) => {
            if (result.errors.length) return;
            await assembleUi(result.outputFiles[0].text);
          });
        },
      },
    ],
  });
  await uiCtx.watch();
  console.log('watching…');
} else {
  await build(pluginOptions);
  await buildUiOnce();
}
