// Each server process reports its own memory; Render's container metric includes all processes.
function reportMemory() {
  const { rss, heapUsed, external, arrayBuffers } = process.memoryUsage();
  console.info("[MEMORY]", JSON.stringify({
    pid: process.pid,
    rssMiB: Math.round(rss / 1048576),
    heapUsedMiB: Math.round(heapUsed / 1048576),
    externalMiB: Math.round(external / 1048576),
    arrayBuffersMiB: Math.round(arrayBuffers / 1048576),
  }));
}

reportMemory();
setInterval(reportMemory, 5 * 60 * 1000).unref();

export {};
