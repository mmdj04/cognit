export class Generator {
  constructor() {
    this.imports = new Map()
  }

  indentStr(n) {
    return "  ".repeat(n)
  }

  gen(node, depth = 0) {
    if (!node) return ""
    switch (node.type) {
      case "Program": return this.genProgram(node, depth)
      case "LetBinding": return this.genLetBinding(node, depth)
      case "VarBinding": return this.genVarBinding(node, depth)
      case "FnDef": return this.genFnDef(node, depth)
      case "FnExpr": return this.genFnExpr(node, depth)
      case "Param": return this.genParam(node, depth)
      case "Block": return this.genBlock(node, depth)
      case "ExprStmt": return this.genExprStmt(node, depth)
      case "Return": return this.genReturn(node, depth)
      case "If": return this.genIf(node, depth)
      case "Match": return this.genMatch(node, depth)
      case "For": return this.genFor(node, depth)
      case "While": return this.genWhile(node, depth)
      case "Import": return this.genImport(node, depth)
      case "Assign": return this.genAssign(node, depth)
      case "BinaryOp": return this.genBinaryOp(node, depth)
      case "UnaryOp": return this.genUnaryOp(node, depth)
      case "Call": return this.genCall(node, depth)
      case "Identifier": return this.genIdentifier(node, depth)
      case "Literal": return this.genLiteral(node, depth)
      case "StringInterpolation": return this.genStringInterpolation(node, depth)
      case "List": return this.genList(node, depth)
      case "Dict": return this.genDict(node, depth)
      case "DictEntry": return this.genDictEntry(node, depth)
      case "Member": return this.genMember(node, depth)
      case "Index": return this.genIndex(node, depth)
      case "Pipe": return this.genPipe(node, depth)
      case "Type": return this.genType(node, depth)
      case "Agent": return this.genAgent(node, depth)
      default:
        return ""
    }
  }

  genLine(str, depth) {
    return this.indentStr(depth) + str + "\n"
  }

  genProgram(node, depth) {
    let out = ""
    const importLines = []
    const otherLines = []

    for (const n of node.nodes) {
      if (n.type === "Import") {
        const source = this.gen(n.source)
        if (n.names) {
          importLines.push(`const { ${n.names.join(", ")} } = require(${source});`)
        } else {
          importLines.push(`require(${source});`)
        }
      } else {
        otherLines.push(this.gen(n, 0))
      }
    }

    if (importLines.length > 0) {
      out += importLines.join("\n") + "\n\n"
    }
    out += otherLines.join("\n")
    return out
  }

  genLetBinding(node, depth) {
    const value = this.gen(node.value, depth)
    let comment = ""
    if (node.typeAnnot) {
      const jsType = this.gen(node.typeAnnot, depth)
      comment = ` // :${jsType}`
    }
    return this.genLine(`const ${node.name} = ${value};${comment}`, depth)
  }

  genVarBinding(node, depth) {
    const value = this.gen(node.value, depth)
    return this.genLine(`let ${node.name} = ${value};`, depth)
  }

  isSingleNodeBlock(body) {
    if (!body || body.type !== "Block") return false
    if (body.nodes.length !== 1) return false
    return true
  }

  getSingleExpr(node) {
    if (node.type === "ExprStmt") return node.expr
    if (node.type === "If" || node.type === "Match") return node
    return null
  }

  genFnDef(node, depth) {
    const params = node.params.map(p => this.gen(p, depth)).join(", ")
    const asyncKw = node.isAsync ? "async " : ""
    let out = this.genLine(`${asyncKw}function ${node.name}(${params}) {`, depth)
    if (this.isSingleNodeBlock(node.body)) {
      const single = node.body.nodes[0]
      if (single.type === "ExprStmt") {
        out += this.genLine(`return ${this.gen(single.expr, depth + 1)};`, depth + 1)
      } else if (single.type === "If" || single.type === "Match") {
        out += this.genLine(`return ${this.gen(single, depth + 1)};`, depth + 1)
      } else {
        out += this.gen(node.body, depth + 1)
      }
    } else {
      out += this.gen(node.body, depth + 1)
    }
    out += this.genLine("}", depth)
    return out
  }

  genFnExpr(node, depth) {
    const params = node.params.map(p => this.gen(p, depth)).join(", ")
    let out = `function(${params}) {\n`
    if (this.isSingleNodeBlock(node.body)) {
      const single = node.body.nodes[0]
      if (single.type === "ExprStmt") {
        out += this.indentStr(depth + 1) + `return ${this.gen(single.expr, depth + 1)};\n`
      } else if (single.type === "If" || single.type === "Match") {
        out += this.indentStr(depth + 1) + `return ${this.gen(single, depth + 1)};\n`
      } else {
        out += this.gen(node.body, depth + 1)
      }
    } else {
      out += this.gen(node.body, depth + 1)
    }
    out += this.indentStr(depth) + "}"
    return out
  }

  genParam(node, depth) {
    return node.name
  }

  genBlock(node, depth) {
    let out = ""
    for (const n of node.nodes) {
      out += this.gen(n, depth)
    }
    return out
  }

  genExprStmt(node, depth) {
    return this.genLine(this.gen(node.expr, depth) + ";", depth)
  }

  genReturn(node, depth) {
    if (node.value) {
      return this.genLine(`return ${this.gen(node.value, depth)};`, depth)
    }
    return this.genLine("return;", depth)
  }

  genIf(node, depth) {
    const allExpr = this.isSingleNodeBlock(node.then) &&
      (!node.else || this.isSingleNodeBlock(node.else)) &&
      node.elifs.every(e => this.isSingleNodeBlock(e.then))

    if (allExpr) {
      if (node.elifs.length === 0) {
        const cond = this.gen(node.condition, depth)
        const thenVal = this.genSingleExprValue(node.then, depth)
        if (node.else) {
          const elseVal = this.genSingleExprValue(node.else, depth)
          return `(${cond} ? ${thenVal} : ${elseVal})`
        }
        return `(${cond} ? ${thenVal} : undefined)`
      }

      let out = this.genLine("(function() {", depth)
      out += this.genLine(`if (${this.gen(node.condition, depth + 1)}) {`, depth + 1)
      out += this.genLine(`return ${this.genSingleExprValue(node.then, depth + 2)};`, depth + 2)
      out += this.genLine("}", depth + 1)
      for (const elif of node.elifs) {
        out += this.genLine(`else if (${this.gen(elif.condition, depth + 1)}) {`, depth + 1)
        out += this.genLine(`return ${this.genSingleExprValue(elif.then, depth + 2)};`, depth + 2)
        out += this.genLine("}", depth + 1)
      }
      if (node.else) {
        out += this.genLine("else {", depth + 1)
        out += this.genLine(`return ${this.genSingleExprValue(node.else, depth + 2)};`, depth + 2)
        out += this.genLine("}", depth + 1)
      }
      out += this.genLine("})()", depth)
      return out
    }

    let out = ""
    out += this.genLine(`if (${this.gen(node.condition, depth)}) {`, depth)
    out += this.genBlockWithReturn(node.then, depth + 1)
    out += this.genLine("}", depth)

    for (const elif of node.elifs) {
      out += this.genLine(`else if (${this.gen(elif.condition, depth)}) {`, depth)
      out += this.genBlockWithReturn(elif.then, depth + 1)
      out += this.genLine("}", depth)
    }

    if (node.else) {
      out += this.genLine("else {", depth)
      out += this.genBlockWithReturn(node.else, depth + 1)
      out += this.genLine("}", depth)
    }

    return out
  }

  genSingleExprValue(node, depth) {
    if (this.isSingleNodeBlock(node) && node.nodes[0].type === "ExprStmt") {
      return this.gen(node.nodes[0].expr, depth)
    }
    return this.gen(node, depth)
  }

  genBlockWithReturn(node, depth) {
    if (this.isSingleNodeBlock(node) && node.nodes[0].type === "ExprStmt") {
      return this.genLine(`return ${this.gen(node.nodes[0].expr, depth)};`, depth)
    }
    return this.gen(node, depth)
  }

  genMatch(node, depth) {
    const expr = this.gen(node.expr, depth)
    let out = this.genLine(`(() => {`, depth)
    out += this.genLine(`const __match_val__ = ${expr};`, depth + 1)
    for (const c of node.cases) {
      out += this.genMatchCase(c, depth + 1)
    }
    out += this.genLine(`})()`, depth)
    return out
  }

  genMatchCase(node) {
    return this.genPatternBranch(node.pattern, node.body, 1)
  }

  genPatternBranch(pattern, body, depth) {
    const bodyCode = this.gen(body, depth)
    switch (pattern.kind) {
      case "Literal":
        return this.genLine(`if (__match_val__ === ${JSON.stringify(pattern.value)}) { return ${bodyCode.trim()}; }`, depth)
      case "Wildcard":
        return this.genLine(`{ return ${bodyCode.trim()}; }`, depth)
      case "Binding":
        return this.genLine(`{ const ${pattern.name} = __match_val__; return ${bodyCode.trim()}; }`, depth)
      case "None":
        return this.genLine(`if (__match_val__ === null || __match_val__ === undefined) { return ${bodyCode.trim()}; }`, depth)
      case "Some":
        return this.genLine(`if (__match_val__ !== null && __match_val__ !== undefined) { const __some_val__ = __match_val__; ${bodyCode.trim()}; }`, depth)
      case "Tuple":
        return this.genLine(`if (Array.isArray(__match_val__)) { ${bodyCode.trim()} }`, depth)
      default:
        return this.genLine(`{ return ${bodyCode.trim()}; }`, depth)
    }
  }

  genFor(node, depth) {
    const iterable = this.gen(node.iterable, depth)
    let out = this.genLine(`for (const ${node.name} of ${iterable}) {`, depth)
    out += this.gen(node.body, depth + 1)
    out += this.genLine("}", depth)
    return out
  }

  genWhile(node, depth) {
    const condition = this.gen(node.condition, depth)
    let out = this.genLine(`while (${condition}) {`, depth)
    out += this.gen(node.body, depth + 1)
    out += this.genLine("}", depth)
    return out
  }

  genImport(node, depth) {
    return ""
  }

  genBinaryOp(node, depth) {
    const left = this.gen(node.left, depth)
    const right = this.gen(node.right, depth)
    return `(${left} ${node.op} ${right})`
  }

  genAssign(node, depth) {
    const targets = node.targets.map(t => this.gen(t, depth)).join(", ")
    const value = this.gen(node.value, depth)
    return `${targets} = ${value}`
  }

  genUnaryOp(node, depth) {
    const operand = this.gen(node.operand, depth)
    return `${node.op}${operand}`
  }

  genCall(node, depth) {
    const callee = this.gen(node.callee, depth)
    const args = node.args.map(a => this.gen(a, depth)).join(", ")
    return `${callee}(${args})`
  }

  genIdentifier(node, depth) {
    return node.name
  }

  genLiteral(node, depth) {
    if (node.literalType === "string") return JSON.stringify(node.value)
    return String(node.value)
  }

  genStringInterpolation(node, depth) {
    const parts = []
    for (let i = 0; i < node.parts.length; i++) {
      if (i % 2 === 0) {
        parts.push(JSON.stringify(node.parts[i]))
      } else {
        parts.push(`String(${this.gen(node.exprs[Math.floor(i / 2)], depth)})`)
      }
    }
    return parts.join(" + ")
  }

  genList(node, depth) {
    const elements = node.elements.map(e => this.gen(e, depth)).join(", ")
    return `[${elements}]`
  }

  genDict(node, depth) {
    const entries = node.entries.map(e => this.gen(e, depth)).join(", ")
    return `{${entries}}`
  }

  genDictEntry(node, depth) {
    return `${this.gen(node.key, depth)}: ${this.gen(node.value, depth)}`
  }

  genMember(node, depth) {
    return `${this.gen(node.obj, depth)}.${node.prop}`
  }

  genIndex(node, depth) {
    return `${this.gen(node.obj, depth)}[${this.gen(node.index, depth)}]`
  }

  genPipe(node, depth) {
    const expr = this.gen(node.expr, depth)
    const fn = node.fn
    if (fn.type === "Call") {
      const args = [this.gen(node.expr, depth), ...fn.args.map(a => this.gen(a, depth))]
      const callee = this.gen(fn.callee, depth)
      return `${callee}(${args.join(", ")})`
    }
    const fnStr = this.gen(node.fn, depth)
    return `${fnStr}(${expr})`
  }

  genType(node, depth) {
    const typeMap = {
      "Int": "number",
      "Float": "number",
      "String": "string",
      "Bool": "boolean",
      "Void": "void",
      "Any": "any",
    }
    if (node.params.length > 0) {
      const inner = node.params.map(p => this.genType(p, depth)).join(", ")
      return `${typeMap[node.name] || node.name}<${inner}>`
    }
    return typeMap[node.name] || node.name
  }

  genAgent(node, depth) {
    const entries = Object.entries(node.config)
    let out = this.genLine(`__cognit_agent__({`, depth)
    for (let i = 0; i < entries.length; i++) {
      const [k, v] = entries[i]
      out += this.indentStr(depth + 1) + `${k}: ${this.gen(v, depth)}` + (i < entries.length - 1 ? "," : "") + "\n"
    }
    out += this.genLine(`})`, depth)
    return out
  }
}
