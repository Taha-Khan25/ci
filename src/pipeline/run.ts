import * as scanner from "@nodesecure/scanner";
import type { Scanner } from "@nodesecure/scanner";
import * as vuln from "@nodesecure/vuln";

import { ConfigOptions, standardizeConfig } from "../config/standardize.js";
import { ValueOf } from "../lib/types";
import * as RC from "../nodesecurerc.js";
import {
  InterpretedPayload,
  runPayloadInterpreter
} from "../payload/interpret.js";
import { reportScannerLoggerEvents, runReporter } from "../reporters/index.js";

import * as pipeline from "./run.js";

export const status = {
  SUCCESS: "success",
  FAILURE: "failure"
} as const;

export type Status = ValueOf<typeof status>;

export function getOutcome(result: boolean): Status {
  return result ? status.SUCCESS : status.FAILURE;
}

async function runScannerAnalysis(
  runtimeConfig: RC.Configuration
): Promise<Scanner.Payload> {
  const { strategy } = await vuln.setStrategy(
    vuln.strategies[runtimeConfig.strategy]
  );
  const logger = new scanner.Logger();

  reportScannerLoggerEvents(logger);

  const payload = await scanner.cwd(
    runtimeConfig.rootDir,
    {
      vulnerabilityStrategy: strategy
    },
    logger
  );

  return payload;
}

function provideErrorCodeToProcess() {
  /**
   * Rather than exiting manually with process.exit() which could result in
   * async operations being aborted, we set the exitCode to 1 (native error code).
   * Consequently, the process can exit gracefully when all tasks are done,
   * whatever the exitCode is.
   */
  process.exitCode = 1;
}

async function runPayloadChecks(
  payload: Scanner.Payload,
  rc: RC.Configuration,
  autoExitAfterFailure: boolean
): Promise<Maybe<InterpretedPayload>> {
  const interpretedPayload = runPayloadInterpreter(payload, rc);
  await runReporter(interpretedPayload, rc);

  if (
    interpretedPayload.status === pipeline.status.FAILURE &&
    autoExitAfterFailure
  ) {
    provideErrorCodeToProcess();
  }

  return interpretedPayload;
}

export async function runPipeline(
  options: ConfigOptions & { autoExitAfterFailure: boolean }
): Promise<Maybe<InterpretedPayload>> {
  try {
    const { autoExitAfterFailure = true, ...configOptions } = options;
    const standardizedCliConfig = standardizeConfig(configOptions);
    const runtimeConfig = {
      // For now, the runtime configuration comes from a in-memory constant.
      ...RC.DEFAULT_RUNTIME_CONFIGURATION,
      ...standardizedCliConfig
    } as RC.Configuration;
    const analysisPayload = await runScannerAnalysis(runtimeConfig);

    /**
     * Once the payload generated by the scanner analysis is available, we can
     * now run the interpreter and use the config to determine whether the
     * pipeline should fail or be successful.
     */
    return await runPayloadChecks(
      analysisPayload,
      runtimeConfig,
      autoExitAfterFailure
    );
  } catch {
    provideErrorCodeToProcess();

    return void 0;
  }
}
