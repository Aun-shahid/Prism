'use client';

import * as React from 'react';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (options: Record<string, unknown>, elementId: string) => unknown;
      } & { TranslateElement: { InlineLayout: { SIMPLE: unknown } } };
    };
  }
}

const SCRIPT_ID = 'google-translate-script';

/**
 * Floating language switcher — translates the rendered dashboard client-side
 * via Google's widget. No per-page string extraction needed, at the cost of
 * translation quality/control (see plan notes: can occasionally conflict with
 * React re-renders on highly-interactive pages).
 */
export default function GoogleTranslate() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.getElementById(SCRIPT_ID)) return; // already injected (route change)

    window.googleTranslateElementInit = () => {
      if (!window.google) return;
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          autoDisplay: false,
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        },
        'google_translate_element'
      );
    };

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <div id="google_translate_element" style={{ display: 'inline-block', minWidth: 40 }} />
      {/* Plain native <style> tag (not styled-jsx, which isn't used elsewhere in
          this app) — global CSS to tame Google's injected widget chrome. */}
      <style>{`
        .goog-te-banner-frame.skiptranslate,
        #goog-gt-tt,
        .goog-te-balloon-frame {
          display: none !important;
        }
        body {
          top: 0 !important;
        }
        body > .skiptranslate {
          display: none !important;
        }
        #google_translate_element .goog-te-gadget {
          font-size: 0;
          color: transparent;
        }
        #google_translate_element .goog-te-gadget-simple {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 6px;
          padding: 3px 6px;
          display: inline-flex;
          align-items: center;
        }
        #google_translate_element .goog-te-gadget-simple .goog-te-menu-value {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.8rem;
        }
        #google_translate_element .goog-te-gadget-simple .goog-te-menu-value span {
          color: rgba(255, 255, 255, 0.85);
        }
        #google_translate_element img {
          display: none !important;
        }
      `}</style>
    </>
  );
}
