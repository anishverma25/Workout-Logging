// src/domain/analytics/citations.ts
//
// Single source of truth for every research-backed number in Overload.
// Reference a citation by id from the methodology / Evidence Corner UI.
// Keep this file as the only place DOIs live, so links stay consistent app-wide.
//
// Each metric lists the citation ids that back it. Numbers marked `kind: "definition"`
// are arithmetic or product rules and intentionally carry no citation.

export interface Citation {
  id: string;
  authors: string;
  /** Absent for textbooks with many editions. */
  year?: number;
  title: string;
  journal: string;
  doi?: string; // preferred link target
  url?: string; // fallback when no resolvable DOI
  openAccess: boolean;
}

export const CITATIONS: Record<string, Citation> = {
  pelland2026: {
    id: 'pelland2026',
    authors: 'Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC',
    year: 2026,
    title:
      'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains',
    journal: 'Sports Medicine 56(2):481-505',
    doi: '10.1007/s40279-025-02344-w',
    openAccess: false,
  },
  bazValle2021: {
    id: 'bazValle2021',
    authors: 'Baz-Valle E, Fontes-Villalba M, Santos-Concejero J',
    year: 2021,
    title:
      'Total Number of Sets as a Training Volume Quantification Method for Muscle Hypertrophy: A Systematic Review',
    journal: 'Journal of Strength and Conditioning Research 35(3):870-878',
    doi: '10.1519/JSC.0000000000002776',
    openAccess: false,
  },
  nuzzo2024: {
    id: 'nuzzo2024',
    authors: 'Nuzzo JL, Pinto MD, Nosaka K, Steele J',
    year: 2024,
    title:
      'Maximal Number of Repetitions at Percentages of the One Repetition Maximum: A Meta-Regression and Moderator Analysis of Sex, Age, Training Status, and Exercise',
    journal: 'Sports Medicine 54:303-321',
    doi: '10.1007/s40279-023-01937-7',
    openAccess: false,
  },
  reynolds2006: {
    id: 'reynolds2006',
    authors: 'Reynolds JM, Gordon TJ, Robergs RA',
    year: 2006,
    title:
      'Prediction of One Repetition Maximum Strength From Multiple Repetition Maximum Testing and Anthropometry',
    journal: 'Journal of Strength and Conditioning Research 20(3):584-592',
    // DOI checked against Crossref (title, authors, volume, pages).
    doi: '10.1519/R-15304.1',
    openAccess: false,
  },
  zourdos2016: {
    id: 'zourdos2016',
    authors:
      'Zourdos MC, Klemp A, Dolan C, Quiles JM, Schau KA, Jo E, Helms E, Esgro B, Duncan S, Garcia Merino S, Blanco R',
    year: 2016,
    title:
      'Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve',
    journal: 'Journal of Strength and Conditioning Research 30(1):267-275',
    doi: '10.1519/JSC.0000000000001049',
    openAccess: false,
  },
  helms2016rir: {
    id: 'helms2016rir',
    authors: 'Helms ER, Cronin J, Storey A, Zourdos MC',
    year: 2016,
    title:
      'Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training',
    journal: 'Strength and Conditioning Journal 38(4):42-49',
    doi: '10.1519/SSC.0000000000000218',
    openAccess: true,
  },
  halperin2022: {
    id: 'halperin2022',
    authors:
      'Halperin I, Malleron T, Har-Nir I, Androulakis-Korakakis P, Wolf M, Fisher J, Steele J',
    year: 2022,
    title:
      'Accuracy in Predicting Repetitions to Task Failure in Resistance Exercise: A Scoping Review and Exploratory Meta-analysis',
    journal: 'Sports Medicine 52(2):377-390',
    doi: '10.1007/s40279-021-01559-x',
    openAccess: false,
  },
  robinson2024: {
    id: 'robinson2024',
    authors: 'Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC',
    year: 2024,
    title:
      'Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions',
    journal: 'Sports Medicine 54(9):2209-2231',
    doi: '10.1007/s40279-024-02069-2',
    openAccess: false,
  },
  singer2024: {
    id: 'singer2024',
    authors:
      'Singer A, Wolf M, Generoso L, Arias E, Delcastillo K, Echevarria E, Martinez A, Androulakis Korakakis P, Refalo MC, Swinton PA, Schoenfeld BJ',
    year: 2024,
    title:
      'Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy',
    journal: 'Frontiers in Sports and Active Living 6:1429789',
    doi: '10.3389/fspor.2024.1429789',
    openAccess: true,
  },
  plotkin2022: {
    id: 'plotkin2022',
    authors:
      'Plotkin D, Coleman M, Van Every D, Maldonado J, Oberlin D, Israetel M, Feather J, Alto A, Vigotsky AD, Schoenfeld BJ',
    year: 2022,
    title:
      'Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations',
    journal: 'PeerJ 10:e14142',
    doi: '10.7717/peerj.14142',
    openAccess: true,
  },
  schoenfeld2019freq: {
    id: 'schoenfeld2019freq',
    authors: 'Schoenfeld BJ, Grgic J, Krieger J',
    year: 2019,
    title:
      'How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency',
    journal: 'Journal of Sports Sciences 37(11):1286-1295',
    doi: '10.1080/02640414.2018.1555906',
    openAccess: false,
  },
  jaric2002: {
    id: 'jaric2002',
    authors: 'Jaric S',
    year: 2002,
    title: 'Muscle Strength Testing: Use of Normalisation for Body Size',
    journal: 'Sports Medicine 32(10):615-631',
    doi: '10.2165/00007256-200232100-00002',
    openAccess: false,
  },
  grgic2020: {
    id: 'grgic2020',
    authors: 'Grgic J, Lazinica B, Schoenfeld BJ, Pedisic Z',
    year: 2020,
    title:
      'Test-Retest Reliability of the One-Repetition Maximum (1RM) Strength Assessment: a Systematic Review',
    journal: 'Sports Medicine - Open 6:31',
    doi: '10.1186/s40798-020-00260-z',
    openAccess: true,
  },
  orsama2014: {
    id: 'orsama2014',
    authors: 'Orsama AL, Mattila E, Ermes M, van Gils M, Wansink B, Korhonen I',
    year: 2014,
    title: 'Weight Rhythms: Weight Increases during Weekends and Decreases during Weekdays',
    journal: 'Obesity Facts 7(1):36-47',
    doi: '10.1159/000356147',
    openAccess: true,
  },
  helms2014: {
    id: 'helms2014',
    authors: 'Helms ER, Aragon AA, Fitschen PJ',
    year: 2014,
    title:
      'Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation',
    journal: 'Journal of the International Society of Sports Nutrition 11:20',
    doi: '10.1186/1550-2783-11-20',
    openAccess: true,
  },
  acsm2026: {
    id: 'acsm2026',
    authors: "Currier BS, D'Souza AC, Phillips SM, et al.",
    year: 2026,
    title:
      'ACSM Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews',
    journal: 'Medicine & Science in Sports & Exercise',
    url: 'https://acsm.org/resistance-training-guidelines-update-2026/',
    openAccess: false,
  },
  // Protein targets (body page).
  morton2018: {
    id: 'morton2018',
    authors:
      'Morton RW, Murphy KT, McKellar SR, Schoenfeld BJ, Henselmans M, Helms E, Aragon AA, Devries MC, Banfield L, Krieger JW, Phillips SM',
    year: 2018,
    title:
      'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults',
    journal: 'British Journal of Sports Medicine 52(6):376-384',
    doi: '10.1136/bjsports-2017-097608',
    openAccess: true,
  },
  // Body and energy formulas (Body page). Verified against Crossref or the publisher.
  mifflin1990: {
    id: 'mifflin1990',
    authors: 'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO',
    year: 1990,
    title: 'A new predictive equation for resting energy expenditure in healthy individuals',
    journal: 'American Journal of Clinical Nutrition 51(2):241-247',
    doi: '10.1093/ajcn/51.2.241',
    openAccess: false,
  },
  frankenfield2005: {
    id: 'frankenfield2005',
    authors: 'Frankenfield D, Roth-Yousey L, Compher C',
    year: 2005,
    title:
      'Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review',
    journal: 'Journal of the American Dietetic Association 105(5):775-789',
    doi: '10.1016/j.jada.2005.02.005',
    openAccess: false,
  },
  fao2004: {
    id: 'fao2004',
    authors: 'FAO/WHO/UNU',
    year: 2004,
    title:
      'Human energy requirements: report of a Joint FAO/WHO/UNU Expert Consultation, Rome, 17-24 October 2001',
    journal:
      'FAO Food and Nutrition Technical Report Series No. 1. Rome: FAO; 2004. ISBN 92-5-105212-3, ISSN 1813-3932',
    url: 'https://www.fao.org/3/y5686e/y5686e00.htm',
    openAccess: true,
  },
  compendium2024: {
    id: 'compendium2024',
    authors: 'Herrmann SD, Willis EA, Ainsworth BE, et al.',
    year: 2024,
    title:
      '2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities',
    journal: 'Journal of Sport and Health Science 13(1):6-12',
    doi: '10.1016/j.jshs.2023.10.010',
    openAccess: false,
  },
  hodgdon1984: {
    id: 'hodgdon1984',
    authors: 'Hodgdon JA, Beckett MB',
    year: 1984,
    title:
      'Prediction of percent body fat for U.S. Navy men from body circumferences and height (Report No. 84-11); Prediction of percent body fat for U.S. Navy women from body circumferences and height (Report No. 84-29)',
    journal:
      'Naval Health Research Center, San Diego, CA. Technical reports 84-11 (March 1984) and 84-29 (June 1984)',
    url: 'https://apps.dtic.mil/sti/tr/pdf/ADA143890.pdf',
    openAccess: true,
  },
  kouri1995: {
    id: 'kouri1995',
    authors: 'Kouri EM, Pope HG Jr, Katz DL, Oliva P',
    year: 1995,
    title: 'Fat-free mass index in users and nonusers of anabolic-androgenic steroids',
    journal: 'Clinical Journal of Sport Medicine 5(4):223-228',
    doi: '10.1097/00042752-199510000-00003',
    openAccess: false,
  },
  who2004bmi: {
    id: 'who2004bmi',
    authors: 'WHO Expert Consultation',
    year: 2004,
    title:
      'Appropriate body-mass index for Asian populations and its implications for policy and intervention strategies',
    journal: 'The Lancet 363(9403):157-163',
    doi: '10.1016/S0140-6736(03)15268-3',
    openAccess: false,
  },
  helms2014protein: {
    id: 'helms2014protein',
    authors: 'Helms ER, Zinn C, Rowlands DS, Brown SR',
    year: 2014,
    title:
      'A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes',
    journal: 'International Journal of Sport Nutrition and Exercise Metabolism 24(2):127-138',
    doi: '10.1123/ijsnem.2013-0054',
    openAccess: false,
  },
  rippetoe2009: {
    id: 'rippetoe2009',
    authors: 'Rippetoe M, Kilgore L',
    year: 2009,
    title: 'Practical Programming for Strength Training, 2nd edition',
    journal: 'Wichita Falls, TX: The Aasgaard Company. ISBN 978-0-9825227-0-7',
    openAccess: false,
  },
  mcardleKatch: {
    id: 'mcardleKatch',
    authors: 'McArdle WD, Katch FI, Katch VL',
    title: 'Exercise Physiology: Nutrition, Energy, and Human Performance',
    journal: 'Textbook (Lippincott Williams & Wilkins / Wolters Kluwer), multiple editions',
    openAccess: false,
  },
  dots2019: {
    id: 'dots2019',
    authors: 'Konertz T (BVDK, German Powerlifting Federation)',
    year: 2019,
    title: 'DOTS (Dynamic Objective Team Scoring) bodyweight coefficient',
    journal: '',
    url: 'https://inchcalculator.com/lifting-strength-calculator',
    openAccess: true,
  },
  lopezVivancos2023: {
    id: 'lopezVivancos2023',
    authors: 'López-Vivancos A, González-Gálvez N, Orquín-Castrillón FJ, Vale RGS, Marcos-Pardo PJ',
    year: 2023,
    title:
      'Electromyographic Activity of the Pectoralis Major Muscle during Traditional Bench Press and Other Variants of Pectoral Exercises: A Systematic Review and Meta-Analysis',
    journal: 'Applied Sciences 13(8):5203',
    doi: '10.3390/app13085203',
    openAccess: true,
  },
  // Training load (Progress, balance and load).
  gabbett2016: {
    id: 'gabbett2016',
    authors: 'Gabbett TJ',
    year: 2016,
    title:
      'The training-injury prevention paradox: should athletes be training smarter and harder?',
    journal: 'British Journal of Sports Medicine 50(5):273-280',
    doi: '10.1136/bjsports-2015-095788',
    openAccess: true,
  },
  foster2001: {
    id: 'foster2001',
    authors:
      'Foster C, Florhaug JA, Franklin J, Gottschall L, Hrovatin LA, Parker S, Doleshal P, Dodge C',
    year: 2001,
    title: 'A new approach to monitoring exercise training',
    journal: 'Journal of Strength and Conditioning Research 15(1):109-115',
    doi: '10.1519/00124278-200102000-00019',
    openAccess: false,
  },
};

// Which citations back each calculated metric. "definition" = arithmetic / product rule, no paper.
export const METRIC_EVIDENCE: Record<
  string,
  { kind: 'evidence' | 'definition'; citations: string[] }
> = {
  estimated1RM: { kind: 'evidence', citations: ['reynolds2006', 'nuzzo2024'] },
  effortInput: { kind: 'evidence', citations: ['zourdos2016', 'helms2016rir', 'halperin2022'] },
  muscleHardSets: { kind: 'evidence', citations: ['pelland2026', 'bazValle2021'] },
  volumeLoad: { kind: 'definition', citations: ['bazValle2021'] },
  relativeStrength: { kind: 'evidence', citations: ['jaric2002'] },
  progression: { kind: 'evidence', citations: ['plotkin2022'] },
  restTimer: { kind: 'evidence', citations: ['singer2024'] },
  effortTarget: { kind: 'evidence', citations: ['robinson2024'] },
  frequency: { kind: 'evidence', citations: ['schoenfeld2019freq', 'pelland2026', 'acsm2026'] },
  adherence: { kind: 'definition', citations: ['acsm2026'] },
  bodyWeightTrend: { kind: 'evidence', citations: ['orsama2014'] },
  weightChangeRate: { kind: 'evidence', citations: ['helms2014'] },
  insightThreshold: { kind: 'evidence', citations: ['grgic2020'] },
  personalRecords: { kind: 'definition', citations: [] },
  workoutsPerWeek: { kind: 'definition', citations: [] },
  trialLength: { kind: 'definition', citations: [] },
  // Body page.
  bmr: { kind: 'evidence', citations: ['mifflin1990', 'frankenfield2005', 'mcardleKatch'] },
  maintenance: { kind: 'evidence', citations: ['fao2004', 'compendium2024'] },
  protein: { kind: 'evidence', citations: ['morton2018', 'helms2014protein'] },
  bodyFat: { kind: 'evidence', citations: ['hodgdon1984'] },
  bmi: { kind: 'evidence', citations: ['who2004bmi'] },
  ffmi: { kind: 'evidence', citations: ['kouri1995'] },
  strengthLevels: { kind: 'evidence', citations: ['rippetoe2009', 'dots2019'] },
  muscleShares: { kind: 'evidence', citations: ['lopezVivancos2023'] },
  trainingLoad: { kind: 'evidence', citations: ['gabbett2016', 'foster2001'] },
};

export function citationUrl(c: Citation): string {
  return c.doi ? `https://doi.org/${c.doi}` : (c.url ?? '');
}
