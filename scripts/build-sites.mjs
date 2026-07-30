import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const fromRoot = (...parts) => path.join(projectRoot, ...parts);

const promptFiles = {
  skill: "SKILL.md",
  contract: "references/contract.md",
  evidence: "references/evidence-policy.md",
  tone: "references/tone-reading.md",
  questioning: "references/questioning.md",
  writing: "references/writing-and-editing.md",
  curator: "references/curator-lenses.md",
  styles: "references/styles.md"
};

const promptDirectory = fromRoot("skills", "memento-memory-editor");
const promptDocuments = Object.fromEntries(
  await Promise.all(
    Object.entries(promptFiles).map(async ([key, relativePath]) => [
      key,
      await readFile(path.join(promptDirectory, relativePath), "utf8")
    ])
  )
);

const [indexHtml, appJs, stylesCss, socialImage] = await Promise.all([
  readFile(fromRoot("public", "index.html"), "utf8"),
  readFile(fromRoot("public", "app.js"), "utf8"),
  readFile(fromRoot("public", "styles.css"), "utf8"),
  readFile(fromRoot("public", "og.png")).then((buffer) =>
    buffer.toString("base64")
  )
]);

await rm(fromRoot("dist"), { recursive: true, force: true });

await build({
  entryPoints: [fromRoot("src", "sites-worker.js")],
  outfile: fromRoot("dist", "server", "index.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  define: {
    __MEMENTO_INDEX_HTML__: JSON.stringify(indexHtml),
    __MEMENTO_APP_JS__: JSON.stringify(appJs),
    __MEMENTO_STYLES_CSS__: JSON.stringify(stylesCss),
    __MEMENTO_OG_PNG__: JSON.stringify(socialImage),
    __MEMENTO_PROMPT_FILES__: JSON.stringify(promptFiles),
    __MEMENTO_PROMPT_DOCUMENTS__: JSON.stringify(promptDocuments)
  }
});
