import React from 'react';

/**
 * ============================================================================
 * AUTHENTIC APPLE / IOS EMOJI COMPONENT
 * ============================================================================
 * Renders authentic Apple / iOS / macOS emojis on all devices (Windows, Android,
 * Linux, macOS, iOS). Bypasses Android/Windows system font emoji fallback by
 * streaming the official Apple Color Emoji asset via CDN with offline text fallback.
 * ============================================================================
 */
export function IosEmoji({ emoji, size = 18, className = '', alt }) {
  if (!emoji) return null;
  const cleanEmoji = emoji.trim();
  if (!cleanEmoji) return null;

  // Apple Color Emoji CDN
  const appleUrl = `https://emojicdn.elk.sh/${encodeURIComponent(cleanEmoji)}?style=apple`;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle select-none ${className}`}
      style={{ width: size, height: size, minWidth: size }}
    >
      <img
        src={appleUrl}
        alt={alt || cleanEmoji}
        width={size}
        height={size}
        loading="lazy"
        draggable="false"
        className="w-full h-full object-contain pointer-events-none select-none"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          if (e.currentTarget.nextSibling) {
            e.currentTarget.nextSibling.style.display = 'inline';
          }
        }}
      />
      <span
        style={{ display: 'none', fontSize: `${Math.round(size * 0.85)}px`, lineHeight: 1 }}
        className="ios-emoji"
      >
        {cleanEmoji}
      </span>
    </span>
  );
}

export default IosEmoji;
