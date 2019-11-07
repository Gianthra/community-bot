import { Message } from 'discord.js';
import ms from 'ms';

import { ReminderEntity } from '../entities/Reminder';
import { database } from '../index';
import { Command } from '../utils/commandHandler';

export const command = new Command({
    aliases: ['reminder', 'remindme', 'remind'],
    command: async (message: Message): Promise<Message> => {
        const split = message.content.split(' ');
        const rawTime = split[1];

        if (!rawTime) {
            return message.channel.send(`:x: Please provide a time`);
        }

        const time = ms(rawTime);
        const reason = split.slice(2).join(' ');

        if (time == undefined) {
            return message.channel.send(`:x: Please provide a valid time`);
        }

        if (time < 30000) {
            // 30 seconds
            return message.channel.send(`:x: The time must be >30s`);
        }

        const repository = database.getRepository(ReminderEntity);

        await repository.insert({
            createdAt: Date.now(),
            length: time,
            member: message.member!.id,
            messageLink: `https://ptb.discordapp.com/channels/${message.guild!.id}/${message.channel.id}/${message.id}`,
            reason,
        });

        return message.channel.send(`:ballot_box_with_check: Reminder set! I will remind you in ~**${ms(time)}**`);
    },
    description: 'Set a reminder',
});
