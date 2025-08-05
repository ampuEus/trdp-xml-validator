import { validateXML } from "xmllint-wasm/index-browser.mjs";
import {
  addErrorDecoration,
  clearEditorErrors,
  getContent,
} from "./code_editor.js";

function setStatus(xmlEditor, valid, messages, errorLine = null) {
  const elem = document.getElementById("messages");
  elem.style.backgroundColor = valid ? "" : "red";
  elem.value = messages;
  if (xmlEditor && errorLine) {
    addErrorDecoration(xmlEditor, errorLine, messages);
  }
}

function parseXmlErrors(errors) {
  return errors && errors.length
    ? errors
        .map((err) => `Line ${err.loc?.lineNumber || "?"}: ${err.message}`)
        .join("\n")
    : "Unknown error";
}

function setXml(xmlEditor, xmlNormalized) {
  if (xmlEditor) {
    xmlEditor.dispatch({
      changes: {
        from: 0,
        to: xmlEditor.state.doc.length,
        insert: xmlNormalized,
      },
    });
  }
}

async function validateXml(xmlEditor, xsdEditor, wantNormalize) {
  const xml = getContent(xmlEditor);
  const xsd = getContent(xsdEditor);

  const config = {
    xml: { fileName: "default.xml", contents: xml },
    schema: { fileName: "default.xsd", contents: xsd },
    normalization: wantNormalize ? "format" : "",
  };

  // Validate XML and destructure result for clarity
  // eslint-disable-next-line init-declarations, one-var
  let errors, valid, normalized;
  try {
    ({ errors, valid, normalized } = await validateXML(config));
  } catch (err) {
    setStatus(xmlEditor, false, `Validation error: ${err.message || err}`);
    clearEditorErrors(xmlEditor);
    return null;
  }

  clearEditorErrors(xmlEditor);

  // Attempt to extract error line and message if invalid
  if (!valid) {
    const allMsgs = parseXmlErrors(errors);
    setStatus(xmlEditor, false, allMsgs);
    if (xmlEditor && errors) {
      for (const err of errors) {
        if (err.loc?.lineNumber) {
          addErrorDecoration(xmlEditor, err.loc.lineNumber, err.message);
        }
      }
    }
    if (wantNormalize) {
      setStatus(
        xmlEditor,
        false,
        "The XML is invalid, it can't be normalized.",
      );
    }
    return valid;
  }
  setStatus(xmlEditor, true, "");

  if (wantNormalize && normalized) {
    setXml(xmlEditor, normalized);
  }
  return valid;
}

function hasUniqueId(element, attribute, data) {
  const seen = new Set();
  for (const item of data) {
    if (item.element === element && item.ids.hasOwnProperty(attribute)) {
      const value = item.ids[attribute];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
    }
  }
  return true;
}

// Output example:
// [
//   {"telegram": "21000", "issues": "OK"},
//   {"telegram": "11010", "issues": ["data-set-id '1102' not found"]}
// ]
function telegramReferencesExist(elements) {
  // Collect all valid data-set ids and com-parameter ids
  const dataSetIds = new Set(
    elements
      .filter((item) => item.element === "data-set" && item.ids.id)
      .map((item) => item.ids.id),
  );
  const comParameterIds = new Set(
    elements
      .filter((item) => item.element === "com-parameter" && item.ids.id)
      .map((item) => item.ids.id),
  );
  // Validate each telegram’s references
  const results = [];
  const permittedProblems = 0;
  elements.forEach((item) => {
    if (item.element === "telegram") {
      const problems = [];
      // Check data-set-id
      if (item.ids["data-set-id"] && !dataSetIds.has(item.ids["data-set-id"])) {
        problems.push(`data-set-id '${item.ids["data-set-id"]}' not found`);
      }
      // Check com-parameter-id
      if (
        item.ids["com-parameter-id"] &&
        !comParameterIds.has(item.ids["com-parameter-id"])
      ) {
        problems.push(
          `com-parameter-id '${item.ids["com-parameter-id"]}' not found`,
        );
      }
      results.push({
        telegram: item.ids["com-id"] || "?",
        issues: problems.length === permittedProblems ? "OK" : problems,
      });
    }
  });
  return results;
}

// Output example:
// [
//   {element: "bus-interface", ids: {"network-id": "1"}},
//   {element: "telegram", ids: {
//     "com-id": "21000",
//     "data-set-id": "2100",
//     "com-parameter-id": "1",
//   }},
//   {element: "source", ids: {id: "1"}},
//   {element: "telegram", ids: {
//     "com-id": "11010",
//     "data-set-id": "1101",
//     "com-parameter-id": "1",
//   }},
//   {element: "destination", ids: {id: "1"}},
//   // etc.
// ]
function getIds(xmlEditor) {
  const xml = getContent(xmlEditor);
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  const allElements = xmlDoc.getElementsByTagName("*");
  const elements = [];
  const minIds = 1;

  for (const elem of allElements) {
    const ids = {};
    for (const attr of elem.attributes) {
      if (attr.name.endsWith("id")) {
        ids[attr.name] = attr.value;
      }
    }
    // Only include elements that have at least one id attribute
    if (Object.keys(ids).length >= minIds) {
      elements.push({
        element: elem.tagName,
        ids: ids,
      });
    }
  }
  return elements;
}

function validateIds(xmlEditor) {
  const elements = getIds(xmlEditor);

  // First check if all elements have unique id
  let uniqueIdErrMsg = "";
  if (!hasUniqueId("bus-interface", "network-id", elements)) {
    uniqueIdErrMsg += "Two or more 'bus-interface' have same 'network-id'.\n";
  }
  if (!hasUniqueId("telegram", "com-id", elements)) {
    uniqueIdErrMsg += "Two or more 'telegram' have same 'com-id'.\n";
  }
  if (!hasUniqueId("com-parameter", "id", elements)) {
    uniqueIdErrMsg += "Two or more 'com-parameter' have same 'id'.\n";
  }
  if (!hasUniqueId("data-set", "id", elements)) {
    uniqueIdErrMsg += "Two or more 'data-set' have same 'id'.\n";
  }
  if (uniqueIdErrMsg !== "") {
    setStatus(xmlEditor, false, uniqueIdErrMsg);
    return false;
  }

  // Second check all telegrams id references to other elements
  let referenceErrMsg = "";
  const telegramResults = telegramReferencesExist(elements);
  for (const result of telegramResults) {
    if (result.issues !== "OK") {
      referenceErrMsg += `Telegram '${result.telegram}': ${Array.isArray(result.issues) ? result.issues.join("; ") : result.issues}\n`;
    }
  }
  if (referenceErrMsg !== "") {
    setStatus(xmlEditor, false, referenceErrMsg);
    return false;
  }
  return true;
}

export async function validate(xmlEditor, xsdEditor) {
  const isValid = await validateXml(xmlEditor, xsdEditor, false);
  if (!isValid) {
    return;
  }
  validateIds(xmlEditor);
}

export async function normalize(xmlEditor, xsdEditor) {
  await validateXml(xmlEditor, xsdEditor, true);
}
