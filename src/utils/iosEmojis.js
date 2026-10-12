/**
 * ============================================================================
 * IOS EMOJI CONFIGURATION & PLAYLIST PRESETS
 * ============================================================================
 * Curated collection of authentic Apple / iOS style emojis tailored for music,
 * mood playlists, vibes, and audio albums.
 * ============================================================================
 */

export const IOS_QUICK_EMOJIS = [
  '🎧', '🎵', '🎶', '🔥', '⚡', '🌙', '🌴', '✨',
  '💜', '🏖️', '🎸', '🎹', '🌊', '☕', '🚀', '💿'
];

export const IOS_EMOJI_CATEGORIES = [
  {
    name: 'Music & Audio',
    icon: '🎵',
    emojis: [
      '🎧', '🎵', '🎶', '🎸', '🎹', '🎷', '🎺', '🥁',
      '🎙️', '📻', '💿', '🔊', '🎼', '🎻', '🪕', '🕺',
      '💃', '🎤', '🎛️', '🎚️', '🪗', '🪘', '🪩', '🔈',
      '🔉', '📢', '🔔', '🔕', '📣', '🎪', '🎟️', '🎫'
    ],
  },
  {
    name: 'Vibes & Energy',
    icon: '⚡',
    emojis: [
      '🔥', '⚡', '✨', '🚀', '🎉', '🏖️', '🌴', '🌊',
      '☀️', '🏎️', '💃', '⭐', '💥', '🎆', '🍸', '🕶️',
      '🍹', '🥂', '🍻', '🛹', '🏄', '🎇', '🧨', '🔮',
      '🌟', '💫', '🌌', '🏍️', '🚁', '🛸', '🎯', '🎳'
    ],
  },
  {
    name: 'Chill & Lofi',
    icon: '🌙',
    emojis: [
      '🌙', '🌌', '☕', '🌧️', '🍃', '🛋️', '🕯️', '🪐',
      '🔮', '💤', '🖤', '🛸', '📚', '🍵', '🌃', '🌫️',
      '🍁', '🍂', '🍄', '🌲', '🪵', '🌿', '🌾', '🫖',
      '🪴', '🪟', '🛏️', '🛌', '🫥', '🩶', '🤍', '🫧'
    ],
  },
  {
    name: 'Moods & Hearts',
    icon: '💜',
    emojis: [
      '💜', '💖', '❤️', '🧡', '💛', '💚', '💙', '🤍',
      '🌸', '💎', '👑', '🌈', '🦄', '🍀', '👾', '🦋',
      '🩵', '🩷', '🤎', '💘', '💝', '💞', '💕', '💌',
      '❣️', '❤️‍🔥', '❤️‍🩹', '💐', '🪷', '🌺', '🌻', '🌹'
    ],
  },
  {
    name: 'Faces & Vibes',
    icon: '😎',
    emojis: [
      '😎', '🥳', '🤩', '🤠', '😍', '🥰', '🤤', '😌',
      '😏', '🤪', '😜', '😋', '🤫', '🤭', '🤗', '🫡',
      '👽', '🤖', '👻', '💀', '🫠', '🥹', '😇', '😈',
      '👀', '🧠', '🫀', '💯', '🤙', '✌️', '🤟', '🙌'
    ],
  },
  {
    name: 'Activities & Hype',
    icon: '🏆',
    emojis: [
      '🏆', '🥇', '🎮', '🕹️', '🎲', '🎯', '🎳', '🥊',
      '🛹', '🚴', '⚽', '🏀', '🏈', '🎾', '⛳', '🏋️',
      '🤺', '🧗', '🤹', '🪄', '🪅', '🎁', '🎈', '🎨',
      '🎬', '🎞️', '🍿', '🎪', '🛸', '🪐', '⚓', '🏎️'
    ],
  },
];

/**
 * Extracts the leading emoji from a string if present
 */
export function extractLeadingEmoji(text = '') {
  if (!text) return null;
  // Match common emoji sequences including surrogate pairs, modifiers, and variation selectors
  const emojiRegex = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u;
  const match = text.trim().match(emojiRegex);
  return match ? match[1] : null;
}

/**
 * Cleans a playlist title by stripping redundant leading emoji if an emoji is provided separately
 */
export function cleanPlaylistTitle(text = '', emoji = '') {
  if (!text) return 'My Playlist';
  let cleaned = text.trim();
  if (emoji && cleaned.startsWith(emoji)) {
    cleaned = cleaned.slice(emoji.length).trim();
  }
  return cleaned || 'My Playlist';
}

/**
 * Generates an automatic smart playlist title from a URL or folder ID
 */
export function generateDefaultPlaylistName(urlOrId = '') {
  if (!urlOrId) return { name: 'My Playlist', emoji: '🎵' };
  const str = String(urlOrId).trim();

  // If Cloudflare R2 / direct URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const urlObj = new URL(str);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const last = decodeURIComponent(segments[segments.length - 1]).replace(/[-_]/g, ' ');
        const capitalized = last.charAt(0).toUpperCase() + last.slice(1);
        if (capitalized && capitalized !== 'Music' && capitalized !== 'Songs') {
          return { name: `${capitalized} Vault`, emoji: '⚡' };
        }
      }
      return { name: 'Cloudflare R2 Bucket', emoji: '⚡' };
    } catch {
      return { name: 'Direct Audio Stream', emoji: '⚡' };
    }
  }

  // Google Drive
  return { name: 'Drive Sound Vault', emoji: '🎧' };
}
