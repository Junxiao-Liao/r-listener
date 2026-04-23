const tracks = [
  {
    title: "Sequence A",
    src: "../assets/audio/sequence-1.wav",
    description: "Track 1 of 2. Start this manually.",
  },
  {
    title: "Sequence B",
    src: "../assets/audio/sequence-2.wav",
    description: "Track 2 of 2. This should start automatically.",
  },
];

const audio = document.querySelector("#audio");
const statusEl = document.querySelector("#sequence-status");
const titleEl = document.querySelector("#sequence-title");
const detailEl = document.querySelector("#sequence-detail");
const queueEl = document.querySelector("#queue");
const logEl = document.querySelector("#log");

const state = {
  currentIndex: 0,
  sequenceStarted: false,
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
    item.textContent = `${track.title} (${index === 0 ? "manual start" : "autoplay target"})`;
    item.classList.toggle("active", index === state.currentIndex);
    queueEl.append(item);
  });
}

function updateStatus(label, isPlaying) {
  statusEl.textContent = label;
  statusEl.classList.toggle("playing", isPlaying);
}

function loadTrack(index) {
  state.currentIndex = index;
  const track = tracks[index];
  audio.autoplay = false;
  audio.src = track.src;
  titleEl.textContent = track.title;
  detailEl.textContent = track.description;
  renderQueue();
  log(`Loaded ${track.title}`);
}

async function playCurrentTrack(reason) {
  const track = tracks[state.currentIndex];

  try {
    await audio.play();
    updateStatus(`Playing ${track.title}`, true);
    log(`Playback started (${reason})`);
    return true;
  } catch (error) {
    updateStatus(`Playback blocked for ${track.title}`, false);
    log(`Playback failed (${reason}): ${error.name}: ${error.message}`);
    return false;
  }
}

function waitForCanPlay() {
  return new Promise((resolve) => {
    audio.addEventListener("canplay", resolve, { once: true });
  });
}

async function tryAutoplayNextTrack() {
  const track = tracks[state.currentIndex];
  audio.autoplay = true;
  updateStatus(`Attempting autoplay for ${track.title}`, false);

  if (await playCurrentTrack("ended-event-autoplay")) {
    return;
  }

  log("Immediate autoplay failed; retrying on canplay");
  await waitForCanPlay();
  await playCurrentTrack("ended-event-autoplay-retry");
}

document.querySelector("#start-button").addEventListener("click", async () => {
  state.sequenceStarted = true;
  log("Sequence armed from start button");
  loadTrack(0);
  updateStatus("Manual playback requested", false);
  await playCurrentTrack("manual-start");
});

document.querySelector("#restart-button").addEventListener("click", async () => {
  state.sequenceStarted = true;
  audio.currentTime = 0;
  log("Current track reset to 0s");
  await playCurrentTrack("restart-button");
});

audio.addEventListener("play", () => {
  if (!state.sequenceStarted && state.currentIndex === 0) {
    state.sequenceStarted = true;
    log("Sequence armed from native audio control");
  }

  updateStatus(`Playing ${tracks[state.currentIndex].title}`, true);
});

audio.addEventListener("pause", () => {
  if (!audio.ended) {
    updateStatus(`Paused ${tracks[state.currentIndex].title}`, false);
  }
});

audio.addEventListener("ended", async () => {
  const finishedTrack = tracks[state.currentIndex];
  log(`${finishedTrack.title} ended`);

  if (!state.sequenceStarted) {
    updateStatus("Sequence has not started", false);
    log("Track ended before sequence was armed");
    return;
  }

  if (state.currentIndex >= tracks.length - 1) {
    updateStatus("Sequence complete", false);
    detailEl.textContent = "Track 2 finished. The autoplay handoff succeeded if it started without another tap.";
    return;
  }

  loadTrack(state.currentIndex + 1);
  await tryAutoplayNextTrack();
});

audio.addEventListener("loadedmetadata", () => {
  log(`Metadata ready (${Math.round(audio.duration)}s)`);
});

loadTrack(0);
updateStatus("Waiting for user gesture", false);
log("Ready for the first manual play");
