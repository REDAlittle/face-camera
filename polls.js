/* Configuration partagée : présentation et page de vote */
window.FC = {
  relay: 'https://ntfy.sh/',
  topic: function (room) { return 'gopod-facecam-' + room; },
  polls: {
    thermo: {
      tab: 'Thermomètre',
      question: 'À quel point êtes-vous à l’aise face à une caméra ?',
      hint: '1 · Je fuis les objectifs — 10 · Je pourrais présenter le JT',
      opts: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      scale: true
    },
    q1: {
      tab: 'Quiz 1',
      question: 'Combien de temps faut-il pour juger si un visage inspire confiance ?',
      opts: ['A', 'B', 'C'],
      labels: ['7 secondes', '30 secondes', '1/10e de seconde'],
      correct: 'C'
    },
    q2: {
      tab: 'Quiz 2',
      question: '« 93 % de la communication passe par le non-verbal. »',
      opts: ['VRAI', 'FAUX'],
      labels: ['Vrai', 'Faux'],
      correct: 'FAUX'
    },
    battle: {
      tab: 'Battle',
      question: 'Quel texte vous donne envie d’appeler ?',
      opts: ['A', 'B'],
      labels: ['Prompt A · le réflexe', 'Prompt B · le CADRE']
    }
  },
  prompt: [
    'Tu es scénariste spécialisée en vidéos courtes pour des expertes.',
    '',
    'C — Je suis [métier]. J’aide [qui] à [résultat]. Ce qui me distingue : [singularité].',
    'A — Mon audience : [qui], qui souffre de [problème] et rêve de [désir].',
    'D — Format : vidéo face caméra de 60 secondes (environ 150 mots) pour [Instagram / LinkedIn].',
    'R — Ton : chaleureux, direct, enthousiaste. Vouvoiement. Zéro jargon.',
    'E — Structure : accroche, cible, déclic, preuve, invitation. Phrases de 12 mots maximum, écrites pour être dites à voix haute.',
    '',
    'Avant d’écrire, pose-moi 5 questions pour bien me connaître.'
  ].join('\n'),
  relances: [
    'Propose 3 accroches : une question, un chiffre, une histoire.',
    'Réécris pour l’oral : phrases courtes, une respiration par ligne.',
    'Ajoute cet exemple vrai, tiré de mon expérience : [anecdote].',
    'Coupe à 150 mots. Garde ce qui me ressemble, enlève la brochure.',
    'Joue ma cliente idéale : qu’est-ce qui te ferait arrêter de scroller ?'
  ],
  checklist: [
    'Mon pitch chronométré : 60 s, pas plus',
    'Mes mots-clés notés, pas tout le texte',
    'Ma première phrase connue par cœur',
    'Ma cliente idéale en tête, avec un prénom',
    'Ma tenue validée, unie et mate',
    'Poudre, baume à lèvres, brosse',
    'De l’eau, et le téléphone en mode avion',
    'Trois respirations 4-4-6, un sourire, top !',
    'Mon code INSPIREES : −20 % sur ma prochaine session GoPod'
  ]
};
