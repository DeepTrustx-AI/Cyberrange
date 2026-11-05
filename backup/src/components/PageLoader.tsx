import React from 'react';
import { MascotLoader } from './mascot/MascotLoader';

// Shown while a page outside the app layouts (sign-in, verification, help) is
// downloading. Pages inside a layout load in place with the inline loader.
export const PageLoader: React.FC = () => <MascotLoader variant="page" label="Loading CyberRange" />;
