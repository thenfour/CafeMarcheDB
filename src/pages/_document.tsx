// pages/_document.tsx
import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentProps,
  DocumentContext,
} from "next/document";
import { AppType } from "next/app";
import { MyAppProps } from "./_app";
import createEmotionCache from "src/core/createEmotionCache";
import createEmotionServer from "@emotion/server/create-instance";

interface MyDocumentProps extends DocumentProps {
  emotionStyleTags: JSX.Element[];
  language: string;
}

export default function MyDocument({ emotionStyleTags, language }: MyDocumentProps) {
  return (
    <Html lang={language}>
      <Head>
        {/* Insertion point for client. This connects with createEmotionCache.ts */}
        <meta name="emotion-insertion-point" content="" />
        {emotionStyleTags}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// `getInitialProps` belongs to `_document` (instead of `_app`),
// it's compatible with static-site generation (SSG).
MyDocument.getInitialProps = async (ctx: DocumentContext) => {
  const originalRenderPage = ctx.renderPage;

  // You can consider sharing the same Emotion cache between all the SSR requests to speed up performance.
  // However, be aware that it can have global side effects.
  const cache = createEmotionCache();
  const { extractCriticalToChunks } = createEmotionServer(cache);
  // Error pages use the English error shell; normal pages provide their resolved formatting language.
  let language = "en-US";

  // We're passing `emotionCache` to App component
  ctx.renderPage = () =>
    originalRenderPage({
      enhanceApp: (
        App: React.ComponentType<React.ComponentProps<AppType> & MyAppProps>
      ) =>
        function EnhanceApp(props: MyAppProps) {
          const bootstrap = props.pageProps.appBootstrap;
          if (bootstrap.status === "ready") {
            language = bootstrap.data.presentation.localization.formattingLocale;
          }
          return <App emotionCache={cache} {...props} />;
        },
    });

  const initialProps = await Document.getInitialProps(ctx);
  // This is important. It prevents Emotion to render invalid HTML.
  // See https://github.com/mui/material-ui/issues/26561#issuecomment-855286153
  const emotionStyles = extractCriticalToChunks(initialProps.html);
  const emotionStyleTags = emotionStyles.styles.map((style) => (
    <style
      data-emotion={`${style.key} ${style.ids.join(" ")}`}
      key={style.key}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: style.css }}
    />
  ));

  return {
    ...initialProps,
    // return emotionStyleTags as props
    emotionStyleTags,
    language,
  };
};

