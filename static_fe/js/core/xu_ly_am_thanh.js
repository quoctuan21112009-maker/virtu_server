/* ================================================================
 * xu_ly_am_thanh.js — Pipeline xử lý âm thanh phát hiện tiếng nói
 * Theo đúng cơ sở Toán & Vật lý (10 tầng xử lý cho Virtu)
 * ================================================================ */

export class BoXuLyAmThanhVAD {
  /**
   * @param {Object} opts
   * @param {number} opts.sampleRate - Mẫu tần số (mặc định 16000 hoặc theo AudioContext)
   * @param {number} opts.fftSize - Kích thước FFT (mặc định 1024 hoặc 2048)
   * @param {number} opts.calibrationDurationMs - Thời gian hiệu chỉnh nền (mặc định 3000ms)
   * @param {number} opts.minSpeechDurationMs - Duration Gate tối thiểu (mặc định 300ms)
   * @param {number} opts.snrOnThresholdDb - Ngưỡng bật (T_on) dB (mặc định 6.0 dB)
   * @param {number} opts.snrOffThresholdDb - Ngưỡng tắt (T_off) dB (mặc định 3.0 dB)
   * @param {function} opts.onSpeechEvent - Callback khi phát hiện sự kiện nói: (eventInfo) => void
   */
  constructor(opts = {}) {
    this.fftSize = opts.fftSize || 1024;
    this.calibrationDurationMs = opts.calibrationDurationMs || 3000;
    this.minSpeechDurationMs = opts.minSpeechDurationMs || 300;
    this.snrOnThresholdDb = opts.snrOnThresholdDb || 6.0;
    this.snrOffThresholdDb = opts.snrOffThresholdDb || 3.0;
    this.onSpeechEvent = opts.onSpeechEvent || null;

    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.filterBandpass = null;
    this.filterHighshelf = null;

    // Buffer FFT
    this.timeData = null;
    this.freqData = null;

    // Tầng 3: Noise Calibration
    this.isCalibrating = true;
    this.calibrationStartTime = 0;
    this.calibNoiseRmsSum = 0;
    this.calibNoiseFrames = 0;
    this.noiseRmsBaseline = 0.005; // Giá trị khởi tạo an toàn
    this.noiseFreqProfile = null;  // N(f)

    // Tầng 9: Hysteresis & Duration Gate
    this.vadState = 0; // 0 = non-speech, 1 = speech
    this.speechStartTime = null;
    this.isSpeechTriggered = false;

    this.isRunning = false;
    this.rafId = null;
  }

  /**
   * Bắt đầu nhận stream audio từ micro
   * @param {MediaStream} stream 
   */
  async batDau(stream) {
    if (this.isRunning) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);

    // Tầng 2.3: Lọc thông dải Bandpass 80Hz - 4000Hz
    this.filterBandpass = this.audioCtx.createBiquadFilter();
    this.filterBandpass.type = "bandpass";
    this.filterBandpass.frequency.value = 2000; // Tâm dải
    this.filterBandpass.Q.value = 0.5;          // Bao phủ dải rộng 80-4000Hz

    // Tầng 2.3 Pre-emphasis: Khuếch đại formant cao (1kHz - 3.5kHz)
    this.filterHighshelf = this.audioCtx.createBiquadFilter();
    this.filterHighshelf.type = "highshelf";
    this.filterHighshelf.frequency.value = 1200;
    this.filterHighshelf.gain.value = 4.0; // +4 dB cho formant cao

    // Tầng 4: Analyser FFT/STFT
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.3; // Mượt phổ thời gian

    // Nối pipeline Web Audio API
    this.sourceNode.connect(this.filterBandpass);
    this.filterBandpass.connect(this.filterHighshelf);
    this.filterHighshelf.connect(this.analyser);
    // Lưu ý: Không connect ra destination để tránh vọng loa!

    const bufferLength = this.analyser.frequencyBinCount;
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.freqData = new Float32Array(bufferLength);
    this.noiseFreqProfile = new Float32Array(bufferLength);

    this.isCalibrating = true;
    this.calibrationStartTime = performance.now();
    this.calibNoiseRmsSum = 0;
    this.calibNoiseFrames = 0;
    this.vadState = 0;
    this.speechStartTime = null;
    this.isSpeechTriggered = false;

    this.isRunning = true;
    this._loop();
  }

  /**
   * Tự động hiệu chỉnh lại Noise Baseline (khi giáo viên yêu cầu reset hoặc môi trường đổi)
   */
  hieuChinhLai() {
    this.isCalibrating = true;
    this.calibrationStartTime = performance.now();
    this.calibNoiseRmsSum = 0;
    this.calibNoiseFrames = 0;
    if (this.noiseFreqProfile) this.noiseFreqProfile.fill(0);
    this.vadState = 0;
    this.speechStartTime = null;
    this.isSpeechTriggered = false;
  }

  dung() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    try {
      this.sourceNode?.disconnect();
      this.filterBandpass?.disconnect();
      this.filterHighshelf?.disconnect();
      this.analyser?.disconnect();
      this.audioCtx?.close();
    } catch (e) { /* ignore */ }
  }

  _loop() {
    if (!this.isRunning) return;

    this.analyser.getFloatTimeDomainData(this.timeData);
    this.analyser.getFloatFrequencyData(this.freqData);

    const now = performance.now();

    // Tầng 5: Tính RMS khung hiện tại (Căn quân phương)
    let sumSq = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = this.timeData[i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / this.timeData.length);

    // Tầng 3: Xử lý pha hiệu chỉnh nhiễu nền (Noise Calibration 3s đầu)
    if (this.isCalibrating) {
      this.calibNoiseRmsSum += rms;
      this.calibNoiseFrames++;

      for (let k = 0; k < this.freqData.length; k++) {
        // Chuyển dBFS sang công suất tuyến tính
        const p = Math.pow(10, this.freqData[k] / 10);
        this.noiseFreqProfile[k] += p;
      }

      if (now - this.calibrationStartTime >= this.calibrationDurationMs) {
        this.noiseRmsBaseline = Math.max(this.calibNoiseRmsSum / Math.max(1, this.calibNoiseFrames), 0.001);
        for (let k = 0; k < this.noiseFreqProfile.length; k++) {
          this.noiseFreqProfile[k] /= Math.max(1, this.calibNoiseFrames);
        }
        this.isCalibrating = false;
        console.log(`[Audio VAD] Đã hiệu chỉnh xong tiếng ồn nền. Baseline RMS: ${this.noiseRmsBaseline.toFixed(5)}`);
      }

      this.rafId = requestAnimationFrame(() => this._loop());
      return;
    }

    // Tầng 6.3: Tính SNR (dB) = 20 * log10(RMS / RMS_noise)
    const snrDb = 20 * Math.log10(Math.max(rms, 1e-6) / this.noiseRmsBaseline);

    // Tầng 6.1: Năng lượng dải tiếng nói E_speech (300Hz - 3400Hz)
    const sampleRate = this.audioCtx.sampleRate;
    const nyquist = sampleRate / 2;
    const binCount = this.freqData.length;
    const hzPerBin = nyquist / binCount;

    let speechBandPower = 0;
    let totalPower = 0;
    let weightedFreqSum = 0;

    for (let k = 0; k < binCount; k++) {
      const freq = k * hzPerBin;
      const power = Math.pow(10, this.freqData[k] / 10);
      totalPower += power;
      weightedFreqSum += freq * power;

      if (freq >= 300 && freq <= 3400) {
        // Tầng 7: Trọng số Spectral Subtraction đơn giản hóa
        const noiseP = this.noiseFreqProfile[k] || 0;
        const cleanP = Math.max(power - 1.5 * noiseP, 0.01 * power);
        speechBandPower += cleanP;
      }
    }

    // Tầng 6.2: Spectral Centroid C(m)
    const spectralCentroid = totalPower > 1e-9 ? (weightedFreqSum / totalPower) : 0;

    // Tầng 8: Phân loại VAD thô
    // Tiếng nói: SNR vượt ngưỡng VÀ năng lượng dải nói chiếm tỷ trọng VÀ centroid thuộc 500Hz - 3000Hz
    const isVoiceCentroid = spectralCentroid >= 450 && spectralCentroid <= 3500;
    const isSpeechBandDominant = speechBandPower > 0.0001;

    // Tầng 9.1: Hysteresis (Ngưỡng kép)
    if (this.vadState === 0) {
      if (snrDb > this.snrOnThresholdDb && isVoiceCentroid && isSpeechBandDominant) {
        this.vadState = 1;
        this.speechStartTime = now;
      }
    } else {
      if (snrDb < this.snrOffThresholdDb) {
        this.vadState = 0;
        this.speechStartTime = null;
        this.isSpeechTriggered = false;
      }
    }

    // Tầng 9.2: Duration Gate (Loại bỏ tiếng ho, gõ bàn ngắn < 300ms)
    if (this.vadState === 1 && this.speechStartTime) {
      const durationMs = now - this.speechStartTime;
      if (durationMs >= this.minSpeechDurationMs && !this.isSpeechTriggered) {
        this.isSpeechTriggered = true; // Chỉ bắn trigger 1 lần cho sự kiện liên tục
        if (typeof this.onSpeechEvent === "function") {
          this.onSpeechEvent({
            snrDb: Number(snrDb.toFixed(1)),
            rms: Number(rms.toFixed(4)),
            spectralCentroid: Math.round(spectralCentroid),
            durationMs: Math.round(durationMs),
            timestamp: Date.now(),
          });
        }
      }
    }

    this.rafId = requestAnimationFrame(() => this._loop());
  }
}
