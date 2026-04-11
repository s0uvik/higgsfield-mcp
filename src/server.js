#!/usr/bin/env node

/**
 * Higgsfield AI MCP Server
 * MCP server exposing Higgsfield AI capabilities to LLMs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { HiggsfieldClient } from "./client.js";

dotenv.config();

// Credentials from env
const apiKey = process.env.HF_API_KEY || "";
const secret = process.env.HF_SECRET || "";

if (!apiKey || !secret) {
  console.error(
    "Warning: Missing HF_API_KEY and/or HF_SECRET environment variables."
  );
}

const client = new HiggsfieldClient(apiKey, secret);

const server = new McpServer({
  name: "Higgsfield AI",
  version: "0.1.0",
});

// ============================================================================
// MCP TOOLS
// ============================================================================

server.tool(
  "generate_image",
  "Generate a high-quality image from a text prompt using Soul model. Returns a job_set_id to poll with get_generation_status.",
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
                status: "Job started - use get_generation_status to check completion",
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
              { success: false, error: e.message, message: "Failed to start image generation" },
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
  "generate_video",
  "Convert an image to a 5-second cinematic video with motion effects using DoP model. Image URL must be publicly accessible HTTPS. Processing takes 20-60 seconds.",
  {
    image_url: z.string().describe("URL of the source image (must be publicly accessible via HTTPS)"),
    motion_id: z.string().describe("Motion preset ID (browse higgsfield://motions)"),
    prompt: z.string().optional().describe("Description of the image/scene. Auto-generated if empty."),
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
                status: "Job started - use get_generation_status to check completion",
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
                message: "Failed to start video generation",
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
                status: "Job started - use get_generation_status to check completion",
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
            text: JSON.stringify(
              { success: false, error: e.message, message: "Failed to start talking head video generation" },
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
                message: "Character creation started. Status: not_ready -> queued -> in_progress -> completed",
                created_at: result.created_at,
                note: "Use list_characters or get_generation_status to check when ready",
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
              { success: false, error: e.message, message: "Failed to create character reference" },
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
  "get_generation_status",
  "Check status and retrieve results of an image/video generation job. Statuses: queued, in_progress, completed, failed, nsfw. Results retained 7 days.",
  {
    job_set_id: z.string().describe("The job_set_id returned from a generation tool"),
  },
  async ({ job_set_id }) => {
    try {
      const result = await client.getJobResults(job_set_id);

      const jobs = result.jobs.map((job) => {
        const info = { job_id: job.id, status: job.status };
        if (job.results) {
          info.results = {
            preview_url: job.results.min.url,
            full_quality_url: job.results.raw.url,
            type: job.results.raw.type,
          };
        }
        return info;
      });

      const statuses = result.jobs.map((j) => j.status);
      let message;
      if (statuses.every((s) => s === "completed")) {
        message = "Generation complete! Download URLs above.";
      } else if (statuses.some((s) => s === "failed")) {
        message = "One or more jobs failed.";
      } else if (statuses.some((s) => s === "nsfw")) {
        message = "Content filter triggered - regenerate with different prompt.";
      } else {
        message = "Still processing - check again in a few seconds.";
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
            text: JSON.stringify(
              { success: false, error: e.message, message: "Failed to retrieve job status" },
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
            text: JSON.stringify(
              { success: false, error: e.message, message: "Failed to list characters" },
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
  "debug_credentials",
  "Debug tool to check if credentials are properly configured.",
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
          text: JSON.stringify({ error: e.message, message: "Failed to fetch styles" }, null, 2),
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
          text: JSON.stringify({ error: e.message, message: "Failed to fetch motion presets" }, null, 2),
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
          text: JSON.stringify({ error: e.message, message: "Failed to fetch characters" }, null, 2),
        },
      ],
    };
  }
});

// ============================================================================
// Server entry point
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
