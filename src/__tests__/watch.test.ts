import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerWatchCommand } from '../commands/watch';
import { render } from 'ink';

// Mock process.stdout.write
const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

vi.mock('ink', () => ({
  render: vi.fn(),
}));

vi.mock('../ui/WatchDashboard', () => ({
  WatchDashboard: () => null,
}));

describe('watch command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerWatchCommand(program);
  });

  it('should register watch command', () => {
    const watchCmd = program.commands.find((c) => c.name() === 'watch');
    expect(watchCmd).toBeDefined();
  });

  it('should clear screen and render dashboard on watch', async () => {
    await program.parseAsync(['node', 'test', 'watch']);
    expect(stdoutWriteSpy).toHaveBeenCalledWith('\x1Bc');
    expect(render).toHaveBeenCalled();
  });
});
