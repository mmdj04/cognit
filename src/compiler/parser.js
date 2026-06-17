import { Lexer } from "./lexer.js"

export class ASTNode {
  constructor(type, ...props) {
    this.type = type
    Object.assign(this, ...props)
  }
}

export class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.pos = 0
  }

  error(msg) {
    const t = this.peek()
    throw new Error(`ParseError at ${t ? t.line + ":" + t.col : "EOF"}: ${msg}`)
  }

  peek(offset = 0) {
    const i = this.pos + offset
    return i < this.tokens.length ? this.tokens[i] : null
  }

  isAt(type, value) {
    const t = this.peek()
    return t && t.type === type && (value === undefined || t.value === value)
  }

  expect(type, value) {
    const t = this.peek()
    if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
      const got = t ? `${t.type}(${t.value})` : "EOF"
      const want = value !== undefined ? `${type}(${value})` : type
      throw new Error(`ParseError at ${t ? t.line + ":" + t.col : "EOF"}: Expected ${want}, got ${got}`)
    }
    return this.advance()
  }

  advance() {
    return this.tokens[this.pos++]
  }

  skipNewlines() {
    while (this.isAt("Newline") || this.isAt(";")) {
      this.advance()
    }
  }

  skipAll() {
    while (this.isAt("Newline") || this.isAt("Indent") || this.isAt("Dedent")) {
      this.advance()
    }
  }

  skipToPipe() {
    while (this.isAt("Newline") || this.isAt("Indent")) {
      this.advance()
    }
  }

  // Check if we're at end of statement (Newline, Dedent, EOF)
  atEndOfStatement() {
    return this.isAt("Newline") || this.isAt("Dedent") || this.isAt("EOF") || this.isAt(")") || this.isAt(";")
  }

  parseProgram() {
    const nodes = []
    this.skipNewlines()
    while (!this.isAt("EOF")) {
      const stmt = this.parseStatement()
      if (stmt) nodes.push(stmt)
      this.skipNewlines()
    }
    return new ASTNode("Program", { nodes })
  }

  parseStatement() {
    if (this.isAt("let")) return this.parseLetBinding()
    if (this.isAt("var")) return this.parseVarBinding()
    if (this.isAt("fn")) return this.parseFnDef()
    if (this.isAt("return")) return this.parseReturn()
    if (this.isAt("if")) return this.parseIf()
    if (this.isAt("match")) return this.parseMatch()
    if (this.isAt("for")) return this.parseFor()
    if (this.isAt("while")) return this.parseWhile()
    if (this.isAt("import")) return this.parseImport()
    if (this.isAt("agent")) return this.parseAgent()
    if (this.isAt("pub")) {
      this.advance()
      const stmt = this.parseStatement()
      if (stmt) stmt.pub = true
      return stmt
    }
    return this.parseExpressionStatement()
  }

  parseExpressionStatement() {
    const expr = this.parseExpression()
    if (!expr) {
      if (this.isAt("Assign")) {
        this.advance()
        const value = this.parseExpression()
        return new ASTNode("ExprStmt", { expr: new ASTNode("Assign", { targets: [], value }) })
      }
      const tok = this.peek()
      if (tok) this.error(`Unexpected token '${tok.value}'`)
      return null
    }
    return new ASTNode("ExprStmt", { expr })
  }

  parseLetBinding() {
    this.advance()
    const name = this.expect("Identifier").value
    let typeAnnot = null
    if (this.isAt(":")) {
      this.advance()
      typeAnnot = this.parseType()
    }
    this.expect("Assign")
    while (this.isAt("Newline") || this.isAt("Indent")) this.advance()
    const value = this.parseExpression()
    return new ASTNode("LetBinding", { name, typeAnnot, value })
  }

  parseVarBinding() {
    this.advance()
    const name = this.expect("Identifier").value
    let typeAnnot = null
    if (this.isAt(":")) {
      this.advance()
      typeAnnot = this.parseType()
    }
    this.expect("Assign")
    while (this.isAt("Newline") || this.isAt("Indent")) this.advance()
    const value = this.parseExpression()
    return new ASTNode("VarBinding", { name, typeAnnot, value })
  }

  parseFnDef() {
    this.advance()
    let isAsync = false
    if (this.isAt("async")) {
      this.advance()
      isAsync = true
    }
    const name = this.expect("Identifier").value
    this.expect("(")
    const params = []
    while (!this.isAt(")") && !this.isAt("EOF")) {
      this.skipNewlines()
      const paramName = this.expect("Identifier").value
      let paramType = null
      if (this.isAt(":")) {
        this.advance()
        paramType = this.parseType()
      }
      params.push(new ASTNode("Param", { name: paramName, typeAnnot: paramType }))
      if (this.isAt(",")) {
        this.advance()
        this.skipNewlines()
      }
    }
    this.expect(")")
    let returnType = null
    if (this.isAt(":")) {
      this.advance()
      returnType = this.parseType()
    }
    const body = this.parseBlockOrExpr()
    return new ASTNode("FnDef", { name, params, returnType, body, isAsync })
  }

  parseFnExpr() {
    this.advance()
    this.expect("(")
    const params = []
    while (!this.isAt(")") && !this.isAt("EOF")) {
      this.skipNewlines()
      const paramName = this.expect("Identifier").value
      let paramType = null
      if (this.isAt(":")) {
        this.advance()
        paramType = this.parseType()
      }
      params.push(new ASTNode("Param", { name: paramName, typeAnnot: paramType }))
      if (this.isAt(",")) {
        this.advance()
        this.skipNewlines()
      }
    }
    this.expect(")")
    const body = this.parseBlockOrExpr()
    return new ASTNode("FnExpr", { params, body })
  }

  parseReturn() {
    this.advance()
    if (this.atEndOfStatement()) {
      return new ASTNode("Return", { value: null })
    }
    const value = this.parseExpression()
    return new ASTNode("Return", { value })
  }

  parseIf() {
    this.advance()
    const condition = this.parseExpression()
    this.skipNewlines()
    const then = this.parseBlockOrExpr()
    const elifs = []
    let elseBlock = null
    this.skipNewlines()
    while (this.isAt("else")) {
      this.advance()
      if (this.isAt("if")) {
        this.advance()
        const elifCond = this.parseExpression()
        this.skipNewlines()
        const elifBody = this.parseBlockOrExpr()
        elifs.push(new ASTNode("If", { condition: elifCond, then: elifBody, elifs: [], else: null }))
        this.skipNewlines()
      } else {
        this.skipNewlines()
        elseBlock = this.parseBlockOrExpr()
        break
      }
    }
    return new ASTNode("If", { condition, then, elifs, else: elseBlock })
  }

  parseMatch() {
    this.advance()
    const expr = this.parseExpression()
    this.skipNewlines()
    return new ASTNode("Match", { expr, cases: this.parseMatchCases() })
  }

  parseMatchCases() {
    const braceStyle = this.isAt("{")
    if (braceStyle) {
      this.advance()
      this.skipNewlines()
    } else {
      this.expect("Indent")
    }
    const endToken = braceStyle ? "}" : "Dedent"
    const cases = []
    while (!this.isAt(endToken) && !this.isAt("EOF")) {
      this.skipNewlines()
      if (this.isAt(endToken)) break
      const pattern = this.parsePattern()
      this.expect("Arrow")
      const body = this.parseExpression()
      cases.push(new ASTNode("MatchCase", { pattern, body }))
      this.skipNewlines()
    }
    if (braceStyle) {
      this.expect("}")
    } else {
      this.expect("Dedent")
    }
    return cases
  }

  parsePattern() {
    if (this.isAt("Identifier") && this.peek().value === "None") {
      this.advance()
      return new ASTNode("Pattern", { kind: "None" })
    }
    if (this.isAt("Identifier") && this.peek().value === "Some") {
      this.advance()
      this.expect("(")
      const inner = this.parsePattern()
      this.expect(")")
      return new ASTNode("Pattern", { kind: "Some", inner })
    }
    if (this.isAt("Identifier") && this.peek().value === "Ok") {
      this.advance()
      this.expect("(")
      const inner = this.parsePattern()
      this.expect(")")
      return new ASTNode("Pattern", { kind: "Ok", inner })
    }
    if (this.isAt("Identifier") && this.peek().value === "Err") {
      this.advance()
      this.expect("(")
      const inner = this.parsePattern()
      this.expect(")")
      return new ASTNode("Pattern", { kind: "Err", inner })
    }
    if (this.isAt("(")) {
      this.advance()
      const patterns = []
      while (!this.isAt(")") && !this.isAt("EOF")) {
        patterns.push(this.parsePattern())
        if (this.isAt(",")) this.advance()
      }
      this.expect(")")
      return new ASTNode("Pattern", { kind: "Tuple", patterns })
    }
    if (this.isAt("_")) {
      this.advance()
      return new ASTNode("Pattern", { kind: "Wildcard" })
    }
    if (this.isAt("Int") || this.isAt("Float") || this.isAt("String") || this.isAt("Bool")) {
      const lit = this.advance()
      return new ASTNode("Pattern", { kind: "Literal", value: lit.value })
    }
    if (this.isAt("Identifier")) {
      const ident = this.advance()
      return new ASTNode("Pattern", { kind: "Binding", name: ident.value })
    }
    throw new Error(`ParseError at ${this.peek()?.line}:${this.peek()?.col}: Unexpected pattern`)
  }

  parseFor() {
    this.advance()
    const name = this.expect("Identifier").value
    this.expect("in")
    const iterable = this.parseExpression()
    this.skipNewlines()
    const body = this.parseBlockOrExpr()
    return new ASTNode("For", { name, iterable, body })
  }

  parseWhile() {
    this.advance()
    const condition = this.parseExpression()
    this.skipNewlines()
    const body = this.parseBlockOrExpr()
    return new ASTNode("While", { condition, body })
  }

  parseImport() {
    this.advance()
    const source = this.expect("String").value
    let names = null
    if (this.isAt(":")) {
      this.advance()
      names = []
      while (!this.atEndOfStatement() && !this.isAt("EOF")) {
        names.push(this.expect("Identifier").value)
        if (this.isAt(",")) this.advance()
      }
    }
    return new ASTNode("Import", { source, names })
  }

  parseAgent() {
    this.advance()
    let name = null
    if (this.isAt("String")) {
      name = this.advance().value
    }
    this.expect("{")
    this.skipNewlines()
    const config = {}
    while (!this.isAt("}") && !this.isAt("EOF")) {
      const key = this.expect("Identifier").value
      this.skipNewlines()
      this.expect("Assign")
      this.skipNewlines()
      config[key] = this.parseExpression()
      this.skipNewlines()
    }
    this.expect("}")
    return new ASTNode("Agent", { name, config })
  }

  parseType() {
    const name = this.expect("Identifier").value
    if (this.isAt("<")) {
      this.advance()
      const params = [this.parseType()]
      while (this.isAt(",")) {
        this.advance()
        params.push(this.parseType())
      }
      this.expect(">")
      return new ASTNode("Type", { name, params })
    }
    if (this.isAt("[")) {
      this.advance()
      const inner = this.parseType()
      this.expect("]")
      return new ASTNode("Type", { name: "Array", params: [inner] })
    }
    return new ASTNode("Type", { name, params: [] })
  }

  parseBlockOrExpr() {
    if (this.isAt("Indent")) {
      return this.parseBlock()
    }
    if (this.isAt("{")) {
      return this.parseBraceBlock()
    }
    if (this.isAt("Arrow")) {
      this.advance()
      if (this.isAt("{")) {
        return this.parseBraceBlock()
      }
      const expr = this.parseExpression()
      return new ASTNode("Block", { nodes: [new ASTNode("ExprStmt", { expr })], singleExpr: true })
    }
    const expr = this.parseExpression()
    return new ASTNode("Block", { nodes: [new ASTNode("ExprStmt", { expr })], singleExpr: true })
  }

  parseBlock() {
    this.expect("Indent")
    const nodes = []
    this.skipNewlines()
    while (!this.isAt("Dedent") && !this.isAt("EOF")) {
      const stmt = this.parseStatement()
      if (stmt) nodes.push(stmt)
      this.skipNewlines()
    }
    this.expect("Dedent")
    return new ASTNode("Block", { nodes, singleExpr: false })
  }

  parseBraceBlock() {
    this.expect("{")
    const nodes = []
    this.skipNewlines()
    while (!this.isAt("}") && !this.isAt("EOF")) {
      const stmt = this.parseStatement()
      if (stmt) nodes.push(stmt)
      this.skipNewlines()
    }
    this.expect("}")
    return new ASTNode("Block", { nodes, singleExpr: false })
  }

  // Expression parsing with precedence climbing
  parseExpression(allowStatement = false) {
    while (this.isAt("Newline") || this.isAt("Indent")) this.advance()
    let expr = this.parsePrimary()
    if (!expr) return null

    while (true) {
      // Handle assignment
      if (this.isAt("Assign")) {
        const targets = [expr]
        this.advance()
        const value = this.parseExpression()
        expr = new ASTNode("Assign", { targets, value })
        continue
      }

      // Handle pipe - skip newlines/indents between expression and pipe
      if (this.isAt("Newline") || this.isAt("Indent")) {
        this.skipToPipe()
        continue
      }
      if (this.isAt("Dedent")) {
        this.advance()
        continue
      }
      if (this.isAt("Pipe")) {
        this.advance()
        const fn = this.parsePipeFn()
        expr = new ASTNode("Pipe", { expr, fn })
        continue
      }

      // Handle binary operators
      if (this.isAt("or")) {
        this.advance()
        const right = this.parsePrimary()
        expr = new ASTNode("BinaryOp", { left: expr, op: "or", right })
        continue
      }

      if (this.isAt("and")) {
        this.advance()
        const right = this.parsePrimary()
        expr = new ASTNode("BinaryOp", { left: expr, op: "and", right })
        continue
      }

      if (this.isAt("Eq") || this.isAt("Neq") || this.isAt("Gt") || this.isAt("Lt") || this.isAt("Gte") || this.isAt("Lte")) {
        const op = this.advance()
        const right = this.parsePrimary()
        expr = new ASTNode("BinaryOp", { left: expr, op: op.value, right })
        continue
      }

      if (this.isAt("Op")) {
        const op = this.advance()
        const right = this.parsePrimary()
        expr = new ASTNode("BinaryOp", { left: expr, op: op.value, right })
        continue
      }

      break
    }

    return expr
  }

  parsePipeFn() {
    if (this.isAt("Identifier")) {
      const name = this.advance().value
      if (this.isAt("(")) {
        this.advance()
        const args = []
        while (!this.isAt(")") && !this.isAt("EOF")) {
          args.push(this.parseExpression())
          if (this.isAt(",")) this.advance()
        }
        this.expect(")")
        return new ASTNode("Call", { callee: new ASTNode("Identifier", { name }), args })
      }
      if (this.isAt("(")) {
        this.advance()
        const args = []
        while (!this.isAt(")") && !this.isAt("EOF")) {
          args.push(this.parseExpression())
          if (this.isAt(",")) this.advance()
        }
        this.expect(")")
        return new ASTNode("Call", { callee: new ASTNode("Identifier", { name }), args })
      }
      return new ASTNode("Identifier", { name })
    }
    if (this.isAt("fn")) {
      return this.parseFnExpr()
    }
    throw new Error(`ParseError at ${this.peek()?.line}:${this.peek()?.col}: Expected function in pipe`)
  }

  parsePrimary() {
    this.skipNewlines()

    if (this.isAt("Int") || this.isAt("Float")) {
      const tok = this.advance()
      return new ASTNode("Literal", { value: tok.value, literalType: tok.type === "Int" ? "int" : "float" })
    }

    if (this.isAt("String")) {
      const tok = this.advance()
      return new ASTNode("Literal", { value: tok.value, literalType: "string" })
    }

    if (this.isAt("Bool")) {
      const tok = this.advance()
      return new ASTNode("Literal", { value: tok.value, literalType: "bool" })
    }

    if (this.isAt("StringInterpolation")) {
      const tok = this.advance()
      const parts = tok.value
      const exprs = []
      for (let i = 1; i < parts.length; i += 2) {
        const exprSource = parts[i]
        const subLexer = new Lexer(exprSource)
        const subTokens = subLexer.tokenize()
        const subParser = new Parser(subTokens)
        const expr = subParser.parseExpression()
        exprs.push(expr || new ASTNode("Identifier", { name: exprSource }))
      }
      return new ASTNode("StringInterpolation", { parts, exprs })
    }

    if (this.isAt("Identifier")) {
      const tok = this.advance()
      let expr = new ASTNode("Identifier", { name: tok.value })

      // Handle call chains
      while (true) {
        if (this.isAt("(")) {
          this.advance()
          const args = []
          while (!this.isAt(")") && !this.isAt("EOF")) {
            this.skipNewlines()
            args.push(this.parseExpression())
            if (this.isAt(",")) this.advance()
          }
          this.expect(")")
          expr = new ASTNode("Call", { callee: expr, args })
          continue
        }
        if (this.isAt(".")) {
          this.advance()
          const prop = this.expect("Identifier").value
          expr = new ASTNode("Member", { obj: expr, prop })
          continue
        }
        if (this.isAt("[")) {
          this.advance()
          const index = this.parseExpression()
          this.expect("]")
          expr = new ASTNode("Index", { obj: expr, index })
          continue
        }
        break
      }
      return expr
    }

    if (this.isAt("(")) {
      this.advance()
      const expr = this.parseExpression()
      this.expect(")")
      return expr
    }

    if (this.isAt("[")) {
      this.advance()
      const elements = []
      this.skipAll()
      while (!this.isAt("]") && !this.isAt("EOF")) {
        const expr = this.parseExpression()
        if (expr) elements.push(expr)
        this.skipAll()
        if (this.isAt(",")) {
          this.advance()
          this.skipAll()
        }
      }
      this.expect("]")
      return new ASTNode("List", { elements })
    }

    if (this.isAt("{")) {
      return this.parseDictOrBraceBlock()
    }

    if ((this.isAt("Op") && this.peek().value === "-") || this.isAt("Not") || this.isAt("!")) {
      const tok = this.advance()
      const operand = this.parsePrimary()
      return new ASTNode("UnaryOp", { op: tok.value === "not" ? "!" : tok.value, operand })
    }

    if (this.isAt("fn")) {
      return this.parseFnExpr()
    }

    if (this.isAt("if")) {
      return this.parseIf()
    }

    if (this.isAt("match")) {
      return this.parseMatch()
    }

    if (this.isAt("not")) {
      this.advance()
      const operand = this.parsePrimary()
      return new ASTNode("UnaryOp", { op: "!", operand })
    }

    if (this.isAt("agent")) {
      return this.parseAgent()
    }

    return null
  }

  parseDictOrBraceBlock() {
    this.advance()
    this.skipNewlines()
    if (this.isAt("}")) {
      this.advance()
      return new ASTNode("Dict", { entries: [] })
    }
    const first = this.parseExpression()
    if (this.isAt(":")) {
      this.advance()
      const entries = []
      entries.push(new ASTNode("DictEntry", { key: first, value: this.parseExpression() }))
      while (this.isAt(",")) {
        this.advance()
        this.skipNewlines()
        if (this.isAt("}")) break
        const key = this.parseExpression()
        this.expect(":")
        const value = this.parseExpression()
        entries.push(new ASTNode("DictEntry", { key, value }))
      }
      this.skipNewlines()
      this.expect("}")
      return new ASTNode("Dict", { entries })
    }
    // It's a brace block
    const nodes = [new ASTNode("ExprStmt", { expr: first })]
    this.skipNewlines()
    while (!this.isAt("}") && !this.isAt("EOF")) {
      const stmt = this.parseStatement()
      if (stmt) nodes.push(stmt)
      this.skipNewlines()
    }
    this.expect("}")
    return new ASTNode("Block", { nodes, singleExpr: false })
  }
}
