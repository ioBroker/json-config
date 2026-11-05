/**
 * The map for the `coordinates` items with `map: true`.
 *
 * The library does not bring `leaflet`: only the coordinates items with a map need it, and it would
 * land in every bundle that uses the library otherwise. So the host provides it - here this test GUI,
 * in production the ioBroker admin. Hand it in lazy, so that leaflet and its CSS are only loaded when
 * a map is really shown:
 *
 *     const OsmMap = React.lazy(() => import('./OsmMap'));
 *     <JsonConfigComponent OsmMap={OsmMap} ... />
 */
import React, { useEffect, useRef, type JSX } from 'react';

import {
    divIcon,
    map as createMap,
    marker as createMarker,
    tileLayer,
    type LatLngTuple,
    type Map,
    type Marker,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { OsmMapProps } from '../../src';

/**
 * The default marker of leaflet is a PNG, which it finds over its CSS. Bundlers rename the file, and
 * leaflet does not find it any more. A pin drawn with SVG needs no file.
 */
const PIN = divIcon({
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="45"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#d32f2f" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>',
    className: '',
    iconSize: [30, 45],
    iconAnchor: [15, 45],
});

/** Without a position and a center the map shows the whole world */
const WORLD: LatLngTuple = [20, 0];

/** Darkens the tiles in the dark theme: inverted and turned back to the original colors */
const DARK_TILES = 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)';

export default function OsmMap(props: OsmMapProps): JSX.Element {
    const divRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const markerRef = useRef<Marker | null>(null);
    // The handlers are bound once, when the map is created. They have to call the newest `onChange`.
    const onChangeRef = useRef(props.onChange);
    // The values the map starts with. Later changes are followed by the effects below.
    const startRef = useRef({ position: props.position, center: props.center, zoom: props.zoom });

    useEffect(() => {
        onChangeRef.current = props.onChange;
    });

    // create the map once
    useEffect(() => {
        const div = divRef.current;
        if (!div) {
            return undefined;
        }
        const start = startRef.current.position || startRef.current.center;
        const map = createMap(div, {
            center: start ? [start.latitude, start.longitude] : WORLD,
            zoom: start ? startRef.current.zoom : 2,
        });
        // The tile policy of OpenStreetMap requires the attribution. Only it is shown: no "Leaflet" and no flag.
        map.attributionControl.setPrefix(false);
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        }).addTo(map);
        // a click sets the position, if the map is not read-only
        map.on('click', e => onChangeRef.current?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }));

        // The map measures its container only at the start. In a tab or an accordion it is invisible
        // then and stays grey, until it hears that its size changed.
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(div);

        mapRef.current = map;
        return () => {
            observer.disconnect();
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
    }, []);

    // the marker follows the position, wherever it comes from
    const latitude = props.position?.latitude;
    const longitude = props.position?.longitude;
    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }
        if (latitude === undefined || longitude === undefined) {
            markerRef.current?.remove();
            markerRef.current = null;
            return;
        }
        const latLng: LatLngTuple = [latitude, longitude];
        if (markerRef.current) {
            markerRef.current.setLatLng(latLng);
            // a moved marker stays where it is, the map only follows if the marker left the view
            if (!map.getBounds().contains(latLng)) {
                map.panTo(latLng);
            }
            return;
        }
        const marker = createMarker(latLng, { icon: PIN, draggable: !!onChangeRef.current, keyboard: false });
        marker.on('dragend', () => {
            const ll = marker.getLatLng();
            onChangeRef.current?.({ latitude: ll.lat, longitude: ll.lng });
        });
        marker.addTo(map);
        markerRef.current = marker;
        // the first position: look at it closely, also if the map showed the whole world until now
        map.setView(latLng, Math.max(map.getZoom(), startRef.current.zoom));
    }, [latitude, longitude]);

    // read-only: the marker cannot be dragged, and a click does nothing (see the handler)
    const editable = !!props.onChange;
    useEffect(() => {
        if (markerRef.current?.dragging) {
            if (editable) {
                markerRef.current.dragging.enable();
            } else {
                markerRef.current.dragging.disable();
            }
        }
        if (divRef.current) {
            divRef.current.style.cursor = editable ? 'crosshair' : '';
        }
    }, [editable]);

    useEffect(() => {
        const pane = mapRef.current?.getPane('tilePane');
        if (pane) {
            pane.style.filter = props.themeType === 'dark' ? DARK_TILES : '';
        }
    }, [props.themeType]);

    return (
        <div
            ref={divRef}
            style={props.style}
        />
    );
}
