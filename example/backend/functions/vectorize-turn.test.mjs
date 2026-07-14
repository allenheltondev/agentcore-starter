import { jest } from '@jest/globals';

// Mock the package data-plane and the DDB unmarshaller before importing the SUT.
const putMemoryTurns = jest.fn();
const deleteMemoryKeys = jest.fn();

jest.unstable_mockModule('@readysetcloud/agent/memory', () => ({
  putMemoryTurns,
  deleteMemoryKeys,
  memoryVectorKey: (sessionId, turnId) => `${sessionId}#${turnId}`,
}));
jest.unstable_mockModule('@aws-sdk/util-dynamodb', () => ({
  // Identity unmarshall: tests pass already-plain images.
  unmarshall: (x) => x,
}));
jest.unstable_mockModule('../services/logger.mjs', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { handler } = await import('./vectorize-turn.mjs');

beforeEach(() => {
  putMemoryTurns.mockReset().mockResolvedValue(undefined);
  deleteMemoryKeys.mockReset().mockResolvedValue(undefined);
});

const turn = {
  entity: 'Turn',
  userId: 'user-1',
  sessionId: 'sess-1',
  turnId: '1000-user',
  role: 'user',
  text: 'hello',
  ts: 1000,
};

test('INSERT embeds the turn into memory', async () => {
  await handler({ Records: [{ eventName: 'INSERT', dynamodb: { NewImage: turn } }] });

  expect(putMemoryTurns).toHaveBeenCalledTimes(1);
  expect(putMemoryTurns).toHaveBeenCalledWith([
    { userId: 'user-1', sessionId: 'sess-1', turnId: '1000-user', role: 'user', text: 'hello', ts: 1000 },
  ]);
  expect(deleteMemoryKeys).not.toHaveBeenCalled();
});

test('REMOVE deletes the memory vector by key', async () => {
  await handler({ Records: [{ eventName: 'REMOVE', dynamodb: { OldImage: turn } }] });

  expect(deleteMemoryKeys).toHaveBeenCalledWith(['sess-1#1000-user']);
  expect(putMemoryTurns).not.toHaveBeenCalled();
});

test('ignores non-Turn records defensively', async () => {
  await handler({
    Records: [{ eventName: 'INSERT', dynamodb: { NewImage: { entity: 'Snapshot' } } }],
  });
  expect(putMemoryTurns).not.toHaveBeenCalled();
});
