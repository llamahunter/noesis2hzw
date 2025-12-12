import fs from "fs";
import xml2js from "xml2js";
import { stripPrefix, parseNumbers, parseBooleans } from "xml2js/lib/processors";
import { NoesisBuiltInEnums, NoesisBuiltInSubTypes, noesisSubtypeToTSConverter, type NoesisBuiltIn, type NoesisClass, type NoesisEnum, type NoesisProperty, type NoesisStructureMap, type NoesisType } from "./types";

function processProperty(property: any): NoesisProperty {
  const subTypeParts = property.SubType ? property.SubType.split(".") : [];
  switch (property.Type) {
    case "Object":
      switch (property.SubType) {
        case "Brush":
          return {
            type: "Brush",
          };
        case "ImageSource":
          return {
            type: "Image",
            imageSourcePath: property.ImageSourcePath,
          };
        case "FontFamily":
          return {
            type: "Font",
          };
        default:
          return {
            type: "Object",
            subType: subTypeParts[subTypeParts.length - 1],
          };
      }
    case "Enum":
      return {
        type: "Enum",
        subType: subTypeParts[subTypeParts.length - 1],
      };
    case "String":
      return {
        type: "String",
        stringMinWordCount: property.StringMinWordCount,
        stringMaxWordCount: property.StringMaxWordCount,
      };
    case "Number":
      return {
        type: "Number",
        numberMinValue: property.NumberMinValue,
        numberMaxValue: property.NumberMaxValue,
        numberDecimalCount: property.NumberDecimalCount,
      };
    case "Boolean":
      return {
        type: "Boolean",
      };
    case "Collection":
      return {
        type: "Collection",
        subType: subTypeParts[subTypeParts.length - 1],
      };
    case "Command":
      return {
        type: "Command",
      };
    default:
      throw new Error(`Unknown property type: ${property.Type}`);
  }
}

function processClassStructure(data: any): NoesisClass {
  // process class
  const noesisClass: NoesisClass = {
    type: "Class",
    name: data.Class.Name,
    properties: new Map<string, NoesisProperty>(),
  };
  if (Array.isArray(data.Class.Property)) {
    data.Class.Property.forEach((prop: any) => {
      try {
        const property = processProperty(prop);
        noesisClass.properties.set(prop.Name, property);
      } catch (e) {
        console.error(`Error processing property ${prop.Name} of class ${data.Class.Name}: ${e}`);
      }
    });
  } else {
    try {
      const property = processProperty(data.Class.Property);
      noesisClass.properties.set(data.Class.Property.Name, property);
    } catch (e) {
      console.error(`Error processing property ${data.Class.Property.Name} of class ${data.Class.Name}: ${e}`);
    }
  }
  return noesisClass;
}

function processEnumStructure(data: any): NoesisEnum {
  // process enum
  const noesisEnum: NoesisEnum = {
    type: "Enum",
    name: data.Enum.Name,
    items: new Map<string, number>(),
  };
  data.Enum.Item.forEach((item: any) => {
    noesisEnum.items.set(item.Name, Number(item.Value));
  });
  return noesisEnum;
}

function addBuiltInEnums(structures: NoesisStructureMap) {
  for (const [name, items] of Object.entries(NoesisBuiltInEnums)) {
    const noesisEnum: NoesisEnum = {
      type: "Enum",
      name,
      items: new Map<string, number>(),
    };
    items.forEach((item, index) => {
      noesisEnum.items.set(item, index);
    });
    structures.set(name, noesisEnum);
  }
}

function addBuiltInTypes(structures: NoesisStructureMap) {
  for (const typeName of NoesisBuiltInSubTypes) {
    const noesisBuiltIn: NoesisBuiltIn = {
      type: "BuiltIn",
      name: typeName,
    };
    structures.set(noesisBuiltIn.name, noesisBuiltIn);
  }
}

// read structures
export async function readStructures(dataPath: string, isVerbose: boolean) {
  const structures = new Map<string, NoesisClass | NoesisEnum>();

  addBuiltInTypes(structures);
  addBuiltInEnums(structures);

  // read structures directory
  const structuresDir = dataPath + "/structures";
  if (isVerbose) {
    console.log(`Reading structures from: ${structuresDir}`);
  }
  const structureFiles = fs.readdirSync(structuresDir);
  for (let i = 0; i < structureFiles.length; i++) {
    const file = structureFiles[i];
    if (file?.endsWith(".xml")) {
      if (isVerbose) {
        console.log(`- ${file}`);
      }
      const data = fs.readFileSync(`${structuresDir}/${file}`, "utf8");
      const result = await xml2js.parseStringPromise(data, {
        trim: true,
        mergeAttrs: true,
        explicitArray: false,
        tagNameProcessors: [stripPrefix],
        valueProcessors: [parseNumbers, parseBooleans],
        attrValueProcessors: [parseNumbers, parseBooleans],
      });
      let structure: NoesisClass | NoesisEnum;
      if (result.Class) {
        structure = processClassStructure(result);
      } else if (result.Enum) {
        structure = processEnumStructure(result);
      } else {
        console.error(`Unknown structure type in file: ${file}`);
        continue;
      }
      structures.set(structure.name, structure);
    }
  }
  if (isVerbose) {
    console.log(`Loaded ${structures.size} structures.`);
  }
  return structures;
}

export function outputTypes(structures: NoesisStructureMap, scriptsPath: string, isVerbose: boolean, indentLevel: number) {
  if (isVerbose) {
    console.log(`Writing TypeScript definitions for ${structures.size} Noesis structures to ${scriptsPath}/NoesisTypes.ts`);
  }
  const output = fs.createWriteStream(scriptsPath + "/NoesisTypes.ts");
  output.write(`// Auto-generated TypeScript definitions for Noesis structures\n\n`);
  output.write(`import { ImageSource } from "horizon/ui";\n\n`);
  output.write(`// Complex brushes not yet supported\n`);
  output.write(`export type Brush = never;\n\n`);
  const indent = " ".repeat(indentLevel);
  structures.forEach((structure) => {
    if (isVerbose) {
      console.log(`- ${structure.name}`);
    }
    if (structure.type === "Class") {
      output.write(`// Definition for structure ${structure.name}\n`);
      output.write(`export type ${structure.name} = {\n`);
      structure.properties.forEach((property, propName) => {
        let type: string;
        switch (property.type) {
          case "String":
            type = "string";
            break;
          case "Number":
            type = "number";
            break;
          case "Boolean":
            type = "boolean";
            break;
          case "Command":
            type = "(parameter?: unknown) => unknown";
            break;
          case "Object":
            type = noesisSubtypeToTSConverter(property.subType);
            break;
          case "Image":
            // images can be either relative paths in the Noesis project or ImageSource objects
            type = "string | ImageSource";
            break;
          case "Brush":
            type = "string | Brush";
            break;
          case "Font":
            type = "FontFamily"
            break;
          case "Enum":
            type = noesisSubtypeToTSConverter(property.subType);
            break;
          case "Collection":
            type = `Array<${noesisSubtypeToTSConverter(property.subType)}>`
            break;
        }
        output.write(`${indent}${propName}: ${type};\n`);
      });
      output.write(`}\n\n`);
    } else if (structure.type === "Enum") {
      output.write(`// Definition for enum ${structure.name}\n`);
      output.write(`export enum ${structure.name} {\n`);
      structure.items.forEach((value, itemName) => {
        output.write(`${indent}"${itemName}" = "${itemName}",\n`);
      });
      output.write(`}\n\n`);
    } else if (structure.type === "BuiltIn") {
      // skip built ins
    }
  })
  output.end();
  output.close();
}
