/**
 * HealthSaathi AI - Speech-to-Text (STT) Client API
 *
 * Communicates with authenticated backend endpoint:
 * POST /api/v1/stt/transcribe
 */

import { apiClient } from './apiClient.js'

export const sttApi = {
  /**
   * Uploads an audio blob to be transcribed by Groq Whisper STT.
   *
   * @param {Blob} audioBlob - The recorded audio binary blob.
   * @param {Object} [options]
   * @param {string} [options.filename='recording.webm'] - Name of audio file with extension.
   * @param {string} [options.language] - Optional ISO-639-1 language code ('en', 'te', 'hi').
   * @returns {Promise<{ text: string }>}
   */
  async transcribeAudio(audioBlob, { filename = 'recording.webm', language } = {}) {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Recorded audio is empty.')
    }

    const formData = new FormData()
    formData.append('audio', audioBlob, filename)

    if (language && language !== 'auto') {
      formData.append('language', language)
    }

    const res = await apiClient.upload('stt/transcribe', formData)
    return res
  },
}
