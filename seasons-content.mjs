export const briefing = [
  {
    "filename": "MAVEN_MYSTERY_GLOBAL_CHIEF_INTRO_CC.mp4",
    "label": "Universal Chief intro",
    "scope": "shared",
    "review_after_briefing": false
  },
  {
    "filename": "MAVEN_MYSTERY_GLOBAL_CITY_TITLE_01_HIGH_VALUE_THEFT_V04.mp4",
    "label": "High-Value Theft / Heist title",
    "scope": "shared",
    "review_after_briefing": false
  },
  {
    "filename": "MAVEN_MYSTERY_GLOBAL_ANNOUNCEMENT_01_HIGH_VALUE_THEFT_CC.mp4",
    "label": "Reusable theft announcement",
    "scope": "shared",
    "review_after_briefing": false
  },
  {
    "filename": "MAVEN_MYSTERY_GLOBAL_BRIEFING_ARRIVAL_TO_TV_CC.mp4",
    "label": "Briefing entrance, podium setup, Let’s begin, TV zoom",
    "scope": "shared",
    "review_after_briefing": false
  },
  {
    "filename": "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_CASE_INTRO_CC.mp4",
    "label": "The Last Loan case introduction",
    "scope": "episode-specific",
    "review_after_briefing": false
  },
  {
    "filename": "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_BM_01_MUSEUM_EXTERIOR_CC.mp4",
    "label": "Museum exterior",
    "scope": "episode-specific",
    "review_after_briefing": true
  },
  {
    "filename": "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_BM_02_EXHIBITION_PROGRAMME_CC.mp4",
    "label": "Exhibition final-evening programme",
    "scope": "episode-specific",
    "review_after_briefing": true
  },
  {
    "filename": "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_BM_03_PUBLIC_LISTING_CC.mp4",
    "label": "Missing-item public listing",
    "scope": "episode-specific",
    "review_after_briefing": true
  },
  {
    "filename": "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_BM_04_VISITOR_PHOTO_CC.mp4",
    "label": "Visitor lobby photograph",
    "scope": "episode-specific",
    "review_after_briefing": true
  },
  {
    "filename": "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_BM_05_INTAKE_REPORT_CC.mp4",
    "label": "Intake report",
    "scope": "episode-specific",
    "review_after_briefing": true
  },
  {
    "filename": "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_BRIEFING_CLOSING_CC.mp4",
    "label": "Case-file instructions and good luck",
    "scope": "episode-specific",
    "review_after_briefing": false
  }
];
export const transcript = "MAVEN_MYSTERY_S0001_E01_HIGH_VALUE_THEFT_Final_Transcript_V05.txt";
export function briefingForEdition(terminal){
  if(!terminal)return {clips:briefing,transcript};
  const replaces=new Set([briefing[4].filename,briefing[7].filename]);
  return {
    clips:briefing.map(clip=>replaces.has(clip.filename)
      ? {...clip,filename:clip.filename.replace('.mp4','_V06.mp4')}
      : clip),
    transcript:transcript.replace('_V05.txt','_V06.txt')
  };
}
export const credit = "MAVEN_SPY_GLASS_MUSIC_CREDIT.txt";
export const reactionFiles = Object.fromEntries(["CORRECT","WRONG_RETRY","CONVICT_ANYWAY"].map(key=>[key,"MAVEN_MYSTERY_GLOBAL_DEDUCTION_"+key]));
export const caseTitles = [
  [
    "01",
    "The Watch"
  ],
  [
    "02",
    "The Closing Timeline"
  ],
  [
    "03",
    "The Transfer"
  ],
  [
    "04",
    "The Return Desk"
  ],
  [
    "05",
    "The Recovery"
  ],
  [
    "06",
    "The Offer"
  ]
];
