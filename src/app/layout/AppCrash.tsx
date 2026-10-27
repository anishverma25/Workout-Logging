import { Component, type ErrorInfo, type ReactNode } from 'react';
import { markStarted, repairAndReload } from '../startup';
import { isChunkLoadError, reloadOnceForNewVersion } from './chunkReload';

/**
 * The last line of defence around the whole app: anything that crashes outside a screen's own
 * error page (the providers, the router itself) lands here instead of leaving a blank screen.
 * Plain markup and colours from the tokens only, so it draws even if the kit is what broke.
 */
export class AppCrash extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The app crashed', error, info.componentStack);
    // A code file from an older version is gone: one reload picks up the new version.
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return;
    markStarted();
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main
        role="alert"
        className="mx-auto flex min-h-dvh w-full max-w-100 flex-col justify-center gap-4 bg-bg px-6 pt-safe pb-safe text-text-1"
      >
        <h1 className="type-title">Overload ran into a problem</h1>
        <p className="type-body text-text-2">
          Everything you logged is safe, on this phone and in your account. Opening the app again
          usually fixes it.
        </p>
        <button
          type="button"
          onClick={repairAndReload}
          className="pressable type-headline mt-2 h-12 rounded-field bg-lime text-on-lime"
        >
          Repair and open
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="pressable type-headline h-12 rounded-field bg-surface-2 text-text-1"
        >
          Try again
        </button>
        <p className="type-caption font-mono break-words text-text-3">{error.message}</p>
      </main>
    );
  }
}
