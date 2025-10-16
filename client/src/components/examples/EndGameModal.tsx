import { EndGameModal } from '../EndGameModal';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function EndGameModalExample() {
  const [isOpen, setIsOpen] = useState(true);
  const [isWin, setIsWin] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        <Button onClick={() => { setIsWin(true); setIsOpen(true); }}>Show Win</Button>
        <Button onClick={() => { setIsWin(false); setIsOpen(true); }}>Show Loss</Button>
      </div>
      <EndGameModal
        isOpen={isOpen}
        isWin={isWin}
        targetDate="200769"
        eventTitle="Apollo 11 Moon Landing"
        eventDescription="Neil Armstrong becomes the first human to set foot on the Moon."
        numGuesses={3}
        onPlayAgain={() => setIsOpen(false)}
        onHome={() => console.log('Home')}
      />
    </div>
  );
}
