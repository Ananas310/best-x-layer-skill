// Minimal ABI fragments for ERC-8004 reads + event decoding on X Layer.
// Sourced from github.com/erc-8004/erc-8004-contracts/abis (master).
// We only include the events and view functions the skill actually uses.

export const identityAbi = [
  {
    type: 'function', stateMutability: 'view', name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function', stateMutability: 'view', name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function', stateMutability: 'view', name: 'getAgentWallet',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function', stateMutability: 'view', name: 'name',
    inputs: [], outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'event', name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event', name: 'URIUpdated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
];

export const reputationAbi = [
  {
    type: 'function', stateMutability: 'view', name: 'getSummary',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'decimals', type: 'uint8' },
    ],
  },
  {
    type: 'function', stateMutability: 'view', name: 'getClients',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function', stateMutability: 'view', name: 'getLastIndex',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'client', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'event', name: 'NewFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: false },
      { name: 'score', type: 'int128', indexed: false },
      { name: 'scoreDecimals', type: 'uint8', indexed: false },
      { name: 'tag1', type: 'string', indexed: true },
      { name: 'tag2', type: 'string', indexed: false },
      { name: 'filehash', type: 'string', indexed: false },
      { name: 'fileuri', type: 'string', indexed: false },
      { name: 'uuid', type: 'string', indexed: false },
      { name: 'responseExtHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event', name: 'FeedbackRevoked',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: true },
    ],
  },
];
