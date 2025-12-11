import fs from "node:fs";
import xml2js from "xml2js";
import util from "node:util";
import { stripPrefix, parseNumbers, parseBooleans } from "xml2js/lib/processors";
import { noesisSubtypeToNoesisTypeConverter, type NoesisProperty, type NoesisStructureMap, type NoesisType } from "./types";

function processCommand(indent: string, commandData: any, indentLevel: number): string {
  const subIndent = indent + " ".repeat(indentLevel);
  return `(parameter?: unknown) => {\n` +
    `${subIndent}console.log("${commandData.Message}", parameter ? parameter : "");\n` +
    `${indent}}`;
}

function processArray(structures: NoesisStructureMap, indent: string, itemType: string, itemsData: any[], indentLevel: number): string {
  let result = "";
  const subIndent = indent + " ".repeat(indentLevel);
  itemsData.forEach((itemData) => {
    const itemString = `${subIndent}${processDataStructure(structures, subIndent, itemType, itemData, indentLevel)}`;
    result += `${itemString},\n`;
  });
  return result;
}

function escapeString(str: string): string {
  return str.replace(/"/g, '\\"');
} 

function processDataStructure(structures: NoesisStructureMap, indent: string, structureType: string, data: any, indentLevel: number): string {
  let result = "";
  const structureNameParts = structureType.split(".");
  const structureName = structureNameParts[structureNameParts.length - 1]!;
  const structure = structures.get(structureName);
  if (structure?.type === "Class") {
    result += "{\n";
    const subIndent = indent + " ".repeat(indentLevel);
    structure.properties.forEach((property, propName) => {
      // process each property in the data
      let value: string | undefined;
      const propValue = data[propName];
      const objectPropValue = data[`${structureName}.${propName}`];
      switch (property.type) {
        case "String": {
          if (propValue) {
            value = `"${escapeString(data[propName][0])}"`;
          } else {
            value = `""`;
          }
          break;
        }
        case "Number": {
          if (propValue) {
            value = `${data[propName][0]}`;
          } else {
            value = "0";
          }
          break;
        }
        case "Boolean": {
          if (propValue) {
            value = `${data[propName][0]}`;
          } else {
            value = "false";
          }
          break;
        }
        case "Enum": {
          if (propValue) {
            // XXX should we just emit the literal string value here?
            value = `${property.subType}.${data[propName]}`;
            //value = `"${propValue[0]}"`;
          } else {
            value = `undefined as any as ${property.subType}`; // XXX should we allow enums to be undefined?
          }
          break;
        }
        case "Font": {
          if (propValue) {
            value = `FontFamily.${data[propName][0]}`;
          } else {
            value = "FontFamily.Bangers";
          }
          break;
        }
        case "Object": {
          if (objectPropValue) {
            const structureData = objectPropValue[0][property.subType][0];
            value = `${processDataStructure(structures, subIndent, property.subType, structureData, indentLevel)}`;
          } else {
            value = `undefined as any as ${property.subType}`; // XXX should we allow objects to be undefined?
          }
          break;
        }
        case "Image": {
          if (propValue) {
            const imageSource = propValue[0];
            const imagePathParts = (imageSource as string).split(";", 2);
            const imagePath = imagePathParts[1]?.replace("component/", "");
            if (imagePath) {
              value = `"${imagePath}"`;
            } else {
              console.warn(`Image path not found for property ${propName} of structure ${structureName}: ${imageSource}`);
              value = `""`;
            }
          } else {
            value = `""`;
          }
          break;
        }
        case "Brush": {
          if (propValue) {
            value = `"${propValue[0]}"`;
          } else {
            value = `""`;
          }
          break;
        }
        case "Collection": {
          if (objectPropValue) {
            const collectionType = noesisSubtypeToNoesisTypeConverter(property.subType);
            const itemsData = objectPropValue[0][collectionType];
            if (Array.isArray(itemsData)) {
              value = `[\n${processArray(structures, subIndent, collectionType, itemsData, indentLevel)}${subIndent}]`;
            } else {
              console.warn(`Expected array for collection property ${propName} type ${collectionType} of structure ${structureName}\n${util.inspect(data, { depth: null })}`);
              value = `[]`;
            }
          } else {
            value = `[]`;
          }
          break;
        }
        case "Command": {
          if (objectPropValue) {
            const commandData = objectPropValue[0]
            if (commandData["MessageCommand"]) {
              value = processCommand(subIndent, commandData["MessageCommand"][0], indentLevel);
            } else {
              console.warn(`Unknown command type for property ${propName} of structure ${structureName}: ${commandData}`);
              value = "() => { console.warn('Command type not recognized'); }";
            }
          } else {
            value = "() => { console.warn('Command not defined'); }";
          }
          break;
        }
      }
      result += `${subIndent}${propName}: ${value},\n`;
    });
    result += `${indent}}`;
  } else if (structure?.type === "Enum") {
    result = `${structure.name}.${data}`;
  } else if (structure?.type === "BuiltIn") {
    switch (structure.name) {
      case "Single":
        result = `${data}`
        break;
      case "Boolean":
        result = `${data}`;
        break;
      case "String":
        result = `"${escapeString(data)}"`;
        break;
      case "Color":
        result = `${data}`;
        break;
      case "BitmapImage": {
        const imageSource = data["UriSource"][0];
        const imagePathParts = (imageSource as string).split(";", 2);
        const imagePath = imagePathParts[1]?.replace("component/", "");
        if (imagePath) {
          result = `"${imagePath}"`;
        } else {
          console.warn(`Image path not found fo built-in structure ${structureName}: ${imageSource}`);
        }
        break;
      }
      case "SolidColorBrush": {
        result = `"${data["Color"][0]}"`;
        break;
      }
      case "MessageCommand": {
        result = processCommand(indent, data, indentLevel);
        break;
      }
      default:
        console.error("Unknown built-in:", structure.name);
    }
  } else {
    console.error(`Unknown structure type for data: ${structureName}`);
  }
  return result;
}

export async function outputDataSets(structures: NoesisStructureMap, dataPath: string, scriptPath: string, setName: string | undefined, isVerbose: boolean, indentLevel: number) {
  if (isVerbose) {
    console.log(`Writing Data Sets to ${scriptPath}`);
  }
  // read data sets
  const dataDir = dataPath + "/sets";
  const dataFiles = setName ? [setName + ".xaml"] : fs.readdirSync(dataDir).filter(file => file?.endsWith(".xaml"));

  for (let i = 0; i < dataFiles.length; i++) {
    const file = dataFiles[i]!;
    if (isVerbose) {
      console.log(`- reading ${file}`);
    }
    const data = fs.readFileSync(`${dataDir}/${file}`, "utf8");
    const result = await xml2js.parseStringPromise(data, {
      trim: true,
      mergeAttrs: true,
      explicitArray: true,
      tagNameProcessors: [stripPrefix],
      valueProcessors: [parseNumbers, parseBooleans],
      attrValueProcessors: [parseNumbers, parseBooleans],
    });
    const structureType = Object.keys(result)[0]!;
    const dataSet = processDataStructure(structures, "", structureType, result[structureType], indentLevel);
  
    const tsFile = file.replace(".xaml", ".ts");
    if (isVerbose) {
      console.log(`- writing ${tsFile}`);
    }
    const output = fs.createWriteStream(scriptPath + "/" + tsFile);
    output.write(`// Auto-generated data context from Noesis data set: ${file}\n\n`);
    const imports = Array.from(structures.values().filter(value => value.type !== "BuiltIn").map(value => value.name));
    output.write(`import { ${imports.join(", ")} } from "./NoesisTypes";\n\n`);
    output.write(`export const dataContext: ${structureType} = ${dataSet};\n`);
    output.end();
    output.close();
  }
}