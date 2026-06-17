const path = require("path")
const { LanguageClient, TransportKind } = require("vscode-languageclient/node")

let client

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join("..", "src", "lsp", "server.js"))

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  }

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "cognit" }],
    synchronize: { fileEvents: "**/*.cgn" },
  }

  client = new LanguageClient("cognit-lsp", "Cognit Language Server", serverOptions, clientOptions)
  client.start()
}

function deactivate() {
  if (client) return client.stop()
}

module.exports = { activate, deactivate }
