import { GameSelectionPage } from '../GameSelectionPage';

export default function GameSelectionPageExample() {
  return (
    <div className="relative min-h-screen">
      <GameSelectionPage onPlayGame={() => console.log('Play game')} />
    </div>
  );
}
