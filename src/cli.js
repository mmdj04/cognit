#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from "fs"
import { Lexer } from "./lexer.js"
import { Parser } from "./parser.js"
import { Generator } from "./generator.js"
import * as runtime from "./runtime.js"

function compile(source, filename = "<input>") {
  const lexer = new Lexer(source)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens)
  const ast = parser.parseProgram()
  const generator = new Generator()
  return generator.gen(ast)
}

function runSource(source, filename) {
  const js = compile(source, filename)
  const globals = { ...runtime }
  const fn = new Function(...Object.keys(globals), js)
  fn(...Object.values(globals))
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log("Cognit v0.1.0")
    console.log("Usage: cognit <file> | cognit run <file> | cognit build <file>")
    return
  }

  if (args[0] === "run") {
    const file = args[1]
    if (!file) { console.error("Specify a file to run"); return }
    const source = readFileSync(file, "utf8")
    runSource(source, file)
    return
  }

  if (args[0] === "build" && args[1]) {
    const source = readFileSync(args[1], "utf8")
    const js = compile(source, args[1])
    const outFile = args[2] || args[1].replace(/\.cgn$/, ".js")
    writeFileSync(outFile, js, "utf8")
    console.log(`Built: ${outFile}`)
    return
  }

  if (args[0] === "build" && !args[1]) {
    const files = readdirSync(".").filter(f => f.endsWith(".cgn"))
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      const js = compile(source, file)
      const outFile = file.replace(/\.cgn$/, ".js")
      writeFileSync(outFile, js, "utf8")
      console.log(`Built: ${file} -> ${outFile}`)
    }
    return
  }

  if (args[0] === "--help" || args[0] === "-h") {
    console.log("Cognit v0.1.0 - A programming language for the future of AI")
    console.log("Usage:")
    console.log("  cognit <file>        Run a .cgn file")
    console.log("  cognit run <file>    Run a .cgn file")
    console.log("  cognit build <file>  Compile .cgn to .js")
    console.log("  cognit build         Compile all .cgn files")
    return
  }

  // If file doesn't match known commands, try running it
  if (!args[0].startsWith("-")) {
    try {
      const source = readFileSync(args[0], "utf8")
      runSource(source, args[0])
      return
    } catch (e) {
      console.error(`Error: ${e.message}`)
      return
    }
  }

  console.log(`Usage: cognit <file> | cognit build <file>`)
}

main()
