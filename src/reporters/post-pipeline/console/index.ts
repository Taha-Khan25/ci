import { performance } from "perf_hooks";

import ms from "pretty-ms";

import { consolePrinter } from "../../../lib/console-printer/index.js";
import * as RC from "../../../nodesecurerc.js";
import { OutcomePayloadFromPipelineChecks } from "../../../payload/interpret.js";
import { Reporter } from "../../reporter.js";

import { printPipelineOutcome } from "./outcome.js";
import { reportDependencyVulns } from "./vulnerabilities.js";
import { reportGlobalWarnings, reportDependencyWarnings } from "./warnings.js";

function printPipelineStart(): void {
  consolePrinter.util
    .concatOutputs([
      consolePrinter.font.highlight("@nodesecure/ci").bold().underline()
        .message,
      consolePrinter.font.standard("Pipeline checks started").bold().message
    ])
    .print();
}

function printEndPipeline(endedAt: number): void {
  consolePrinter.util
    .concatOutputs([
      consolePrinter.font.highlight("@nodesecure/ci").bold().underline()
        .message,
      consolePrinter.font.standard("Pipeline checks ended").bold().message,
      consolePrinter.font
        .info(`${ms(endedAt)}`)
        .italic()
        .bold().message
    ])
    .print();
}

export const consoleReporter: Reporter<
  OutcomePayloadFromPipelineChecks & RC.Configuration
> = {
  type: RC.reporterTarget.CONSOLE,
  report({ data, status, warnings }) {
    const startedAt = performance.now();
    printPipelineStart();

    reportGlobalWarnings(data.warnings);
    reportDependencyWarnings(
      data.dependencies.warnings,
      // For now, we are only dealing with union types
      warnings as RC.Warnings
    );
    reportDependencyVulns(data.dependencies.vulnerabilities);

    const endedAt = performance.now() - startedAt;
    printEndPipeline(endedAt);
    printPipelineOutcome(data, status, warnings as RC.Warnings);
  }
};