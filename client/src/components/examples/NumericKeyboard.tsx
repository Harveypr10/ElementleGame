import { NumericKeyboard } from '../NumericKeyboard';
import { useState } from 'react';

export default function NumericKeyboardExample() {
  const [input, setInput] = useState('');
  
  const keyStates = {
    '1': 'ruledOut' as const,
    '5': 'inSequence' as const,
    '9': 'correct' as const,
  };

  return (
    <div className="space-y-4">
      <div className="text-center text-xl font-mono">{input || 'Press keys...'}</div>
      <NumericKeyboard
        onDigitPress={(d) => setInput(input + d)}
        onDelete={() => setInput(input.slice(0, -1))}
        onClear={() => setInput('')}
        onEnter={() => console.log('Enter:', input)}
        keyStates={keyStates}
        canSubmit={input.length === 8}
      />
    </div>
  );
}
