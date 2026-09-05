// Regenerates the golden ledger fixtures from Interlock's real module
// (design D7). For every fixtures/ledger/*.md it writes `<name>.parsed.json`
// (the output of parseLedger without a reference audit) and
// `<name>.serialized.md` (serializeLedger over that parse), and records the
// Interlock version it ran against in fixtures/ledger/VERSION.
//
//   INTERLOCK_LIB_DIR=~/IdeaProjects/specflow/lib npm run gen:ledger-fixtures
//
// Defaults to the installed plugin cache. The port's tests compare against
// the written files and never need Interlock present.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_LIB = join(homedir(), '.claude/plugins/cache/interlock/interlock/0.2.0/lib')
const libDir = resolve((process.env.INTERLOCK_LIB_DIR || DEFAULT_LIB).replace(/^~(?=$|\/)/, homedir()))
const ledgerModule = join(libDir, 'ledger.mjs')
if (!existsSync(ledgerModule)) {
  console.error(`No ledger.mjs under ${libDir}. Set INTERLOCK_LIB_DIR to Interlock's lib/ directory.`)
  process.exit(1)
}

const { parseLedger, serializeLedger } = await import(pathToFileURL(ledgerModule).href)

const fixturesDir = resolve('fixtures/ledger')
const sources = readdirSync(fixturesDir).filter(f => f.endsWith('.md') && !f.endsWith('.serialized.md'))
if (sources.length === 0) {
  console.error(`No *.md fixtures under ${fixturesDir}`)
  process.exit(1)
}

for (const file of sources) {
  const name = file.replace(/\.md$/, '')
  const text = readFileSync(join(fixturesDir, file), 'utf8')
  const parsed = parseLedger(text)
  writeFileSync(join(fixturesDir, `${name}.parsed.json`), JSON.stringify(parsed, null, 2) + '\n')
  writeFileSync(join(fixturesDir, `${name}.serialized.md`), serializeLedger(parsed.change, parsed.rows))
  console.log(`${name}: ${parsed.rows.length} row(s), ${parsed.invalid.length} invalid, parseable=${parsed.parseable}`)
}

let version = 'unknown'
const manifest = join(libDir, '..', '.claude-plugin', 'plugin.json')
if (existsSync(manifest)) {
  try {
    version = JSON.parse(readFileSync(manifest, 'utf8')).version || version
  } catch {
    /* leave unknown */
  }
}
writeFileSync(
  join(fixturesDir, 'VERSION'),
  `interlock ${version}\ngenerated ${new Date().toISOString().slice(0, 10)}\n`
)
console.log(`VERSION: interlock ${version}`)
