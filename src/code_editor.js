import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { xml } from "@codemirror/lang-xml";

function isDarkTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function systemThemeExtension() {
  return isDarkTheme() ? oneDark : [];
}

export function setupEditor(initialXml = "", domElementId = "") {
  return new EditorView({
    doc: initialXml,
    extensions: [basicSetup, xml(), systemThemeExtension(), decorationsField],
    parent: document.getElementById(domElementId),
  });
}

export async function loadFile(file) {
  try {
    const response = await fetch(file);
    return await response.text();
  } catch (err) {
    console.error("Error:", err);
  }
  return null;
}

export async function setContentFromFile(editorView, filepath) {
  const content = await loadFile(filepath);
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: content },
  });
}

export function getContent(editor) {
  return editor ? editor.state.doc.toString() : "";
}

export function clearContent(editorView) {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: "" },
  });
}

// ********************* //
//       DECOTATORS      //
// ********************* //
// Create an effect for updating decorations
const setDecorations = StateEffect.define();

// A StateField to hold current decorations
const decorationsField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    for (const err of tr.effects) {
      if (err.is(setDecorations)) return err.value;
    }
    if (tr.docChanged) deco = deco.map(tr.changes);
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Create "error style" decoration for a whole line
function errorLineDeco(line, themeStyles) {
  return Decoration.line({ attributes: { style: themeStyles.line } }).range(
    line.from,
  );
}

// WidgetType for message display
class ErrorWidget extends WidgetType {
  constructor(message, themeStyles) {
    super();
    this.message = message;
    this.themeStyles = themeStyles;
  }
  toDOM() {
    const el = document.createElement("span");
    el.textContent = ` ⟶ ${this.message}`;
    el.style = this.themeStyles.widget; // Style string, e.g. "color: red; ..."
    return el;
  }
}

// Message widget decoration to show the message **inline**
function errorMessageWidget(line, message, themeStyles) {
  return Decoration.widget({
    widget: new ErrorWidget(message, themeStyles),
    side: 1,
  }).range(line.to); // Shows at the end of the line
}

// Add an error decoration to a specific line
export function addErrorDecoration(view, lineNumber, message) {
  const themeStyles = isDarkTheme()
    ? {
        line: "background: #442222;",
        widget: "color: #ff6666; padding-left: .5em; font-size: 0.8em",
      }
    : {
        line: "background: #fee;",
        widget: "color: red; padding-left: .5em; font-size: 0.8em",
      };
  const line = view.state.doc.line(lineNumber);
  const lineDeco = errorLineDeco(line, themeStyles);
  const widgetDeco = errorMessageWidget(line, message, themeStyles);

  const current = view.state.field(decorationsField, false) || Decoration.none;
  const newSet = current.update({
    add: [lineDeco, widgetDeco],
    sort: true,
  });

  view.dispatch({
    effects: setDecorations.of(newSet),
  });
}

// Clear all decorations
export function clearEditorErrors(view) {
  view.dispatch({
    effects: setDecorations.of(Decoration.none),
    EditorErrors() {
      view.dispatch({
        effects: setDecorations.of(Decoration.none),
      });
    },
  });
}
