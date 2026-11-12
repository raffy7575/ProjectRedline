// Driver skills (bought with skill points earned by levelling up) and achievements.

export const MAX_LEVEL = 30;
export const SKILL_MAX = 5;

export const SKILLS = [
    { id: 'launch', name: 'Launch Control', icon: '🚦', desc: 'Sharper reactions off the line and faster gear changes.', effect: '-5% shift time, better auto-launch per level' },
    { id: 'cornering', name: 'Apex Precision', icon: '🎯', desc: 'Carry more speed through every corner.', effect: '+0.35% pace per level' },
    { id: 'braking', name: 'Trail Braking', icon: '🛑', desc: 'Brake later and harder.', effect: '+2% braking power per level' },
    { id: 'tyres', name: 'Tyre Whisperer', icon: '⭕', desc: 'Look after the rubber so you can push for longer.', effect: '-7% tyre wear per level' },
    { id: 'nitro', name: 'Nitro Discipline', icon: '🔥', desc: 'Squeeze more out of every bottle.', effect: '+8% nitrous capacity per level' },
    { id: 'composure', name: 'Ice Cold', icon: '🧊', desc: 'Fewer lock-ups, even under pressure.', effect: '-15% mistake chance per level' }
];

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level) {
    return Math.round(180 * Math.pow(level, 1.3));
}

export const ACHIEVEMENTS = [
    { id: 'first-race', name: 'Green Light', desc: 'Finish your first race.', reward: 300 },
    { id: 'first-win', name: 'Top Step', desc: 'Win a race.', reward: 600 },
    { id: 'podium-10', name: 'Podium Regular', desc: 'Finish on the podium 10 times.', reward: 2500 },
    { id: 'wins-25', name: 'Serial Winner', desc: 'Win 25 races.', reward: 12000 },
    { id: 'perfect-launch', name: 'Lights Out', desc: 'Nail a perfect launch.', reward: 400 },
    { id: 'perfect-launch-10', name: 'Reflexes', desc: 'Nail 10 perfect launches.', reward: 3000 },
    { id: 'last-to-first', name: 'Through the Field', desc: 'Win a race after starting 6th or lower.', reward: 2000 },
    { id: 'photo-finish', name: 'Photo Finish', desc: 'Win by less than 0.3 seconds.', reward: 1500 },
    { id: 'dominant', name: 'Untouchable', desc: 'Win by more than 6 seconds.', reward: 1000 },
    { id: 'lap-records-5', name: 'Record Collector', desc: 'Hold the lap record on 5 different track layouts.', reward: 3000 },
    { id: 'clean-race', name: 'Clean Hands', desc: 'Win without a single lock-up while using Push for most of the race.', reward: 1200 },
    { id: 'tuner', name: 'Wrench Monkey', desc: 'Buy 15 upgrades.', reward: 2000 },
    { id: 'collector', name: 'Collector', desc: 'Own 4 cars at once.', reward: 4000 },
    { id: 'daily-3', name: 'Regular', desc: 'Reach a 3-day Daily Challenge streak.', reward: 3000 },
    { id: 'daily-7', name: 'Dedicated', desc: 'Reach a 7-day Daily Challenge streak.', reward: 10000 },
    { id: 'champ-D', name: 'Amateur Champion', desc: 'Win the Amateur League championship.', reward: 0 },
    { id: 'champ-C', name: 'Semi-Pro Champion', desc: 'Win the Semi-Pro League championship.', reward: 0 },
    { id: 'champ-B', name: 'Pro Champion', desc: 'Win the Pro League championship.', reward: 0 },
    { id: 'champ-A', name: 'Redline Legend', desc: 'Win the Elite League championship.', reward: 0 },
    { id: 'millionaire', name: 'Six Figures', desc: 'Have $250,000 in the bank.', reward: 0 }
];
