# Code-drawn mode: the storyboard page is the renderer

A vertical or horizontal film drawn entirely by code: one HTML page draws every
frame with `drawFrame(g, t)`, a pure function of time, on a canvas. The same page
is the storyboard the owner approves and, unchanged, the film's renderer. No VHS,
no Remotion, no screen recording. Use it when the subject is a process (a skill,
a workflow, agents, a gate) better shown as a drawn picture than as a terminal.

First built for the OrchestKit verify reel (2026-11-10): 32 s, 1080x1920, 960
frames, approved storyboard to encoded film in about 5 minutes of machine time.

## The contract

- `drawFrame(g, t)` draws the whole frame at time `t` seconds on a context already
  scaled to the design size (for example 1080x1920). No state carried between
  frames, no `Date.now()`, no unseeded random: any frame renders alone, in any order.
- Every string and number on screen comes from a real captured run, and the
  storyboard page names the capture file for each shot. Drawn pictures (agents as
  figures, a stopwatch, a server) are labelled as drawn, not passed off as screens.
- The page keeps its wiring (player, shot cards, buttons) after a marker comment,
  `// ---- page wiring ----`. Everything before the marker is drawing code.

## The pipeline

```
storyboard page ──▶ owner approves ──▶ freeze approved-design/
      │                                        │
      └──▶ make-film.py ──▶ film.html (2x canvas, renderAt(t))
                                │
              render-frames.mjs ──▶ fNNN.png at 2x ──▶ encode ──▶ preflight
                                                          │
              approved stills ◀── compare.py ──▶ frames decoded from the MP4
```

1. **Storyboard page.** One self-contained HTML file: a live player of the canvas,
   one card per shot with its words, motion and capture source, and a "copy as
   prompt" approve section. Show it served at the phone and desktop widths.
2. **Freeze on approval.** Copy the page, its fonts and images to
   `approved-design/` beside the film and never edit that copy. A later change is
   a new approval, not an edit of the old reference.
3. **Film page.** `python3 scripts/code-drawn/make-film.py <storyboard.html>`
   copies the drawing code unchanged into `film.html` with a canvas at 2x and
   `window.renderAt(t)`. It records every `new Image()` the drawing code makes and
   loads every font face up front: canvas text never requests a font by itself,
   and a top-level `const` image is not a `window` property, so neither can be
   found later.
4. **Frames.** Serve the folder (any static server), start Chrome with
   `--remote-debugging-port=9222`, then
   `node scripts/code-drawn/render-frames.mjs <url>/film.html frames --fps 30 --seconds 32`.
   It opens its own tab, saves the canvas pixels (not a screenshot) as
   `f000.png`... and closes the tab. 960 frames at 2160x3840 took 98 to 107 s.
5. **Encode.** From 2x frames, downscaled once:
   ```bash
   ffmpeg -framerate 30 -i frames/f%03d.png \
     -vf "scale=1080:1920:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p" \
     -c:v libx264 -profile:v high -preset slow -tune animation -crf 12 -g 30 \
     -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
     -movflags +faststart film.mp4
   ```
   Use your house encoder and preflight gate instead when you have one.
6. **Compare.** Shoot the approved page at a dozen moments (`?t=<seconds>` on the
   page, one still per moment, named `<t>.png`) and decode the same moments from
   the MP4 (`ffmpeg -ss <t> -i film.mp4 -frames:v 1 rendered/<t>.png`). Then
   `python3 scripts/code-drawn/compare.py approved rendered`. Show the pairs side
   by side on a served page at both widths.
7. **Fresh review.** Hand the exported MP4 (contact sheet, beat frames, strips
   across every fast move, phone-width sheet, the words with their times) to a
   reviewer that saw none of the work. Its score is the score; at most three
   rounds, a new reviewer each round.

## What compare.py measures, and its limits

- Both images are resized to 540x960 and blurred 2 px first. Without the blur, a
  page screenshot (900 px wide) and a film frame (2160 px, downscaled) differ on
  0.6 to 2 % of pixels, all on letter edges, and a true match reads as a miss.
- A pair matches at a mean difference under 4 of 255 and under 1 % of pixels off
  by more than 48. On the verify reel the true pairs measured 1.5 to 2.1 and 0.0 %.
- The control pairs each approved still with the next moment's frame; every one
  must differ, or the run fails. It also exits 1 on a planted wrong frame. The
  margin is thin for small changes: a frame 1.5 s late in a slow shot measured
  mean 3.26 and 1.19 % off, caught only by the second limit.
- It samples moments. A defect between them (a slide over the footer during a pan,
  a carried element landing in the wrong place) passes the compare and is found
  only by the strips in the fresh review. On the verify reel, the first review
  found five such defects in a film that matched 12 of 12 moments.

## Lessons from the first film

- **Transitions are where it breaks.** Clip the stage above any fixed footer before
  a pan, keep headlines fixed at the top while the scene moves, and cross-fade the
  outgoing and incoming headline so no frame is without one.
- **Never count up to a grade.** A score counting 0.0, 1.4, 2.6 under "Graded 7.9"
  shows grades that never happened. Land the real number whole.
- **A carried element must land on something meaningful.** A music stand flown onto
  an agent read as a sign taped to its chest, then as a hat. Fade it in place.
- **Phone width decides type size.** At 1080 wide, anything under about 40 px is
  unreadable on a 360 px phone. Labels that say who acts and what happens carry the
  explanation for a muted viewer, so they get 40 to 46 px.
- **Clocks must tell the truth.** A stopwatch for 60 s turns once and points to 12
  at 60 s; a free-spinning hand looks like wrong data.
- Silence costs about a third of the impact in review. Plan the sound bed with the
  storyboard, not after the film.
