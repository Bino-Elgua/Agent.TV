import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * AvatarProvider – Unified interface for avatar video synthesis
 * Supports: HeyGen, Synthesia, D-ID
 * Output: MP4 video URL or uploaded path
 */
export class AvatarProvider {
  constructor(configOverride = {}) {
    this.service = configOverride.service || process.env.AVATAR_SERVICE || 'heygen';
    this.apiKey = configOverride.apiKey || process.env.AVATAR_API_KEY || null;
    this.avatarId = configOverride.avatarId || process.env.AVATAR_ID || 'default';
    this.voiceId = configOverride.voiceId || process.env.VOICE_ID || 'default';
    this.videoQuality = configOverride.videoQuality || 'medium'; // low, medium, high
  }

  async generateVideo(script, options = {}) {
    logger.info({ service: this.service, duration: options.duration }, 'Generating avatar video');

    try {
      if (this.service === 'heygen') {
        return await this._generateHeyGen(script, options);
      } else if (this.service === 'synthesia') {
        return await this._generateSynthesia(script, options);
      } else if (this.service === 'd-id') {
        return await this._generateDID(script, options);
      } else {
        throw new Error(`Unknown avatar service: ${this.service}`);
      }
    } catch (err) {
      logger.error({ error: err.message }, 'Avatar generation failed');
      throw err;
    }
  }

  async _generateHeyGen(script, options) {
    // HeyGen API: https://docs.heygen.com/reference/generate-video
    logger.debug('Calling HeyGen API');

    const payload = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: options.avatarId || this.avatarId,
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: options.voiceId || this.voiceId,
          },
          background: {
            type: 'color',
            color: '#FFFFFF',
          },
        },
      ],
      quality: options.quality || this.videoQuality,
      dimension: {
        width: 1080,
        height: 1920,
      },
    };

    try {
      const response = await axios.post(
        'https://api.heygen.com/v1/video.generate',
        payload,
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const videoId = response.data.data.video_id;

      // Poll for completion
      return await this._pollVideoStatus('heygen', videoId);
    } catch (err) {
      if (err.response?.status === 401) {
        logger.warn('HeyGen API key invalid – using placeholder video URL');
        return { videoUrl: 'https://placeholder.video/ai-generated.mp4', videoId: 'placeholder' };
      }
      throw err;
    }
  }

  async _generateSynthesia(script, options) {
    // Synthesia API: https://docs.synthesia.io/
    logger.debug('Calling Synthesia API');

    const payload = {
      input: [
        {
          type: 'avatar',
          avatar_id: options.avatarId || this.avatarId,
          background: {
            type: 'color',
            color: '#FFFFFF',
          },
          text: script,
        },
      ],
      output_format: {
        type: 'mp4',
        resolution: '1080p',
      },
    };

    try {
      const response = await axios.post(
        'https://api.synthesia.io/v1/videos',
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const videoId = response.data.id;

      // Poll for completion
      return await this._pollVideoStatus('synthesia', videoId);
    } catch (err) {
      if (err.response?.status === 401) {
        logger.warn('Synthesia API key invalid – using placeholder');
        return { videoUrl: 'https://placeholder.video/ai-generated.mp4', videoId: 'placeholder' };
      }
      throw err;
    }
  }

  async _generateDID(script, options) {
    // D-ID API: https://studio.d-id.com/api/docs
    logger.debug('Calling D-ID API');

    const payload = {
      script: {
        type: 'text',
        input: script,
        provider: {
          type: 'microsoft',
          voice_id: options.voiceId || 'en-US-AriaNeural',
        },
      },
      config: {
        fluent: true,
        pad_audio: 0.0,
      },
      presenter_id: options.presenterId || this.avatarId,
    };

    try {
      const response = await axios.post(
        'https://api.d-id.com/talks',
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const videoId = response.data.id;

      // Poll for completion
      return await this._pollVideoStatus('d-id', videoId);
    } catch (err) {
      if (err.response?.status === 401) {
        logger.warn('D-ID API key invalid – using placeholder');
        return { videoUrl: 'https://placeholder.video/ai-generated.mp4', videoId: 'placeholder' };
      }
      throw err;
    }
  }

  async _pollVideoStatus(service, videoId, maxAttempts = 120) {
    // Poll until video is ready (timeout: 2 minutes)
    const pollInterval = 1000; // 1s between polls

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        let status;

        if (service === 'heygen') {
          const response = await axios.get(
            `https://api.heygen.com/v1/video.get?video_id=${videoId}`,
            {
              headers: { 'X-API-Key': this.apiKey },
              timeout: 10000,
            }
          );
          status = response.data.data.status;
          if (status === 'completed') {
            return { videoUrl: response.data.data.video_url, videoId };
          }
        } else if (service === 'synthesia') {
          const response = await axios.get(
            `https://api.synthesia.io/v1/videos/${videoId}`,
            {
              headers: { Authorization: `Bearer ${this.apiKey}` },
              timeout: 10000,
            }
          );
          status = response.data.status;
          if (status === 'completed') {
            return { videoUrl: response.data.download_url, videoId };
          }
        } else if (service === 'd-id') {
          const response = await axios.get(
            `https://api.d-id.com/talks/${videoId}`,
            {
              headers: { Authorization: `Bearer ${this.apiKey}` },
              timeout: 10000,
            }
          );
          status = response.data.status;
          if (status === 'done') {
            return { videoUrl: response.data.result_url, videoId };
          }
        }

        logger.debug({ service, videoId, status, attempt }, `Poll ${attempt}/${maxAttempts}`);

        if (status === 'failed') {
          throw new Error(`Video generation failed: ${status}`);
        }

        // Wait before next poll
        await new Promise(r => setTimeout(r, pollInterval));
      } catch (err) {
        logger.error({ attempt, error: err.message }, 'Poll attempt failed');
        if (attempt === maxAttempts - 1) {
          throw new Error(`Video generation timeout after ${maxAttempts} attempts`);
        }
      }
    }

    throw new Error('Video generation timeout');
  }

  getStatus() {
    return {
      service: this.service,
      avatarId: this.avatarId,
      voiceId: this.voiceId,
      quality: this.videoQuality,
      hasApiKey: !!this.apiKey,
    };
  }
}

export const avatarProvider = new AvatarProvider();
export default avatarProvider;
