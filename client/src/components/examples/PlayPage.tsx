import { PlayPage } from '../PlayPage';

export default function PlayPageExample() {
  return (
    <PlayPage
      targetDate="19690720"
      eventTitle="Apollo 11 Moon Landing"
      eventDescription="Neil Armstrong becomes the first human to set foot on the Moon."
      maxGuesses={5}
    />
  );
}
