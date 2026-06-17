import { Lexer } from "../src/compiler/lexer.js"
import { Parser } from "../src/compiler/parser.js"
import { Generator } from "../src/compiler/generator.js"
import * as runtime from "../src/runtime/index.js"

let passed = 0
let failed = 0

function test(name, src, expected) {
  try {
    const tokens = new Lexer(src).tokenize()
    const ast = new Parser(tokens).parseProgram()
    const js = new Generator().gen(ast)
    const outputs = []
    const testRuntime = {
      ...runtime,
      print(...args) {
        outputs.push(args.map(a => typeof a === "object" && a !== null ? JSON.stringify(a) : String(a)).join(" "))
      }
    }
    const fn = new Function(...Object.keys(testRuntime), js)
    fn(...Object.values(testRuntime))
    const got = outputs.join("\n")
    if (expected !== undefined && got !== expected) {
      console.log(`FAIL: ${name}`)
      console.log(`  expected: ${expected}`)
      console.log(`  got:      ${got}`)
      failed++
    } else {
      passed++
    }
  } catch (e) {
    console.log(`FAIL: ${name} — ${e.message}`)
    failed++
  }
}

// === Core Language ===
test("hello world", `print("hello")`, `hello`)
test("let binding", `let x = 42\nprint(x)`, `42`)
test("fn definition", `fn add(a,b) -> a + b\nprint(add(2,3))`, `5`)
test("string interpolation", `let n = "Cognit"\nprint("Hello, {n}!")`, `Hello, Cognit!`)

// === Pipes ===
test("pipe basic", `range(1,4) |> sum |> print`, `6`)
test("pipe chain", `range(1,6) |> filter(fn(x)->x%2==0) |> map(fn(x)->x*x) |> print`, `[4,16]`)

// === Pattern Matching ===
test("match", `fn f(n) { match n { 0 -> "a" _ -> "b" } }\nprint(f(0))`, `a`)

// === If/Else ===
test("if expr", `let x = if 1 > 0 -> "yes" else -> "no"\nprint(x)`, `yes`)

// === For ===
test("for loop", `let s = 0\nfor i in range(1,4) { s = s + i }\nprint(s)`, `6`)

// === Semicolons ===
test("semicolons", `let x = 1; let y = 2; print(x + y)`, `3`)

// === Exponentiation ===
test("exponentiation", `print(2 ** 10)`, `1024`)

// === Tensor ===
test("vec add", `let a = vec(1,2,3); print(a.add([4,5,6]).data)`, `[5,7,9]`)
test("matrix mul", `let m = mat([[1,2],[3,4]]); print(m.matmul(m).data)`, `[[7,10],[15,22]]`)
test("identity", `print(eye(3).data)`, `[[1,0,0],[0,1,0],[0,0,1]]`)
test("tensor sum", `let t = tensor([1,2,3]); print(t.sum())`, `6`)

// === Collections ===
test("sort", `print(sort([3,1,2]))`, `[1,2,3]`)
test("reverse", `print(reverse([1,2,3]))`, `[3,2,1]`)
test("chunk", `print(chunk([1,2,3,4], 2))`, `[[1,2],[3,4]]`)
test("unique", `print(unique([1,2,2,3]))`, `[1,2,3]`)

// === Agent ===
test("agent", `let a = agent { model = "t" }\nprint(a.model)`, `t`)

// === JSON ===
test("json stringify", `print(json_stringify({"a":1}))`, `{"a":1}`)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
