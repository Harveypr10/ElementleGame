import { useState } from "react";
import { WelcomePage } from "@/components/WelcomePage";
import { GameSelectionPage } from "@/components/GameSelectionPage";
import { PlayPage } from "@/components/PlayPage";
import { ThemeToggle } from "@/components/ThemeToggle";

const puzzles = [
  {
    date_id: "day1",
    target_date: "251015",
    event_title: "Battle of Agincourt",
    event_description: "Henry V's English army defeats the French in one of the most famous battles of the Hundred Years' War."
  },
  {
    date_id: "day2",
    target_date: "020966",
    event_title: "Great Fire of London",
    event_description: "A massive fire sweeps through London, destroying much of the medieval city over four days."
  },
  {
    date_id: "day3",
    target_date: "040776",
    event_title: "Declaration of Independence",
    event_description: "The United States Declaration of Independence is adopted in Philadelphia."
  },
  {
    date_id: "day4",
    target_date: "180615",
    event_title: "Battle of Waterloo",
    event_description: "Napoleon Bonaparte meets his final defeat at the Battle of Waterloo, ending his rule as Emperor of the French."
  },
  {
    date_id: "day5",
    target_date: "171203",
    event_title: "First Powered Flight",
    event_description: "The Wright brothers achieve the first powered flight at Kitty Hawk, North Carolina."
  },
  {
    date_id: "day6",
    target_date: "200769",
    event_title: "Apollo 11 Moon Landing",
    event_description: "Neil Armstrong becomes the first human to set foot on the Moon."
  },
  {
    date_id: "day7",
    target_date: "091189",
    event_title: "Fall of the Berlin Wall",
    event_description: "East and West Berliners begin dismantling the wall that divided the city for decades."
  }
];

type Screen = "welcome" | "selection" | "play";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");
  
  const getDailyPuzzle = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return puzzles[dayOfYear % puzzles.length];
  };

  const currentPuzzle = getDailyPuzzle();

  return (
    <div className="relative">
      {currentScreen === "welcome" && (
        <>
          <div className="absolute top-4 right-4 z-10">
            <ThemeToggle />
          </div>
          <WelcomePage onPlayWithoutSignIn={() => setCurrentScreen("selection")} />
        </>
      )}

      {currentScreen === "selection" && (
        <GameSelectionPage onPlayGame={() => setCurrentScreen("play")} />
      )}

      {currentScreen === "play" && (
        <PlayPage
          targetDate={currentPuzzle.target_date}
          eventTitle={currentPuzzle.event_title}
          eventDescription={currentPuzzle.event_description}
          maxGuesses={5}
          onBack={() => setCurrentScreen("selection")}
        />
      )}
    </div>
  );
}
