import type { Telegram } from 'telegraf';
import { genMatches } from './genMatches';

export interface Match {
    user0: string;
    user1: string | null;
    result: 'no_result' | 'won0' | 'won1' | 'draw';
    result0?: number;
    result1?: number;
}

export interface Standing {
    name: string;
    wins: number;
    losses: number;
    draws: number;
    score: number;
}

export interface Event {
    id: number;
    adminId: number;
    chatId: number;
    name: string;
    roundTime: number;
    users: string[];
    status: 'not_started' | 'started';
    round: number;
    totalRounds: number;
    totalRoundsManual: boolean;
    matches: Match[];
}

let id = 0;
const events: Event[] = [];

const DEFAULT_ROUND_TIME = 10000;

export function newEvent(adminId: number, chatId: number, name: string): Event {
    const event: Event = {
        id: id++,
        adminId,
        chatId,
        name,
        roundTime: DEFAULT_ROUND_TIME,
        users: [],
        status: 'not_started',
        round: -1,
        totalRounds: 0,
        totalRoundsManual: false,
        matches: []
    };
    events.push(event);

    return event;
}

export function getEventsByUser(adminId: number): Event[] {
    return events.filter(it => it.adminId === adminId);
}

export function recalcTotalRounds(event: Event): void {
    if (event.totalRoundsManual) {
        return;
    }
    event.totalRounds = Math.ceil(Math.log2(event.users.length));
}

export function getStandings(event: Event): Standing[] {
    let list: Standing[] = event.users.map(name => {
        return {
            name,
            wins: 0,
            losses: 0,
            draws: 0,
            score: 0
        }
    });

    event.matches.forEach(match => {
        const item0 = list.find(item => item.name === match.user0);
        const item1 = list.find(item => item.name === match.user1);

        if (match.result === 'won0') {
            ++item0.wins;
            ++item1.losses;
        } else if (match.result === 'won1') {
            ++item0.losses;
            ++item1.wins;
        } else if (match.result === 'draw') {
            ++item0.draws;
            ++item1.draws;
        }
    });

    list.forEach(item => {
        item.score = item.wins * 3 + item.draws;
    });

    list = list.sort((a, b) => {
        return b.score - a.score;
    });

    // todo by same score

    return list;
}

export function startRound(event: Event, tg: Telegram) {
    const standings = getStandings(event);

    let index = 0;
    let totalNewMatches: Match[] = [];
    while (index < event.users.length) {
        let groupEnd = index + 1;
        let firstScore = standings[index].score;
        while (groupEnd < event.users.length && standings[groupEnd].score === firstScore) {
            ++groupEnd;
        }
        let groupCount = groupEnd - index;
        if (groupCount % 2 === 1 && groupEnd < event.users.length) {
            ++groupEnd;
            ++groupCount;
        }

        const newMatches = genMatches(standings.slice(index, groupEnd), event.matches);
        totalNewMatches = totalNewMatches.concat(newMatches);

        index = groupEnd;
    }

    event.matches = event.matches.concat(totalNewMatches);

    setTimeout(() => {
        const notifyUsers = new Set<string>();

        totalNewMatches.forEach(match => {
            if (match.result === 'no_result') {
                notifyUsers.add(match.user0);
                notifyUsers.add(match.user1);
            }
        });

        tg.sendMessage(
            event.chatId,
            'Round have ended. Be sure to end in 5 turns and submit results.\n' + [...notifyUsers].map(user => `@${user}`).join(' ')
        );
    }, event.roundTime);

    return {
        standings,
        newMatches: totalNewMatches
    };
}
