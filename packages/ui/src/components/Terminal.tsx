import { useRef, useEffect } from 'react';

interface Props {
  output: string;
}

export default function Terminal({ output }: Props) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [output]);

  return (
    <pre
      ref={ref}
      className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 overflow-auto max-h-96"
    >
      {output || 'No output'}
    </pre>
  );
}
