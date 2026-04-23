#!/usr/bin/env node

/**
 * Higgsfield AI MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { HiggsfieldClient } from "./client.js";

dotenv.config();

const apiKey = process.env.HF_API_KEY || "";
const secret = process.env.HF_SECRET || "";

if (!apiKey || !secret) {
  console.error("Warning: Missing HF_API_KEY and/or HF_SECRET environment variables.");
}

const client = new HiggsfieldClient(apiKey, secret);

const server = new McpServer({
  name: "Higgsfield AI",
  version: "0.2.0",
});

// Helper: format new unified API response
function fmtNewApiResult(result) {
  return {
    success: true,
    request_id: result.request_id,
    status: result.status,
    status_url: result.status_url,
    cancel_url: result.cancel_url,
    message: "Job queued — use get_request_status with request_id to poll completion",
  };
}

// Helper: format new API status response
function fmtRequestStatus(result) {
  const out = {
    success: true,
    request_id: result.request_id,
    status: result.status,
  };

  if (result.images?.length) {
    out.images = result.images;
  }
  if (result.video) {
    out.video = result.video;
  }

  const msgMap = {
    completed: "Done! Output URLs above.",
    failed: "Generation failed.",
    nsfw: "Content filter triggered — try different prompt.",
    cancelled: "Request was cancelled.",
    queued: "Still queued — check again in a few seconds.",
    in_progress: "Processing — check again in a few seconds.",
  };
  out.message = msgMap[result.status] || "Unknown status.";

  return out;
}

// ============================================================================
// TOOLS — OLD API (Soul image, DoP video, Talking Head, Characters)
// ============================================================================

server.tool(
  "generate_image",
  "Generate a high-quality image from a text prompt using Soul model. Returns job_set_id to poll with get_generation_status.",
  {
    prompt: z.string().describe("Detailed text description of the image to generate"),
    quality: z.enum(["720p", "1080p"]).default("1080p").describe("Image quality"),
    character_id: z.string().optional().describe("Character reference ID for consistent generation"),
    style_id: z.string().optional().describe("Style preset ID (browse higgsfield://styles)"),
  },
  async ({ prompt, quality, character_id, style_id }) => {
    try {
      const result = await client.generateImage({
        prompt,
        quality,
        customReferenceId: character_id,
        styleId: style_id,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                job_set_id: result.id,
                job_type: result.type,
                status: "Job started — use get_generation_status to check completion",
                created_at: result.created_at,
                jobs: result.jobs,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "generate_video",
  "Convert an image to a 5-second cinematic video with motion effects using DoP model. Image URL must be publicly accessible HTTPS. Processing takes 20-60 seconds.",
  {
    image_url: z.string().describe("URL of the source image (must be publicly accessible via HTTPS)"),
    motion_id: z.string().describe("Motion preset ID (browse higgsfield://motions)"),
    prompt: z.string().optional().describe("Description of the scene. Auto-generated if empty."),
    quality: z.enum(["lite", "turbo", "standard"]).default("standard").describe("Video quality"),
  },
  async ({ image_url, motion_id, prompt, quality }) => {
    const modelMap = { lite: "dop-lite", turbo: "dop-turbo", standard: "dop-preview" };
    const model = modelMap[quality] || "dop-preview";

    try {
      const result = await client.generateVideo({
        imageUrl: image_url,
        motionId: motion_id,
        prompt: prompt || "",
        model,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                job_set_id: result.id,
                job_type: result.type,
                status: "Job started — use get_generation_status to check completion",
                created_at: result.created_at,
                jobs: result.jobs,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: e.message,
                debug_info: { image_url, motion_id, model, prompt_provided: !!prompt },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
);

server.tool(
  "generate_talking_head",
  "Generate a talking head video from image + audio using Speak v2 model. Audio MUST be WAV format. Processing takes 2-3 minutes.",
  {
    image_url: z.string().describe("URL of the source image (portrait/headshot)"),
    audio_url: z.string().describe("URL of the audio file in WAV format"),
    prompt: z.string().describe("Text description of the image/scene"),
    quality: z.enum(["high", "mid"]).default("high").describe("Video quality"),
    duration: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5).describe("Duration in seconds"),
    enhance_prompt: z.boolean().default(false).describe("Auto-enhance the prompt"),
    seed: z.number().min(1).max(1000000).default(42).describe("Random seed for reproducibility"),
  },
  async ({ image_url, audio_url, prompt, quality, duration, enhance_prompt, seed }) => {
    try {
      const result = await client.generateTalkingHead({
        imageUrl: image_url,
        audioUrl: audio_url,
        prompt,
        quality,
        duration,
        enhancePrompt: enhance_prompt,
        seed,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                job_set_id: result.id,
                job_type: result.type,
                status: "Job started — use get_generation_status to check completion",
                created_at: result.created_at,
                jobs: result.jobs,
                duration,
                quality,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "get_generation_status",
  "Check status and retrieve results of a Soul/DoP/TalkingHead job (old API). Statuses: queued, in_progress, completed, failed, nsfw. Results retained 7 days.",
  {
    job_set_id: z.string().describe("The job_set_id returned from generate_image, generate_video, or generate_talking_head"),
  },
  async ({ job_set_id }) => {
    try {
      const result = await client.getJobResults(job_set_id);

      const jobs = result.jobs.map((job) => {
        const info = { job_id: job.id, status: job.status };
        if (job.results) {
          info.results = {
            preview_url: job.results.min?.url,
            full_quality_url: job.results.raw?.url,
            type: job.results.raw?.type,
          };
        }
        return info;
      });

      const statuses = result.jobs.map((j) => j.status);
      let message;
      if (statuses.every((s) => s === "completed")) {
        message = "Done! Download URLs above.";
      } else if (statuses.some((s) => s === "failed")) {
        message = "One or more jobs failed.";
      } else if (statuses.some((s) => s === "nsfw")) {
        message = "Content filter triggered — try different prompt.";
      } else {
        message = "Still processing — check again in a few seconds.";
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                job_set_id: result.id,
                type: result.type,
                created_at: result.created_at,
                jobs,
                message,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

// ============================================================================
// TOOLS — CHARACTER MANAGEMENT
// ============================================================================

server.tool(
  "create_character",
  "Create a reusable character reference for consistent generation. Costs 40 credits ($2.50). Provide 1-5 face images.",
  {
    name: z.string().describe("Descriptive name for this character reference"),
    image_urls: z.array(z.string()).min(1).max(5).describe("1-5 image URLs showing the character's face"),
  },
  async ({ name, image_urls }) => {
    try {
      const result = await client.createCharacter(name, image_urls);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                character_id: result.id,
                name: result.name,
                status: result.status,
                message: "Character creation started. Status: not_ready → queued → in_progress → completed",
                created_at: result.created_at,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "list_characters",
  "List all character references you've created, with IDs, names, status, and thumbnails.",
  {},
  async () => {
    try {
      const result = await client.listCharacters(1, 50);
      const characters = (result.items || []).map((item) => ({
        character_id: item.id,
        name: item.name,
        status: item.status,
        thumbnail_url: item.thumbnail_url,
        created_at: item.created_at,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                total: result.total || 0,
                characters,
                message: `Found ${characters.length} character reference(s)`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "get_character",
  "Get details of a single character reference by ID.",
  {
    character_id: z.string().describe("Character reference ID"),
  },
  async ({ character_id }) => {
    try {
      const result = await client.getCharacter(character_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                character_id: result.id,
                name: result.name,
                status: result.status,
                thumbnail_url: result.thumbnail_url,
                created_at: result.created_at,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "delete_character",
  "Delete a character reference by ID. This is irreversible.",
  {
    character_id: z.string().describe("Character reference ID to delete"),
  },
  async ({ character_id }) => {
    try {
      await client.deleteCharacter(character_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { success: true, character_id, message: "Character deleted successfully" },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

// ============================================================================
// TOOLS — STYLES & MOTIONS LOOKUP
// ============================================================================

server.tool(
  "list_styles",
  "List all available style presets for generate_image (Soul model). Returns style IDs and names.",
  {},
  async () => {
    try {
      const styles = await client.listStyles();
      const formatted = styles.map((s) => ({
        style_id: s.id,
        name: s.name,
        description: s.description,
        preview_url: s.preview_url,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { success: true, total: formatted.length, styles: formatted },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "list_motions",
  "List all available motion presets for generate_video (DoP model). Returns motion IDs and names.",
  {},
  async () => {
    try {
      const motions = await client.listMotions();
      const formatted = motions.map((m) => ({
        motion_id: m.id,
        name: m.name,
        description: m.description,
        preview_url: m.preview_url,
        start_end_frame: m.start_end_frame || false,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { success: true, total: formatted.length, motions: formatted },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

// ============================================================================
// TOOLS — NEW UNIFIED API (request_id based)
// ============================================================================

server.tool(
  "get_request_status",
  "Check status of a new-API generation request (Reve/Seedream/Kling/Seedance/DoPStandard). Statuses: queued, in_progress, completed, failed, nsfw, cancelled.",
  {
    request_id: z.string().describe("The request_id returned from new-API generation tools"),
  },
  async ({ request_id }) => {
    try {
      const result = await client.getRequestStatus(request_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fmtRequestStatus(result), null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "cancel_request",
  "Cancel a queued generation request (new API). Only works for queued jobs — in_progress jobs cannot be cancelled.",
  {
    request_id: z.string().describe("The request_id to cancel"),
  },
  async ({ request_id }) => {
    try {
      await client.cancelRequest(request_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { success: true, request_id, message: "Request cancelled successfully" },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "generate_image_reve",
  "Generate an image using Reve text-to-image model. Returns request_id — poll with get_request_status.",
  {
    prompt: z.string().describe("Text description of the image to generate"),
    aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("16:9").describe("Output aspect ratio"),
    resolution: z.enum(["720p", "1080p"]).default("1080p").describe("Output resolution"),
    webhook_url: z.string().url().optional().describe("Optional webhook URL to receive completion callback"),
  },
  async ({ prompt, aspect_ratio, resolution, webhook_url }) => {
    try {
      const result = await client.generateImageReve({ prompt, aspectRatio: aspect_ratio, resolution, webhookUrl: webhook_url });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fmtNewApiResult(result), null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "generate_image_seedream",
  "Generate an image using ByteDance Seedream v4 text-to-image model. Returns request_id — poll with get_request_status.",
  {
    prompt: z.string().describe("Text description of the image to generate"),
    aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("16:9").describe("Output aspect ratio"),
    resolution: z.enum(["720p", "1080p"]).default("1080p").describe("Output resolution"),
    camera_fixed: z.boolean().optional().describe("Lock camera position (no camera movement)"),
    webhook_url: z.string().url().optional().describe("Optional webhook URL to receive completion callback"),
  },
  async ({ prompt, aspect_ratio, resolution, camera_fixed, webhook_url }) => {
    try {
      const result = await client.generateImageSeedream({
        prompt,
        aspectRatio: aspect_ratio,
        resolution,
        cameraFixed: camera_fixed,
        webhookUrl: webhook_url,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fmtNewApiResult(result), null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "edit_image_seedream",
  "Edit or transform an image using ByteDance Seedream v4 edit model. Returns request_id — poll with get_request_status.",
  {
    prompt: z.string().describe("Description of the desired edit or transformation"),
    aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("16:9").describe("Output aspect ratio"),
    resolution: z.enum(["720p", "1080p"]).default("1080p").describe("Output resolution"),
    webhook_url: z.string().url().optional().describe("Optional webhook URL to receive completion callback"),
  },
  async ({ prompt, aspect_ratio, resolution, webhook_url }) => {
    try {
      const result = await client.editImageSeedream({
        prompt,
        aspectRatio: aspect_ratio,
        resolution,
        webhookUrl: webhook_url,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fmtNewApiResult(result), null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "generate_video_kling",
  "Generate a video from an image using Kling Video v2.1 Pro model. Prompt should describe camera movement and motion. Returns request_id — poll with get_request_status.",
  {
    image_url: z.string().describe("URL of the source image (must be publicly accessible via HTTPS)"),
    prompt: z.string().describe("Camera movement and motion instructions (e.g. 'slow pan left, subject walks forward')"),
    webhook_url: z.string().url().optional().describe("Optional webhook URL to receive completion callback"),
  },
  async ({ image_url, prompt, webhook_url }) => {
    try {
      const result = await client.generateVideoKling({ imageUrl: image_url, prompt, webhookUrl: webhook_url });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fmtNewApiResult(result), null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "generate_video_seedance",
  "Generate a video from an image using ByteDance Seedance v1 Pro model. Prompt should describe movement and action. Returns request_id — poll with get_request_status.",
  {
    image_url: z.string().describe("URL of the source image (must be publicly accessible via HTTPS)"),
    prompt: z.string().describe("Movement and action description (e.g. 'person waves hand, background wind effect')"),
    webhook_url: z.string().url().optional().describe("Optional webhook URL to receive completion callback"),
  },
  async ({ image_url, prompt, webhook_url }) => {
    try {
      const result = await client.generateVideoSeedance({ imageUrl: image_url, prompt, webhookUrl: webhook_url });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fmtNewApiResult(result), null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

server.tool(
  "generate_video_dop_standard",
  "Generate a video from an image using Higgsfield DoP Standard model (new API). Returns request_id — poll with get_request_status.",
  {
    image_url: z.string().describe("URL of the source image (must be publicly accessible via HTTPS)"),
    prompt: z.string().describe("Description of the desired motion and scene"),
    duration: z.number().int().min(2).max(10).optional().describe("Video duration in seconds"),
    webhook_url: z.string().url().optional().describe("Optional webhook URL to receive completion callback"),
  },
  async ({ image_url, prompt, duration, webhook_url }) => {
    try {
      const result = await client.generateVideoDopStandard({
        imageUrl: image_url,
        prompt,
        duration,
        webhookUrl: webhook_url,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fmtNewApiResult(result), null, 2),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

// ============================================================================
// TOOLS — FILE UPLOAD
// ============================================================================

server.tool(
  "upload_image",
  "Upload an image to Higgsfield hosting and get a public URL. Pass the image as a base64 string. Returns a public_url you can use in any generation tool.",
  {
    image_base64: z.string().describe("Base64-encoded image data (no data URI prefix — raw base64 only)"),
    content_type: z
      .enum(["image/jpeg", "image/png", "image/webp"])
      .default("image/jpeg")
      .describe("MIME type of the image"),
  },
  async ({ image_base64, content_type }) => {
    try {
      const bytes = Buffer.from(image_base64, "base64");
      const public_url = await client.uploadFile(bytes, content_type);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                public_url,
                message: "Image uploaded. Use public_url in any generation tool.",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: e.message }, null, 2),
          },
        ],
      };
    }
  }
);

// ============================================================================
// TOOLS — DEBUG
// ============================================================================

server.tool(
  "debug_credentials",
  "Check if credentials are properly configured.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              api_key_configured: !!client.headers["hf-api-key"],
              secret_configured: !!client.headers["hf-secret"],
              api_key_preview: client.headers["hf-api-key"]
                ? client.headers["hf-api-key"].slice(0, 8) + "..."
                : "NOT SET",
              base_url: client.baseUrl,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ============================================================================
// MCP RESOURCES
// ============================================================================

server.resource("styles", "higgsfield://styles", async (uri) => {
  try {
    const styles = await client.listStyles();
    const formatted = styles.map((s) => ({
      style_id: s.id,
      name: s.name,
      description: s.description,
      preview_url: s.preview_url,
    }));

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ available_styles: formatted, usage: "Use style_id in generate_image tool" }, null, 2),
        },
      ],
    };
  } catch (e) {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: e.message }, null, 2),
        },
      ],
    };
  }
});

server.resource("motions", "higgsfield://motions", async (uri) => {
  try {
    const motions = await client.listMotions();
    const formatted = motions.map((m) => ({
      motion_id: m.id,
      name: m.name,
      description: m.description,
      preview_url: m.preview_url,
      start_end_frame: m.start_end_frame || false,
    }));

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ available_motions: formatted, usage: "Use motion_id in generate_video tool" }, null, 2),
        },
      ],
    };
  } catch (e) {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: e.message }, null, 2),
        },
      ],
    };
  }
});

server.resource("characters", "higgsfield://characters", async (uri) => {
  try {
    const result = await client.listCharacters(1, 100);
    const characters = (result.items || []).map((item) => ({
      character_id: item.id,
      name: item.name,
      status: item.status,
      thumbnail_url: item.thumbnail_url,
      created_at: item.created_at,
    }));

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { total_characters: result.total || 0, characters, usage: "Use character_id in generate_image tool" },
            null,
            2
          ),
        },
      ],
    };
  } catch (e) {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: e.message }, null, 2),
        },
      ],
    };
  }
});

// ============================================================================
// Entry point
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
