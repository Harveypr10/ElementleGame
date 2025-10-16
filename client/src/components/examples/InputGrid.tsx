import { InputGrid } from '../InputGrid';

export default function InputGridExample() {
  const guesses = [
    [
      { digit: "1", state: "notInSequence" as const },
      { digit: "2", state: "inSequence" as const, arrow: "up" as const },
      { digit: "3", state: "correct" as const },
      { digit: "4", state: "inSequence" as const, arrow: "down" as const },
      { digit: "5", state: "notInSequence" as const },
      { digit: "6", state: "correct" as const },
      { digit: "7", state: "inSequence" as const, arrow: "up" as const },
      { digit: "8", state: "notInSequence" as const },
    ],
  ];

  return <InputGrid guesses={guesses} currentInput="1234" maxGuesses={5} />;
}
