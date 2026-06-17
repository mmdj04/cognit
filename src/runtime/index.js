export function print(...args) {
  const formatted = args.map(a => {
    if (typeof a === "object" && a !== null) return JSON.stringify(a)
    return String(a)
  })
  console.log(...formatted)
}

export function map(arr, fn) {
  return arr.map(fn)
}

export function filter(arr, fn) {
  return arr.filter(fn)
}

export function reduce(arr, fn, initial) {
  return arr.reduce(fn, initial)
}

export function range(start, end, step = 1) {
  if (end === undefined) { end = start; start = 0 }
  const result = []
  for (let i = start; i < end; i += step) result.push(i)
  return result
}

export function len(arr) { return arr.length }
export function sum(arr) { return arr.reduce((a, b) => a + b, 0) }
export function first(arr) { return arr[0] }
export function last(arr) { return arr[arr.length - 1] }
export function take(arr, n) { return arr.slice(0, n) }
export function drop(arr, n) { return arr.slice(n) }
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// === Tensor Operations ===

export function tensor(data) {
  if (data && data.__isTensor) return data
  return new Tensor(data)
}

class Tensor {
  constructor(data) {
    this.__isTensor = true
    this.data = data
    this.shape = computeShape(data)
  }

  get(rows, cols) {
    if (cols !== undefined) return this.data[rows][cols]
    return this.data[rows]
  }

  map(fn) {
    return new Tensor(this.data.map((row, i) =>
      Array.isArray(row) ? row.map((v, j) => fn(v, i, j)) : fn(row, i)
    ))
  }

  add(other) {
    if (other instanceof Tensor) other = other.data
    return new Tensor(elementWise(this.data, other, (a, b) => a + b))
  }

  sub(other) {
    if (other instanceof Tensor) other = other.data
    return new Tensor(elementWise(this.data, other, (a, b) => a - b))
  }

  mul(other) {
    if (other instanceof Tensor) other = other.data
    return new Tensor(elementWise(this.data, other, (a, b) => a * b))
  }

  div(other) {
    if (other instanceof Tensor) other = other.data
    return new Tensor(elementWise(this.data, other, (a, b) => a / b))
  }

  matmul(other) {
    if (other instanceof Tensor) other = other.data
    return new Tensor(matrixMultiply(this.data, other))
  }

  transpose() {
    const a = this.data
    if (!Array.isArray(a[0])) return new Tensor(a)
    const result = a[0].map((_, i) => a.map(row => row[i]))
    return new Tensor(result)
  }

  dot(other) {
    return this.mul(other).sum()
  }

  sum() {
    const a = this.data
    if (Array.isArray(a[0])) {
      return a.reduce((s, row) => s + row.reduce((ss, v) => ss + v, 0), 0)
    }
    return a.reduce((s, v) => s + v, 0)
  }

  mean() {
    const a = this.data
    if (Array.isArray(a[0])) {
      return this.sum() / (a.length * a[0].length)
    }
    return this.sum() / a.length
  }

  reshape(...shape) {
    const flat = this.flatten().data
    return new Tensor(reshapeArray(flat, shape))
  }

  flatten() {
    return new Tensor(flattenArray(this.data))
  }

  toString() {
    return JSON.stringify(this.data)
  }
}

function computeShape(data) {
  if (!Array.isArray(data)) return []
  const shape = [data.length]
  if (data.length > 0 && Array.isArray(data[0])) {
    shape.push(data[0].length)
  }
  return shape
}

function elementWise(a, b, op) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((row, i) => elementWise(row, b[i] !== undefined ? b[i] : b, op))
  }
  if (Array.isArray(a)) {
    return a.map(v => op(v, b))
  }
  return op(a, b)
}

function matrixMultiply(a, b) {
  const rows = a.length, cols = b[0].length, inner = b.length
  const result = []
  for (let i = 0; i < rows; i++) {
    result[i] = []
    for (let j = 0; j < cols; j++) {
      let sum = 0
      for (let k = 0; k < inner; k++) {
        sum += a[i][k] * b[k][j]
      }
      result[i][j] = sum
    }
  }
  return result
}

function flattenArray(arr) {
  const result = []
  for (const v of arr) {
    if (Array.isArray(v)) result.push(...flattenArray(v))
    else result.push(v)
  }
  return result
}

function reshapeArray(flat, shape) {
  if (shape.length === 0) return flat[0]
  const size = shape[0]
  const rest = shape.slice(1)
  const result = []
  let idx = 0
  for (let i = 0; i < size; i++) {
    if (rest.length === 0) {
      result.push(flat[idx++])
    } else {
      const subSize = flat.length / size
      result.push(reshapeArray(flat.slice(idx, idx + subSize), rest))
      idx += subSize
    }
  }
  return result
}

export function vec(...args) {
  return new Tensor(args)
}

export function mat(rows) {
  return new Tensor(rows)
}

export function eye(n) {
  const result = []
  for (let i = 0; i < n; i++) {
    result[i] = []
    for (let j = 0; j < n; j++) {
      result[i][j] = i === j ? 1 : 0
    }
  }
  return new Tensor(result)
}

export function zeros(...shape) {
  return fillArray(shape, 0)
}

export function ones(...shape) {
  return fillArray(shape, 1)
}

function fillArray(shape, val) {
  if (shape.length === 0) return val
  const size = shape[0]
  const rest = shape.slice(1)
  const result = []
  for (let i = 0; i < size; i++) {
    result.push(rest.length > 0 ? fillArray(rest, val) : val)
  }
  return result
}

// === JSON Utilities ===

export function json_parse(str) {
  return JSON.parse(str)
}

export function json_stringify(obj, pretty) {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj)
}

// === Agent System ===

export function __cognit_agent__(config) {
  return { __type: "agent", ...config }
}

export function agent_run(agent, input) {
  if (agent.run) return agent.run(input)
  print("[agent] Running:", agent.model || "default")
  print("[agent] Input:", input)
  print("[agent] Instructions:", agent.instructions || "none")
  return { role: "assistant", content: `Processed: ${input}` }
}

// === Collection Utilities ===

export function sort(arr, fn) {
  return [...arr].sort(fn || ((a, b) => a < b ? -1 : a > b ? 1 : 0))
}

export function reverse(arr) {
  return [...arr].reverse()
}

export function chunk(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

export function unique(arr) {
  return [...new Set(arr)]
}

export function zip(...arrays) {
  const min = Math.min(...arrays.map(a => a.length))
  return Array.from({ length: min }, (_, i) => arrays.map(a => a[i]))
}

export function flatten(arr) {
  const result = []
  for (const v of arr) {
    if (Array.isArray(v)) result.push(...flatten(v))
    else result.push(v)
  }
  return result
}

export function group_by(arr, fn) {
  const result = {}
  for (const v of arr) {
    const key = fn(v)
    if (!result[key]) result[key] = []
    result[key].push(v)
  }
  return result
}

// === Math Utilities ===

export let cos = Math.cos
export let sin = Math.sin
export let sqrt = Math.sqrt
export let exp = Math.exp
