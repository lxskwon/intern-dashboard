/**
 * Renders body text line-by-line. Lines starting with a dash/bullet (- – •)
 * become hanging-indent bullets so wrapped lines align with the text, not the
 * marker. Shared by the log entries, the printable report, and the activity feed
 * so bullets look identical everywhere. Server-safe (no hooks).
 */
export function BodyText({ text }: { text: string }) {
  // Normalize CRLF/CR line endings so the bullet regex matches consistently
  // (otherwise a trailing \r blocks the match and the line renders as plain).
  return (
    <>
      {text.replace(/\r\n?/g, "\n").split("\n").map((line, i) => {
        const m = line.match(/^\s*([-–•])\s+(.+)$/);
        if (m) {
          return (
            <div className="journal-bullet" key={i}>
              <span className="journal-bullet-mark">{m[1]}</span>
              <span>{m[2]}</span>
            </div>
          );
        }
        return (
          <div className="journal-line" key={i}>
            {line === "" ? " " : line}
          </div>
        );
      })}
    </>
  );
}
