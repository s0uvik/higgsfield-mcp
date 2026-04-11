# Higgsfield MCP

Bridge between [Higgsfield AI](https://higgsfield.ai) and any MCP-compatible client (Claude Desktop, Cursor, etc.). Built on the official [MCP SDK for TypeScript/Node](https://github.com/modelcontextprotocol/typescript-sdk).

---

## What Can It Do?

| Capability                | Model                        | Output                           |
| ------------------------- | ---------------------------- | -------------------------------- |
| Prompt to image           | Soul                         | Up to 1080p stills               |
| Still to motion clip      | DoP (lite / turbo / preview) | 5-second cinematic loops         |
| Portrait + voice to video | Speak v2                     | 5 / 10 / 15-second talking heads |
| Persistent identity       | Custom References            | Reusable face embeddings         |

Every generation call is async — you fire it, receive a `job_set_id`, and poll until the result lands.

---

## Quick Start

### 1. Prerequisites

- **Node.js 18+**
- A Higgsfield AI account — grab keys at <https://cloud.higgsfield.ai/api-keys>

### 2. Install

```bash
cd higgsfield-mcp
npm install
```

### 3. Credentials

Copy the template and fill in your keys:

```bash
cp .env.example .env
```

```env
HF_API_KEY=hf_xxxxxxxxxxxx
HF_SECRET=sk_xxxxxxxxxxxx
```

### 4. Run

```bash
npm start
```

The server starts on **stdio** — pipe it into any MCP host.

---

## Connecting to Claude Desktop

Edit your Claude Desktop config:

- **macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "higgsfield": {
      "command": "node",
      "args": ["src/server.js"],
      "cwd": "/full/path/to/higgsfield-mcp",
      "env": {
        "HF_API_KEY": "hf_xxxxxxxxxxxx",
        "HF_SECRET": "sk_xxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## Tool Reference

### `generate_image`

Turns a text prompt into a high-resolution still.

| Param          | Type                  | Default   | Notes                                                  |
| -------------- | --------------------- | --------- | ------------------------------------------------------ |
| `prompt`       | string                | —         | **Required.** Describe what you want.                  |
| `quality`      | `"720p"` \| `"1080p"` | `"1080p"` | Higher = more credits.                                 |
| `character_id` | string                | —         | Lock in a face from Custom References.                 |
| `style_id`     | string                | —         | Apply a preset look. Browse via `higgsfield://styles`. |

---

### `generate_video`

Animates a still image into a short cinematic clip.

| Param       | Type                                  | Default      | Notes                                                  |
| ----------- | ------------------------------------- | ------------ | ------------------------------------------------------ |
| `image_url` | string                                | —            | **Required.** Public HTTPS link to the source frame.   |
| `motion_id` | string                                | —            | **Required.** Pick one from `higgsfield://motions`.    |
| `prompt`    | string                                | —            | Scene description; auto-filled if omitted.             |
| `quality`   | `"lite"` \| `"turbo"` \| `"standard"` | `"standard"` | Maps to dop-lite / dop-turbo / dop-preview internally. |

> Expect 20–60 s processing. Poll `get_generation_status` every ~10 s.

---

### `generate_talking_head`

Combines a portrait still with a voice track to produce a lip-synced video.

| Param            | Type                 | Default  | Notes                                       |
| ---------------- | -------------------- | -------- | ------------------------------------------- |
| `image_url`      | string               | —        | **Required.** Headshot / portrait.          |
| `audio_url`      | string               | —        | **Required.** **WAV only** — MP3 will fail. |
| `prompt`         | string               | —        | **Required.** Describe the scene / subject. |
| `quality`        | `"high"` \| `"mid"`  | `"high"` |                                             |
| `duration`       | `5` \| `10` \| `15`  | `5`      | Seconds. Audio is auto-trimmed.             |
| `enhance_prompt` | boolean              | `false`  | Let the model rewrite the prompt.           |
| `seed`           | number (1–1 000 000) | `42`     | For reproducibility.                        |

> Takes 2–3 min. Convert MP3 first: `ffmpeg -i speech.mp3 -acodec pcm_s16le -ar 44100 speech.wav`

---

### `create_character`

Uploads face references so future images keep a consistent identity.

| Param        | Type           | Notes                                |
| ------------ | -------------- | ------------------------------------ |
| `name`       | string         | Human-readable label.                |
| `image_urls` | string[] (1–5) | Clear face shots from varied angles. |

> One-time cost: **40 credits ($2.50)**. The returned `character_id` is reusable forever.

---

### `get_generation_status`

Polls a running or finished job.

| Param        | Type   |
| ------------ | ------ |
| `job_set_id` | string |

**Possible statuses:** `queued` → `in_progress` → `completed` / `failed` / `nsfw`

When `completed`, the response contains `preview_url` and `full_quality_url`. Results stay available for **7 days**.

---

### `list_characters`

Returns every Custom Reference on your account — IDs, names, thumbnails, readiness status.

---

### `debug_credentials`

Sanity-check tool. Shows whether keys are loaded and the base URL the client is hitting. No API call is made.

---

## Browsable Resources

MCP resources let the client inspect catalogs before calling a tool.

| URI                       | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| `higgsfield://styles`     | Soul style presets — pass `style_id` to `generate_image`         |
| `higgsfield://motions`    | DoP motion presets — pass `motion_id` to `generate_video`        |
| `higgsfield://characters` | Your Custom References — pass `character_id` to `generate_image` |

---

## End-to-End Example

```text
1.  Browse higgsfield://styles  →  pick a style_id
2.  generate_image({ prompt: "...", style_id })  →  job_set_id
3.  get_generation_status(job_set_id)  →  wait until completed  →  full_quality_url
4.  Browse higgsfield://motions  →  pick a motion_id
5.  generate_video({ image_url: full_quality_url, motion_id })  →  new job_set_id
6.  get_generation_status(new_job_set_id)  →  download cinematic clip
```

---

## Credit Costs

| Operation    | Tier     | Credits | USD   |
| ------------ | -------- | ------- | ----- |
| Image        | 720p     | 1.5     | $0.09 |
| Image        | 1080p    | 3       | $0.19 |
| Video        | Lite     | 2       | $0.13 |
| Video        | Turbo    | 6.5     | $0.41 |
| Video        | Standard | 9       | $0.56 |
| Talking Head | —        | varies  | —     |
| Character    | one-time | 40      | $2.50 |

**Exchange rate:** $1 = 16 credits — top up at <https://cloud.higgsfield.ai/credits>

---

## Troubleshooting

| Symptom                            | Fix                                                    |
| ---------------------------------- | ------------------------------------------------------ |
| `401 Unauthorized`                 | Double-check `HF_API_KEY` and `HF_SECRET`.             |
| `402 Payment Required`             | Out of credits — reload at the dashboard.              |
| Server invisible in Claude Desktop | Verify `cwd` is an absolute path; restart the app.     |
| Job stuck on `queued`              | Retry poll — high-traffic periods can delay startup.   |
| Video returns `422`                | Ensure the image URL is publicly reachable over HTTPS. |
| Talking head fails                 | Confirm audio is `.wav`, not `.mp3`.                   |

---

## Project Layout

```
higgsfield-mcp/
├── src/
│   ├── client.js      # HTTP wrapper around the Higgsfield REST API
│   └── server.js      # MCP server — tools, resources, stdio transport
├── package.json
├── .env.example
├── .mcp.json          # Drop-in config snippet for Claude Desktop
└── .gitignore
```

---

## Extending

- **New tool** — add another `server.tool(...)` block in `src/server.js`.
- **New API endpoint** — add a method to `HiggsfieldClient` in `src/client.js`.

---

## Links

- Higgsfield Platform — <https://higgsfield.ai>
- Higgsfield API Docs — <https://platform.higgsfield.ai/docs>
- MCP Specification — <https://modelcontextprotocol.io>
- MCP TypeScript SDK — <https://github.com/modelcontextprotocol/typescript-sdk>

---

## License

MIT
