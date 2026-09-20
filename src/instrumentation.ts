// https://github.com/vercel/next.js/discussions/15341
// Run code once per node server startup
//export const runtime = 'nodejs';

export async function register() {
    // console.log(`process.env.NEXT_RUNTIME = ${process.env.NEXT_RUNTIME}`);

    // https://nextjs.org/docs/14/pages/building-your-application/optimizing/instrumentation

    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { registerNodeInstrumentation } =
            await import("./instrumentation.node");

        await registerNodeInstrumentation();
    }
}