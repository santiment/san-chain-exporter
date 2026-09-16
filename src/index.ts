'use strict';
import { logger } from './lib/logger';
import { BLOCKCHAIN } from './lib/constants';
import { getBoolEnvVariable } from './lib/utils';
import { Main } from './main'


let mainInstance: Main;

export async function main() {
  mainInstance = new Main();

  try {
    if (BLOCKCHAIN === undefined) {
      throw Error("'BLOCKCHAIN' variable need to be defined")
    }
    await mainInstance.init(BLOCKCHAIN);
  } catch (err: any) {
    logger.error(err.stack);
    throw new Error(`Error initializing exporter: ${err.message}`);
  }
  try {
    await mainInstance.workLoop();
    await mainInstance.disconnect();
    logger.info('Bye!');
  } catch (err: any) {
    logger.error(err.stack);
    throw new Error(`Error in exporter work loop: ${err.message}`);
  }
}

if (!getBoolEnvVariable('TEST_ENV', false)) {
  process.on('SIGINT', () => {
    mainInstance.stop();
  });
  process.on('SIGTERM', () => {
    mainInstance.stop();
  });

  process.on('unhandledRejection', (reason: unknown, p: Promise<unknown>): void => {
    // Otherwise unhandled promises are not possible to trace with the information logged
    if (reason instanceof Error) {
      logger.error('Unhandled Rejection at: ', p, 'reason:', reason, 'error stack:', reason.stack);
    }
    else {
      logger.error('Unhandled Rejection at: ', p, 'reason:', reason);
    }
    // Throwing here will trigger an uncaughtException and crash the process.
    throw reason;
  });

  main().catch((err: any) => {
    // The underlying error (with its stack) has already been logged by main(). Log the wrapping message and exit
    // with a failure code, so that the orchestrator restarts the exporter.
    logger.error(err.message);
    process.exit(1);
  });
}


