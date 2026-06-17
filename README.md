# λ Cognit

**A programming language designed for AI, robotics, and data pipelines.**

Cognit compiles to JavaScript — zero config, instant feedback. Write modern, expressive code that runs anywhere JS runs.

---

## Quick Start

```bash
# Run a Cognit file
cognit run hello.cgn

# Compile to JavaScript
cognit build hello.cgn
```

**[Try Cognit in your browser →](https://mmdj04.github.io/cognit/play.html)**

---

## Features

### Functional Pipes

```cognit
let result = numbers
    |> filter(fn(x) -> x % 2 == 0)
    |> map(fn(x) -> x * x)
    |> reduce(fn(acc, x) -> acc + x, 0)
```

### Pattern Matching

```cognit
fn describe(n) {
    match n {
        0 -> "zero"
        1 -> "one"
        _ -> "many"
    }
}
```

### String Interpolation

```cognit
let name = "Cognit"
print("Hello, {name}!")  # → Hello, Cognit!
```

### Tensor Operations

```cognit
let a = vec(1, 2, 3)
let b = vec(4, 5, 6)
print(a.add(b).data)       # → [5, 7, 9]
print(a.matmul(b).data)    # → 32

let m = mat([[1, 2], [3, 4]])
print(m.matmul(m).data)    # → [[7, 10], [15, 22]]
print(eye(3).data)         # → identity matrix
```

### Agents

```cognit
let assistant = agent {
    model = "gpt-4"
    temperature = 0.7
    instructions = "You are helpful"
}
```

### Expression-oriented

```cognit
let grade = if score >= 90 -> "A"
            else if score >= 80 -> "B"
            else -> "F"
```

---

## Installation

```bash
npm install -g cognit
```

Or run directly with Node.js:

```bash
node src/cli/index.js run hello.cgn
```

---

## Project Structure

```
cognit/
├── src/
│   ├── compiler/     # Lexer, Parser, Generator
│   ├── cli/          # CLI entry point
│   └── runtime/      # Standard library (tensor, agent, JSON, collections)
├── docs/
│   ├── index.html    # Landing page
│   └── play.html     # Online playground
├── examples/         # Example .cgn files
└── package.json
```

---

## Development

```bash
git clone https://github.com/mmdj04/cognit
cd cognit
npm test              # Run test suite
npm start -- run examples/hello.cgn
```

---

## License

MIT © Matheus Moraes
