import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import React from 'react';

// Make React available globally for JSX
global.React = React;

// Cleanup after each test
afterEach(() => {
  cleanup();
});
