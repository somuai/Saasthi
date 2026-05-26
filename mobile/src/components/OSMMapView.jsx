import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import PropTypes from "prop-types";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";

function buildMapHtml(initialLat, initialLng, initialZoom) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{height:100%;width:100%}
.marker-icon{background:transparent;border:none}
.marker-dot{width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}
.marker-dot.selected{width:28px;height:28px;border:3px solid #fff;box-shadow:0 0 0 2px}
#user-dot{width:18px;height:18px;border-radius:50%;background:#4285F4;border:3px solid #fff;box-shadow:0 0 0 2px rgba(66,133,244,.3)}
.leaflet-popup-content-wrapper{border-radius:8px}
.leaflet-popup-content{margin:10px 14px}
.popup-name{font-weight:700;font-size:14px;margin-bottom:2px}
.popup-detail{font-size:12px;color:#666;margin-bottom:4px}
.popup-link{color:#0F766E;font-size:12px;font-weight:700;cursor:pointer;padding:4px 0;display:inline-block}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map=L.map('map',{center:[${initialLat},${initialLng}],zoom:${initialZoom},zoomControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
L.control.scale({imperial:false,metric:true}).addTo(map);

var markers={}, userMarker=null;

map.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapPress'}));});

window.mapReady = true;

function setMarkers(data){
  Object.values(markers).forEach(function(m){map.removeLayer(m);});
  markers={};
  if(!data||!data.length)return;
  data.forEach(function(pt){
    var c=pt.color||'#0F766E';
    var dot=document.createElement('div');dot.className='marker-dot';dot.style.background=c;dot.style.color=c;
    var m=L.marker([pt.latitude,pt.longitude],{
      icon:L.divIcon({className:'marker-icon',html:dot.outerHTML,iconSize:[22,22],iconAnchor:[11,11]})
    }).addTo(map);
    var pid=pt.id;
    var html='<div class="popup-name">'+(pt.title||'')+'</div>';
    if(pt.subtitle)html+='<div class="popup-detail">'+pt.subtitle+'</div>';
    html+='<div class="popup-link" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:&quot;markerClick&quot;,id:&quot;'+pid+'&quot;}));">View Patient &rarr;</div>';
    m.bindPopup(html);
    m._ptId=pt.id;
    m.on('popupopen',function(){
      document.querySelectorAll('.marker-dot').forEach(function(el){el.classList.remove('selected');});
      var el=m.getElement();if(el){var d=el.querySelector('.marker-dot');if(d)d.classList.add('selected');}
    });
    markers[pt.id]=m;
  });
}

function setUserLocation(lat,lng){
  if(userMarker){map.removeLayer(userMarker);}
  userMarker=L.marker([lat,lng],{
    icon:L.divIcon({className:'marker-icon',html:'<div id="user-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]}),
    zIndexOffset:1000
  }).addTo(map);
}
</script>
</body>
</html>`;
}

function regionToZoom(latDelta) {
  if (latDelta <= 0.002) return 16;
  if (latDelta <= 0.01) return 14;
  if (latDelta <= 0.04) return 12;
  if (latDelta <= 0.2) return 10;
  if (latDelta <= 1) return 8;
  if (latDelta <= 4) return 6;
  return 4;
}

export default function OSMMapView({ markers, initialRegion, showsUserLocation, onMarkerPress, onMapPress, style }) {
  const webviewRef = useRef(null);
  const [ready, setReady] = useState(false);

  const html = buildMapHtml(
    initialRegion?.latitude || 20.5937,
    initialRegion?.longitude || 78.9629,
    regionToZoom(initialRegion?.latitudeDelta || 4),
  );

  const inject = useCallback((js) => {
    webviewRef.current?.injectJavaScript(js + ";true;");
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "markerClick" && onMarkerPress) onMarkerPress(msg.id);
      if (msg.type === "mapPress" && onMapPress) onMapPress();
    } catch { /* ignore malformed messages */ }
  }, [onMarkerPress, onMapPress]);

  const handleLoad = useCallback(() => {
    setReady(true);
  }, []);

  const sendMarkers = useCallback((data) => {
    if (data && data.length) inject("setMarkers(" + JSON.stringify(data) + ")");
  }, [inject]);

  const sendUserLocation = useCallback((lat, lng) => {
    inject("setUserLocation(" + lat + "," + lng + ")");
  }, [inject]);

  useEffect(() => {
    if (ready && markers) sendMarkers(markers);
  }, [ready, markers, sendMarkers]);

  useEffect(() => {
    if (!ready || !showsUserLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        if (!cancelled) sendUserLocation(loc.coords.latitude, loc.coords.longitude);
      } catch { /* location unavailable */ }
    })();
    return () => { cancelled = true; };
  }, [ready, showsUserLocation, sendUserLocation]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webviewRef}
        style={styles.webview}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        onLoad={handleLoad}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

OSMMapView.propTypes = {
  markers: PropTypes.array,
  initialRegion: PropTypes.shape({
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    latitudeDelta: PropTypes.number,
    longitudeDelta: PropTypes.number,
  }),
  showsUserLocation: PropTypes.bool,
  onMarkerPress: PropTypes.func,
  onMapPress: PropTypes.func,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.number]),
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: "transparent" },
});
