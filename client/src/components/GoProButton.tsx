import { useSubscription } from '@/hooks/useSubscription';

interface GoProButtonProps {
  onClick: () => void;
  isPro?: boolean;
}

export function GoProButton({ onClick, isPro: externalIsPro }: GoProButtonProps) {
  const { isPro: hookIsPro } = useSubscription();
  const isPro = externalIsPro ?? hookIsPro;

  if (isPro) {
    return (
      <button
        onClick={onClick}
        className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-gradient-to-b from-orange-400 to-orange-500 shadow-sm hover:shadow-md transition-all"
        data-testid="button-pro-status"
      >
        <span className="text-sm font-bold text-white">Pro</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center px-2 py-1.5 rounded-lg bg-gradient-to-b from-orange-400 to-orange-500 shadow-sm hover:shadow-md transition-all"
      data-testid="button-go-pro"
    >
      <div className="flex items-center gap-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] font-normal text-white">Ads on</span>
      </div>
      <span className="text-xs font-bold text-white">Go Pro</span>
    </button>
  );
}
