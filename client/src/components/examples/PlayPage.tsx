import { PlayPage } from '../PlayPage';

export default function PlayPageExample() {
  return (
    <PlayPage
      targetDate="200769"
      eventTitle="Apollo 11 Moon Landing"
      eventDescription="Neil Armstrong becomes the first human to set foot on the Moon."
      maxGuesses={5}
      onBack={() => console.log('Back')}
      onViewStats={() => console.log('View Stats')}
      onViewArchive={() => console.log('View Archive')}
    />
  );
}
