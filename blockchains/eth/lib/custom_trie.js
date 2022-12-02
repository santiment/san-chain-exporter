
function buildEmptyNode() {
  return {
    children: {},
    traceObject: null
  };
}

const DUMMY_FIRST_NODE = '$';

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
class CustomTrie {
  constructor(inputTraces) {
    if (!Array.isArray(inputTraces)) {
      throw (`Expected parameter Array, received ${typeof input}`);
    }

    this.trieRoot = inputTraces.reduce((rootNode, trace) => {
      const traceAddress = trace.traceAddress.length > 0 ? DUMMY_FIRST_NODE + ' ' + trace.traceAddress.join(' ')
        : DUMMY_FIRST_NODE;
      const leafNode = traceAddress
        .toLowerCase()
        .split(' ')
        .reduce(this.#buildChild, rootNode);

      leafNode.traceObject = trace;

      return rootNode;
    }, buildEmptyNode());
  }

  #buildChild(trieLiefNode, letter) {
    trieLiefNode.children[letter] = trieLiefNode.children[letter] || buildEmptyNode();
    return trieLiefNode.children[letter];
  }

  #markChildrenRecursive(node, isParentFailed) {
    if (isParentFailed && node.traceObject && !node.traceObject['error']) {
      node.traceObject['error'] = 'parent_error';
    }

    const shouldFailChildren = isParentFailed || Boolean(node.traceObject && node.traceObject.error);
    Object.values(node.children).forEach(child => {
      this.#markChildrenRecursive(child, shouldFailChildren);
    });
  }

  markChildrenWithFailedParents() {
    this.#markChildrenRecursive(this.trieRoot, false);
  }
}

module.exports = {
  CustomTrie,
  DUMMY_FIRST_NODE
};
