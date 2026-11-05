import React, { type JSX } from 'react';

import {
    Add,
    Edit,
    Search,
    Visibility,
    LinkOff,
    Link as LinkIcon,
    NotListedLocation,
    Stop,
    FastForward,
    FastRewind,
    Lightbulb,
    Power,
    Fluorescent,
    WbIncandescent,
    Settings,
    Group,
    Person,
    QrCode,
} from '@mui/icons-material';

import { IconConnectionState, IconPlayPause, IconRefresh, IconTrash } from '@iobroker/gui-components';

/**
 * Icon for the given name. `play`/`pause` and `connection`/`no-connection` are the same animated component each, so
 * if a state switches between them (e.g. `trueImage: 'pause'`, `falseImage: 'play'`), one symbol turns into the other.
 */
export default function getIconByName(name: string | undefined, style?: React.CSSProperties): JSX.Element | null {
    if (name === 'edit' || name === 'rename') {
        return <Edit style={style} />;
    }
    if (name === 'delete') {
        return <IconTrash style={style} />;
    }
    if (name === 'refresh') {
        return <IconRefresh style={style} />;
    }
    if (name === 'newDevice' || name === 'new' || name === 'add') {
        return <Add style={style} />;
    }
    if (name === 'discover' || name === 'search') {
        return <Search style={style} />;
    }
    if (name === 'unpairDevice' || name === 'unpair') {
        return <LinkOff style={style} />;
    }
    if (name === 'pairDevice' || name === 'pair') {
        return <LinkIcon style={style} />;
    }
    if (name === 'identify') {
        return <NotListedLocation style={style} />;
    }
    if (name === 'play') {
        return (
            <IconPlayPause
                running={false}
                style={style}
            />
        );
    }
    if (name === 'stop') {
        return <Stop style={style} />;
    }
    if (name === 'pause') {
        return (
            <IconPlayPause
                running
                style={style}
            />
        );
    }
    if (name === 'forward' || name === 'next') {
        return <FastForward style={style} />;
    }
    if (name === 'rewind' || name === 'previous') {
        return <FastRewind style={style} />;
    }
    if (name === 'lamp' || name === 'light') {
        return <Lightbulb style={style} />;
    }
    if (name === 'backlight') {
        return <Fluorescent style={style} />;
    }
    if (name === 'dimmer') {
        return <WbIncandescent style={style} />;
    }
    if (name === 'socket') {
        return <Power style={style} />;
    }
    if (name === 'settings') {
        return <Settings style={style} />;
    }
    if (name === 'users' || name === 'group') {
        return <Group style={style} />;
    }
    if (name === 'user') {
        return <Person style={style} />;
    }
    if (name === 'qrcode') {
        return <QrCode style={style} />;
    }
    if (name === 'connection') {
        return (
            <IconConnectionState
                state="connected"
                style={style}
            />
        );
    }
    if (name === 'no-connection') {
        return (
            <IconConnectionState
                state="disconnected"
                style={style}
            />
        );
    }
    if (name === 'visible') {
        return <Visibility style={style} />;
    }
    return null;
}
