import { useSubscription } from '@/hooks/useSubscription';

interface GoProButtonProps {
  onClick: () => void;
  isPro?: boolean;
}

export function GoProButton({ onClick, isPro: externalIsPro }: GoProButtonProps) {
  const { isPro: hookIsPro, tier } = useSubscription();
  const isPro = externalIsPro ?? hookIsPro;

  if (isPro) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center px-3 py-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 shadow-sm hover:shadow-md transition-all"
        data-testid="button-pro-status"
      >
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-amber-900 uppercase">{tier}</span>
        </div>
        <span className="text-[10px] font-medium text-amber-800">Pro</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center px-3 py-2 rounded-xl bg-gradient-to-b from-orange-400 to-orange-500 shadow-sm hover:shadow-md transition-all"
      data-testid="button-go-pro"
    >
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-normal text-white">Ads on</span>
      </div>
      <span className="text-sm font-bold text-white">Go Pro</span>
    </button>
  );
}
