// Seed the database with October 2025 puzzle data
import { storage } from "./storage";

const puzzleData = [
  {
    date: "2025-10-01",
    targetDate: "011025",
    eventTitle: "Founding of Constantinople",
    eventDescription: "Constantine I dedicates Byzantium as the new capital of the Roman Empire.",
    clue1: "A city bridging Europe and Asia",
    clue2: "Later became the seat of Eastern emperors",
  },
  {
    date: "2025-10-02",
    targetDate: "021025",
    eventTitle: "Saladin Captures Jerusalem",
    eventDescription: "Saladin retakes Jerusalem from the Crusaders after the Battle of Hattin.",
    clue1: "A sultan famed for chivalry",
    clue2: "Victory after a crushing defeat of knights",
  },
  {
    date: "2025-10-03",
    targetDate: "031025",
    eventTitle: "Death of St. Francis of Assisi",
    eventDescription: "Founder of the Franciscan Order, known for devotion to poverty and nature.",
    clue1: "Preacher who called animals his brothers",
    clue2: "Inspired a monastic order of friars",
  },
  {
    date: "2025-10-04",
    targetDate: "041025",
    eventTitle: "Gregorian Calendar Introduced",
    eventDescription: "Pope Gregory XIII reforms the calendar, skipping 10 days in October.",
    clue1: "A papal reform of time itself",
    clue2: "Days vanished overnight to fix the seasons",
  },
  {
    date: "2025-10-05",
    targetDate: "051025",
    eventTitle: "March on Versailles",
    eventDescription: "French Revolution: women march to Versailles demanding bread and reforms.",
    clue1: "Crowds stormed a royal palace",
    clue2: "A protest sparked by hunger",
  },
  {
    date: "2025-10-06",
    targetDate: "061025",
    eventTitle: "Paris World's Fair Opens",
    eventDescription: "Exposition Universelle opens in Paris, showcasing the Eiffel Tower.",
    clue1: "A global showcase of inventions",
    clue2: "A new iron landmark stole the show",
  },
  {
    date: "2025-10-07",
    targetDate: "071025",
    eventTitle: "KLM Founded",
    eventDescription: "Dutch airline KLM is founded, the world's oldest still operating airline.",
    clue1: "Blue planes from the Netherlands",
    clue2: "Oldest airline still flying today",
  },
  {
    date: "2025-10-08",
    targetDate: "081025",
    eventTitle: "Great Chicago Fire",
    eventDescription: "A massive fire destroys much of Chicago, killing hundreds and leaving thousands homeless.",
    clue1: "A blaze that reshaped a Midwestern city",
    clue2: "Legend blames a cow for starting it",
  },
  {
    date: "2025-10-09",
    targetDate: "091025",
    eventTitle: "Che Guevara Executed",
    eventDescription: "Revolutionary Che Guevara is captured and executed in Bolivia.",
    clue1: "A bearded guerrilla in a beret",
    clue2: "His face became a global protest icon",
  },
  {
    date: "2025-10-10",
    targetDate: "101025",
    eventTitle: "Xinhai Revolution",
    eventDescription: "Revolution in China begins, leading to the fall of the Qing dynasty.",
    clue1: "The last imperial dynasty faced collapse",
    clue2: "Sparked the birth of a republic in Asia",
  },
  {
    date: "2025-10-11",
    targetDate: "111025",
    eventTitle: "Second Vatican Council Opens",
    eventDescription: "Pope John XXIII opens Vatican II, modernising the Catholic Church.",
    clue1: "A council that reshaped Catholic worship",
    clue2: "Mass in local languages became possible",
  },
  {
    date: "2025-10-12",
    targetDate: "121025",
    eventTitle: "Columbus Reaches Americas",
    eventDescription: "Christopher Columbus makes landfall in the Bahamas, opening European exploration.",
    clue1: "A voyage backed by Spanish monarchs",
    clue2: "He thought he'd reached Asia",
  },
  {
    date: "2025-10-13",
    targetDate: "131025",
    eventTitle: "Knights Templar Arrested",
    eventDescription: "King Philip IV of France orders mass arrest of the Knights Templar.",
    clue1: "A secretive order of warrior monks",
    clue2: "Friday the 13th superstition begins here",
  },
  {
    date: "2025-10-14",
    targetDate: "141025",
    eventTitle: "Battle of Hastings",
    eventDescription: "William the Conqueror defeats Harold II, beginning Norman rule in England.",
    clue1: "An arrow in the eye sealed a king's fate",
    clue2: "The last successful invasion of England",
  },
  {
    date: "2025-10-15",
    targetDate: "151025",
    eventTitle: "Gregorian Calendar Skips",
    eventDescription: "In Catholic countries, 10 days are skipped to align with the new calendar.",
    clue1: "People went to bed and woke up ten days later",
    clue2: "A papal decree fixed drifting seasons",
  },
  {
    date: "2025-10-16",
    targetDate: "161025",
    eventTitle: "Execution of Marie Antoinette",
    eventDescription: "French queen executed during the Revolution.",
    clue1: "A monarch met the guillotine",
    clue2: "Her name is tied to a cake quote",
  },
  {
    date: "2025-10-17",
    targetDate: "171025",
    eventTitle: "Al Capone Convicted",
    eventDescription: "Chicago gangster Al Capone convicted of tax evasion.",
    clue1: "A mob boss brought down by accountants",
    clue2: "Not bullets, but ledgers ended his reign",
  },
  {
    date: "2025-10-18",
    targetDate: "181025",
    eventTitle: "Alaska Purchase",
    eventDescription: "The U.S. formally takes possession of Alaska from Russia.",
    clue1: "A land deal once mocked as folly",
    clue2: "Gold and oil later proved its worth",
  },
  {
    date: "2025-10-19",
    targetDate: "191025",
    eventTitle: "Surrender at Yorktown",
    eventDescription: "British General Cornwallis surrenders to Washington, ending major fighting in the American Revolution.",
    clue1: "A decisive blow in a colonial war",
    clue2: "French fleet helped seal the victory",
  },
  {
    date: "2025-10-20",
    targetDate: "201025",
    eventTitle: "Sydney Opera House Opens",
    eventDescription: "Australia's iconic performing arts centre is officially opened.",
    clue1: "A building shaped like sails",
    clue2: "An icon on Sydney Harbour",
  },
  {
    date: "2025-10-21",
    targetDate: "211025",
    eventTitle: "Battle of Trafalgar",
    eventDescription: "Admiral Nelson defeats the French and Spanish fleets, securing British naval supremacy.",
    clue1: "A one‑eyed admiral's last victory",
    clue2: "'England expects that every man will do his duty'",
  },
  {
    date: "2025-10-22",
    targetDate: "221025",
    eventTitle: "Cuban Missile Crisis Peak",
    eventDescription: "President Kennedy announces a naval blockade of Cuba, bringing the world close to nuclear war.",
    clue1: "Thirteen days of tension",
    clue2: "A standoff over missiles near Florida",
  },
  {
    date: "2025-10-23",
    targetDate: "231025",
    eventTitle: "Apple Releases iPod",
    eventDescription: "Apple launches the iPod, revolutionising portable music.",
    clue1: "1,000 songs in your pocket",
    clue2: "White earbuds became iconic",
  },
  {
    date: "2025-10-24",
    targetDate: "241025",
    eventTitle: "United Nations Founded",
    eventDescription: "The UN Charter comes into force, establishing the United Nations.",
    clue1: "An organisation born after WWII",
    clue2: "Its HQ is in New York City",
  },
  {
    date: "2025-10-25",
    targetDate: "251025",
    eventTitle: "Charge of the Light Brigade",
    eventDescription: "British cavalry make a doomed charge during the Crimean War.",
    clue1: "'Into the valley of Death rode the six hundred'",
    clue2: "A disastrous cavalry charge",
  },
  {
    date: "2025-10-26",
    targetDate: "261025",
    eventTitle: "Gunfight at the O.K. Corral",
    eventDescription: "Famous shootout in Tombstone, Arizona, involving Wyatt Earp and Doc Holliday.",
    clue1: "A Wild West showdown",
    clue2: "Lawmen vs outlaws in Arizona",
  },
  {
    date: "2025-10-27",
    targetDate: "271025",
    eventTitle: "New York Subway Opens",
    eventDescription: "The first underground line of the New York City Subway opens to the public.",
    clue1: "America's largest metro system begins",
    clue2: "Underground trains in Manhattan",
  },
  {
    date: "2025-10-28",
    targetDate: "281025",
    eventTitle: "Statue of Liberty Dedicated",
    eventDescription: "The Statue of Liberty is officially unveiled in New York Harbor.",
    clue1: "A gift from France",
    clue2: "A torch‑bearing lady greets arrivals",
  },
  {
    date: "2025-10-29",
    targetDate: "291025",
    eventTitle: "Wall Street Crash",
    eventDescription: "Stock market collapse triggers the Great Depression.",
    clue1: "Known as Black Tuesday",
    clue2: "Billions wiped off in hours",
  },
  {
    date: "2025-10-30",
    targetDate: "301025",
    eventTitle: "War of the Worlds Broadcast",
    eventDescription: "Orson Welles' radio play causes panic, mistaken for real news of an alien invasion.",
    clue1: "Martians on the radio",
    clue2: "Orson Welles' most famous hoax",
  },
  {
    date: "2025-10-31",
    targetDate: "311025",
    eventTitle: "Martin Luther's 95 Theses",
    eventDescription: "Martin Luther nails his 95 Theses to the church door in Wittenberg, sparking the Reformation.",
    clue1: "A monk challenges indulgences",
    clue2: "Sparked the Protestant Reformation",
  },
];

export async function seedPuzzles() {
  console.log("Seeding October 2025 puzzles...");
  
  for (const puzzle of puzzleData) {
    try {
      const existing = await storage.getPuzzleByDate(puzzle.date);
      if (!existing) {
        await storage.createPuzzle(puzzle);
        console.log(`Created puzzle for ${puzzle.date}: ${puzzle.eventTitle}`);
      } else {
        console.log(`Puzzle already exists for ${puzzle.date}`);
      }
    } catch (error) {
      console.error(`Error seeding puzzle for ${puzzle.date}:`, error);
    }
  }
  
  console.log("All October 2025 puzzles seeded successfully!");
}
