import { useState } from "react";

import type { ActorAvatarKind } from "../types.ts";

// Fallback glyphs shown when an actor has no image (or its image failed to
// load). Drawn as plain SVG so they take `currentColor` and scale with the
// avatar box.
export function FallbackIcon({ kind }: { kind: ActorAvatarKind }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "group") {
    // Two overlapping people — a group of employees.
    return (
      <svg {...common} aria-hidden>
        <circle cx="6" cy="5.5" r="2" />
        <path d="M2.5 12.5c0-2 1.6-3.2 3.5-3.2s3.5 1.2 3.5 3.2" />
        <path d="M10.2 3.9a2 2 0 0 1 0 3.6M11.3 9.5c1.5.3 2.5 1.4 2.5 3" />
      </svg>
    );
  }
  if (kind === "org") {
    // A building — the generic org type / org unit logo fallback.
    return (
      <svg {...common} aria-hidden>
        <rect x="3.5" y="2.5" width="9" height="11" rx="1" />
        <path d="M5.8 5h1.4M8.8 5h1.4M5.8 7.5h1.4M8.8 7.5h1.4M6.8 13.5v-2.6h2.4v2.6" />
      </svg>
    );
  }
  // person — a single employee / manager.
  return (
    <svg {...common} aria-hidden>
      <circle cx="8" cy="5.5" r="2.4" />
      <path d="M3.6 13c0-2.4 2-3.9 4.4-3.9s4.4 1.5 4.4 3.9" />
    </svg>
  );
}

type ActorAvatarProps = {
  image?: string | null;
  kind?: ActorAvatarKind;
  // Base CSS class. The fallback glyph wrapper additionally gets
  // `${className}--fallback` and `is-${kind}`, so each call site (dropdown
  // option, task node, …) can size and shape its own avatar.
  className?: string;
  alt?: string;
};

// Avatar for an actor: shows the entity image when present and loadable,
// otherwise a kind-appropriate fallback glyph. The failed src is tracked
// (rather than a plain boolean) so a later, different image URL for the same
// actor is retried instead of staying stuck on the fallback.
export default function ActorAvatar({
  image,
  kind = "person",
  className = "actor-avatar",
  alt = "",
}: ActorAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (image && failedSrc !== image) {
    return (
      <img
        className={className}
        src={image}
        alt={alt}
        onError={() => setFailedSrc(image)}
      />
    );
  }

  return (
    <span
      className={`${className} ${className}--fallback is-${kind}`}
      aria-hidden
    >
      <FallbackIcon kind={kind} />
    </span>
  );
}
