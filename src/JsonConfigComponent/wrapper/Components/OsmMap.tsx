import React, { Suspense, type JSX } from 'react';

import { CircularProgress, IconButton } from '@mui/material';
import { Map as IconMap } from '@mui/icons-material';

import { I18n, type ThemeType } from '@iobroker/gui-components';

/** A position on the map in degrees */
export interface OsmMapPosition {
    latitude: number;
    longitude: number;
}

/**
 * What the map of the host has to accept.
 *
 * Described here and not imported from `leaflet`, so that neither this library nor anything that
 * bundles it needs that package - not even for the types.
 */
export interface OsmMapProps {
    /** Position of the marker. `null` if no valid position is set: then no marker is shown */
    position: OsmMapPosition | null;
    /** Where the map looks at if `position` is `null`, like the position of the system. `null` shows the whole world */
    center: OsmMapPosition | null;
    /** Zoom level the map starts with, if a position or a center is known */
    zoom: number;
    /**
     * Called when the user clicks on the map or drags the marker to a new place.
     * Not set if the map is read-only: then neither the marker can be moved nor a position be set.
     */
    onChange?: (position: OsmMapPosition) => void;
    themeType: ThemeType;
    style?: React.CSSProperties;
}

/**
 * The map of the host, in practice an OpenStreetMap drawn with `leaflet`.
 *
 * It is handed in and not imported, because `leaflet` is only needed by the `coordinates` items with
 * `map: true`, and everything that bundles this library would carry it along otherwise, the custom
 * components of all adapters included. The admin has leaflet anyway, so it hands the map in.
 *
 * The host should hand it in as `React.lazy(() => import('./OsmMap'))`: then leaflet with its CSS is
 * only loaded when a map is really shown. This library renders it inside `Suspense`. Without a map
 * the item shows a link to openstreetmap.org instead, so the position can still be checked.
 */
export type OsmMapComponent = React.ComponentType<OsmMapProps>;

interface OsmMapErrorBoundaryProps {
    children: React.ReactNode;
    fallback: React.ReactNode;
}

/** A map that cannot be loaded (offline, chunk not found) must not take the whole configuration page with it */
class OsmMapErrorBoundary extends React.Component<OsmMapErrorBoundaryProps, { failed: boolean }> {
    constructor(props: OsmMapErrorBoundaryProps) {
        super(props);
        this.state = { failed: false };
    }

    // React logs the error itself
    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    render(): React.ReactNode {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

/** Link to the position on openstreetmap.org, if the host has no map or the map cannot be loaded */
function OsmLink(props: { position: OsmMapPosition | null }): JSX.Element | null {
    if (!props.position) {
        return null;
    }
    const { latitude, longitude } = props.position;
    return (
        <IconButton
            size="small"
            component="a"
            href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            title={I18n.t('jc_Show on OpenStreetMap')}
        >
            <IconMap />
        </IconButton>
    );
}

interface OsmMapViewProps extends OsmMapProps {
    /** Map of the host. Without it only a link to openstreetmap.org is shown. */
    OsmMap?: OsmMapComponent;
    /** Height of the map in pixels */
    height: number;
}

export default function OsmMap(props: OsmMapViewProps): JSX.Element | null {
    const { OsmMap: HostMap, height, ...mapProps } = props;

    if (!HostMap) {
        return <OsmLink position={props.position} />;
    }

    return (
        <div style={{ width: '100%', height, marginTop: 8, ...props.style }}>
            <OsmMapErrorBoundary fallback={<OsmLink position={props.position} />}>
                <Suspense
                    fallback={
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <CircularProgress />
                        </div>
                    }
                >
                    <HostMap
                        {...mapProps}
                        style={{ width: '100%', height: '100%' }}
                    />
                </Suspense>
            </OsmMapErrorBoundary>
        </div>
    );
}
