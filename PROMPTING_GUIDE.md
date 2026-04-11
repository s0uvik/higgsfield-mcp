# Prompting Guide — Getting Better Results from Higgsfield AI

This guide covers how to write effective prompts for each Higgsfield model so you get the highest quality output on the first try.

---

## Image Generation (Soul Model)

### Structure Your Prompt in Layers

A strong image prompt has four parts:

1. **Subject** — who or what is in the frame
2. **Setting** — where the scene takes place
3. **Mood / Lighting** — the emotional tone and light direction
4. **Style / Camera** — how the shot is composed

**Weak:**
```
a woman in a garden
```

**Strong:**
```
A woman in her 30s with sharp cheekbones sitting cross-legged on a stone bench
in a sun-bleached desert garden, golden hour side-lighting casting long shadows,
shot on 35mm film with shallow depth of field
```

### Tips That Make a Difference

- **Be specific about faces and expressions.** "Confident half-smile" beats "smiling." "Narrowed eyes looking past the camera" beats "serious face."
- **Name the light source.** "Overhead fluorescent" and "warm window light from the left" produce completely different images. Don't leave it to chance.
- **Mention the lens or camera style.** Terms like "85mm portrait lens," "wide-angle," "macro close-up," or "drone shot" steer composition more than adjectives do.
- **Use film/photography references over art references.** "Shot on Kodak Portra 400" or "Fujifilm color science" gives the model a concrete palette to match.
- **Avoid contradictions.** "Dark moody scene with bright vibrant colors" confuses the model. Pick a direction.
- **Front-load the important details.** The model pays more attention to the beginning of the prompt. Put your subject and key visual first.

### Using Style Presets

Browse `higgsfield://styles` to see available presets. When using a `style_id`:

- Your prompt still matters — the style sets the visual treatment, your words set the content.
- Keep prompts shorter when using styles. Let the preset handle mood and color; focus your prompt on subject and action.
- If the style already implies a look (e.g., "cinematic noir"), don't fight it with contradictory prompt words.

### Using Character References

When generating with a `character_id`:

- Describe the scene and clothing, not the face. The character reference handles facial consistency.
- Mention pose and expression: "looking over her shoulder with a slight grin" helps the model place the known face in a new context.
- Avoid describing physical features that conflict with the reference images (e.g., don't say "blonde hair" if the reference has dark hair).

---

## Video Generation (DoP Model)

### Prompting for Motion

The `prompt` field for video describes the **scene**, not the motion — the `motion_id` preset handles camera movement and animation style.

**Good video prompts describe the static scene clearly:**
```
A calm lake surrounded by pine trees at dawn, mist hovering over the water surface
```

**Bad video prompts try to direct the action:**
```
The camera slowly pans right while zooming into the lake and the mist swirls around
```

### Choosing the Right Quality Tier

| Tier | Best For |
|---|---|
| **Lite** | Quick previews, testing motion presets, iterating on ideas |
| **Turbo** | Balanced speed and quality — good for most use cases |
| **Standard** | Final output, client-facing work, maximum detail |

### Motion Preset Selection

Browse `higgsfield://motions` before generating. Consider:

- **Match motion to content.** A slow dolly works for landscapes; a handheld shake suits action scenes.
- **Check the `start_end_frame` flag.** Some presets define both start and end positions — these give more predictable results for specific compositions.
- **Test with Lite first.** Try a cheap Lite render to verify the motion preset works with your image before committing to Standard quality.

---

## Talking Head (Speak v2 Model)

### Image Selection

The source image has the biggest impact on quality:

- **Use a front-facing headshot or slight 3/4 angle.** Extreme profiles or tilted heads produce artifacts.
- **Ensure the mouth area is clearly visible.** No hands near the face, no scarves covering the chin.
- **Neutral or slight expression works best.** A wide open smile as the starting frame can look odd when the mouth begins moving.
- **High resolution with good lighting.** Grainy, dark, or low-res portraits degrade the output noticeably.

### Audio Preparation

- **WAV format is mandatory.** Convert with: `ffmpeg -i input.mp3 -acodec pcm_s16le -ar 44100 output.wav`
- **Clean audio matters.** Background noise, music, or multiple speakers confuse lip sync. Use a noise-cleaned single-speaker track.
- **Match audio length to your chosen duration.** If you pick `duration: 10` but supply 30 seconds of audio, it will be trimmed. Front-load the important content.
- **Natural speech cadence works best.** Very fast speech or long pauses can produce unnatural mouth movements.

### Prompt Writing for Talking Heads

The prompt here describes **what the person and scene look like**, not what they're saying:

**Good:**
```
A professional woman in a navy blazer sitting at a modern desk with soft studio lighting
```

**Bad:**
```
A woman talking about quarterly earnings and explaining the revenue growth
```

### Quality and Duration Trade-offs

| Duration | Quality: High | Quality: Mid |
|---|---|---|
| 5s | Fast, sharp — best for short clips | Fastest option overall |
| 10s | Good balance for most talking head content | Acceptable for drafts |
| 15s | Longest processing time (~3 min), highest detail | Use for longer takes where speed matters more than polish |

### Using the Seed Parameter

- Same `seed` + same inputs = same output. Useful when you want to regenerate with a small prompt tweak without changing everything else.
- Change the seed when you want variety from the same image and audio combination.

---

## General Tips Across All Models

1. **Iterate cheaply.** Use lower quality tiers or shorter durations while experimenting. Switch to high quality for the final version.

2. **Poll patiently.** Check `get_generation_status` every 10–15 seconds. Hammering it faster won't speed things up.

3. **Save your job IDs.** Results are available for 7 days. You don't need to regenerate if you still have the `job_set_id`.

4. **Watch for NSFW flags.** If a job comes back with status `nsfw`, rephrase the prompt — even unintentional triggers can trip the filter. Avoid words with double meanings.

5. **Public URLs only.** Every `image_url` and `audio_url` must be reachable from Higgsfield's servers. Local files, `localhost`, and authenticated URLs won't work. Use a CDN, S3 presigned URL, or public hosting.

6. **Don't over-prompt.** A focused 2–3 sentence prompt usually outperforms a paragraph stuffed with every adjective you can think of. Clarity beats quantity.
