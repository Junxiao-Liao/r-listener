const tracks = [
  {
    title: "Night Drive I",
    artist: "Local fixture",
    album: "Background play validation",
    duration: 18,
    src: "../assets/audio/background-1.wav",
    artwork: "../assets/artwork/night-drive-1.svg",
  },
  {
    title: "Night Drive II",
    artist: "Local fixture",
    album: "Background play validation",
    duration: 18,
    src: "../assets/audio/background-2.wav",
    artwork: "../assets/artwork/night-drive-2.svg",
  },
  {
    title: "Night Drive III",
    artist: "Local fixture",
    album: "Background play validation",
    duration: 18,
    src: "../assets/audio/background-3.wav",
    artwork: "../assets/artwork/night-drive-3.svg",
  },
];

const audio = document.querySelector("#audio");
const artwork = document.querySelector("#artwork");
const titleEl = document.querySelector("#track-title");
const artistEl = document.querySelector("#track-artist");
const albumEl = document.querySelector("#track-album");
const statusEl = document.querySelector("#playback-status");
const mediaSessionSupportEl = document.querySelector("#media-session-support");
const queueEl = document.querySelector("#queue");
const logEl = document.querySelector("#log");

const state = {
  currentIndex: 0,
};

function log(message) {
  const entry = document.createElement("li");
  entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  logEl.prepend(entry);
}

function renderQueue() {
  queueEl.innerHTML = "";

  tracks.forEach((track, index) => {
    const item = document.createElement("li");
    item.textContent = `${track.title} (${Math.round(track.duration)}s)`;
    item.classList.toggle("active", index === state.currentIndex);
    queueEl.append(item);
  });
}

function updateStatus() {
  const isPlaying = !audio.paused && !audio.ended;
  statusEl.textContent = isPlaying ? "Playing" : "Paused";
  statusEl.classList.toggle("playing", isPlaying);
}

function updateMediaMetadata(track) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) {
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: [
      {
        src: new URL(track.artwork, window.location.href).href,
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  });
}

function updatePositionState() {
  if (!("mediaSession" in navigator) || typeof navigator.mediaSession.setPositionState !== "function") {
    return;
  }

  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration || 0,
      playbackRate: audio.playbackRate,
      position: audio.currentTime,
    });
  } catch {
    // Ignore browsers that expose the API but reject some state updates.
  }
}

function loadTrack(index) {
  state.currentIndex = (index + tracks.length) % tracks.length;
  const track = tracks[state.currentIndex];

  audio.src = track.src;
  artwork.src = track.artwork;
  titleEl.textContent = track.title;
  artistEl.textContent = track.artist;
  albumEl.textContent = track.album;

  updateMediaMetadata(track);
  renderQueue();
  updateStatus();
  log(`Loaded ${track.title}`);
}

async function playCurrentTrack(reason) {
  try {
    await audio.play();
    log(`Playback started (${reason})`);
  } catch (error) {
    log(`Playback failed (${reason}): ${error.message}`);
  }
}

function pauseCurrentTrack(reason) {
  audio.pause();
  log(`Playback paused (${reason})`);
}

async function stepTrack(direction, reason) {
  const shouldResume = !audio.paused && !audio.ended;
  loadTrack(state.currentIndex + direction);

  if (shouldResume) {
    await playCurrentTrack(reason);
  }
}

function configureMediaSession() {
  if (!("mediaSession" in navigator)) {
    mediaSessionSupportEl.textContent = "navigator.mediaSession is not available in this browser.";
    return;
  }

  mediaSessionSupportEl.textContent = "Media Session API detected. Action handlers registered for play, pause, previous, and next.";

  const handlers = {
    play: () => {
      log("Media Session action: play");
      void playCurrentTrack("media-session-play");
    },
    pause: () => {
      log("Media Session action: pause");
      pauseCurrentTrack("media-session-pause");
    },
    previoustrack: () => {
      log("Media Session action: previous track");
      void stepTrack(-1, "media-session-previous");
    },
    nexttrack: () => {
      log("Media Session action: next track");
      void stepTrack(1, "media-session-next");
    },
  };

  Object.entries(handlers).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      log(`Media Session action not supported by this browser: ${action}`);
    }
  });
}

document.querySelector("#play-button").addEventListener("click", () => {
  void playCurrentTrack("play-button");
});

document.querySelector("#pause-button").addEventListener("click", () => {
  pauseCurrentTrack("pause-button");
});

document.querySelector("#previous-button").addEventListener("click", () => {
  void stepTrack(-1, "previous-button");
});

document.querySelector("#next-button").addEventListener("click", () => {
  void stepTrack(1, "next-button");
});

audio.addEventListener("play", () => {
  updateStatus();
  updatePositionState();
});

audio.addEventListener("pause", () => {
  updateStatus();
  updatePositionState();
});

audio.addEventListener("ended", () => {
  updateStatus();
  updatePositionState();
  log("Track ended");
});

audio.addEventListener("loadedmetadata", () => {
  renderQueue();
  updatePositionState();
});

audio.addEventListener("timeupdate", () => {
  updatePositionState();
});

loadTrack(0);
configureMediaSession();
log("Ready for manual playback");
