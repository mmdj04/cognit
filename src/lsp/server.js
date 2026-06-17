#!/usr/bin/env node

import { Lexer } from "../compiler/lexer.js"
import { Parser } from "../compiler/parser.js"

const documents = new Map()

const builtins = {
  print:      { params: "...args", doc: "Print values to console" },
  map:        { params: "arr, fn", doc: "Apply fn to each element of arr" },
  filter:     { params: "arr, fn", doc: "Keep elements where fn returns true" },
  reduce:     { params: "arr, fn, initial", doc: "Reduce arr to single value using fn" },
  range:      { params: "start, end?, step?", doc: "Generate array of numbers" },
  len:        { params: "arr", doc: "Get length of array" },
  sum:        { params: "arr", doc: "Sum all elements of array" },
  first:      { params: "arr", doc: "Get first element of array" },
  last:       { params: "arr", doc: "Get last element of array" },
  take:       { params: "arr, n", doc: "Take first n elements" },
  drop:       { params: "arr, n", doc: "Drop first n elements" },
  sleep:      { params: "ms", doc: "Sleep for ms milliseconds" },
  sort:       { params: "arr, fn?", doc: "Sort array (optional comparator)" },
  reverse:    { params: "arr", doc: "Reverse array" },
  chunk:      { params: "arr, size", doc: "Split array into chunks" },
  unique:     { params: "arr", doc: "Remove duplicate elements" },
  zip:        { params: "...arrays", doc: "Zip multiple arrays together" },
  flatten:    { params: "arr", doc: "Flatten nested arrays" },
  group_by:   { params: "arr, fn", doc: "Group array by key function" },
  cos:        { params: "x", doc: "Cosine of x (radians)" },
  sin:        { params: "x", doc: "Sine of x (radians)" },
  sqrt:       { params: "x", doc: "Square root of x" },
  exp:        { params: "x", doc: "e^x" },
  tensor:     { params: "data", doc: "Create a tensor from nested array" },
  vec:        { params: "...vals", doc: "Create a 1D tensor (vector)" },
  mat:        { params: "rows, cols, value?", doc: "Create a 2D tensor (matrix)" },
  eye:        { params: "n", doc: "Create n×n identity matrix" },
  zeros:      { params: "...dims", doc: "Create tensor filled with zeros" },
  ones:       { params: "...dims", doc: "Create tensor filled with ones" },
  json_parse: { params: "str", doc: "Parse JSON string" },
  json_stringify: { params: "val", doc: "Convert value to JSON string" },
  agent_run:  { params: "agent", doc: "Run an agent" },
}

const keywords = [
  "let", "var", "fn", "match", "if", "else", "true", "false",
  "return", "import", "for", "in", "while", "and", "or", "not",
  "Some", "None", "Ok", "Err", "async", "await", "type", "pub",
  "agent",
]

class LSPConnection {
  constructor() {
    this.buffer = ""
  }

  send(msg) {
    const json = JSON.stringify(msg)
    process.stdout.write(`Content-Length: ${json.length}\r\n\r\n${json}`)
  }

  read() {
    return new Promise((resolve) => {
      const onData = (chunk) => {
        this.buffer += chunk.toString()
        const match = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/)
        if (!match) return
        const length = parseInt(match[1])
        const headerEnd = match.index + match[0].length
        if (this.buffer.length < headerEnd + length) return
        const json = this.buffer.slice(headerEnd, headerEnd + length)
        this.buffer = this.buffer.slice(headerEnd + length)
        process.stdin.removeListener("data", onData)
        resolve(JSON.parse(json))
      }
      process.stdin.on("data", onData)
    })
  }
}

function extractSymbols(ast) {
  const symbols = []
  if (!ast || ast.type !== "Program") return symbols
  for (const node of ast.body) {
    if (node.type === "LetBinding" || node.type === "VarBinding") {
      const line = Math.max(0, (node.line || 1) - 1)
      const col = Math.max(0, (node.col || 1) - 1)
      symbols.push({
        name: node.name,
        kind: 13,
        range: {
          start: { line, character: col },
          end: { line, character: col + node.name.length },
        },
        detail: node.type === "LetBinding" ? "let" : "var",
      })
    } else if (node.type === "FnDef") {
      const line = Math.max(0, (node.line || 1) - 1)
      const col = Math.max(0, (node.col || 1) - 1)
      symbols.push({
        name: node.name,
        kind: 12,
        range: {
          start: { line, character: col },
          end: { line, character: col + node.name.length },
        },
        detail: "fn",
      })
    }
  }
  return symbols
}

function getDiagnostics(source) {
  const diagnostics = []
  try {
    const lexer = new Lexer(source)
    const tokens = lexer.tokenize()
    const parser = new Parser(tokens)
    parser.parseProgram()
  } catch (e) {
    const m = e.message.match(/(LexError|ParseError) at (\d+):(\d+): (.+)/)
    if (m) {
      const line = parseInt(m[2]) - 1
      const col = parseInt(m[3]) - 1
      diagnostics.push({
        range: {
          start: { line, character: Math.max(0, col - 1) },
          end: { line, character: col + 10 },
        },
        severity: 1,
        source: "cognit",
        message: m[4],
      })
    } else {
      diagnostics.push({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        severity: 1,
        source: "cognit",
        message: e.message,
      })
    }
  }
  return diagnostics
}

function getCompletions(source) {
  const items = []
  for (const kw of keywords) {
    items.push({ label: kw, kind: 14, detail: "keyword" })
  }
  for (const [name, info] of Object.entries(builtins)) {
    items.push({
      label: name,
      kind: 3,
      detail: `fn(${info.params})`,
      documentation: info.doc,
    })
  }
  try {
    const lexer = new Lexer(source)
    const tokens = lexer.tokenize()
    const parser = new Parser(tokens)
    const ast = parser.parseProgram()
    for (const sym of extractSymbols(ast)) {
      items.push({ label: sym.name, kind: sym.kind, detail: sym.detail })
    }
  } catch (_) {}
  return items
}

function getHover(source, line, col) {
  const lines = source.split("\n")
  if (line >= lines.length) return null
  const textLine = lines[line]
  if (col > textLine.length) return null
  let start = col
  while (start > 0 && /\w/.test(textLine[start - 1])) start--
  let end = col
  while (end < textLine.length && /\w/.test(textLine[end])) end++
  const word = textLine.slice(start, end)
  if (!word) return null
  const builtin = builtins[word]
  if (builtin) {
    return {
      contents: { kind: "markdown", value: `\`${word}(${builtin.params})\`\n\n${builtin.doc}` },
      range: { start: { line, character: start }, end: { line, character: end } },
    }
  }
  if (keywords.includes(word)) {
    return {
      contents: { kind: "markdown", value: `\`${word}\` — keyword` },
      range: { start: { line, character: start }, end: { line, character: end } },
    }
  }
  return null
}

async function main() {
  const conn = new LSPConnection()

  const init = await conn.read()
  conn.send({
    jsonrpc: "2.0",
    id: init.id,
    result: {
      capabilities: {
        textDocumentSync: { openClose: true, change: 1 },
        completionProvider: { triggerCharacters: [".", " "] },
        hoverProvider: true,
        documentSymbolProvider: true,
      },
      serverInfo: { name: "cognit-lsp", version: "0.1.0" },
    },
  })

  conn.send({ jsonrpc: "2.0", method: "initialized", params: {} })

  while (true) {
    const msg = await conn.read()
    const { method, params, id } = msg

    if (method === "textDocument/didOpen") {
      const uri = params.textDocument.uri
      documents.set(uri, params.textDocument.text)
      conn.send({
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: { uri, diagnostics: getDiagnostics(params.textDocument.text) },
      })
    } else if (method === "textDocument/didChange") {
      const uri = params.textDocument.uri
      const text = params.contentChanges[0].text
      documents.set(uri, text)
      conn.send({
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: { uri, diagnostics: getDiagnostics(text) },
      })
    } else if (method === "textDocument/didClose") {
      documents.delete(params.textDocument.uri)
    } else if (method === "textDocument/completion") {
      const source = documents.get(params.textDocument.uri) || ""
      conn.send({
        jsonrpc: "2.0",
        id,
        result: { isIncomplete: false, items: getCompletions(source) },
      })
    } else if (method === "textDocument/hover") {
      const source = documents.get(params.textDocument.uri) || ""
      conn.send({
        jsonrpc: "2.0",
        id,
        result: getHover(source, params.position.line, params.position.character),
      })
    } else if (method === "textDocument/documentSymbol") {
      const source = documents.get(params.textDocument.uri) || ""
      try {
        const lexer = new Lexer(source)
        const tokens = lexer.tokenize()
        const parser = new Parser(tokens)
        conn.send({ jsonrpc: "2.0", id, result: extractSymbols(parser.parseProgram()) })
      } catch (_) {
        conn.send({ jsonrpc: "2.0", id, result: [] })
      }
    } else if (method === "shutdown") {
      conn.send({ jsonrpc: "2.0", id, result: null })
    } else if (method === "exit") {
      process.exit(0)
    } else if (id !== undefined) {
      conn.send({ jsonrpc: "2.0", id, result: null })
    }
  }
}

main().catch((e) => {
  console.error("LSP Error:", e.message)
  process.exit(1)
})
