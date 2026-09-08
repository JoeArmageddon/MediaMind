import { View, StyleSheet } from 'react-native';

// Classic manga screentone/shading lines - a tiled field of thin diagonal
// bars, clipped by the parent's overflow:hidden. Built from rotated Views
// rather than an SVG/image asset, since it needs no extra native
// dependency and looks right at any card size.
export function MangaHatch({
  color = '#161311',
  opacity = 0.16,
  spacing = 7,
  angle = '32deg',
}: {
  color?: string;
  opacity?: number;
  spacing?: number;
  angle?: string;
}) {
  const lines = Array.from({ length: 46 });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: i * spacing - 220,
            left: -120,
            width: 500,
            height: 1.4,
            backgroundColor: color,
            opacity,
            transform: [{ rotate: angle }],
          }}
        />
      ))}
    </View>
  );
}
