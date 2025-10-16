import { InputGrid } from '../InputGrid';

export default function InputGridExample() {
  const guesses = [
    [
      { digit: "2", state: "notInSequence" as const, arrow: "down" as const },
      { digit: "0", state: "correct" as const },
      { digit: "0", state: "inSequence" as const, arrow: "up" as const },
      { digit: "7", state: "correct" as const },
      { digit: "6", state: "correct" as const },
      { digit: "9", state: "correct" as const },
    ],
  ];

  return <InputGrid guesses={guesses} currentInput="1234" maxGuesses={5} />;
}
