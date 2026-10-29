import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
self.MonacoEnvironment = {
  getWorker: () =>
    new Worker(
      new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
      { type: "module" },
    ),
};
loader.config({ monaco });
monaco.languages.register({ id: "kremen", extensions: [".kr", ".krh"] });
monaco.languages.setLanguageConfiguration("kremen", {
  comments: { lineComment: "//", blockComment: ["/*", "*/"] },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
  ],
});
monaco.languages.setMonarchTokensProvider("kremen", {
  keywords: [
    "package",
    "import",
    "extern",
    "type",
    "struct",
    "func",
    "var",
    "const",
    "return",
    "if",
    "else",
    "for",
    "unsafe",
    "break",
    "continue",
    "mut",
    "true",
    "false",
    "defer",
    "catch",
    "arenablock",
    "enum",
    "match",
  ],
  types: [
    "i8",
    "i16",
    "i32",
    "i64",
    "u8",
    "u16",
    "u32",
    "u64",
    "bool",
    "string",
    "arena",
    "file",
    "thread",
  ],
  tokenizer: {
    root: [
      [
        /[a-zA-Z_][\w]*/,
        {
          cases: {
            "@keywords": "keyword",
            "@types": "type",
            "@default": "identifier",
          },
        },
      ],
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [/"([^"\\]|\\.)*"/, "string"],
      [/'([^'\\]|\\.)*'/, "string"],
      [/\b\d+(\.\d+)?\b/, "number"],
      [/[{}()[\]]/, "@brackets"],
      [/[=><!~?:&|+\-*\/%^]+/, "operator"],
    ],
    comment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
  },
});
monaco.languages.registerCompletionItemProvider("kremen", {
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };
    return {
      suggestions: [
        "package",
        "import",
        "extern",
        "type",
        "struct",
        "func",
        "var",
        "const",
        "return",
        "if",
        "else",
        "for",
        "unsafe",
        "break",
        "continue",
        "mut",
        "true",
        "false",
        "defer",
        "catch",
        "arenablock",
        "enum",
        "match",
      ].map((label) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: label,
        range,
        detail: "Kremen keyword",
      })),
    };
  },
});
monaco.editor.defineTheme("kremen-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "EC94BA" },
    { token: "string", foreground: "B1D6AB" },
    { token: "number", foreground: "D8B38F" },
    { token: "type", foreground: "89C4D6" },
    { token: "comment", foreground: "8290A6", fontStyle: "italic" },
  ],
  colors: {
    "editor.background": "#10151F",
    "editor.foreground": "#DDE4EF",
    "editorLineNumber.foreground": "#7D8CA3",
    "editor.lineHighlightBackground": "#18202D",
    "editor.selectionBackground": "#414E6D",
    "editorCursor.foreground": "#F76C88",
  },
});
export { monaco };
