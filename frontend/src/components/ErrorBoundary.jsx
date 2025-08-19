import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(){
    return { hasError: true };
  }
  componentDidCatch(error, info){
    // Surface to console for diagnostics during lazy load failures
    console.error('[Route error]', error, info);
  }
  render(){
    if (this.state.hasError) {
      return <div style={{ padding: 16, color: 'crimson' }}>Failed to load page.</div>;
    }
    return this.props.children;
  }
}
