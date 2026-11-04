// Leveldaten als Textraster. Abschnitte werden aneinandergehaengt und unten ausgerichtet.
// Tiles:   # Boden   = Holzsteg (von unten durchlaessig)   H Heuballen   X Kiste   ~ Wasser
// Objekte: S Start   E Ziel   C Vogelscheuche (Ruecksetzpunkt)   o Samen   G goldene Runkel
//          L Baumstamm   R rollender Stamm   B Wildschwein   K Kuh   T Traktor
// Deko:    f Zaun   r Runkelpflanze   P Fass
// Ein Sprung schafft 3 Tiles Hoehe und bei vollem Lauf etwa 5 Tiles Weite.
window.RR = window.RR || {};

(function () {
  const G = '##############################';
  const _ = '..............................';

  RR.LEVELS = [
    {
      name: 'Der Runkelacker',
      theme: {
        id: 'acker', dirt: '#6e4a28', dirtDark: '#56391e', grass: '#7fa82a', grassLight: '#a7bd2f', furrows: true,
        sky: ['#3f9be0', '#9fd2f0', '#e4f3f6'], sun: '#fff3b0', sunGlow: 'rgba(255, 240, 170, .35)', sunX: 0.2, sunY: 86,
        cloud: ['#f8fbff', '#ffffff'],
        dust: 'rgba(110, 74, 40, .8)'
      },
      clubs: { first: 7, interval: 4.4, speed: 500, heights: ['low', 'mid', 'high'] },
      hints: [
        { col: 3, keys: 'Laufen mit ← → oder A D', touch: 'Laufen mit ◀ ▶' },
        { col: 40, keys: 'Springen mit der Leertaste', touch: 'Springen mit ▲' },
        { col: 66, keys: 'Hoher Knüppel? Ducken mit ↓ oder S', touch: 'Hoher Knüppel? Ducken mit ▼' }
      ],
      chunks: [
        [
          '..........o.o.o...............',
          '..Sr.........r..........r.....',
          G, G
        ],
        [
          '.............o.o.o............',
          _,
          '...r..........L..........r....',
          G, G
        ],
        [
          '.................G............',
          '................===...........',
          _,
          _,
          '..........=====...............',
          _,
          '.......r.......r........L.....',
          G, G
        ],
        [
          '..........o.o.................',
          _,
          '...r...................C......',
          '###########...################',
          '###########...################'
        ],
        [
          '.........o.o.o.o..............',
          _,
          _,
          '......L..........XX.......L...',
          G, G
        ],
        [
          '.............G................',
          _,
          '.........====....====.........',
          _,
          _,
          '#######................#######',
          '#######................#######'
        ],
        [
          '....o.o.o..........o.o.o......',
          _,
          '...L.............L......C.....',
          G, G
        ],
        [
          '.......................G......',
          '......................===.....',
          _,
          _,
          '...............=====..........',
          _,
          '..XX....r...........L.........',
          G, G
        ],
        [
          '.....o.o.o....................',
          _,
          '............r........E........',
          G, G
        ]
      ]
    },
    {
      name: 'Die Viehweide',
      theme: {
        id: 'weide', dirt: '#7a5a30', dirtDark: '#5f4524', grass: '#5fb02f', grassLight: '#8fd34a', furrows: false,
        sky: ['#4aa6e4', '#a9dcf3', '#eaf6e6'], sun: '#fff3b0', sunGlow: 'rgba(255, 240, 170, .35)', sunX: 0.55, sunY: 70,
        cloud: ['#f8fbff', '#ffffff'],
        dust: 'rgba(120, 90, 50, .8)'
      },
      clubs: { first: 6, interval: 3.8, speed: 540, heights: ['low', 'mid', 'high'] },
      hints: [
        { col: 34, keys: 'Kühe tragen dich: Ihr Rücken ist sicher', touch: 'Kühe tragen dich: Ihr Rücken ist sicher' },
        { col: 92, keys: 'Spring dem Wildschwein auf den Kopf!', touch: 'Spring dem Wildschwein auf den Kopf!' }
      ],
      chunks: [
        [
          '........o.o.o.................',
          '..Sf.f.......f.f..............',
          G, G
        ],
        [
          '..............o.o.o...........',
          _,
          '..f.f........K............f.f.',
          G, G
        ],
        [
          '.......o.o....................',
          '.....H............o.o.........',
          '....HH........................',
          '##########~~~~################',
          G
        ],
        [
          '............G.................',
          '...........===................',
          _,
          '...f.f............B.........C.',
          G, G
        ],
        [
          '................G.............',
          '...............===............',
          _,
          _,
          _,
          '............K.................',
          G, G
        ],
        [
          '.......o.o.o..................',
          _,
          '...................B.....C....',
          '#####....#####################',
          '#####....#####################'
        ],
        [
          '................o.o...........',
          '....K.................K.......',
          '#############~~~~#############',
          G
        ],
        [
          '....................G.........',
          '...................====.......',
          _,
          '...............H..............',
          '............HHHH.........B....',
          G, G
        ],
        [
          '......o.o.o...................',
          '..f.f........B.........C......',
          G, G
        ],
        [
          '...o.o.o......................',
          '.........K............E.......',
          G, G
        ]
      ]
    },
    {
      name: 'Hof und Feldweg',
      theme: {
        id: 'hof', dirt: '#9a7a45', dirtDark: '#7c6034', grass: '#a8923c', grassLight: '#cdb65a', furrows: false,
        sky: ['#3f4a86', '#d9698a', '#ffb65c'], sun: '#ffb04a', sunGlow: 'rgba(255, 170, 90, .35)', sunX: 0.72, sunY: 240,
        cloud: ['#e9a99a', '#f7c4b0'],
        tintFar: 'rgba(120, 50, 90, .38)', tintMid: 'rgba(130, 60, 70, .3)', tintNear: 'rgba(110, 50, 60, .24)',
        dust: 'rgba(170, 140, 90, .85)'
      },
      clubs: { first: 5, interval: 3.1, speed: 590, heights: ['low', 'mid', 'high'] },
      hints: [
        { col: 40, keys: 'Rollende Stämme: drüberspringen!', touch: 'Rollende Stämme: drüberspringen!' },
        { col: 62, keys: 'Traktor! Von oben ist er sicher', touch: 'Traktor! Von oben ist er sicher' },
        { col: 212, keys: 'Unter den Kisten nur geduckt durch', touch: 'Unter den Kisten nur geduckt durch' }
      ],
      chunks: [
        [
          '......o.o.o...................',
          '..S...P............X..........',
          G, G
        ],
        [
          '..........o.o.o...............',
          '.....................R........',
          G, G
        ],
        [
          '.........G....................',
          '........===...................',
          _,
          '...HH..............T..........',
          G, G
        ],
        [
          '.........====.................',
          '.......................R.C....',
          '#####............#############',
          '#####............#############'
        ],
        [
          '...o.o.o......................',
          '..........XX.......B......XX..',
          G, G
        ],
        [
          '............G.................',
          '...........===................',
          _,
          _,
          '.....====.....................',
          _,
          '.....................T........',
          G, G
        ],
        [
          '........o.o.o.................',
          '..K..................R...C....',
          '#########~~~~#################',
          G
        ],
        [
          '..........XXXXXXX.............',
          '.............G.........B......',
          G, G
        ],
        [
          '.......o.o.o..................',
          '...................T.....C....',
          G, G
        ],
        [
          '..o.o.o.......................',
          '.........R.......B............',
          G, G
        ],
        [
          '..o.o.o.......................',
          '......P.P.............E.......',
          G, G
        ]
      ]
    }
  ];
})();
