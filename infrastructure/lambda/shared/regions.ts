
export const REGION_MAPPING: Record<string, string[]> = {
  "Central Auckland": [
    "cbd", "central", "ponsonby", "parnell", "newmarket", "mt eden", "mount eden", 
    "britomart", "viaduct", "wynyard", "epsom", "grey lynn", "pt chev", "point chevalier", 
    "mt albert", "mount albert", "mission bay", "st heliers", "remuera", "onehunga", 
    "ellerslie", "greenlane", "kingsland", "grafton", "newton", "freemans bay", 
    "herne bay", "sylvia park", "sandringham", "balmoral", "avondale", "meadowbank", 
    "glendowie", "kohimarama", "orakei", "panmure", "mt wellington", "mount wellington"
  ],
  "North Shore": [
    "north shore", "takapuna", "albany", "devonport", "milford", "birkenhead", 
    "glenfield", "northcote", "browns bay", "wairau", "castor bay", "mokoia",
    "beach haven", "sunnynook", "rothesay", "orewa", "whangaparaoa", "silverdale", 
    "mairangi bay", "campbells bay", "torbay", "hillcrest", "northcross",
    "warkworth", "matakana", "snells beach", "wellsford", "stanley point"
  ],
  "West Auckland": [
    "west auckland", "henderson", "titirangi", "new lynn", "massey", "te atatu", 
    "hobsonville", "kumeu", "piha", "glen eden", "kelston", "huapai", "muriwai",
    "swanson", "ranui", "waitakere", "blockhouse bay", "whenuapai", "te henga",
    "helensville", "parakai", "riverhead", "taupaki"
  ],
  "South Auckland": [
    "south auckland", "manukau", "papatoetoe", "mangere", "manurewa", "papakura", 
    "pukekohe", "otahuhu", "takanini", "karaka", "weymouth", "wiri", "franklin",
    "drury", "mangere bridge", "otara", "waiuku", "pokeno", "tuakau", "clarks beach"
  ],
  "East Auckland": [
    "east auckland", "howick", "pakuranga", "botany", "flat bush", "half moon bay", 
    "clevedon", "dannemora", "highland park", "bucklands beach", "whitford",
    "maraetai", "beachlands", "sunnyhills", "farm cove"
  ],
  "Waiheke Island": [
    "waiheke", "oneroa", "onetangi", "surfdale", "ostend", "matiatia"
  ]
};

/**
 * Maps a specific location summary or address to an Auckland macro region.
 */
export function mapToMacroRegion(locationSummary?: string): string {
  if (!locationSummary) return "Unknown";
  const locLower = locationSummary.toLowerCase();

  for (const [region, keywords] of Object.entries(REGION_MAPPING)) {
    if (keywords.some(kw => locLower.includes(kw))) {
      return region;
    }
  }
  return "Unknown";
}
