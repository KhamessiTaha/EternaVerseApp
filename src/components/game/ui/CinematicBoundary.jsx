// src/components/game/ui/CinematicBoundary.jsx
//
// A cinematic is decoration. It must never be the thing standing between a
// player and their game.
//
// The end cinematic is lazily loaded (three.js is a 1MB chunk), which means it
// can fail in ways ordinary components can't: a stale chunk hash after a
// deploy, a dropped connection, a WebGL context that won't allocate. React's
// default answer to all of those is to sit on the Suspense fallback forever -
// and ours was a bare dark <div>, indistinguishable from the cinematic itself
// having gone wrong. Either way the player is stranded on a black screen.
//
// This catches the throw and hands control back, so the worst case is "you
// didn't get the animation" rather than "you can't get to your universe".
import { Component } from 'react';

export class CinematicBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Worth seeing in the console - it's never expected - but never fatal.
    console.error('Cinematic failed, skipping to the summary:', error);
    this.props.onFail?.();
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export default CinematicBoundary;
