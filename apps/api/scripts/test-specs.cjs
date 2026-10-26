const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const apiDir = path.resolve(__dirname, '..')
const configFile = path.join(apiDir, 'tsconfig.json')
const raw = ts.readConfigFile(configFile, ts.sys.readFile)
const specs = process.argv.slice(2)
if (!specs.length) throw new Error('Pass at least one test file to test-specs.cjs')
raw.config.include = specs
raw.config.exclude = []
const config = ts.parseJsonConfigFileContent(
  raw.config,
  ts.sys,
  apiDir,
  { noEmit: true, incremental: false },
  configFile,
)
const program = ts.createProgram(config.fileNames, config.options)
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)]
if (diagnostics.length) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: (file) => file,
      getNewLine: () => '\n',
    }),
  )
  process.exit(1)
}

// Node 20 cannot load TypeScript/decorators directly; use the existing compiler.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: config.options, fileName: filename })
  module._compile(result.outputText, filename)
}
for (const spec of specs) require(path.join(apiDir, spec))
