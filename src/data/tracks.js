// Track catalogue.
//
// `points` is a closed loop of control points in any unit: the builder scales
// the loop so one lap is exactly `lengthM` metres. `dirtZones` are [from, to]
// fractions of the lap that are loose surface. `theme` picks the scenery.

export const TRACKS = [
    {
        id: 't-dock', name: 'Dockside Sprint', theme: 'industrial', lengthM: 1250, width: 13,
        blurb: 'Short blast between the container stacks. Two heavy braking zones.',
        start: 1, points: [[12, 14], [46, 11], [78, 13], [90, 22], [88, 34], [74, 37], [68, 46], [76, 56], [66, 64], [46, 61], [36, 50], [22, 54], [10, 44], [8, 26]],
        dirtZones: []
    },
    {
        id: 't2', name: 'The Serpent', theme: 'city', lengthM: 1950, width: 12,
        blurb: 'Downtown street circuit along the river. Fast sweepers into a tight harbour section.',
        image: { src: 'img/serpent-city.webp', w: 2752, h: 1536 },
        start: 36, points: [[712, 428], [793, 224], [987, 350], [1130, 352], [1126, 491], [1150, 588], [1174, 751], [1194, 787], [1233, 807], [1485, 885], [1653, 989], [1673, 1018], [1685, 1060], [1694, 1116], [1690, 1164], [1675, 1186], [1631, 1198], [1575, 1220], [1539, 1237], [1500, 1269], [1476, 1300], [1451, 1334], [1043, 1118], [955, 1077], [882, 1045], [827, 1033], [773, 1038], [717, 1038], [676, 1040], [639, 1030], [608, 1006], [581, 970], [554, 928], [532, 882], [525, 834], [571, 736], [664, 569], [700, 462]],
        dirtZones: []
    },
    {
        id: 't3', name: "Dragon's Tail", theme: 'forest', lengthM: 1700, width: 11,
        blurb: 'Forest road that turns to gravel halfway round. Mixed-surface setups shine.',
        start: 1, points: [[16, 50], [52, 30], [90, 12], [100, 30], [96, 62], [90, 84], [74, 80], [62, 90], [46, 72], [30, 88], [14, 76]],
        dirtZones: [[0.30, 0.80]]
    },
    {
        id: 't4', name: 'Muddy Canyon', theme: 'desert', lengthM: 1550, width: 11,
        blurb: 'Loose canyon floor with one paved straight. Bring gravel tyres.',
        start: 1, points: [[14, 80], [16, 44], [26, 18], [56, 14], [86, 20], [96, 48], [92, 80], [72, 76], [54, 50], [40, 66], [30, 86]],
        dirtZones: [[0.10, 0.92]]
    },
    {
        id: 't1', name: 'Hammerhead', theme: 'airfield', lengthM: 2350, width: 14,
        blurb: 'Old airfield. Long runways, a fast kink and the famous hammerhead hairpin.',
        start: 1, points: [[10, 20], [48, 17], [84, 20], [96, 34], [86, 48], [72, 58], [86, 70], [92, 84], [72, 92], [50, 88], [44, 70], [38, 56], [24, 66], [10, 58], [6, 38]],
        dirtZones: []
    },
    {
        id: 't-neon', name: 'Neon Loop', theme: 'night', lengthM: 1650, width: 11,
        blurb: 'Tight night circuit through the entertainment district. Walls everywhere.',
        start: 3, points: [[10, 12], [40, 12], [50, 22], [62, 12], [90, 14], [94, 36], [78, 42], [80, 60], [94, 70], [86, 88], [58, 86], [52, 70], [36, 68], [30, 86], [10, 84], [8, 60], [22, 48], [8, 34]],
        dirtZones: []
    },
    {
        id: 't-alpine', name: 'Alpine Pass', theme: 'alpine', lengthM: 3100, width: 11,
        blurb: 'Mountain road with a gravel summit section. Long, technical and unforgiving.',
        points: [[8, 60], [20, 40], [14, 22], [30, 10], [48, 18], [60, 8], [78, 12], [84, 28], [98, 34], [104, 52], [92, 62], [96, 80], [80, 90], [66, 78], [52, 88], [40, 76], [28, 90], [12, 82]],
        dirtZones: [[0.28, 0.52]]
    },
    {
        id: 't-coast', name: 'Coastline GP', theme: 'coast', lengthM: 2800, width: 14,
        blurb: 'Flowing seaside circuit. High-speed esses reward downforce and nerve.',
        start: 13, points: [[8, 30], [30, 14], [56, 20], [74, 10], [98, 16], [108, 34], [96, 46], [78, 42], [66, 54], [82, 66], [100, 68], [104, 84], [84, 92], [56, 86], [40, 70], [24, 82], [8, 70], [14, 50]],
        dirtZones: []
    },
    {
        id: 't-ring', name: 'Redline Ring', theme: 'circuit', lengthM: 3600, width: 15,
        blurb: 'The full grand prix circuit. Flat-out straights, a stadium section and nowhere to hide.',
        start: 1, points: [[6, 26], [40, 20], [80, 16], [108, 20], [116, 36], [104, 46], [84, 42], [74, 52], [86, 62], [108, 60], [118, 74], [108, 90], [80, 92], [62, 80], [48, 90], [30, 84], [34, 66], [22, 56], [8, 60], [2, 44]],
        dirtZones: []
    }
];

export function getTrackDef(trackId) {
    return TRACKS.find(t => t.id === trackId) || null;
}
