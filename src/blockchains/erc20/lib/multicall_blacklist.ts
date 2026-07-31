import { logger } from '../../../lib/logger';

/**
 * Tracks ERC20 contracts whose 'balanceOf' consistently fails with a clean on-chain revert (the
 * request carrying the call succeeded). After 'failureThreshold' consecutive contract-wide
 * failures a contract is blacklisted and its balance requests are skipped. A success before the
 * threshold is reached resets the count.
 *
 * The state is in-memory only: a blacklisted contract stays skipped for the lifetime of the
 * process and gets re-evaluated from scratch on restart.
 */
export class MulticallBlacklist {
  private readonly failureThreshold: number;
  private consecutiveFailures: Map<string, number> = new Map();
  private blacklisted: Set<string> = new Set();

  constructor(failureThreshold: number) {
    this.failureThreshold = failureThreshold;
  }

  // Record that every queried address of the contract failed to resolve, with all failures being
  // clean on-chain reverts.
  recordAllFailed(contract: string, blockNumber: number) {
    const failures = (this.consecutiveFailures.get(contract) ?? 0) + 1;
    if (failures >= this.failureThreshold) {
      this.consecutiveFailures.delete(contract);
      this.blacklisted.add(contract);
      logger.info(`Blacklisting contract ${contract} at block ${blockNumber} after ` +
        `${this.failureThreshold} consecutive contract-wide multicall failures`);
    }
    else {
      this.consecutiveFailures.set(contract, failures);
    }
  }

  // Record that at least one queried address of the contract resolved successfully.
  recordCleanResult(contract: string) {
    this.consecutiveFailures.delete(contract);
  }

  isBlacklisted(contract: string): boolean {
    return this.blacklisted.has(contract);
  }
}
