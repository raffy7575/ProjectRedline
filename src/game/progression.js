// Driver progression: XP, levels, skill points and achievements.

import { state } from '../core/store.js';
import { SKILLS, SKILL_MAX, MAX_LEVEL, xpForLevel, ACHIEVEMENTS } from '../data/progression.js';

export function skillLevel(skillId) {
    return Math.max(0, Math.min(SKILL_MAX, Number(state.skills[skillId]) || 0));
}

export function spentSkillPoints() {
    return SKILLS.reduce((sum, skill) => sum + skillLevel(skill.id), 0);
}

/** One skill point per level gained (level 1 starts with one to spend). */
export function availableSkillPoints() {
    return Math.max(0, state.level - spentSkillPoints());
}

export function upgradeSkill(skillId) {
    if (!SKILLS.some(s => s.id === skillId)) return { ok: false, reason: 'Unknown skill.' };
    if (skillLevel(skillId) >= SKILL_MAX) return { ok: false, reason: 'Skill is maxed.' };
    if (availableSkillPoints() <= 0) return { ok: false, reason: 'No skill points. Level up by racing.' };
    state.skills[skillId] = skillLevel(skillId) + 1;
    return { ok: true };
}

/** Adds XP, returns how many levels were gained. */
export function addXp(amount) {
    let gained = 0;
    state.xp += Math.max(0, Math.round(amount));
    while (state.level < MAX_LEVEL && state.xp >= xpForLevel(state.level)) {
        state.xp -= xpForLevel(state.level);
        state.level++;
        gained++;
    }
    if (state.level >= MAX_LEVEL) state.xp = Math.min(state.xp, xpForLevel(MAX_LEVEL));
    return gained;
}

export function levelProgress() {
    const need = xpForLevel(state.level);
    return { xp: state.xp, need, fraction: state.level >= MAX_LEVEL ? 1 : Math.min(1, state.xp / need) };
}

/** Numbers the simulation uses for the player's driver. */
export function playerDriverProfile() {
    return {
        skill: 0.960 + 0.0035 * skillLevel('cornering'),
        aggression: 0.7,
        consistency: 0.5 + 0.09 * skillLevel('composure'),
        tyreCare: 1 - 0.07 * skillLevel('tyres'),
        launch: 0.35 + 0.12 * skillLevel('launch')
    };
}

/** Skill levels in the shape sim/vehicle.js expects. */
export function playerPerfSkills() {
    return {
        braking: skillLevel('braking'),
        nitro: skillLevel('nitro'),
        shifting: skillLevel('launch')
    };
}

/** Unlock an achievement once. Returns the achievement (and pays it) if new. */
export function unlockAchievement(id) {
    if (state.achievements[id]) return null;
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) return null;
    state.achievements[id] = Date.now();
    state.money += achievement.reward;
    return achievement;
}

/** Checks the achievements that depend only on totals. Returns newly unlocked ones. */
export function checkStatAchievements() {
    const unlocked = [];
    const tryUnlock = (id, condition) => {
        if (condition) {
            const a = unlockAchievement(id);
            if (a) unlocked.push(a);
        }
    };
    const s = state.stats;
    tryUnlock('first-race', s.races >= 1);
    tryUnlock('first-win', s.wins >= 1);
    tryUnlock('podium-10', s.podiums >= 10);
    tryUnlock('wins-25', s.wins >= 25);
    tryUnlock('perfect-launch', s.perfectLaunches >= 1);
    tryUnlock('perfect-launch-10', s.perfectLaunches >= 10);
    tryUnlock('lap-records-5', Object.keys(state.records).length >= 5);
    tryUnlock('tuner', s.upgradesBought >= 15);
    tryUnlock('collector', state.cars.length >= 4);
    tryUnlock('daily-3', state.daily.streak >= 3);
    tryUnlock('daily-7', state.daily.streak >= 7);
    tryUnlock('millionaire', state.money >= 250000);
    return unlocked;
}
