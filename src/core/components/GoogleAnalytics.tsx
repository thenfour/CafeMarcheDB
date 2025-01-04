import { useEffect } from "react";
import { useCurrentUser } from '../../auth/hooks/useCurrentUser';
import { IsNullOrWhitespace } from "shared/utils";

type GoogleAnalyticsProps = {
  trackingId: string | undefined;
};

const GoogleAnalytics: React.FC<GoogleAnalyticsProps> = ({ trackingId }) => {
  const userId: number | undefined = useCurrentUser()[0]?.id || undefined;

  useEffect(() => {
    if (IsNullOrWhitespace(trackingId)) {
      return;
    }
    if (!!userId) return; // don't track our own users.
    // Load Google Analytics script dynamically
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
    script.async = true;
    document.head.appendChild(script);

    // Initialize gtag and set up configuration with user_id if available
    const inlineScript = document.createElement("script");
    inlineScript.innerHTML = `
        // console.log('installing google analytics with userid ${userId || "<none>"}');
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${trackingId}', {
          page_path: window.location.pathname,
          user_id: '${userId || ""}'
        });
      `;
    document.head.appendChild(inlineScript);

    return () => {
      // Cleanup scripts if necessary
      document.head.removeChild(script);
      document.head.removeChild(inlineScript);
    };
  }, [trackingId, userId]);

  return null; // This component doesn't render anything
};

export default GoogleAnalytics;
