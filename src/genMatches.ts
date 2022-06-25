import { Match, Standing } from './events';

export function genMatches(standings: Standing[], existentMatches: Match[]): Match[] {
    const userToIndexMap = new Map<string, number>();
    const indexToUserMap = new Map<number, string>();

    standings.forEach((item, index) => {
        userToIndexMap.set(item.name, index);
        indexToUserMap.set(index, item.name);
    });

    const foundMatches = new Map<string, Set<string>>();

    existentMatches.forEach(match => {
        let set0 = foundMatches.get(match.user0);
        if (!set0) {
            set0 = new Set();
            foundMatches.set(match.user0, set0);
        }
        if (match.user1) {
            set0.add(match.user1);
        }

        if (match.user1) {
            let set1 = foundMatches.get(match.user1);
            if (!set1) {
                set1 = new Set();
                foundMatches.set(match.user1, set1);
            }
            set1.add(match.user0);
        }
    });

    const g: number[][] = [];
    for (let i = 0; i < standings.length; ++i) {
        g[i] = [];
        const user0 = indexToUserMap.get(i);
        const set0 = foundMatches.get(user0);
        for (let j = i + 1; j < standings.length; ++j) {
            const user1 = indexToUserMap.get(j);
            g[i].push(j);
        }
    }

    const mt = new Array(standings.length);
    const used: boolean[] = [];
    mt.fill(-1);

    const tryKhun = (v: number, e?: number): boolean => {
        if (used[v]) {
            return false;
        }
        used[v] = true;
        for (let i = 0; i < g[v].length; ++i) {
            let to = g[v][i];
            if (to === e) {
                continue;
            }
            if (mt[to] === -1 && mt[v] === -1 || mt[to] !== -1 && tryKhun(mt[to]) || mt[v] === -1 && tryKhun(mt[v], to)) {
                mt[v] = -1;
                mt[to] = v;
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < standings.length; ++i) {
        used.fill(false);
        tryKhun(i);
    }

    const notFoundPairs = new Set<number>();
    const newMatches: Match[] = [];

    for (let i = 0; i < standings.length; ++i) {
        notFoundPairs.add(i);
    }
    for (let i = 0; i < standings.length; ++i) {
        if (mt[i] !== -1) {
            notFoundPairs.delete(i);
            notFoundPairs.delete(mt[i]);
            newMatches.push({
                user0: indexToUserMap.get(i),
                user1: indexToUserMap.get(mt[i]),
                result: 'no_result'
            });
        }
    }

    const notFoundPairsArr = [...notFoundPairs];

    while (notFoundPairsArr.length >= 2) {
        const i = notFoundPairsArr.pop();
        const j = notFoundPairsArr.pop();

        newMatches.push({
            user0: indexToUserMap.get(i),
            user1: indexToUserMap.get(j),
            result: 'no_result'
        });
    }

    if (notFoundPairsArr.length) {
        const id = notFoundPairsArr[0];

        newMatches.push({
            user0: indexToUserMap.get(id),
            user1: null,
            result: 'won0'
        });
    }

    return newMatches;
}
