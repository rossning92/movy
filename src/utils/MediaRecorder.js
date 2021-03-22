"use strict";

let mediaRecorder;
let recordedBlobs;
let stream;

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function start() {
  if (stream === undefined) {
    const canvas = document.querySelector("canvas");
    stream = canvas.captureStream(); // frames per second
  }

  recordedBlobs = [];

  mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(100); // collect 100ms of data
}

function stop() {
  mediaRecorder.stop();

  // Download as webm file
  const blob = new Blob(recordedBlobs, { type: "video/webm" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = "test.webm";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

export { start, stop };
