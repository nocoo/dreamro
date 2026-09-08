const paths: Record<string, string> = {
  sword: '<path d="m6 20 4-4m-3-3 6 6M10 14 20 4l-1 6-7 7M4 18l2 2"/>',
  spear: '<path d="M5 21 17 5m-1-3 5 2-2 7-4-4ZM10 12l4 3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  crossShield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6ZM12 7v11m-5-7h10"/>',
  flame: '<path d="M12 2c2 6-5 7-4 12 0-2-3-3-3-3-3 7 2 11 7 11s10-5 7-11c-1-3-4-4-4-7 0 4-2 5-3 6 1-4 1-5 0-8Z"/>',
  bow: '<path d="M4 4c19 0 16 16 16 16L4 4m1 0c10 5 10 10 15 15M4 20 21 3m-5 0h5v5M4 20l1-5m-1 5 5-1"/>',
  cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
  bag: '<path d="M6 8h12l3 12H3L6 8Zm3 0V5a3 3 0 0 1 6 0v3M8 12h8m-4-2v7"/>',
  dagger: '<path d="m4 20 5-5m-3-3 6 6M9 13 21 3l-5 12-4 1M16 6l2 2M3 18l3 3"/>',
  star: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/>',
  spark: '<path d="m12 3 2 6 7 3-7 3-2 6-2-6-7-3 7-3Zm7-2v4m-2-2h4M4 18v4m-2-2h4"/>',
  book: '<path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2V4Zm3 4 3 1m-3 3 3 1m6-4 3-1m-3 5 3-1"/>',
  feather: '<path d="M5 20 19 4M7 17c-6-9 4-16 14-14-1 10-4 19-14 14Zm1-7 2 4m4-8v4m0 3 4 1"/>',
  music: '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="18" cy="16" rx="3" ry="2.5"/>',
  fan: '<path d="M12 21 2 7c5-6 15-6 20 0L12 21ZM8 4l4 17 4-17M4 8l8 13 8-13"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  fist: '<path d="M6 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v7-3a2 2 0 0 1 4 0v5l-5 7H9l-5-7V9a2 2 0 0 1 2 3Z"/>',
  hammer: '<path d="m4 21 9-12m-5-4 6-3 7 5-4 6-9-8Zm-1 9 4 3"/>',
  flask: '<path d="M9 3h6m-5 0v7L4 19c-1 2 1 3 3 3h10c2 0 4-1 3-3l-6-9V3M7 15h10m-8 3h1m4-1h1"/>',
  mask: '<path d="M2 7c6-4 14-4 20 0l-2 9-5 2-3-4-3 4-5-2-2-9Z"/><path d="m6 9 3 2-3 1m12-3-3 2 3 1"/>',
  wind: '<path d="M3 7h12c5 0 5-6 1-5M2 12h18c4 0 4 6 0 6M5 17h8c4 0 4 5 0 4"/>',
  drop: '<path d="M12 2c-2 4-8 9-8 13a8 8 0 0 0 16 0c0-4-6-9-8-13ZM8 15c0 2 1 3 3 3"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M9 9h6l-6 6h6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
  snow: '<path d="M12 2v20M3.4 7l17.2 10M3.4 17 20.6 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4M18 19l-1-4 4-1M3 14l4 1-1 4M18 5l-1 4 4 1"/>',
  diamond: '<path d="m12 2 9 10-9 10L3 12 12 2Zm0 0v20M3 12h18M7 7l10 10M7 17 17 7"/>',
  flower: '<path d="M12 8C5-2 1 9 8 12c-10 5 1 11 4 4 5 10 11-1 4-4 10-5-1-11-4-4Z"/><circle cx="12" cy="12" r="2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  sound: '<path d="M11 4 6 8H2v8h4l5 4V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  mute: '<path d="M11 4 6 8H2v8h4l5 4V4Zm5 5 6 6m-6 0 6-6"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
  scroll: '<path d="M7 3h12a2 2 0 0 1 2 2v3h-5M5 3a2 2 0 0 1 2 2v14a2 2 0 0 1-4 0v-3h13v3a2 2 0 0 0 4 0V5M10 8h4m-4 4h4"/>',
  settings: '<path d="m10 2 4 0 1 3 3 1 3 0 2 4-2 2 0 3 1 2-3 3-3-1-3 1-2 2-4-2v-3l-2-2-3-1 1-4 3-1 2-3Z"/><circle cx="12" cy="12" r="3"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3M8 18h8"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h.1M17 7h.1M12 12h.1M7 17h.1M17 17h.1" stroke-width="3"/>',
  rotate: '<path d="M4 9a9 9 0 1 1 0 6m0-12v6h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  leave: '<path d="M9 3H4v18h5m-1-9h14m-5-5 5 5-5 5"/>',
  heart: '<path d="M12 21 3 12C-2 5 7-1 12 6c5-7 14-1 9 6Z"/>',
  potion: '<path d="M9 2h6v6c9 6 7 14-3 14S0 14 9 8V2Zm-1 2h8M6 14h12"/><path d="m10 16 3 3"/>',
  chest: '<path d="M3 11V7c0-6 18-6 18 0v4M3 11h18v10H3V11Zm6 0v5h6v-5M5 4v7m14-7v7"/>',
  expand: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M3 15v6h6"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  leaf: '<path d="M4 20C-2 5 9 2 22 2c0 14-4 20-18 18ZM4 20 17 7M9 15v-5m0 5h5"/>',
  save: '<path d="M3 3h15l3 3v15H3V3ZM7 3v6h10V3M7 21v-8h10v8"/>',
};

export function icon(name: string, className = '', size = 24): string {
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.star}</svg>`;
}

export const ornament = `<svg viewBox="0 0 240 24" fill="none" aria-hidden="true"><path d="M0 12h83m74 0h83M89 12l8-4-3 4 3 4-8-4Zm62 0-8-4 3 4-3 4 8-4ZM104 12l16-10 16 10-16 10-16-10Zm7 0 9-5 9 5-9 5-9-5Z" stroke="currentColor"/><circle cx="120" cy="12" r="2" fill="currentColor"/></svg>`;

export const wingMark = `<svg viewBox="0 0 96 76" fill="none" aria-hidden="true"><path d="M44 42C21 38 13 21 5 11c-2 19 3 35 23 43-9-1-17-5-22-9 7 15 18 21 36 18M52 42C75 38 83 21 91 11c2 19-3 35-23 43 9-1 17-5 22-9-7 15-18 21-36 18" fill="currentColor" opacity=".78"/><path d="m48 5 7 23 15 8-15 8-7 23-7-23-15-8 15-8Z" fill="currentColor"/><path d="m48 22 4 14-4 15-4-15Z" fill="#fff9e9"/></svg>`;

export function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
