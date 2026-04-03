// components/Leafletmap.tsx
//
// WHY CartoDB instead of OpenStreetMap tiles?
//   OSM's volunteer tile servers (tile.openstreetmap.org) block requests that
//   don't originate from a real browser — React Native WebView requests are
//   rejected and show "osm.wiki/Blocked".
//
//   CartoDB (cartocdn.com) rastertiles are:
//     ✓ Free with no API key
//     ✓ WebView-friendly (no User-Agent restrictions)
//     ✓ Same OpenStreetMap data, cleaner look
//     ✓ Proper CORS headers
//
// Available CartoDB styles (swap the path segment):
//   rastertiles/voyager          ← default, clean colourful
//   rastertiles/voyager_nolabels ← same without text labels
//   light_all                   ← minimal grey
//   dark_all                    ← dark theme
//   light_nolabels

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import WebView from 'react-native-webview';

interface LeafletMapProps {
  lat:          number;
  lng:          number;
  accuracy?:    number;
  zoom?:        number;
  height?:      number;
  primaryColor?: string;
  tileStyle?:   'voyager' | 'light' | 'dark';
}

const TILE_URLS = {
  voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  light:   'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const LeafletMap: React.FC<LeafletMapProps> = ({
  lat,
  lng,
  accuracy,
  zoom        = 16,
  height      = 260,
  primaryColor = '#4569ea',
  tileStyle   = 'voyager',
}) => {
  const html = useMemo(() => {
    const tileUrl     = TILE_URLS[tileStyle] || TILE_URLS.voyager;
    const circleColor = primaryColor;
    const accuracyCircle = accuracy && accuracy > 0
      ? `L.circle([${lat}, ${lng}], {
           radius: ${accuracy},
           color: '${circleColor}',
           fillColor: '${circleColor}',
           fillOpacity: 0.08,
           weight: 1,
           dashArray: '4 4',
         }).addTo(map);`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; }
    /* Hide default Leaflet marker — we draw our own */
    .custom-marker {
      width: 20px; height: 20px; border-radius: 50%;
      background: ${circleColor};
      border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
    /* Suppress attribution overlap on small maps */
    .leaflet-control-attribution {
      font-size: 9px !important;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: ${zoom},
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: false,
    });

    /* ── CartoDB tiles — no User-Agent restrictions, no API key needed ── */
    L.tileLayer('${tileUrl}', {
      attribution: '${ATTRIBUTION}',
      subdomains: 'abcd',
      maxZoom: 20,
      minZoom: 2,
    }).addTo(map);

    /* ── Accuracy circle ── */
    ${accuracyCircle}

    /* ── Custom pulsing dot marker ── */
    var icon = L.divIcon({
      className: '',
      html: '<div class="custom-marker"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);

    /* ── Recenter on resize (handles WebView layout shift) ── */
    setTimeout(function() {
      map.invalidateSize();
      map.setView([${lat}, ${lng}], ${zoom});
    }, 200);
  </script>
</body>
</html>`;
  }, [lat, lng, accuracy, zoom, primaryColor, tileStyle]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Allow mixed content so tile images load on Android
        mixedContentMode="compatibility"
        // Needed on Android for external tile URLs
        originWhitelist={['*']}
        // Silence "onContentSizeChange" / layout warnings
        onShouldStartLoadWithRequest={() => true}
      />
    </View>
  );
};

export default LeafletMap;

const styles = StyleSheet.create({
  container: {
    width:    '100%',
    overflow: 'hidden',
  },
  webview: {
    flex:            1,
    backgroundColor: 'transparent',
  },
});