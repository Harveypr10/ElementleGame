import { supabaseAdmin } from './supabase';

const puzzlesData = [
  {
    date: '2025-10-01',
    target_date: '251015',
    event_title: 'Battle of Agincourt',
    event_description: "Henry V's English army achieved a decisive victory against a much larger French force during the Hundred Years' War.",
    clue1: 'A famous English king won this battle',
    clue2: "It took place during the Hundred Years' War"
  },
  {
    date: '2025-10-02',
    target_date: '020966',
    event_title: 'Great Fire of London',
    event_description: "A major conflagration that destroyed much of the City of London, including St. Paul's Cathedral.",
    clue1: 'This disaster destroyed much of London',
    clue2: "St. Paul's Cathedral was lost in this event"
  },
  {
    date: '2025-10-03',
    target_date: '040776',
    event_title: 'Declaration of Independence',
    event_description: 'The thirteen American colonies declared themselves independent from British rule.',
    clue1: 'America declared freedom from Britain',
    clue2: 'This document was signed in Philadelphia'
  },
  {
    date: '2025-10-04',
    target_date: '180615',
    event_title: 'Battle of Waterloo',
    event_description: "Napoleon's final defeat at the hands of the Duke of Wellington and Prussian forces.",
    clue1: 'Napoleon was finally defeated here',
    clue2: 'The Duke of Wellington led the victors'
  },
  {
    date: '2025-10-05',
    target_date: '171203',
    event_title: 'First Powered Flight',
    event_description: 'The Wright Brothers achieved the first sustained, controlled, powered heavier-than-air flight.',
    clue1: 'Two brothers made history in the air',
    clue2: 'This happened at Kitty Hawk'
  },
  {
    date: '2025-10-06',
    target_date: '200769',
    event_title: 'Apollo 11 Moon Landing',
    event_description: 'Neil Armstrong becomes the first human to set foot on the Moon.',
    clue1: 'One small step for man...',
    clue2: 'Neil Armstrong walked here'
  },
  {
    date: '2025-10-07',
    target_date: '091189',
    event_title: 'Fall of the Berlin Wall',
    event_description: 'The barrier dividing East and West Berlin was opened, marking the end of the Cold War.',
    clue1: 'A famous wall came down',
    clue2: 'This ended the division of Germany'
  },
  {
    date: '2025-10-08',
    target_date: '081025',
    event_title: 'Great Chicago Fire',
    event_description: 'A massive fire destroys much of Chicago, killing hundreds and leaving thousands homeless.',
    clue1: 'A blaze that reshaped a Midwestern city',
    clue2: 'Legend blames a cow for starting it'
  },
  {
    date: '2025-10-09',
    target_date: '091025',
    event_title: 'Che Guevara Executed',
    event_description: 'Revolutionary Che Guevara is captured and executed in Bolivia.',
    clue1: 'A bearded guerrilla in a beret',
    clue2: 'His face became a global protest icon'
  },
  {
    date: '2025-10-10',
    target_date: '101025',
    event_title: 'Xinhai Revolution',
    event_description: 'Revolution in China begins, leading to the fall of the Qing dynasty.',
    clue1: 'The last imperial dynasty faced collapse',
    clue2: 'Sparked the birth of a republic in Asia'
  },
  {
    date: '2025-10-11',
    target_date: '111025',
    event_title: 'Second Vatican Council Opens',
    event_description: 'Pope John XXIII opens Vatican II, modernising the Catholic Church.',
    clue1: 'A council that reshaped Catholic worship',
    clue2: 'Mass in local languages became possible'
  },
  {
    date: '2025-10-12',
    target_date: '121025',
    event_title: 'Columbus Reaches Americas',
    event_description: 'Christopher Columbus makes landfall in the Bahamas, opening European exploration.',
    clue1: 'A voyage backed by Spanish monarchs',
    clue2: "He thought he'd reached Asia"
  },
  {
    date: '2025-10-13',
    target_date: '131025',
    event_title: 'Knights Templar Arrested',
    event_description: 'King Philip IV of France orders mass arrest of the Knights Templar.',
    clue1: 'A secretive order of warrior monks',
    clue2: 'Friday the 13th superstition begins here'
  },
  {
    date: '2025-10-14',
    target_date: '141025',
    event_title: 'Battle of Hastings',
    event_description: 'William the Conqueror defeats Harold II, beginning Norman rule in England.',
    clue1: "An arrow in the eye sealed a king's fate",
    clue2: 'The last successful invasion of England'
  },
  {
    date: '2025-10-15',
    target_date: '151025',
    event_title: 'Gregorian Calendar Skips',
    event_description: 'In Catholic countries, 10 days are skipped to align with the new calendar.',
    clue1: 'People went to bed and woke up ten days later',
    clue2: 'A papal decree fixed drifting seasons'
  },
  {
    date: '2025-10-16',
    target_date: '161025',
    event_title: 'Execution of Marie Antoinette',
    event_description: 'French queen executed during the Revolution.',
    clue1: 'A monarch met the guillotine',
    clue2: 'Her name is tied to a cake quote'
  },
  {
    date: '2025-10-17',
    target_date: '171025',
    event_title: 'Al Capone Convicted',
    event_description: 'Chicago gangster Al Capone convicted of tax evasion.',
    clue1: 'A mob boss brought down by accountants',
    clue2: 'Not bullets, but ledgers ended his reign'
  },
  {
    date: '2025-10-18',
    target_date: '181025',
    event_title: 'Alaska Purchase',
    event_description: 'The U.S. formally takes possession of Alaska from Russia.',
    clue1: 'A land deal once mocked as folly',
    clue2: 'Gold and oil later proved its worth'
  },
  {
    date: '2025-10-19',
    target_date: '191025',
    event_title: 'Surrender at Yorktown',
    event_description: 'British General Cornwallis surrenders to Washington, ending major fighting in the American Revolution.',
    clue1: 'A decisive blow in a colonial war',
    clue2: 'French fleet helped seal the victory'
  },
  {
    date: '2025-10-20',
    target_date: '201025',
    event_title: 'Sydney Opera House Opens',
    event_description: "Australia's iconic performing arts centre is officially opened.",
    clue1: 'A building shaped like sails',
    clue2: 'An icon on Sydney Harbour'
  },
  {
    date: '2025-10-21',
    target_date: '211025',
    event_title: 'Battle of Trafalgar',
    event_description: 'Admiral Nelson defeats the French and Spanish fleets, securing British naval supremacy.',
    clue1: "A one‑eyed admiral's last victory",
    clue2: "'England expects that every man will do his duty'"
  },
  {
    date: '2025-10-22',
    target_date: '221025',
    event_title: 'Cuban Missile Crisis Peak',
    event_description: 'President Kennedy announces a naval blockade of Cuba, bringing the world close to nuclear war.',
    clue1: 'Thirteen days of tension',
    clue2: 'A standoff over missiles near Florida'
  },
  {
    date: '2025-10-23',
    target_date: '231025',
    event_title: 'Apple Releases iPod',
    event_description: 'Apple launches the iPod, revolutionising portable music.',
    clue1: '1,000 songs in your pocket',
    clue2: 'White earbuds became iconic'
  },
  {
    date: '2025-10-24',
    target_date: '241025',
    event_title: 'United Nations Founded',
    event_description: 'The UN Charter comes into force, establishing the United Nations.',
    clue1: 'An organisation born after WWII',
    clue2: 'Its HQ is in New York City'
  },
  {
    date: '2025-10-25',
    target_date: '251025',
    event_title: 'Charge of the Light Brigade',
    event_description: 'British cavalry make a doomed charge during the Crimean War.',
    clue1: "'Into the valley of Death rode the six hundred'",
    clue2: 'A disastrous cavalry charge'
  },
  {
    date: '2025-10-26',
    target_date: '261025',
    event_title: 'Gunfight at the O.K. Corral',
    event_description: 'Famous shootout in Tombstone, Arizona, involving Wyatt Earp and Doc Holliday.',
    clue1: 'A Wild West showdown',
    clue2: 'Lawmen vs outlaws in Arizona'
  },
  {
    date: '2025-10-27',
    target_date: '271025',
    event_title: 'New York Subway Opens',
    event_description: 'The first underground line of the New York City Subway opens to the public.',
    clue1: "America's largest metro system begins",
    clue2: 'Underground trains in Manhattan'
  },
  {
    date: '2025-10-28',
    target_date: '281025',
    event_title: 'Statue of Liberty Dedicated',
    event_description: 'The Statue of Liberty is officially unveiled in New York Harbor.',
    clue1: 'A gift from France',
    clue2: 'A torch‑bearing lady greets arrivals'
  },
  {
    date: '2025-10-29',
    target_date: '291025',
    event_title: 'Wall Street Crash',
    event_description: 'Stock market collapse triggers the Great Depression.',
    clue1: 'Known as Black Tuesday',
    clue2: 'Billions wiped off in hours'
  },
  {
    date: '2025-10-30',
    target_date: '301025',
    event_title: 'War of the Worlds Broadcast',
    event_description: "Orson Welles' radio play causes panic, mistaken for real news of an alien invasion.",
    clue1: 'Martians on the radio',
    clue2: "Orson Welles' most famous hoax"
  },
  {
    date: '2025-10-31',
    target_date: '311025',
    event_title: "Martin Luther's 95 Theses",
    event_description: 'Martin Luther nails his 95 Theses to the church door in Wittenberg, sparking the Reformation.',
    clue1: 'A monk challenges indulgences',
    clue2: 'Sparked the Protestant Reformation'
  }
];

export async function seedPuzzles() {
  console.log('Seeding puzzles to Supabase...');
  
  try {
    // Insert all puzzles
    const { data, error } = await supabaseAdmin
      .from('puzzles')
      .upsert(puzzlesData.map((puzzle, index) => ({
        id: index + 1,
        date: puzzle.date,
        target_date: puzzle.target_date,
        event_title: puzzle.event_title,
        event_description: puzzle.event_description,
        clue1: puzzle.clue1,
        clue2: puzzle.clue2
      })), { onConflict: 'date' });

    if (error) {
      console.error('Error seeding puzzles:', error);
      throw error;
    }

    console.log('Successfully seeded', puzzlesData.length, 'puzzles');
    return data;
  } catch (error) {
    console.error('Failed to seed puzzles:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPuzzles()
    .then(() => {
      console.log('Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
