# Higgsfield MCP

MCP server for [Higgsfield AI](https://higgsfield.ai) — generate images and videos directly from Claude or any MCP-compatible client.

---

## Setup

**Node.js 18+ required.** Get your API keys at <https://cloud.higgsfield.ai/api-keys>.

### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "higgsfield": {
      "command": "npx",
      "args": ["-y", "higgsfield-mcp"],
      "env": {
        "HF_API_KEY": "your_api_key",
        "HF_SECRET": "your_secret"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add higgsfield -- npx -y higgsfield-mcp
export HF_API_KEY=your_api_key
export HF_SECRET=your_secret
```

### 3. Get Your API Keys

1. Go to <https://cloud.higgsfield.ai/api-keys>
2. Create or copy your **API Key** and **Secret**

### 4. Connect to an MCP Client

#### Claude Desktop

Edit your Claude Desktop config:

- **macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "higgsfield": {
      "command": "npx",
      "args": ["-y", "higgsfield-mcp"],
      "env": {
        "HF_API_KEY": "hf_xxxxxxxxxxxx",
        "HF_SECRET": "sk_xxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

#### Claude Code (CLI)

```bash
claude mcp add higgsfield -- npx -y higgsfield-mcp
```

Then set your environment variables before running Claude Code:

```bash
export HF_API_KEY=hf_xxxxxxxxxxxx
export HF_SECRET=sk_xxxxxxxxxxxx
```

#### Cursor / VS Code

Add to your `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "higgsfield": {
      "command": "npx",
      "args": ["-y", "higgsfield-mcp"],
      "env": {
        "HF_API_KEY": "hf_xxxxxxxxxxxx",
        "HF_SECRET": "sk_xxxxxxxxxxxx"
      }
    }
  }
}
```

---

## Tools

### Image Generation

| Tool                      | Model            | Notes                                           |
| ------------------------- | ---------------- | ----------------------------------------------- |
| `generate_image`          | Soul             | Supports style presets and character references |
| `generate_image_reve`     | Reve             |                                                 |
| `generate_image_seedream` | Seedream v4      | Optional `camera_fixed` param                   |
| `edit_image_seedream`     | Seedream v4 Edit | Edit existing images via prompt                 |

### Video Generation

| Tool                          | Model                     | Notes                                   |
| ----------------------------- | ------------------------- | --------------------------------------- |
| `generate_video`              | DoP (lite/turbo/standard) | Requires a `motion_id`                  |
| `generate_video_kling`        | Kling v2.1 Pro            | Prompt = camera movement instructions   |
| `generate_video_seedance`     | Seedance v1 Pro           | Prompt = movement/action description    |
| `generate_video_dop_standard` | DoP Standard              | Optional `duration` (2–10s)             |
| `generate_talking_head`       | Speak v2                  | Portrait + WAV audio → lip-synced video |

### Status & Control

| Tool                    | Notes                                         |
| ----------------------- | --------------------------------------------- |
| `get_generation_status` | Poll Soul/DoP/TalkingHead jobs (`job_set_id`) |
| `get_request_status`    | Poll all other generation jobs (`request_id`) |
| `cancel_request`        | Cancel a queued job                           |

### Characters

| Tool               | Notes                                                        |
| ------------------ | ------------------------------------------------------------ |
| `create_character` | 1–5 face images → reusable `character_id`. Costs 40 credits. |
| `list_characters`  | All characters with status and thumbnails                    |
| `get_character`    | Single character by ID                                       |
| `delete_character` | Permanently delete a character                               |

### Lookup

| Tool                | Notes                               |
| ------------------- | ----------------------------------- |
| `list_styles`       | Style presets for `generate_image`  |
| `list_motions`      | Motion presets for `generate_video` |
| `debug_credentials` | Verify keys are loaded              |

### Resources

Browse these before generating:

- `higgsfield://styles` — style IDs for `generate_image`
- `higgsfield://motions` — motion IDs for `generate_video`
- `higgsfield://characters` — your character references

---

## How Jobs Work

Tools return either a `job_set_id` or `request_id`. Poll the matching status tool until `completed`, then download the output URL. Results are kept for **7 days**.

```
generate_image(...)             → job_set_id  → get_generation_status(job_set_id)
generate_image_reve(...)        → request_id  → get_request_status(request_id)
generate_video_kling(...)       → request_id  → get_request_status(request_id)
```

All tools accept an optional `webhook_url` to receive a callback when the job finishes.

---

## Talking Head Note

Audio must be **WAV format**. Convert with:

```bash
ffmpeg -i speech.mp3 -acodec pcm_s16le -ar 44100 speech.wav
```

---

## Credits

| Operation            | Credits | USD   |
| -------------------- | ------- | ----- |
| Image 720p           | 1.5     | $0.09 |
| Image 1080p          | 3       | $0.19 |
| Video lite           | 2       | $0.13 |
| Video turbo          | 6.5     | $0.41 |
| Video standard       | 9       | $0.56 |
| Character (one-time) | 40      | $2.50 |

Top up at <https://cloud.higgsfield.ai/credits>

---

## Links

- [Higgsfield Platform](https://higgsfield.ai)
- [API Docs](https://platform.higgsfield.ai/docs)
- [MCP Specification](https://modelcontextprotocol.io)
