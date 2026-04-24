Create a very detailed UX/Figma-style design board for a mobile web app.

The product is a private personal music listener web app. Users upload their own music files and synced lyrics files, organize music into custom playlists, and listen to their private library on mobile browsers. The design should include only mobile web pages, not desktop screens, not native iOS/Android screens, and not implementation diagrams.

Do not design this as an admin dashboard. It should feel like a polished consumer music app similar in structure to NetEase Cloud Music / QQ Music, but with original visual styling. Do not force a red brand color. Choose a tasteful modern music-app visual system with strong hierarchy, album-art focus, rounded cards, clean typography, and clear touch targets.

Important constraints:
- Mobile web only
- English UI only
- Private library only; no public browsing, no social feed, no sharing
- Users only listen to music they uploaded themselves
- Users can upload audio files and lyrics files
- Bulk upload is supported
- Custom playlists are supported
- Lyrics are mainly synced lyrics, such as .lrc files
- Tapping a synced lyric line should seek playback to that line
- The design should focus on pages, flows, and UI states, not backend, database, S3, or deployment
- Do not include unrelated pages such as storage analytics, social profiles, public discovery, friends, comments, subscriptions, payments, charts, radio, podcasts, or recommendation feeds

Design a single large, high-resolution landscape Figma-style overview board containing many mobile page mockups. Each mobile screen should be clearly labeled. Arrange the pages in a logical flow with section headers and light connector arrows where useful.

Overall mobile app structure:
Use a bottom navigation bar with:
- Home
- Library
- Upload
- Playlists
- Settings

Show a persistent mini-player above the bottom navigation whenever appropriate. The mini-player should include tiny album art, track title, artist, play/pause button, and an expand affordance.

Include the following mobile web pages and states:

1. Sign In Page
Purpose: user logs into their private music library.
UI elements:
- App logo or wordmark
- Short tagline such as “Your private music library”
- Email field
- Password field
- Sign In button
- Link to Create Account
- Optional Forgot Password link
Keep it simple and music-oriented.

2. Sign Up Page
Purpose: create private account.
UI elements:
- App logo or wordmark
- Email field
- Password field
- Confirm password field
- Create Account button
- Link back to Sign In
Avoid complex onboarding.

3. Home Page
Purpose: main landing page after login.
UI elements:
- Greeting/header
- Search entry point
- Continue Listening card
- Recently Played horizontal list
- Recently Uploaded horizontal list
- Pinned or Favorite Playlists section
- Upload shortcut card
- Bottom navigation
- Mini-player if something is playing
Do not include public recommendations or trending music.

4. Library / All Music Page
Purpose: browse all uploaded tracks.
UI elements:
- Page title “Library”
- Search bar
- Filter/sort chips:
  - Recently Added
  - Title
  - Artist
  - Album
- Music list rows with:
  - Cover thumbnail or fallback icon
  - Track title
  - Artist or “Unknown Artist”
  - Duration
  - More menu button
- Select mode button for bulk actions
- Empty state variant if no music exists
Possible row menu actions:
- Play
- Add to Playlist
- View Lyrics
- Edit Metadata
- Delete

5. Music Detail Page
Purpose: inspect one track.
UI elements:
- Large cover image or placeholder
- Track title
- Artist
- Album
- Duration
- File format badge, such as MP3, FLAC, AAC, M4A, WAV, OGG
- Lyrics status badge:
  - Synced Lyrics
  - Plain Lyrics
  - No Lyrics
  - Invalid Lyrics
- Primary Play button
- Secondary actions:
  - Edit Metadata
  - Replace Audio
  - Upload/Replace Lyrics
  - Add to Playlist
  - Delete
This page should account for incomplete downloaded-file metadata.

6. Edit Music Metadata Page
Purpose: edit track information.
UI elements:
- Header with Cancel and Save
- Cover image selector
- Text fields:
  - Title
  - Artist
  - Album
  - Track Number
  - Genre
  - Year
- Lyrics file section:
  - Current lyrics file
  - Replace lyrics file
  - Remove lyrics file
- Destructive Delete Music action at the bottom
Design as a mobile page, not a desktop modal.

7. Upload Page
Purpose: upload audio and lyrics files.
UI elements:
- Page title “Upload”
- Large tap-to-select upload area
- Secondary hint: “Upload audio files and .lrc lyrics files”
- Supported audio format hint:
  - MP3, FLAC, AAC, M4A, WAV, OGG
- Bulk upload supported hint
- Buttons:
  - Select Files
  - Upload All
- Explain filename matching visually:
  - song-name.mp3
  - song-name.lrc
  - matched automatically
Do not show desktop drag-and-drop as the main pattern, because this is mobile web only.

8. Upload Review Page
Purpose: review selected files before upload.
UI elements:
- List of detected audio files
- For each item:
  - File name
  - Detected title
  - Detected artist, if available
  - Matched lyrics file, if available
  - Status badge
- Status badge examples:
  - Ready
  - Lyrics Matched
  - Lyrics Missing
  - Duplicate Detected
  - Unsupported Format
- Per-track actions:
  - Choose Lyrics File
  - Remove
- Bottom fixed action button:
  - Upload All

9. Upload Progress Page
Purpose: show uploading and processing.
UI elements:
- Overall progress bar
- Per-file progress rows
- States:
  - Uploading
  - Processing Metadata
  - Processing Lyrics
  - Completed
  - Failed
- Failed item actions:
  - Retry
  - Remove
- Completion state:
  - “Upload complete”
  - Buttons: View Library, Upload More

10. Playlists Page
Purpose: manage custom playlists.
UI elements:
- Page title “Playlists”
- Search playlists
- Create Playlist button
- Playlist cards/list rows showing:
  - Cover collage or generated cover
  - Playlist name
  - Number of tracks
  - Updated date
  - Play button
  - More menu
- Empty state if no playlists exist:
  - “No playlists yet”
  - Create Playlist button
Do not include public playlists or social playlists.

11. Create Playlist Page
Purpose: create a custom playlist.
UI elements:
- Header with Cancel and Save
- Playlist cover selector, optional
- Playlist Name field
- Description field, optional
- Create button
Keep it simple.

12. Edit Playlist Page
Purpose: rename or modify playlist details.
UI elements:
- Header with Cancel and Save
- Cover selector
- Playlist Name field
- Description field
- Delete Playlist action
- Confirmation state for delete

13. Playlist Detail Page
Purpose: listen to and manage tracks inside a playlist.
UI elements:
- Playlist cover
- Playlist name
- Track count
- Total duration
- Play button
- Add Music button
- Track list with:
  - Track title
  - Artist
  - Duration
  - More menu
- Edit/reorder mode entry
Track menu actions:
- Play Next
- Remove from Playlist
- View Details
- View Lyrics
- Delete from Library, shown as a more dangerous separate action

14. Add Music to Playlist Page
Purpose: choose tracks to add to a playlist.
UI elements:
- Search bar
- Music list with checkboxes
- Selected count
- Add Selected button fixed at bottom
- Already added state
- Empty search result state

15. Reorder Playlist Page
Purpose: reorder tracks inside playlist.
UI elements:
- Playlist title
- Track rows with drag handles
- Save Order button
- Cancel button
This should look touch-friendly.

16. Full Player Page
Purpose: main listening experience.
Make this one of the most visually prominent screens.
UI elements:
- Large album art
- Track title
- Artist
- Playlist or queue context
- Progress slider
- Current time and duration
- Previous button
- Play/Pause button
- Next button
- Lyrics button
- Queue button
- More menu
- Optional repeat/shuffle controls if useful
More menu actions:
- Add to Playlist
- View Track Details
- Edit Metadata
- Delete
Show how the mini-player expands into this full player.

17. Lyrics Player Page
Purpose: synced lyrics reading and seeking.
Make this a signature feature.
UI elements:
- Track title and artist
- Small playback controls
- Progress indicator
- Scrollable lyrics view
- Active lyric line centered and highlighted
- Surrounding lyric lines above and below with softer visual weight
- Tap/click lyric line to seek
- Small hint: “Tap a line to jump”
- Optional visible timestamps in subtle style, such as [01:24.30]
Show this as a mobile web page, not an OS lock screen.
Include lyric states:
- Synced lyrics available
- Plain lyrics available but not seekable
- No lyrics uploaded
- Invalid lyrics file

18. Queue / Now Playing Page
Purpose: show current and upcoming tracks.
Design as a mobile bottom sheet or full mobile page.
UI elements:
- Current track section
- Upcoming tracks list
- Drag handles for reordering queue, if included
- Remove from queue action
- Clear queue button
- Play from selected track action
Do not include social listening or public queue features.

19. Settings Page
Purpose: account and playback preferences only.
UI elements:
- Account section:
  - Email
  - Sign Out
- Playback section:
  - Auto-play next track toggle
  - Show mini-player toggle, if useful
  - Prefer synced lyrics toggle, if useful
- Library management section:
  - Default sort order
  - Default playlist behavior, optional
- Language section:
  - English shown as selected
Do not include storage usage charts, billing, subscriptions, public profile, friends, or admin analytics.

20. Empty and Error State Cards
Create small reusable mobile state cards for:
- Empty Library:
  “You haven’t uploaded any music yet.”
  Button: Upload Music
- Empty Playlist:
  “This playlist is empty.”
  Button: Add Music
- No Lyrics:
  “No lyrics file uploaded.”
  Button: Upload Lyrics
- Invalid Lyrics:
  “This lyrics file could not be parsed.”
  Button: Replace Lyrics
- Upload Failed:
  Shows failed file name, reason, Retry, Remove
- Unsupported Format:
  Shows unsupported file name and accepted formats
- Loading:
  Skeleton list rows for music library

Information architecture and board layout:
Arrange the design board in sections from left to right or top to bottom:
- Auth
- Home and Navigation
- Library and Music Management
- Upload Flow
- Playlist Flow
- Player and Lyrics
- Settings
- Empty/Error States

Use clear section labels and page labels. Use connector arrows to show important flows:
- Sign In → Home
- Home → Full Player
- Mini-player → Full Player
- Library → Music Detail → Edit Metadata
- Library → Upload
- Upload → Upload Review → Upload Progress → Library
- Playlists → Playlist Detail → Add Music / Reorder
- Full Player → Lyrics Player
- Full Player → Queue

Interaction annotations:
Add small callout labels for important interactions:
- “Tap track to play”
- “Tap mini-player to expand”
- “Tap lyric line to seek”
- “Audio and .lrc files can be bulk uploaded”
- “Files with matching names are paired automatically”
- “All music is private”

Visual quality:
- High-fidelity mobile web app mockups
- Dense but readable
- Realistic spacing for mobile screens
- Modern music-app aesthetic
- Consistent components
- Clear hierarchy
- Touch-friendly controls
- Avoid cluttered admin-table appearance
- Use realistic placeholder album art or abstract music artwork
- Use readable English labels
- Landscape design board, high resolution, suitable for understanding the whole product at a glance
