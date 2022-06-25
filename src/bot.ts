import { Telegraf, Telegram } from 'telegraf';
import { escapeMarkdown } from './escapeMarkdown';
import { getEventsByUser, getStandings, newEvent, recalcTotalRounds, startRound } from './events';
import { processUserName } from './processUserName';

const token = process.env.BOT_TOKEN;
if (token === undefined) {
    throw new Error('BOT_TOKEN must be provided');
}

const bot = new Telegraf(token);
const tg = new Telegram(token);

const messages = {
    eventAddSuccess(name: string) {
        return `Event \`${escapeMarkdown(name)}\` created\\. Now add members with \\\`/useradd\\\` and run \\\`/eventroundstart\\\` after all members are ready`;
    },
    eventAddMissingName() {
        return escapeMarkdown('Event name is required. Try `/useradd Some name`');
    },
    userAddNameRequired() {
        return escapeMarkdown('User name is required. Try `/useradd @user0 @user1 ...`');
    },
    eventNotFound() {
        return escapeMarkdown('Event not found. Try `/eventadd Some name` first');
    },
    eventPreview(eventName: string, users: string[], rounds: number) {
        return `Event \`${escapeMarkdown(eventName)}\` now have following users:\n\n${users.map(it => `\\- @${escapeMarkdown(it)}`).join('\n')}\n\n*Total rounds: ${rounds}*`;
    },
    userAddSuccess(eventName: string, users: string[], rounds: number) {
        return escapeMarkdown('Users added.\n\n') + messages.eventPreview(eventName, users, rounds);
    },
    userRemoveNameRequired() {
        return escapeMarkdown('User name is required. Try `/userremove @user0 @user1 ...`');
    },
    userRemoveSuccess(eventName: string, users: string[], rounds: number) {
        return escapeMarkdown('Users removed.\n\n') + messages.eventPreview(eventName, users, rounds);
    },
    eventAlreadyStarted() {
        return escapeMarkdown('Event already started');
    },
    eventSetRoundsCountRequired() {
        return escapeMarkdown('Specify rounds count, i.e. `eventsetrounds X`');
    },
    done() {
        return escapeMarkdown('Done');
    },
    eventStandings(eventName: string, standings: string) {
        return `Event \`${escapeMarkdown(eventName)}\`, standings:\n\n${standings}`;
    },
    eventNotStarted() {
        return escapeMarkdown('Event not started');
    },
    matchSubmitResultsArgsRequired() {
        return 'Specify results, i\\.e\\. `/matchsubmitresults` @user0 @user1 2:1';
    },
    matchNotFound() {
        return escapeMarkdown('Match is not found');
    },
    incorrectResultsFormat() {
        return escapeMarkdown('Incorrect results format');
    },
    eventEnded() {
        return escapeMarkdown('Event already ended');
    },
    notEndedMatch(user0: string, user1: string) {
        return `Match ${escapeMarkdown(user0)} \\- ${escapeMarkdown(user1)} have not submitted result`;
    },
    roundStarted(matches: string) {
        return `*Round started*\n\nMatches:\n\n${matches}`;
    }
};

bot.command('eventadd', ctx => {
    const name = /^\/[^ ]+ (.+)$/i.exec(ctx.message.text);
    if (name) {
        const event = newEvent(ctx.from.id, ctx.chat.id, name[1]);
        ctx.replyWithMarkdownV2(messages.eventAddSuccess(event.name));
    } else {
        ctx.replyWithMarkdownV2(messages.eventAddMissingName());
    }
});

bot.command('useradd', ctx => {
    const names = ctx.message.text.split(/\s+/).slice(1);
    if (names.length < 1) {
        ctx.replyWithMarkdownV2(messages.userAddNameRequired());
    } else {
        const events = getEventsByUser(ctx.from.id);
        const event = events[0];
        if (!event) {
            ctx.replyWithMarkdownV2(messages.eventNotFound());
        } else {
            event.users.push(...names.map(processUserName));
            event.users = [...new Set(event.users)];
            recalcTotalRounds(event);
            ctx.replyWithMarkdownV2(messages.userAddSuccess(event.name, event.users, event.totalRounds));
        }
    }
});

bot.command('userremove', ctx => {
    const names = ctx.message.text.split(/\s+/).slice(1);
    if (names.length < 1) {
        ctx.replyWithMarkdownV2(messages.userRemoveNameRequired());
    } else {
        const events = getEventsByUser(ctx.from.id);
        const event = events[0];
        if (!event) {
            ctx.replyWithMarkdownV2(messages.eventNotFound());
        } else {
            const set = new Set(names.map(processUserName));
            event.users = event.users.filter(it => !set.has(it));
            recalcTotalRounds(event);
            ctx.replyWithMarkdownV2(messages.userAddSuccess(event.name, event.users, event.totalRounds));
        }
    }
});

bot.command('eventsetrounds', ctx => {
    const rounds = Number(ctx.message.text.split(/\s+/).slice(1)[0]);
    const events = getEventsByUser(ctx.from.id);
    const event = events[0];
    if (!event) {
        ctx.replyWithMarkdownV2(messages.eventNotFound());
    } else if (event.status === 'not_started') {
        ctx.replyWithMarkdownV2(messages.eventAlreadyStarted());
    } else if (rounds <= 1 || isNaN(rounds)) {
        ctx.replyWithMarkdownV2(messages.eventSetRoundsCountRequired());
    } else {
        event.totalRounds = rounds;
        event.totalRoundsManual = true;
        ctx.replyWithMarkdownV2(messages.done());
    }
});

bot.command('eventstandings', ctx => {
    const events = getEventsByUser(ctx.from.id);
    const event = events[0];
    if (!event) {
        ctx.replyWithMarkdownV2(messages.eventNotFound());
    } else {
        const standings = getStandings(event);
        ctx.replyWithMarkdownV2(messages.eventStandings(event.name, standings.map(item => {
            return `@${escapeMarkdown(item.name)} ${item.wins} / ${item.draws} / ${item.losses} ${item.score}`;
        }).join('\n')));
    }
});

bot.command('matchsubmitresults', ctx => {
    const data = ctx.message.text.split(/\s+/);
    const events = getEventsByUser(ctx.from.id);
    const event = events[0];
    if (!event) {
        ctx.replyWithMarkdownV2(messages.eventNotFound());
    } else if (event.status === 'not_started') {
        ctx.replyWithMarkdownV2(messages.eventNotStarted());
    } else if (data.length !== 4) {
        ctx.replyWithMarkdownV2(messages.matchSubmitResultsArgsRequired());
    } else {
        const user0 = processUserName(data[1]);
        const user1 = processUserName(data[2]);

        const match = event.matches.find(match => {
            return match.user0 === user0 && match.user1 === user1 || match.user0 === user1 && match.user1 === user0;
        });

        if (!match) {
            ctx.replyWithMarkdownV2(messages.matchNotFound());
            return;
        }

        const parts = data[3].split(':');
        if (parts.length !== 2) {
            ctx.replyWithMarkdownV2(messages.incorrectResultsFormat());
            return;
        }

        const results = parts.map(Number);
        match.result0 = results[0];
        match.result1 = results[1];
        if (results[0] > results[1]) {
            match.result = 'won0';
        } else if (results[0] < results[1]) {
            match.result = 'won1';
        } else {
            match.result = 'draw';
        }
        ctx.replyWithMarkdownV2(messages.done());
    }
});

bot.command('eventroundstart', ctx => {
    const events = getEventsByUser(ctx.from.id);
    const event = events[0];
    if (!event) {
        ctx.replyWithMarkdownV2(messages.eventNotFound());
    } else if (event.status !== 'started' && event.status !== 'not_started') {
        ctx.replyWithMarkdownV2(messages.eventEnded());
    } else {
        event.status = 'started';
        const notEndedMatch = event.matches.find(match => match.result === 'no_result');
        if (notEndedMatch) {
            ctx.replyWithMarkdownV2(messages.notEndedMatch(notEndedMatch.user0, notEndedMatch.user1));
            return;
        }

        const {newMatches} = startRound(event, tg);
        ctx.replyWithMarkdownV2(messages.roundStarted(newMatches.map(match => {
            if (!match.user1) {
                return `@${escapeMarkdown(match.user0)} \\- autowin`;
            }
            return `@${escapeMarkdown(match.user0)} \\- @${escapeMarkdown(match.user1)}`;
        }).join('\n')));
    }
});

bot.launch().then(() => {
    console.log('Bot started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
