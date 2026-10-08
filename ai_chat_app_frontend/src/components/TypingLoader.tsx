
const TypingLoader = () => {
  return (
    <div className="flex items-center space-x-1 px-4 py-2">
      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
    </div>
  )
}

export default TypingLoader