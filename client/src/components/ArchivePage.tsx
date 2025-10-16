import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Archive } from "lucide-react";

interface ArchivePageProps {
  onBack: () => void;
  onPlayPuzzle: (puzzleId: string) => void;
  puzzles: Array<{
    date_id: string;
    target_date: string;
    event_title: string;
    event_description: string;
  }>;
}

export function ArchivePage({ onBack, onPlayPuzzle, puzzles }: ArchivePageProps) {
  const formatDate = (date: string) => {
    if (date.length !== 6) return date;
    const day = date.substring(0, 2);
    const month = date.substring(2, 4);
    const year = date.substring(4, 6);
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <h2 className="text-2xl font-semibold">Archive</h2>

        <div className="w-9" />
      </div>

      <div className="flex-1">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Archive className="h-5 w-5" />
            <p>Play previous historical date puzzles</p>
          </div>

          {puzzles.map((puzzle, index) => (
            <Card key={puzzle.date_id} className="p-4 hover-elevate" data-testid={`archive-puzzle-${index}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Puzzle #{index + 1}
                    </span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatDate(puzzle.target_date)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{puzzle.event_title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {puzzle.event_description}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => onPlayPuzzle(puzzle.date_id)}
                  data-testid={`button-play-${puzzle.date_id}`}
                >
                  Play
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
