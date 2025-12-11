export type NoesisType = "Object" | "Image" | "Brush" | "Font" | "Enum" | "String" | "Number" | "Boolean" | "Collection" | "Command";

export type NoesisProperty =
  | {
      type: "Boolean" | "Command" | "Brush" | "Font";
    }
  | {
      type: "String";
      stringMinWordCount: number;
      stringMaxWordCount: number;
    }
  | {
      type: "Number";
      numberMinValue: number;
      numberMaxValue: number;
      numberDecimalCount: number;
  }
  | {
      type: "Object";
      subType: string;
    }
  | {
      type: "Image";
      imageSourcePath: string;
    }
  | {
      type: "Enum";
      subType: string;
    }
  | {
      type: "Collection";
      subType: string;
    };

export type NoesisClass = {
  type: "Class";
  name: string;
  properties: Map<string, NoesisProperty>;
};

export type NoesisEnum = {
  type: "Enum";
  name: string;
  items: Map<string, number>;
};

export type NoesisBuiltIn = {
  type: "BuiltIn";
  name: string;
}

export const NoesisBuiltInEnums: Record<string, string[]> = {
  Visibility: ["Collapsed", "Visible", "Hidden"],
  Orientation: ["Horizontal", "Vertical"],
  HorizontalAlignment: ["Left", "Center", "Right", "Stretch"],
  VerticalAlignment: ["Top", "Center", "Bottom", "Stretch"],
  TextAlignment: ["Left", "Center", "Right", "Justify"],
  TextWrapping: ["NoWrap", "Wrap", "WrapWithOverflow"],
  TextTrimming: ["None", "CharacterEllipsis", "WordEllipsis"],
  FlowDirection: ["LeftToRight", "RightToLeft"],
  FontFamily: ["Anton", "Bangers", "Oswald", "Roboto", "Roboto-Mono"],
};

export const NoesisBuiltInSubTypes = [
  "Single",
  "Boolean",
  "String",
  "Color",
  "BitmapImage",
  "SolidColorBrush",
  "MessageCommand",
];

export function noesisSubtypeToTSConverter(type: string): string {
  switch (type) {
    case "Single":
      return "number";
    case "String":
      return "string";
    case "Bool":
      return "boolean";
    case "ImageSource":
      return "string | ImageSource";
    case "Brush":
      return "string | Brush";
    case "BaseCommand":
      return "(parameter?: unknown) => unknown";
    default:
      return type;
  }
}

export function noesisSubtypeToNoesisTypeConverter(type: string): string {
  switch (type) {
    case "Bool":
      return "Boolean";
    case "ImageSource":
      return "BitmapImage";
    case "Brush":
      return "SolidColorBrush";
    case "BaseCommand":
      return "MessageCommand";
    default:
      return type;
  }
}

export type NoesisStructureMap = Map<string, NoesisClass | NoesisEnum | NoesisBuiltIn>;