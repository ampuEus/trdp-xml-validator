import {
  setupEditor,
  setContentFromFile,
  loadFile,
  clearContent,
} from "./code_editor.js";
import { validate, normalize } from "./xml_management.js";
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import xmlExample from "url:../public/trdp_api/example.xml";
import xsdSchema from "url:../public/trdp_api/trdp-config.xsd";
import { styleIcon } from "./github_icon.js";

async function main() {
  // Load predefined TRDP XSD
  const fileContent = await loadFile(xsdSchema);

  // Start editors
  const xmlEditorView = setupEditor("", "xml-editor");
  const xsdEditorView = setupEditor(fileContent, "xsd-editor");

  // Attach update listener now you have both editors
  const updateListenerExtension = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      validate(xmlEditorView, xsdEditorView);
    }
  });
  xmlEditorView.dispatch({
    effects: StateEffect.appendConfig.of(updateListenerExtension),
  });
  xsdEditorView.dispatch({
    effects: StateEffect.appendConfig.of(updateListenerExtension),
  });

  // Add actions to buttons
  document
    .getElementById("normalize")
    .addEventListener("click", () => normalize(xmlEditorView, xsdEditorView));
  document
    .getElementById("set-xml")
    .addEventListener("click", () =>
      setContentFromFile(xmlEditorView, xmlExample),
    );
  document
    .getElementById("set-xsd")
    .addEventListener("click", () =>
      setContentFromFile(xsdEditorView, xsdSchema),
    );
  document
    .getElementById("clear-xml")
    .addEventListener("click", () => clearContent(xmlEditorView));
  document
    .getElementById("clear-xsd")
    .addEventListener("click", () => clearContent(xsdEditorView));
}

// Reset validation message onload
window.addEventListener(
  "load",
  () => (document.getElementById("messages").value = ""),
);

styleIcon();
main();
