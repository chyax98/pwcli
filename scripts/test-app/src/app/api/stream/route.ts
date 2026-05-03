export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let count = 0;
      const interval = setInterval(() => {
        if (count >= 30) {
          clearInterval(interval);
          controller.close();
          return;
        }
        const data = `data: ${JSON.stringify({ count, timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(data));
        count++;
      }, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
