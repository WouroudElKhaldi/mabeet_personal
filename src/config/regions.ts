// Lebanon's regions (its governorates, Akkar with the North, Baalbek-Hermel with the Bekaa, Nabatieh with the
// South) and the towns and areas in each. A place stores its town as its area ("Ehden"), so searching for a
// region ("North Lebanon", "the north", "الشمال") looks for any of its towns instead. All lower case.

export const REGIONS = {
  north: {
    names: [
      "north",
      "north lebanon",
      "the north",
      "shmal",
      "el shmal",
      "الشمال",
      "شمال لبنان",
      "لبنان الشمالي",
    ],
    areas: [
      "tripoli",
      "batroun",
      "ehden",
      "zgharta",
      "bcharre",
      "bsharri",
      "tannourine",
      "douma",
      "hasroun",
      "qadisha",
      "koura",
      "amioun",
      "chekka",
      "anfeh",
      "akkar",
      "halba",
      "qobayat",
      "kousba",
      "bakhoun",
    ],
  },
  "mount-lebanon": {
    names: ["mount lebanon", "jabal lebanon", "جبل لبنان"],
    areas: [
      "chouf",
      "deir el qamar",
      "beiteddine",
      "baakline",
      "barouk",
      "maasser",
      "aley",
      "bhamdoun",
      "souk el gharb",
      "metn",
      "broummana",
      "beit mery",
      "baskinta",
      "bikfaya",
      "dhour el choueir",
      "zaarour",
      "keserwan",
      "jounieh",
      "harissa",
      "faraya",
      "faqra",
      "kfardebian",
      "mzaar",
      "ehmej",
      "byblos",
      "jbeil",
      "laqlouq",
      "annaya",
      "aaqoura",
    ],
  },
  beirut: {
    names: ["beirut", "بيروت"],
    areas: ["beirut", "achrafieh", "hamra", "gemmayzeh", "mar mikhael", "verdun", "ras beirut", "badaro"],
  },
  bekaa: {
    names: ["bekaa", "beqaa", "the bekaa", "البقاع"],
    areas: [
      "bekaa",
      "zahle",
      "chtaura",
      "anjar",
      "baalbek",
      "hermel",
      "rachaya",
      "kefraya",
      "ammiq",
      "taanayel",
      "saghbine",
      "jdita",
    ],
  },
  south: {
    names: ["south", "south lebanon", "the south", "jnoub", "الجنوب", "جنوب لبنان"],
    areas: [
      "saida",
      "sidon",
      "tyre",
      "sour",
      "jezzine",
      "nabatieh",
      "naqoura",
      "marjayoun",
      "bint jbeil",
      "hasbaya",
      "rmeish",
    ],
  },
} as const;

type RegionKey = keyof typeof REGIONS;

/** A region's key from its name in English, Arabic or Arabizi ("north lebanon" → "north"), or undefined. */
function regionNamed(text: string): RegionKey | undefined {
  const wanted = text.trim().toLowerCase();
  return (Object.keys(REGIONS) as RegionKey[]).find(
    (key) => key === wanted || (REGIONS[key].names as readonly string[]).includes(wanted),
  );
}

/** What an area search should look for: every town of a region, or the text itself. */
export function areasMatching(area: string): readonly string[] {
  const region = regionNamed(area);
  return region ? REGIONS[region].areas : [area.trim()];
}
