import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerConfigCommand } from '../commands/config';
import { setConfig, getConfig, clearConfig } from '../utils/config';

vi.mock('../utils/config', () => ({
  setConfig: vi.fn(),
  getConfig: vi.fn(() => ({})),
  clearConfig: vi.fn(),
}));

describe('config command', () => {
  let program: Command;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerConfigCommand(program);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should register config set, list, and clear commands', () => {
    const configCmd = program.commands.find((c) => c.name() === 'config');
    expect(configCmd).toBeDefined();
    expect(configCmd?.commands.map((c) => c.name())).toEqual(['set', 'list', 'clear']);
  });

  it('should call setConfig on config set', async () => {
    await program.parseAsync(['node', 'test', 'config', 'set', 'alert_email', 'test@test.com']);
    expect(setConfig).toHaveBeenCalledWith('alert_email', 'test@test.com');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Set alert_email to test@test.com'));
  });

  it('should parse integer for alert_cooldown', async () => {
    await program.parseAsync(['node', 'test', 'config', 'set', 'alert_cooldown', '123']);
    expect(setConfig).toHaveBeenCalledWith('alert_cooldown', 123);
  });

  it('should call getConfig on config list', async () => {
    (getConfig as any).mockReturnValue({ alert_cooldown: 100 });
    await program.parseAsync(['node', 'test', 'config', 'list']);
    expect(getConfig).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('alert_cooldown'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('100'));
  });

  it('should call clearConfig on config clear', async () => {
    await program.parseAsync(['node', 'test', 'config', 'clear']);
    expect(clearConfig).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration cleared'));
  });
});
