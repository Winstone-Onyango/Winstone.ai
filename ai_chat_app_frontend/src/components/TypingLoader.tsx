interface Props {
  label?: string;
}

const TypingLoader = ({ label }: Props) => {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5" aria-label={label ?? "AI is typing"}>
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
};

export default TypingLoader;
