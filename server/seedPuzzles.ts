// Seed the database with initial puzzle data
import { storage } from "./storage";

const puzzleData = [
  {
    date: "2025-10-01",
    targetDate: "251015",
    eventTitle: "Battle of Agincourt",
    eventDescription: "Henry V's English army achieved a decisive victory against a much larger French force during the Hundred Years' War.",
    clue1: "A famous English king won this battle",
    clue2: "It took place during the Hundred Years' War",
  },
  {
    date: "2025-10-02",
    targetDate: "020966",
    eventTitle: "Great Fire of London",
    eventDescription: "A major conflagration that destroyed much of the City of London, including St. Paul's Cathedral.",
    clue1: "This disaster destroyed much of London",
    clue2: "St. Paul's Cathedral was lost in this event",
  },
  {
    date: "2025-10-03",
    targetDate: "040776",
    eventTitle: "Declaration of Independence",
    eventDescription: "The thirteen American colonies declared themselves independent from British rule.",
    clue1: "America declared freedom from Britain",
    clue2: "This document was signed in Philadelphia",
  },
  {
    date: "2025-10-04",
    targetDate: "180615",
    eventTitle: "Battle of Waterloo",
    eventDescription: "Napoleon's final defeat at the hands of the Duke of Wellington and Prussian forces.",
    clue1: "Napoleon was finally defeated here",
    clue2: "The Duke of Wellington led the victors",
  },
  {
    date: "2025-10-05",
    targetDate: "171203",
    eventTitle: "First Powered Flight",
    eventDescription: "The Wright Brothers achieved the first sustained, controlled, powered heavier-than-air flight.",
    clue1: "Two brothers made history in the air",
    clue2: "This happened at Kitty Hawk",
  },
  {
    date: "2025-10-06",
    targetDate: "200769",
    eventTitle: "Apollo 11 Moon Landing",
    eventDescription: "Neil Armstrong becomes the first human to set foot on the Moon.",
    clue1: "One small step for man...",
    clue2: "Neil Armstrong walked here",
  },
  {
    date: "2025-10-07",
    targetDate: "091189",
    eventTitle: "Fall of the Berlin Wall",
    eventDescription: "The barrier dividing East and West Berlin was opened, marking the end of the Cold War.",
    clue1: "A famous wall came down",
    clue2: "This ended the division of Germany",
  },
];

export async function seedPuzzles() {
  console.log("Seeding puzzles...");
  
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
  
  console.log("Puzzles seeded successfully!");
}
