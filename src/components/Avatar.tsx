/* eslint-disable @next/next/no-img-element */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  photoUrl,
  size = 46,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <img
        className="avatar"
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
