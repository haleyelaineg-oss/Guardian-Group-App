import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Admin route failed to render.', error, info);
  }

  render() {
    if (this.state.error) {
      return <div className="view active error-state"><h1 className="view-title">This page couldn’t load</h1><p className="empty-hint">Try loading it again. If the problem persists, return to the dashboard and try once more.</p><button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try Again</button></div>;
    }

    return this.props.children;
  }
}
