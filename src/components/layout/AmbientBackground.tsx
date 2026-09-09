// Three large, heavily-blurred gradient blobs that slowly drift and pulse
// behind the app shell - the "moving gradients" half of the polish ask.
// Pure decoration: aria-hidden, pointer-events-none, and z-0 so it never
// competes with real content or the existing noise-texture overlay.
// Colors match the app's existing category-gradient palette
// (globals.css's .cat-tv/.cat-movie/.cat-anime) rather than introducing new
// ones, so this reads as "the same theme, smoother" rather than a new look.
export function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="ambient-blob bg-gradient-to-br from-indigo-600/30 to-violet-600/20"
        style={{
          top: '-15%',
          left: '-10%',
          width: '55vw',
          height: '55vw',
          animation: 'ambient-drift-a 26s ease-in-out infinite, ambient-pulse 10s ease-in-out infinite',
        }}
      />
      <div
        className="ambient-blob bg-gradient-to-br from-fuchsia-600/20 to-pink-600/15"
        style={{
          bottom: '-20%',
          right: '-15%',
          width: '50vw',
          height: '50vw',
          animation: 'ambient-drift-b 32s ease-in-out infinite, ambient-pulse 13s ease-in-out infinite',
        }}
      />
      <div
        className="ambient-blob bg-gradient-to-br from-blue-500/15 to-indigo-500/10"
        style={{
          top: '35%',
          right: '10%',
          width: '38vw',
          height: '38vw',
          animation: 'ambient-drift-c 24s ease-in-out infinite',
        }}
      />
    </div>
  );
}
