interface Props {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ value, onChange, readOnly }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className="w-full h-full bg-transparent font-mono text-sm text-cc-text p-4 resize-none focus:outline-none"
      spellCheck={false}
    />
  );
}
