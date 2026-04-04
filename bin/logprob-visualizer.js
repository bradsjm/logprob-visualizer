#!/usr/bin/env node

import { formatHelpText, parseCliArgs, startServer } from "../runtime/server.js";

async function main() {
  let options;

  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(formatHelpText());
    process.exitCode = 1;
    return;
  }

  if (options.showHelp) {
    console.log(formatHelpText());
    return;
  }

  try {
    const result = await startServer(options);
    console.log(`Logprob Visualizer running at ${result.url}`);

    if (options.openBrowser && !result.browserOpened) {
      console.warn("Browser auto-open failed. Open the URL manually.");
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? `Failed to start Logprob Visualizer: ${error.message}`
        : "Failed to start Logprob Visualizer.",
    );
    process.exitCode = 1;
  }
}

main();
