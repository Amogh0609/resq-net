/// <reference types="google.maps" />
// Google Maps Platform View (#/gmaps) with AdvancedMarker, Places Autocomplete New,
// and Routes API tanker routing.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { tr, useLang } from '../i18n.ts';
import { THEME_BUTTON_PHOTOS } from '../buttonPhotos.ts';
import { workPhotoUrl } from '../workPhotos.js';

interface FacilityNode {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lon: number;
  on_map?: boolean;
  buffers?: { power?: number; water?: number };
}

interface SupplyHub {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

const SUPPLY_HUBS: SupplyHub[] = [
  { id: 'hebbal', label: 'Hebbal Tanker & Diesel Depot', lat: 13.0358, lng: 77.597 },
  { id: 'ecity', label: 'Electronic City Utility Hub', lat: 12.8452, lng: 77.6602 },
  { id: 'majestic', label: 'Central KSRTC / BESCOM Staging', lat: 12.9766, lng: 77.5713 },
  { id: 'tkhalli', label: 'TK Halli Pumping Intake Yard', lat: 12.6712, lng: 77.3195 },
];

const KIND_PIN: Record<string, { bg: string; glyph: string; label: string }> = {
  hospital: { bg: '#16a34a', glyph: 'H', label: 'Hospital' },
  substation: { bg: '#2563eb', glyph: 'E', label: 'Substation' },
  substation_tx: { bg: '#1d4ed8', glyph: 'TX', label: '220kV Substation' },
  reservoir: { bg: '#0891b2', glyph: 'W', label: 'Water Supply' },
  pump: { bg: '#0e7490', glyph: 'P', label: 'Pump Station' },
  telecom: { bg: '#7c3aed', glyph: 'T', label: 'Telecom Site' },
};

function FacilityMarker({
  node,
  selected,
  onSelect,
}: {
  node: FacilityNode;
  selected: boolean;
  onSelect: (node: FacilityNode) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const cfg = KIND_PIN[node.kind] || { bg: '#475569', glyph: '•', label: node.kind };
  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: node.lat, lng: node.lon }}
        title={node.name}
        onClick={() => onSelect(node)}
        zIndex={selected ? 200 : node.kind === 'hospital' ? 50 : 90}
      >
        <Pin
          background={selected ? '#ff4d4f' : cfg.bg}
          borderColor="#ffffff"
          glyphColor="#ffffff"
          scale={selected ? 1.15 : 0.92}
        />
      </AdvancedMarker>
      {selected && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onSelect(node)}>
          <div className="gm-info">
            <div className="gm-info-kind">{cfg.label}</div>
            <strong>{node.name}</strong>
            <div className="gm-info-coord">
              {node.lat.toFixed(4)}, {node.lon.toFixed(4)}
            </div>
            {node.buffers && (
              <div className="gm-info-buf">
                Backup: diesel {node.buffers.power ?? '–'}h · water {node.buffers.water ?? '–'}h
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapsWorkspace({ facilities }: { facilities: FacilityNode[] }) {
  const [lang] = useLang();
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [kindFilter, setKindFilter] = useState<string>('all');
  const [selected, setSelected] = useState<FacilityNode | null>(null);
  const [searchedPlace, setSearchedPlace] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);

  // Places Autocomplete (New API: AutocompleteSuggestion + AutocompleteSessionToken + Place.fetchFields)
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<
    Array<{ placeId: string; text: string; secondary: string; prediction: google.maps.places.PlacePrediction }>
  >([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Routes API state
  const [hubId, setHubId] = useState<string>(SUPPLY_HUBS[0].id);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: string; durationMin: string; destName: string } | null>(
    null
  );
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const visibleFacilities = useMemo(() => {
    const filtered = facilities.filter((f) => {
      if (kindFilter === 'all') return true;
      if (kindFilter === 'substation') return f.kind === 'substation' || f.kind === 'substation_tx';
      if (kindFilter === 'water') return f.kind === 'reservoir' || f.kind === 'pump';
      return f.kind === kindFilter;
    });
    // Prioritize substations/water first and keep marker count smooth & legible
    const priority = filtered.filter((f) => f.kind !== 'hospital');
    const hospitals = filtered.filter((f) => f.kind === 'hospital').slice(0, kindFilter === 'hospital' ? 45 : 22);
    return [...priority.slice(0, 35), ...hospitals];
  }, [facilities, kindFilter]);

  // Clear route polylines on unmount or reset
  const clearPolylines = useCallback(() => {
    for (const p of polylinesRef.current) p.setMap(null);
    polylinesRef.current = [];
  }, []);

  useEffect(() => () => clearPolylines(), [clearPolylines]);

  // Debounced Places API (New) AutocompleteSuggestion fetch
  useEffect(() => {
    const q = searchInput.trim();
    if (!q || !placesLib || q.length < 2) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSearchBusy(true);
      try {
        if (!tokenRef.current) {
          tokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const { suggestions: raw } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: tokenRef.current,
          includedRegionCodes: ['in'],
          locationBias: { lat: 12.9716, lng: 77.5946 },
        });
        if (!active) return;
        const mapped = (raw || [])
          .map((s: google.maps.places.AutocompleteSuggestion) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => Boolean(p))
          .slice(0, 5)
          .map((p) => ({
            placeId: p.placeId,
            text: p.mainText?.text || p.text?.text || 'Bengaluru location',
            secondary: p.secondaryText?.text || '',
            prediction: p,
          }));
        setSuggestions(mapped);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/QUOTA|OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED/i.test(msg)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { tier: 2 } }));
        }
        if (active) setSuggestions([]);
      } finally {
        if (active) setSearchBusy(false);
      }
    }, 280);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchInput, placesLib]);

  const choosePrediction = async (prediction: google.maps.places.PlacePrediction) => {
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
      tokenRef.current = null;
      setSuggestions([]);
      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        const item = {
          name: place.displayName || 'Selected Place',
          address: place.formattedAddress || 'Bengaluru',
          lat,
          lng,
        };
        setSearchedPlace(item);
        setSearchInput(item.name);
        map?.panTo({ lat, lng });
        map?.setZoom(14);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/QUOTA|OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED/i.test(msg)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { tier: 2 } }));
      }
    }
  };

  // Modern Routes API computation (Route.computeRoutes + createPolylines)
  const computeDispatchRoute = async () => {
    const target = searchedPlace
      ? { name: searchedPlace.name, lat: searchedPlace.lat, lng: searchedPlace.lng }
      : selected
        ? { name: selected.name, lat: selected.lat, lng: selected.lon }
        : visibleFacilities[0]
          ? { name: visibleFacilities[0].name, lat: visibleFacilities[0].lat, lng: visibleFacilities[0].lon }
          : null;
    if (!target || !routesLib || !map) return;

    const hub = SUPPLY_HUBS.find((h) => h.id === hubId) || SUPPLY_HUBS[0];
    setRouteBusy(true);
    setRouteError(null);
    clearPolylines();
    try {
      const { routes } = await routesLib.Route.computeRoutes({
        origin: { lat: hub.lat, lng: hub.lng },
        destination: { lat: target.lat, lng: target.lng },
        travelMode: 'DRIVING',
        routingPreference: 'TRAFFIC_AWARE',
        fields: ['path', 'distanceMeters', 'durationMillis'],
      });
      if (!routes?.length) {
        setRouteError('No driving route returned for this pair.');
        return;
      }
      const route = routes[0];
      const polys: google.maps.Polyline[] = route.createPolylines({
        polylineOptions: {
          strokeColor: '#f5a623',
          strokeOpacity: 0.92,
          strokeWeight: 5,
        },
      });
      polys.forEach((p) => p.setMap(map));
      polylinesRef.current = polys;

      const km = route.distanceMeters ? (route.distanceMeters / 1000).toFixed(1) : '–';
      const mins = route.durationMillis ? Math.round(route.durationMillis / 60000) : '–';
      setRouteSummary({ distanceKm: String(km), durationMin: String(mins), destName: target.name });

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: hub.lat, lng: hub.lng });
      bounds.extend({ lat: target.lat, lng: target.lng });
      map.fitBounds(bounds, 70);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Route computation failed.';
      if (/429|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT/i.test(msg)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded', { detail: { tier: 2 } }));
      }
      setRouteError(msg);
    } finally {
      setRouteBusy(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map?.panTo(coords);
        map?.setZoom(13);
      },
      () => {},
      { timeout: 8000 }
    );
  };

  return (
    <div className="gm-layout">
      <aside className="gm-sidebar">
        <div className="gm-block">
          <div className="gm-head-row">
            <h2>{tr(lang, 'gmaps.title')}</h2>
            <button type="button" className="gm-mini-btn" onClick={detectLocation}>
              {tr(lang, 'gmaps.myLocation')}
            </button>
          </div>

          <label className="gm-label" htmlFor="gm-places-input">
            {tr(lang, 'gmaps.searchLabel')}
          </label>
          <div className="gm-search-wrap">
            <input
              id="gm-places-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Hospital, substation, pump station…"
              aria-label="Search places in Bengaluru"
            />
            {searchBusy && <span className="gm-spin">…</span>}
          </div>
          {suggestions.length > 0 && (
            <ul className="gm-suggestions" role="listbox" aria-label="Place suggestions">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button type="button" onClick={() => choosePrediction(s.prediction)}>
                    <b>{s.text}</b>
                    {s.secondary && <span>{s.secondary}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="gm-filters" role="group" aria-label="Filter infrastructure">
            {[
              ['all', tr(lang, 'gmaps.all'), THEME_BUTTON_PHOTOS.skyline],
              ['hospital', tr(lang, 'gmaps.hospitals'), THEME_BUTTON_PHOTOS.hospital],
              ['substation', tr(lang, 'gmaps.power'), THEME_BUTTON_PHOTOS.power],
              ['water', tr(lang, 'gmaps.water'), THEME_BUTTON_PHOTOS.monsoon],
              ['telecom', tr(lang, 'gmaps.telecom'), workPhotoUrl('transmission')],
            ].map(([id, label, pic]) => (
              <button
                key={id}
                type="button"
                className={kindFilter === id ? 'on' : ''}
                onClick={() => setKindFilter(id)}
              >
                <img className="gm-filter-pic" src={pic} alt="" referrerPolicy="no-referrer" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="gm-block">
          <h3>{tr(lang, 'gmaps.routingTitle')}</h3>
          <p className="gm-sub">
            Target: <b>{searchedPlace?.name || selected?.name || visibleFacilities[0]?.name || 'Select a pin on map'}</b>
          </p>
          <label className="gm-label" htmlFor="gm-hub-select">
            Dispatch origin hub
          </label>
          <select id="gm-hub-select" value={hubId} onChange={(e) => setHubId(e.target.value)}>
            {SUPPLY_HUBS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
          <div className="gm-btn-row">
            <button type="button" className="gm-primary" onClick={computeDispatchRoute} disabled={routeBusy || !routesLib}>
              {routeBusy ? 'Routing…' : tr(lang, 'gmaps.computeRoute')}
            </button>
            {routeSummary && (
              <button
                type="button"
                className="gm-mini-btn"
                onClick={() => {
                  clearPolylines();
                  setRouteSummary(null);
                }}
              >
                Clear
              </button>
            )}
          </div>
          {routeSummary && (
            <div className="gm-route-card">
              <b>{routeSummary.durationMin} min ETA</b> · {routeSummary.distanceKm} km to {routeSummary.destName}
            </div>
          )}
          {routeError && <p className="gm-err">{routeError}</p>}
        </div>
      </aside>

      <div className="gm-canvas-wrap">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: 12.9716, lng: 77.5946 }}
          defaultZoom={12}
          gestureHandling="greedy"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {visibleFacilities.map((f) => (
            <FacilityMarker
              key={f.id}
              node={f}
              selected={selected?.id === f.id}
              onSelect={(n) => setSelected((cur) => (cur?.id === n.id ? null : n))}
            />
          ))}
          {searchedPlace && (
            <AdvancedMarker position={{ lat: searchedPlace.lat, lng: searchedPlace.lng }} title={searchedPlace.name} zIndex={300}>
              <Pin background="#f5a623" borderColor="#111827" glyphColor="#111827" scale={1.18} />
            </AdvancedMarker>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

export default function GoogleMapsView() {
  const [apiKey, setApiKey] = useState<string>('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [facilities, setFacilities] = useState<FacilityNode[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/config/maps')
        .then((r) => (r.ok ? r.json() : { apiKey: '' }))
        .catch(() => ({ apiKey: '' })),
      fetch('data/resqnet.json')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([cfg, cityData]) => {
      if (!alive) return;
      const resolvedKey = cfg?.apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
      setApiKey(resolvedKey);
      setFacilities((cityData?.graph?.nodes || []).filter((n: FacilityNode) => n.on_map !== false));
      setConfigLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!configLoaded) {
    return (
      <div className="splash">
        <h1>Live Map</h1>
        <p>Loading Google Maps configuration…</p>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="splash">
        <h1>Google Maps Unavailable</h1>
        <p className="err">No Google Maps Platform API key is configured in the server environment.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="en" region="IN" libraries={['places', 'routes', 'marker']}>
      <MapsWorkspace facilities={facilities} />
    </APIProvider>
  );
}
