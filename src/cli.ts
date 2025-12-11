#! /usr/bin/env bun
import { program } from "commander";
import { outputTypes, readStructures } from "./structures";
import { outputDataSets } from "./datasets";

program
  .name("noesis2hzw")
  .description("Generate TypeScript files from Noesis project data")
  .version("0.0.1")
  .showHelpAfterError()
  .option("-v, --verbose", "Enable verbose logging")
  .option("-t, --types-only", "Only generate TypeScript type definitions")
  .option("-i, --indent-level <number>", "Number of spaces for indentation", "2")
  .argument("<noesis_project_path>", "Path to the Noesis project root directory (containing the .noesis/data folder)")
  .argument("<output_directory>", "Path to the output directory for generated TypeScript files")
  .argument("[set_name]", "Name of the dataset set to generate (optional, all if omitted)")
  .action(async (noesisProjectPath: string, outputDirectory: string, setName?: string) => {
    const options = program.opts();
    if (options.verbose) {
      console.log("Verbose logging enabled");
    }
    const dataPath = `${noesisProjectPath}/.noesis/data`;;
    const structures = await readStructures(dataPath, options.verbose);
    outputTypes(structures, outputDirectory, options.verbose, options.indentLevel);
    if (!options.typesOnly) {
      await outputDataSets(structures, dataPath, outputDirectory, setName, options.verbose, options.indentLevel);
    }
  });

program.parse();
