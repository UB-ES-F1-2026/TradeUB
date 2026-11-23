// Resum dels tests i la cobertura del frontend per al job summary de GitHub Actions.
// S'executa des de frontend/ després de vitest amb --coverage i --reporter=json (vitest-results.json) i escriu Markdown a
// la sortida estàndard. Si falta algun informe (vitest no ha arrencat), ho diu en lloc de fallar.
import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null)
const bar = (pct) => '█'.repeat(Math.floor(pct / 5)).padEnd(20, '░')
const icon = (pct) => (pct >= 90 ? '🟢' : pct >= 75 ? '🟡' : '🔴')
const percent = (pct) => `${pct.toFixed(1).replace('.', ',')} %`

const results = readJson('vitest-results.json')
const coverage = readJson('coverage/coverage-summary.json')

let tests = "⚠️ No s'han executat"
if (results) {
  const { numPassedTests: passed, numFailedTests: failed, numPendingTests: skipped, numTodoTests: todo } = results
  const omitted = skipped + todo
  tests = [
    failed && `❌ ${failed} fallats`,
    `✅ ${passed} passats`,
    omitted && `⏭️ ${omitted} ${omitted === 1 ? 'omès' : 'omesos'}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

const lines = ['### 🟩 Frontend', '', `**Tests:** ${tests}`, '']

if (!coverage) {
  lines.push('**Cobertura:** ⚠️ Sense dades')
} else {
  const metrics = { lines: 'Línies', statements: 'Sentències', functions: 'Funcions', branches: 'Branques' }
  lines.push('| Cobertura | % | |', '|:--|--:|:--|')
  for (const [key, label] of Object.entries(metrics)) {
    const { pct } = coverage.total[key]
    lines.push(`| ${label} | ${icon(pct)} **${percent(pct)}** | \`${bar(pct)}\` |`)
  }

  const below = Object.entries(coverage)
    .filter(([file, data]) => file !== 'total' && data.lines.pct < 90)
    .sort(([, a], [, b]) => a.lines.pct - b.lines.pct)
  if (below.length) {
    lines.push('', '<details><summary>Fitxers per sota del 90 % de línies</summary>', '')
    lines.push('| Fitxer | Línies | Branques |', '|:--|--:|--:|')
    for (const [file, data] of below) {
      lines.push(`| \`${relative(process.cwd(), file)}\` | ${percent(data.lines.pct)} | ${percent(data.branches.pct)} |`)
    }
    lines.push('', '</details>')
  }
}

console.log(lines.join('\n'))
