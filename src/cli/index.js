#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from "fs"
import { createInterface } from "readline"
import { Lexer } from "../compiler/lexer.js"
import { Parser } from "../compiler/parser.js"
import { Generator } from "../compiler/generator.js"
import * as runtime from "../runtime/index.js"

function formatError(source, msg, filename) {
  const match = msg.match(/(LexError|ParseError) at (\d+):(\d+): (.+)/)
  if (!match) return `Error: ${msg}`
  const [, type, lineStr, colStr, detail] = match
  const line = parseInt(lineStr)
  const col = parseInt(colStr)
  const lines = source.split("\n")
  let out = `\n  ${filename || "<input>"}:${line}:${col}\n`
  if (line >= 1 && line <= lines.length) {
    out += `  ${lines[line - 1]}\n`
    out += `  ${" ".repeat(Math.max(0, col - 1))}^\n`
  }
  out += `  ${type}: ${detail}`
  return out
}

function compile(source, filename = "<input>") {
  const lexer = new Lexer(source)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens)
  const ast = parser.parseProgram()
  const generator = new Generator()
  return generator.gen(ast)
}

function compileSafe(source, filename) {
  try {
    const js = compile(source, filename)
    return { js, error: null }
  } catch (e) {
    return { js: null, error: formatError(source, e.message, filename) }
  }
}

function runSource(source, filename) {
  const { js, error } = compileSafe(source, filename)
  if (error) {
    console.error(error)
    process.exit(1)
  }
  const globals = { ...runtime }
  try {
    const fn = new Function(...Object.keys(globals), js)
    fn(...Object.values(globals))
  } catch (e) {
    console.error(`\nRuntime Error: ${e.message}`)
    process.exit(1)
  }
}

function repl() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " })
  console.log("Cognit REPL v0.1.0 (type .exit to quit)")
  rl.prompt()
  rl.on("line", (input) => {
    const trimmed = input.trim()
    if (trimmed === "" || trimmed.startsWith("#")) { rl.prompt(); return }
    if (trimmed === ".exit") { rl.close(); return }
    const { js, error } = compileSafe(trimmed, "<repl>")
    if (error) {
      console.error(error)
    } else if (js.trim()) {
      try {
        const fn = new Function(...Object.keys(runtime), js)
        fn(...Object.values(runtime))
      } catch (e) {
        console.error("Runtime Error:", e.message)
      }
    }
    rl.prompt()
  })
  rl.on("close", () => console.log())
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    repl()
    return
  }

  if (args[0] === "run") {
    const file = args[1]
    if (!file) { console.error("Error: specify a file to run"); return }
    const source = readFileSync(file, "utf8")
    runSource(source, file)
    return
  }

  if (args[0] === "build" && args[1]) {
    const source = readFileSync(args[1], "utf8")
    const { js, error } = compileSafe(source, args[1])
    if (error) { console.error(error); process.exit(1); return }
    const outFile = args[2] || args[1].replace(/\.cgn$/, ".js")
    writeFileSync(outFile, js, "utf8")
    console.log(`Built: ${outFile}`)
    return
  }

  if (args[0] === "build" && !args[1]) {
    const files = readdirSync(".").filter(f => f.endsWith(".cgn"))
    if (files.length === 0) { console.log("No .cgn files found"); return }
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      const { js, error } = compileSafe(source, file)
      if (error) { console.error(error); continue }
      const outFile = file.replace(/\.cgn$/, ".js")
      writeFileSync(outFile, js, "utf8")
      console.log(`Built: ${file} -> ${outFile}`)
    }
    return
  }

  if (args[0] === "--help" || args[0] === "-h") {
    console.log("Cognit v0.1.0")
    console.log("Usage:")
    console.log("  cognit               Start REPL")
    console.log("  cognit <file>        Run a .cgn file")
    console.log("  cognit run <file>    Run a .cgn file")
    console.log("  cognit build <file>  Compile .cgn to .js")
    console.log("  cognit build         Compile all .cgn files")
    return
  }

  if (!args[0].startsWith("-")) {
    try {
      const source = readFileSync(args[0], "utf8")
      runSource(source, args[0])
      return
    } catch (e) {
      console.error(formatError("", e.message, args[0]))
      return
    }
  }
}

main()
