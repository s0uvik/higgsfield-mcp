/**
 * Higgsfield AI API Client
 */

const BASE_URL = "https://platform.higgsfield.ai";

export class HiggsfieldClient {
  constructor(apiKey, secret, baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.headers = {
      "hf-api-key": apiKey,
      "hf-secret": secret,
      Authorization: `Key ${apiKey}:${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async _request(method, path, { body, params } = {}) {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const options = {
      method,
      headers: this.headers,
      signal: AbortSignal.timeout(30000),
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  }

  // New unified generation API: POST /{model_id}
  async _generate(modelId, body, webhookUrl) {
    const path = webhookUrl
      ? `/${modelId}?hf_webhook=${encodeURIComponent(webhookUrl)}`
      : `/${modelId}`;
    return this._request("POST", path, { body });
  }

  // ── File Upload ───────────────────────────────────────────────────────────

  async uploadFile(bytes, contentType = "image/jpeg") {
    // Phase 1: get presigned upload URL
    const { public_url, upload_url } = await this._request("POST", "/files/generate-upload-url", {
      body: { content_type: contentType },
    });

    // Phase 2: PUT raw bytes to presigned URL (no auth header — embedded in URL)
    const res = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upload failed HTTP ${res.status}: ${text}`);
    }

    return public_url;
  }

  // ── Old API (v1) ──────────────────────────────────────────────────────────

  async generateImage({
    prompt,
    quality = "1080p",
    batchSize = 1,
    customReferenceId,
    styleId,
    widthAndHeight = "2048x1152",
    enhancePrompt = false,
    webhookUrl,
    webhookSecret,
  }) {
    const params = {
      prompt,
      width_and_height: widthAndHeight,
      enhance_prompt: enhancePrompt,
      quality,
      batch_size: batchSize,
    };
    if (customReferenceId) params.custom_reference_id = customReferenceId;
    if (styleId) params.style_id = styleId;

    const body = { params };
    if (webhookUrl) {
      body.webhook = { url: webhookUrl, secret: webhookSecret || "" };
    }

    return this._request("POST", "/v1/text2image/soul", { body });
  }

  async generateVideo({
    imageUrl,
    motionId,
    prompt = "",
    model = "dop-preview",
    webhookUrl,
    webhookSecret,
  }) {
    if (!prompt) prompt = "Cinematic video with natural motion";

    const params = {
      model,
      prompt,
      input_images: [{ type: "image_url", image_url: imageUrl }],
      motions: [{ id: motionId, strength: 0.5 }],
    };

    const body = { params };
    if (webhookUrl) {
      body.webhook = { url: webhookUrl, secret: webhookSecret || "" };
    }

    return this._request("POST", "/v1/image2video/dop", { body });
  }

  async generateTalkingHead({
    imageUrl,
    audioUrl,
    prompt,
    quality = "high",
    duration = 5,
    enhancePrompt = false,
    seed = 42,
    webhookUrl,
    webhookSecret,
  }) {
    const params = {
      input_image: { type: "image_url", image_url: imageUrl },
      input_audio: { type: "audio_url", audio_url: audioUrl },
      prompt,
      quality,
      duration,
      enhance_prompt: enhancePrompt,
      seed,
    };

    const body = { params };
    if (webhookUrl) {
      body.webhook = { url: webhookUrl, secret: webhookSecret || "" };
    }

    return this._request("POST", "/v1/speak/higgsfield", { body });
  }

  async getJobResults(jobSetId) {
    return this._request("GET", `/v1/job-sets/${jobSetId}`);
  }

  async listStyles() {
    return this._request("GET", "/v1/text2image/soul-styles");
  }

  async listMotions() {
    return this._request("GET", "/v1/motions");
  }

  async createCharacter(name, imageUrls) {
    const body = {
      name,
      input_images: imageUrls.map((url) => ({
        type: "image_url",
        image_url: url,
      })),
    };
    return this._request("POST", "/v1/custom-references", { body });
  }

  async listCharacters(page = 1, pageSize = 20) {
    return this._request("GET", "/v1/custom-references/list", {
      params: { page, page_size: pageSize },
    });
  }

  async getCharacter(characterId) {
    return this._request("GET", `/v1/custom-references/${characterId}`);
  }

  async deleteCharacter(characterId) {
    return this._request("DELETE", `/v1/custom-references/${characterId}`);
  }

  // ── New unified API ───────────────────────────────────────────────────────

  async getRequestStatus(requestId) {
    return this._request("GET", `/requests/${requestId}/status`);
  }

  async cancelRequest(requestId) {
    return this._request("POST", `/requests/${requestId}/cancel`);
  }

  async generateImageReve({ prompt, aspectRatio = "16:9", resolution = "1080p", webhookUrl } = {}) {
    return this._generate("reve/text-to-image", { prompt, aspect_ratio: aspectRatio, resolution }, webhookUrl);
  }

  async generateImageSeedream({ prompt, aspectRatio = "16:9", resolution = "1080p", cameraFixed, webhookUrl } = {}) {
    const body = { prompt, aspect_ratio: aspectRatio, resolution };
    if (cameraFixed !== undefined) body.camera_fixed = cameraFixed;
    return this._generate("bytedance/seedream/v4/text-to-image", body, webhookUrl);
  }

  async editImageSeedream({ prompt, aspectRatio = "16:9", resolution = "1080p", webhookUrl } = {}) {
    return this._generate(
      "bytedance/seedream/v4/edit",
      { prompt, aspect_ratio: aspectRatio, resolution },
      webhookUrl
    );
  }

  async generateVideoKling({ imageUrl, prompt, webhookUrl } = {}) {
    return this._generate(
      "kling-video/v2.1/pro/image-to-video",
      { image_url: imageUrl, prompt },
      webhookUrl
    );
  }

  async generateVideoSeedance({ imageUrl, prompt, webhookUrl } = {}) {
    return this._generate(
      "bytedance/seedance/v1/pro/image-to-video",
      { image_url: imageUrl, prompt },
      webhookUrl
    );
  }

  async generateVideoDopStandard({ imageUrl, prompt, duration, webhookUrl } = {}) {
    const body = { image_url: imageUrl, prompt };
    if (duration) body.duration = duration;
    return this._generate("higgsfield-ai/dop/standard", body, webhookUrl);
  }
}
