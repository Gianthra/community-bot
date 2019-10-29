import { BitFieldResolvable, Client, Message, MessageEmbed, PermissionString } from 'discord.js';

export class Command {
    public constructor(public options: CommandOptions) {
        this.options.aliases = this.options.aliases.map(alias => alias.toLowerCase());
    }
}

interface CommandHandlerOptions {
    prefix: string;
    logger: (...message: string[]) => void;
    guildsAllowed?: string[];
    helpCommandFn?: (commands: { aliases: string[]; description: string }[], message: Message) => Promise<void>;
    commandNotFoundFnOrMessage?: ((message: Message) => Promise<void> | void) | string;
}

interface CommandOptions {
    aliases: string[];
    description: string;
    privelagesRequired?: BitFieldResolvable<PermissionString>[];
    command: (message: Message, messageContent: string) => Promise<unknown>;
}

// Command Handler Class
export class CommandHandler {
    private commands: Command[] = [];

    constructor(private bot: Client, private option: CommandHandlerOptions) {
        // Logger
        this.option.logger = option.logger || console.log;

        // Add Help Command
        this.addHelpCommand();

        // Handle Message Event
        this.bot.on('message', (message: Message) => this.handleMessageEvt(message));
    }

    /**
     * Register a command
     * @param command An Instance of Command Class
     */
    registerCommand(command: Command): void {
        this.commands.push(command);
        this.option.logger('Added Command: ', command.options.aliases[0]);
    }

    /**
     * Handle Messages
     * @param message Message Event Object
     */
    private async handleMessageEvt(message: Message): Promise<void> {
        if (message.author!.bot) return;
        if (!message.guild) return;

        const rawMessageContent = message.content.split(' ');
        // First word is command word
        let cmd = rawMessageContent
            .splice(0, 1)
            .toString()
            .toLowerCase();
        // Rest of the words are message
        const messageContent = rawMessageContent.join(' ');

        // If not from allowed guilds return
        if ((this.option.guildsAllowed || []).length > 0) {
            if (!this.option.guildsAllowed!.includes(message.guild!.id)) return;
        }

        // If word doesnt start with prefix return
        if (!cmd.startsWith(this.option.prefix)) return;
        else cmd = cmd.slice(this.option.prefix.length);

        // Filter commands that have same aliases
        const commands = this.commands.filter(({ options: { aliases } }) => aliases.includes(cmd));

        // If commands found run them
        if (commands.length > 0) {
            const commandsRan = commands.map(async ({ options: { command, privelagesRequired } }) => {
                // If privelages required for command check them
                if (privelagesRequired && privelagesRequired.length > 0) {
                    const allowed: boolean = privelagesRequired
                        .map(privelage => message.member!.hasPermission(privelage))
                        .reduce((prev, current) => prev && current, true);

                    // If allowed run them
                    if (allowed) await command(message, messageContent);
                    else message.channel.send(':x: You do not have the privelages');
                }
                // Else run them
                else await command(message, messageContent);
            });

            await Promise.all(commandsRan);
        }
    }

    /**
     * Add the help command
     */
    private addHelpCommand(): void {
        this.registerCommand(
            new Command({
                aliases: ['help'],
                command: async (message, messageContent): Promise<void> => {
                    // Commands List
                    const commandsList = this.commands.map(({ options: { aliases, description } }) => ({
                        aliases,
                        description,
                    }));

                    // If user mentioned help command use it
                    if (this.option.helpCommandFn) return await this.option.helpCommandFn(commandsList, message);

                    // Default help command
                    const embed = new MessageEmbed();
                    embed.setTitle('Help Message');

                    // If help for a specific command
                    if (messageContent.trim().length > 0) {
                        const commandName = messageContent.split(' ')[0].toLowerCase();
                        const command = commandsList.find(({ aliases }) => aliases.includes(commandName));

                        // If command exists
                        if (command) {
                            embed.addField('**Aliases :**', command.aliases.join(', '));
                            embed.addField('**Description :**', command.description);
                            await message.channel.send(embed);
                            return;
                        }
                    }

                    // If for all commands
                    commandsList.forEach(({ aliases, description }) => embed.addField('`' + aliases[0] + '`', description));
                    await message.channel.send(embed);
                },
                description: 'Help Command',
            }),
        );
    }
}
