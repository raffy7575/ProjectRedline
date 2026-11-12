// Named rival drivers.
//   talent       added to the league's base driver skill (pace)
//   aggression   0..1, how freely they spend nitro and dive for gaps
//   consistency  0..1, higher = fewer lock-ups
//   bias         which upgrades they buy first

export const RIVALS = [
    { id: 'rival-ember', name: 'Ember Vale', color: '#ff6d3a', talent: 0.006, aggression: 0.85, consistency: 0.55, bias: 'power', bio: 'Flat out or nothing. Fast, loud and occasionally in the wall.' },
    { id: 'rival-apex', name: 'Apex Mori', color: '#42a5f5', talent: 0.009, aggression: 0.45, consistency: 0.9, bias: 'grip', bio: 'Clinical. Never the latest braker, always on the podium.' },
    { id: 'rival-shale', name: 'Shale Knox', color: '#d9a441', talent: 0.003, aggression: 0.6, consistency: 0.7, bias: 'offroad', bio: 'Grew up on gravel. Hand them a dirt section and say goodbye.' },
    { id: 'rival-juno', name: 'Juno Park', color: '#ab7df6', talent: 0.0, aggression: 0.5, consistency: 0.75, bias: 'balanced', bio: 'Rookie with a tidy style and a tight budget.' },
    { id: 'rival-rook', name: 'Rook Castellan', color: '#8d9aa5', talent: -0.006, aggression: 0.7, consistency: 0.5, bias: 'power', bio: 'More enthusiasm than talent. Great starts, creative braking.' },
    { id: 'rival-mika', name: 'Mika Sorel', color: '#4dd0a7', talent: -0.002, aggression: 0.35, consistency: 0.85, bias: 'grip', bio: 'Smooth and patient. Waits for your mistake.' },
    { id: 'rival-dax', name: 'Dax Moreno', color: '#ef5350', talent: -0.009, aggression: 0.9, consistency: 0.4, bias: 'balanced', bio: 'Local legend in his own head. Spins twice a race.' },
    { id: 'rival-vex', name: 'Vex Arden', color: '#26c6da', talent: 0.007, aggression: 0.75, consistency: 0.7, bias: 'power', bio: 'Ex-drag racer. Lethal on the straights.' },
    { id: 'rival-tor', name: 'Tor Halvik', color: '#9ccc65', talent: 0.001, aggression: 0.55, consistency: 0.8, bias: 'offroad', bio: 'Rally veteran who refuses to lift on loose surfaces.' },
    { id: 'rival-sable', name: 'Sable Quinn', color: '#ec407a', talent: 0.010, aggression: 0.65, consistency: 0.85, bias: 'grip', bio: 'Former karting champion. Carries impossible corner speed.' },
    { id: 'rival-kira', name: 'Kira Voss', color: '#ffca28', talent: 0.004, aggression: 0.6, consistency: 0.8, bias: 'balanced', bio: 'Engineer first, driver second. Her setup is always right.' },
    { id: 'rival-nyx', name: 'Nyx Calder', color: '#b0bec5', talent: 0.013, aggression: 0.8, consistency: 0.9, bias: 'power', bio: 'The reigning Elite champion. Nobody has beaten Nyx over a season.' }
];

export function getRival(rivalId) {
    return RIVALS.find(r => r.id === rivalId) || null;
}

// Upgrade categories each build bias shops for, in priority order.
export const BIAS_PRIORITIES = {
    power: ['engine', 'turbo', 'exhaust', 'nitro', 'gearbox', 'weight', 'brakes', 'tyres', 'suspension', 'aero'],
    grip: ['tyres', 'suspension', 'brakes', 'aero', 'weight', 'engine', 'gearbox', 'exhaust', 'turbo', 'nitro'],
    offroad: ['tyres', 'weight', 'engine', 'gearbox', 'brakes', 'exhaust', 'turbo', 'nitro', 'suspension', 'aero'],
    balanced: ['engine', 'tyres', 'weight', 'brakes', 'suspension', 'exhaust', 'gearbox', 'aero', 'turbo', 'nitro']
};
