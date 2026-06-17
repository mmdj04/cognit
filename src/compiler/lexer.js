const Keywords = new Set([
  "let", "var", "fn", "match", "if", "else", "true", "false",
  "return", "import", "for", "in", "while", "and", "or", "not",
  "Some", "None", "Ok", "Err", "async", "await", "type", "pub",
  "agent",
])

export class Token {
  constructor(type, value, line, col) {
    this.type = type
    this.value = value
    this.line = line
    this.col = col
  }
}

export class Lexer {
  constructor(source) {
    this.source = source
    this.pos = 0
    this.line = 1
    this.col = 1
    this.tokens = []
    this.indentStack = [0]
    this.atLineStart = true
    this.pendingDedents = 0
    this.braceDepth = 0
  }

  error(msg) {
    throw new Error(`LexError at ${this.line}:${this.col}: ${msg}`)
  }

  peek(offset = 0) {
    const i = this.pos + offset
    return i < this.source.length ? this.source[i] : "\0"
  }

  advance() {
    if (this.pos >= this.source.length) return "\0"
    const ch = this.source[this.pos]
    this.pos++
    if (ch === "\n") {
      this.line++
      this.col = 1
    } else {
      this.col++
    }
    return ch
  }

  measureIndent() {
    let indent = 0
    const savedPos = this.pos
    const savedLine = this.line
    const savedCol = this.col
    while (this.pos < this.source.length) {
      const ch = this.peek()
      if (ch === " ") {
        indent++
        this.pos++
        this.col++
      } else if (ch === "\t") {
        indent += 4
        this.pos++
        this.col++
      } else if (ch === "#") {
        while (this.pos < this.source.length && this.peek() !== "\n") {
          this.pos++
        }
      } else if (ch === "\n") {
        indent = 0
        this.pos++
        this.line++
        this.col = 1
      } else if (ch === "\r") {
        this.pos++
      } else {
        break
      }
    }
    const result = { indent, line: this.line, col: this.col }
    this.pos = savedPos
    this.line = savedLine
    this.col = savedCol
    return result
  }

  handleLineStart() {
    if (this.braceDepth > 0) {
      this.atLineStart = false
      return
    }
    const { indent, line, col } = this.measureIndent()
    this.currentIndent = indent
    const top = this.indentStack[this.indentStack.length - 1]

    if (indent > top) {
      this.indentStack.push(indent)
      this.tokens.push(new Token("Indent", indent, line, col))
    } else if (indent < top) {
      while (this.indentStack.length > 1 && indent < this.indentStack[this.indentStack.length - 1]) {
        this.indentStack.pop()
        this.tokens.push(new Token("Dedent", indent, line, col))
      }
      if (indent !== this.indentStack[this.indentStack.length - 1]) {
        this.error(`Indentation mismatch: expected ${this.indentStack[this.indentStack.length - 1]}, got ${indent}`)
      }
    }
    this.atLineStart = false
  }

  readString(quote) {
    let str = ""
    let parts = null
    let inExpr = false
    while (this.pos < this.source.length) {
      const ch = this.advance()
      if (ch === "\\") {
        const next = this.advance()
        const escapes = { n: "\n", t: "\t", r: "\r", '"': '"', "'": "'", "\\": "\\", "{": "{" }
        str += escapes[next] || next
      } else if (ch === quote) {
        if (parts) {
          if (!inExpr) parts.push(str)
          return parts
        }
        return str
      } else if (ch === "\n") {
        this.error("Newline in string literal")
      } else if (ch === "{" && !inExpr) {
        if (parts === null) parts = [str]
        else parts.push(str)
        parts.push("")
        str = ""
        inExpr = true
      } else if (ch === "}" && inExpr) {
        parts[parts.length - 1] = str
        str = ""
        inExpr = false
      } else {
        str += ch
      }
    }
    if (parts) {
      if (!inExpr) parts.push(str)
      return parts
    }
    this.error("Unterminated string")
  }

  readNumber() {
    let num = ""
    let isFloat = false
    while (/[0-9._]/.test(this.peek())) {
      const ch = this.advance()
      if (ch === "_") continue
      if (ch === ".") {
        if (isFloat) this.error("Multiple dots in number")
        isFloat = true
      }
      num += ch
    }
    return isFloat ? parseFloat(num) : parseInt(num, 10)
  }

  readIdentifier() {
    let id = ""
    while (/[a-zA-Z0-9_?!]/.test(this.peek())) {
      id += this.advance()
    }
    return id
  }

  readStringInterpolation() {
    const parts = [""]
    let depth = 0
    while (this.pos < this.source.length) {
      const ch = this.advance()
      if (ch === "\\") {
        const next = this.advance()
        parts[parts.length - 1] += ({ n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\", "{": "{" })[next] || next
      } else if (ch === '"') {
        break
      } else if (ch === "{") {
        if (depth === 0) {
          parts.push("")
          parts.push("")
          depth++
          continue
        }
        parts[parts.length - 1] += ch
      } else if (ch === "}") {
        if (depth === 1) {
          parts.push("")
          depth--
          continue
        }
        parts[parts.length - 1] += ch
      } else {
        parts[parts.length - 1] += ch
      }
    }
    return parts
  }

  skipWhitespaceInline() {
    while (this.pos < this.source.length) {
      const ch = this.peek()
      if (ch === " " || ch === "\t") {
        this.advance()
      } else {
        break
      }
    }
  }

  tokenize() {
    while (this.pos < this.source.length) {
      if (this.atLineStart) {
        this.handleLineStart()
      }

      this.skipWhitespaceInline()
      if (this.pos >= this.source.length) break

      const ch = this.peek()
      const line = this.line
      const col = this.col

      if (ch === "\n") {
        this.advance()
        if (this.tokens.length > 0) {
          const last = this.tokens[this.tokens.length - 1]
          if (last.type !== "Newline" && last.type !== "Indent" && last.type !== "Dedent") {
            this.tokens.push(new Token("Newline", "\n", line, col))
          }
        }
        this.atLineStart = true
        continue
      }

      if (ch === "#") {
        while (this.pos < this.source.length && this.peek() !== "\n") {
          this.advance()
        }
        continue
      }

      if (ch === '"') {
        this.advance()
        const result = this.readString('"')
        if (Array.isArray(result)) {
          this.tokens.push(new Token("StringInterpolation", result, line, col))
        } else {
          this.tokens.push(new Token("String", result, line, col))
        }
        continue
      }

      if (ch === "'") {
        this.advance()
        const str = this.readString("'")
        this.tokens.push(new Token("String", str, line, col))
        continue
      }

      if (ch === "-" && this.peek(1) === ">") {
        this.advance(); this.advance()
        this.tokens.push(new Token("Arrow", "->", line, col))
        continue
      }

      if (ch === "|" && this.peek(1) === ">") {
        this.advance(); this.advance()
        this.tokens.push(new Token("Pipe", "|>", line, col))
        continue
      }

      if (ch === "=" && this.peek(1) === "=") {
        this.advance(); this.advance()
        this.tokens.push(new Token("Eq", "==", line, col))
        continue
      }

      if (ch === "!" && this.peek(1) === "=") {
        this.advance(); this.advance()
        this.tokens.push(new Token("Neq", "!=", line, col))
        continue
      }

      if (ch === "&" && this.peek(1) === "&") {
        this.advance(); this.advance()
        this.tokens.push(new Token("And", "&&", line, col))
        continue
      }

      if (ch === "|" && this.peek(1) === "|") {
        this.advance(); this.advance()
        this.tokens.push(new Token("Or", "||", line, col))
        continue
      }

      if (ch === ">") {
        if (this.peek(1) === "=") {
          this.advance(); this.advance()
          this.tokens.push(new Token("Gte", ">=", line, col))
        } else {
          this.advance()
          this.tokens.push(new Token("Gt", ">", line, col))
        }
        continue
      }

      if (ch === "<") {
        if (this.peek(1) === "=") {
          this.advance(); this.advance()
          this.tokens.push(new Token("Lte", "<=", line, col))
        } else {
          this.advance()
          this.tokens.push(new Token("Lt", "<", line, col))
        }
        continue
      }

      if (ch === "*" && this.peek(1) === "*") {
        this.advance(); this.advance()
        this.tokens.push(new Token("Op", "**", line, col))
        continue
      }
      if (ch === "@") {
        this.advance()
        this.tokens.push(new Token("Op", "@", line, col))
        continue
      }
      if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%") {
        this.advance()
        this.tokens.push(new Token("Op", ch, line, col))
        continue
      }

      if (ch === "{") {
        this.advance()
        this.braceDepth++
        this.tokens.push(new Token("{", "{", line, col))
        continue
      }
      if (ch === "}") {
        this.advance()
        this.braceDepth--
        this.tokens.push(new Token("}", "}", line, col))
        continue
      }
      if ("()[]:,.;".includes(ch)) {
        this.advance()
        this.tokens.push(new Token(ch, ch, line, col))
        continue
      }

      if (ch === "=") {
        this.advance()
        this.tokens.push(new Token("Assign", "=", line, col))
        continue
      }

      if (ch === "!") {
        this.advance()
        this.tokens.push(new Token("Not", "!", line, col))
        continue
      }

      if (/[0-9]/.test(ch)) {
        const val = this.readNumber()
        const type = Number.isInteger(val) ? "Int" : "Float"
        this.tokens.push(new Token(type, val, line, col))
        continue
      }

      if (/[a-zA-Z_]/.test(ch)) {
        const id = this.readIdentifier()
        if (Keywords.has(id)) {
          if (id === "true" || id === "false") {
            this.tokens.push(new Token("Bool", id === "true", line, col))
          } else {
            this.tokens.push(new Token(id, id, line, col))
          }
        } else {
          this.tokens.push(new Token("Identifier", id, line, col))
        }
        continue
      }

      this.error(`Unexpected character '${ch}'`)
    }

    while (this.indentStack.length > 1) {
      this.indentStack.pop()
      this.tokens.push(new Token("Dedent", null, this.line, this.col))
    }
    this.tokens.push(new Token("EOF", null, this.line, this.col))
    return this.tokens
  }
}
