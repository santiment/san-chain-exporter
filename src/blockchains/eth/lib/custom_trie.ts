
import { assertIsDefined } from '../../../lib/utils';
import { Trace } from '../eth_types';


export class TrieNode {
  public children: TrieNode[];
  public traceObject: Trace | null;

  constructor() {
    this.children = [];
    this.traceObject = null;
  }
}

export const PARENT_ERROR = "parent_error";

/**
 * This is a Trie implementation which has knowledge of the data which we put inside it. In a generic trie
 * implementation each node would be just a letter. In this implementation, besides a letter, each node can have
 * an associated ETH trace.
 *
 * For example let's review the trace (simplified):
 *
 * {
 *   "action": {
 *    },
 *   "blockHash": "0x3351f19f7c7b0a7ff0ebde0e469aafd1ab2f80b868bc1fbfbb1f78c0d1a6cb81",
 *   "blockNumber": 15676732,
 *   "result": {
 *     "gasUsed": "0x13a7",
 *     "output": "0x0000000000000000000000000000000000000000000000000000385b32f60f98"
 *   },
 *   "subtraces": 0,
 *   "traceAddress": [
 *     0,
 *     0,
 *     1
 *   ],
 *   "type": "call"
 * }
 *
 *
 * Instead of just producing a trie looking like so:
 *
 *      root
 *       |
 *       0
 *      /
 *     0
 *      \
 *       1
 *
 * we also store the trace object at the leaf.
 *
 * This allows us to execute the command 'mark children with failed parents' in linear time - single pass of the
 * trie. If we have a generic trie implementation instead, there is no way to do this in linear time.
 */

/**
 *
 * @param inputTraces Traces per single transaction
 */
export function markChildrenWithFailedParents(inputTraces: Trace[]): void {
  if (!Array.isArray(inputTraces)) {
    throw new Error(`Expected parameter Array, received ${typeof inputTraces}`);
  }
  if (inputTraces.length === 0) {
    throw new Error('Input traces argument should be non empty');
  }
  if (inputTraces[0].traceAddress.length !== 0) {
    throw new Error(`First trace per tx should be a root trace, we got: ${inputTraces[0]}`);
  }

  // We allow in the traces for a transaction to have multiple root traces. That is a trace where 'traceAddress: []'.
  // When a trace has its traceAddress set (ex: 'traceAddress: [0]'), we associated it with the previous root trace
  // as per the order in the input array.
  const trieRoots: TrieNode[] = [];

  let currentTrieRoot: TrieNode | undefined;

  for (const trace of inputTraces) {
    if (trace.traceAddress.length === 0) {
      currentTrieRoot = new TrieNode();
      currentTrieRoot.traceObject = trace;
      trieRoots.push(currentTrieRoot);
    }
    else {
      assertIsDefined(currentTrieRoot, "Trie root should be available when 'traceAddress[]' is not empty")
      const leafNode: TrieNode = constructTrieFromPathVector(currentTrieRoot, trace.traceAddress);
      leafNode.traceObject = trace;
    }
  }

  for (const trieRoot of trieRoots) {
    markChildrenRecursive(trieRoot, false);
  }
}


/**
 * Return a Trie based on an input. The input should be an array of numbers, each number describes a child.
 *   Example: [0, 1, 0] should be represented as:
 *      root
 *       |
 *       0
 *        \
 *         1
 *        /
 *       0
 *
 * @param trieRoot - Root to attach the newly constructed Trie to
 * @param pathFector - An array of numbers representing a path in the Trie
 * @return - The leaf node constructed. That is the last Node in the vector path.
*/
function constructTrieFromPathVector(trieRoot: TrieNode, pathFector: number[]): TrieNode {
  return pathFector.reduce((previousValue: TrieNode, currentValue: number) => {
    return buildChildIfNotPresent(previousValue, currentValue);
  }, trieRoot)
}

/**
 * Attach a new lief to a Trie node, unless the child is already present
 *
 * @param trieNode A Trie node to potentially attach to
 * @param letter Number representing a step in the path vector
 * @returns The leaf node, either newly constructed or already present
 */
function buildChildIfNotPresent(trieNode: TrieNode, letter: number): TrieNode {
  if (trieNode.children[letter] === undefined) {
    trieNode.children[letter] = new TrieNode();
  }
  return trieNode.children[letter];
}

/**
 * Recursively mark nodes as failed, if their parent is failed
 *
 * @param node The node who's children to consider
 * @param isParentFailed
 */
function markChildrenRecursive(node: TrieNode, isParentFailed: Boolean): void {
  if (isParentFailed && node.traceObject && node.traceObject.error === undefined) {
    node.traceObject.error = 'parent_error';
  }

  const shouldFailChildren = isParentFailed || Boolean(node.traceObject && node.traceObject.error);
  Object.values(node.children).forEach((child: TrieNode) => {
    markChildrenRecursive(child, shouldFailChildren);
  });
}

