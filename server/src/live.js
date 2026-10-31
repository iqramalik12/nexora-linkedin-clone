// Real-time updates over Server-Sent Events. Each signed-in tab keeps one stream open;
// publish() pushes an event to every open stream of one person.
const streams = new Map(); // userId -> Set<res>

export function openStream(req, res) {
  const id = req.user._id.toString();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  if (!streams.has(id)) streams.set(id, new Set());
  streams.get(id).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    const set = streams.get(id);
    set?.delete(res);
    if (set?.size === 0) streams.delete(id);
  });
}

export function publish(userId, event, data) {
  for (const res of streams.get(userId.toString()) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const isOnline = (userId) => streams.has(userId.toString());
