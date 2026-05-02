import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatCommands } from '../useChatCommands';

const mocks = vi.hoisted(() => {
  const mockAddMessage = vi.fn();
  const mockAddMessageToThread = vi.fn();
  const mockPatchMessage = vi.fn();
  const mockPatchThreadMessage = vi.fn();
  const mockApiFetch = vi.fn();
  const useChatStoreMock = Object.assign(
    () => ({
      addMessage: mockAddMessage,
      addMessageToThread: mockAddMessageToThread,
      patchMessage: mockPatchMessage,
      patchThreadMessage: mockPatchThreadMessage,
    }),
    {
      getState: () => ({ currentThreadId: 'thread-1' }),
    },
  );

  return {
    mockAddMessage,
    mockAddMessageToThread,
    mockPatchMessage,
    mockPatchThreadMessage,
    mockApiFetch,
    useChatStoreMock,
  };
});

vi.mock('@/stores/chatStore', () => ({
  useChatStore: mocks.useChatStoreMock,
}));

vi.mock('@/hooks/useCatData', () => ({
  useCatData: () => ({ cats: [] }),
}));

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mocks.mockApiFetch(...args),
}));

interface HarnessProps {
  onReady: (fn: (input: string, overrideThreadId?: string) => Promise<boolean>) => void;
}

function Harness({ onReady }: HarnessProps) {
  const { processCommand } = useChatCommands();

  React.useEffect(() => {
    onReady(processCommand);
  }, [onReady, processCommand]);

  return null;
}

async function setupProcessCommand(
  root: Root,
): Promise<(input: string, overrideThreadId?: string) => Promise<boolean>> {
  let processCommand: ((input: string, overrideThreadId?: string) => Promise<boolean>) | null = null;

  await act(async () => {
    root.render(
      React.createElement(Harness, {
        onReady: (fn) => {
          processCommand = fn;
        },
      }),
    );
  });

  if (!processCommand) {
    throw new Error('processCommand not initialized');
  }

  return processCommand;
}

beforeAll(() => {
  (globalThis as { React?: typeof React }).React = React;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete (globalThis as { React?: typeof React }).React;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe('useChatCommands /btw', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.mockAddMessage.mockClear();
    mocks.mockAddMessageToThread.mockClear();
    mocks.mockPatchMessage.mockClear();
    mocks.mockPatchThreadMessage.mockClear();
    mocks.mockApiFetch.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('handles /btw locally and calls the side-question endpoint', async () => {
    const processCommand = await setupProcessCommand(root);
    mocks.mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          catId: 'codex',
          catDisplayName: '缅因猫',
          answer: 'F129 是 pack system。',
        }),
    });

    let handled = false;
    await act(async () => {
      handled = await processCommand('/btw F129 是什么？');
    });

    expect(handled).toBe(true);
    expect(mocks.mockApiFetch).toHaveBeenCalledWith('/api/threads/thread-1/side-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'F129 是什么？' }),
    });
    expect(mocks.mockAddMessage).toHaveBeenCalledTimes(1);
    expect(mocks.mockAddMessage.mock.calls[0][0]).toMatchObject({
      type: 'system',
      variant: 'info',
      content: '[btw] 正在旁路询问...',
    });
    expect(mocks.mockPatchMessage).toHaveBeenCalledTimes(1);
    expect(mocks.mockPatchMessage.mock.calls[0][1].content).toContain('[btw → 缅因猫] F129 是什么？');
    expect(mocks.mockPatchMessage.mock.calls[0][1].content).toContain('F129 是 pack system。');
  });

  it('shows usage for /btw without a question', async () => {
    const processCommand = await setupProcessCommand(root);

    let handled = false;
    await act(async () => {
      handled = await processCommand('/btw');
    });

    expect(handled).toBe(true);
    expect(mocks.mockApiFetch).not.toHaveBeenCalled();
    expect(mocks.mockAddMessage.mock.calls[0][0]).toMatchObject({
      type: 'system',
      variant: 'info',
    });
    expect(mocks.mockAddMessage.mock.calls[0][0].content).toContain('用法: /btw <旁路问题>');
  });
});
