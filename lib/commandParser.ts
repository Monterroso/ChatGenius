import db from '@/lib/db';
import { addBotKnowledge, deleteBotKnowledge } from './botKnowledge';

interface CommandResult {
  type: 'command';
  response: string;
  success: boolean;
}

interface Command {
  description: string;
  handler: (botId: string, content?: string) => Promise<CommandResult>;
}

interface CommandInfo {
  command: string;
  description: string;
}

const BUILT_IN_COMMANDS: Record<string, Command> = {
  help: {
    description: 'Show available commands',
    handler: async (botId: string): Promise<CommandResult> => {
      const result = await db.query(
        'SELECT command, description FROM bot_commands WHERE bot_id = $1 AND enabled = true',
        [botId]
      );
      
      const commands = result.rows;
      const builtInHelp: CommandInfo[] = Object.entries(BUILT_IN_COMMANDS).map(([cmd, info]) => ({
        command: `/${cmd}`,
        description: info.description,
      }));

      const allCommands: CommandInfo[] = [...builtInHelp, ...commands];
      const helpText: string = allCommands
        .map((cmd: CommandInfo) => `${cmd.command}: ${cmd.description}`)
        .join('\n');

      return {
        type: 'command',
        response: `Available commands:\n${helpText}`,
        success: true,
      };
    },
  },
  learn: {
    description: 'Add new knowledge to the bot (Usage: /learn <content>)',
    handler: async (botId: string, content?: string): Promise<CommandResult> => {
      if (!content) {
        return {
          type: 'command',
          response: 'Please provide content to learn',
          success: false,
        };
      }

      await addBotKnowledge(content, { source: 'user_command' }, botId);
      return {
        type: 'command',
        response: 'I\'ve learned this information!',
        success: true,
      };
    },
  },
  forget: {
    description: 'Remove all learned knowledge',
    handler: async (botId: string): Promise<CommandResult> => {
      await deleteBotKnowledge(botId);
      return {
        type: 'command',
        response: 'I\'ve forgotten all learned information.',
        success: true,
      };
    },
  },
};

export async function parseCommand(
  message: string,
  botId: string,
  userId: string
): Promise<CommandResult> {
  // Extract command and arguments
  const [command, ...args] = message.slice(1).split(' ');
  const content = args.join(' ');

  // Check built-in commands first
  const builtInCommand = BUILT_IN_COMMANDS[command];
  if (builtInCommand) {
    return builtInCommand.handler(botId, content);
  }

  // Check custom commands from database
  const result = await db.query(
    'SELECT * FROM bot_commands WHERE bot_id = $1 AND command = $2 AND enabled = true',
    [botId, command]
  );

  if (result.rows.length === 0) {
    return {
      type: 'command',
      response: `Unknown command: ${command}. Use /help to see available commands.`,
      success: false,
    };
  }

  // For now, just acknowledge custom commands
  // You can extend this to handle custom command logic
  return {
    type: 'command',
    response: `Executing command: ${command}`,
    success: true,
  };
}