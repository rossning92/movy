"use strict";

export default class WebmMediaRecorder {
  constructor({ name = "unnamed", framerate = 60 } = {}) {
    this.recordedBlobs = [];
    this.name = name;

    const canvas = document.querySelector("canvas");
    this.stream = canvas.captureStream(framerate); // maximum frame rate for capturing

    this.mediaRecorder = new MediaRecorder(this.stream, {
      // Looks like 8Mbps is the highest bitrate chrome supports?
      videoBitsPerSecond: 8.0 * 1000000,
      mimeType: "video/webm",
    });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedBlobs.push(event.data);
      }
    };
  }

  start() {
    this.mediaRecorder.start(100); // collect 100ms of data
  }

  stop() {
    this.mediaRecorder.stop();

    // Download as webm file
    const blob = new Blob(this.recordedBlobs, { type: "video/webm" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = this.name + ".webm";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);

    this.recordedBlobs.length = 0;
  }
}
