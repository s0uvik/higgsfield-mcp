# Prompting Guide

---

## Image Generation

### Soul (`generate_image`)
> "Generate a 1080p image of a lone astronaut on Mars at golden hour, 35mm film, shallow depth of field."

- Subject → Setting → Lighting → Camera style
- When using `style_id`: let the preset handle mood, focus your prompt on subject and action
- When using `character_id`: describe pose and expression, not physical features

### Reve (`generate_image_reve`)
> "Use Reve to generate a 16:9 cinematic still of a neon-lit Tokyo alley in heavy rain."

### Seedream v4 (`generate_image_seedream`)
> "Generate a portrait-ratio image with Seedream of a samurai standing in fog, camera fixed."

### Seedream Edit (`edit_image_seedream`)
> "Edit my image — change the background to a sunset beach, keep the subject the same."

---

## Video Generation

### DoP (`generate_video`)
> "Animate this image with a slow push-in camera move, turbo quality."

- The `prompt` describes the scene — the `motion_id` handles movement
- Test with `lite` quality first before committing to `standard`

### Kling v2.1 Pro (`generate_video_kling`)
> "Use Kling to animate this image with a dramatic upward crane shot."

- Prompt = camera movement instructions

### Seedance v1 Pro (`generate_video_seedance`)
> "Use Seedance — the character walks forward toward the camera."

- Prompt = subject movement and action

### DoP Standard (`generate_video_dop_standard`)
> "Generate a 6-second video from this image with a gentle parallax drift, DoP Standard."

### Talking Head (`generate_talking_head`)
> "Create a 10-second talking head from this portrait and this WAV file."

- Audio must be **WAV**. Convert: `ffmpeg -i input.mp3 -acodec pcm_s16le -ar 44100 output.wav`
- Use a front-facing headshot, mouth clearly visible
- Prompt describes the scene/appearance, not what the person is saying

---

## Status & Control

> "Check status of job `jobset_xyz789`." → `get_generation_status` (Soul/DoP/TalkingHead jobs)

> "What's the status of request `req_abc456`?" → `get_request_status` (all other models)

> "Cancel request `req_abc456`." → `cancel_request` (queued jobs only)

---

## Characters

> "Create a character named Elena using these three images: url1, url2, url3."
> "Show me all my saved characters."
> "Delete character `char_abc123`."

---

## Lookup

> "What image styles are available?" → `list_styles`
> "List all motion presets." → `list_motions`

---

## General Tips

- **Public URLs only.** `image_url` and `audio_url` must be reachable from Higgsfield's servers. No localhost or auth-gated URLs.
- **Poll every 10–15s.** Don't hammer the status endpoint.
- **Iterate cheap.** Use low quality tiers while testing, switch to high for finals.
- **Results last 7 days.** Save your `job_set_id` / `request_id`.
- **NSFW filter trips.** If status is `nsfw`, rephrase — avoid ambiguous words.
- **Short prompts win.** 2–3 focused sentences beat a stuffed paragraph.
