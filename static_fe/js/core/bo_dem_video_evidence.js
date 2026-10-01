/* ================================================================
 * bo_dem_video_evidence.js — Ring Buffer lưu video bằng chứng 10-15s
 * và Hàng đợi gửi dữ liệu tuần tự (Sequential Async Queue) chống nghẽn
 * ================================================================ */

/**
 * Hàng đợi gửi bất đồng bộ tuần tự (FIFO)
 * Đảm bảo các request upload ảnh/video/YOLO gửi lần lượt, không bắn ồ ạt làm drop socket/connection.
 */
export class HangDoiGuiTuanTu {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  them(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this._xuLyTiepTheo();
    });
  }

  async _xuLyTiepTheo() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const { taskFn, resolve, reject } = this.queue.shift();
    try {
      const result = await taskFn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.isProcessing = false;
      this._xuLyTiepTheo();
    }
  }

  doDai() {
    return this.queue.length;
  }
}

/**
 * Bộ đệm xoay vòng (Ring Buffer) lưu trữ video 10-15s bằng chứng
 */
export class BoDemVideoEvidence {
  /**
   * @param {MediaStream} stream - MediaStream kết hợp cả Video + Audio
   * @param {Object} opts
   * @param {number} opts.chunkIntervalMs - Thời gian mỗi chunk (mặc định 2500ms)
   * @param {number} opts.maxChunks - Số chunk tối đa lưu trữ (5 chunk * 2.5s = ~12.5s)
   */
  constructor(stream, opts = {}) {
    this.stream = stream;
    this.chunkIntervalMs = opts.chunkIntervalMs || 2500;
    this.maxChunks = opts.maxChunks || 5;

    this.recorder = null;
    this.chunksRingBuffer = [];
    this.isRunning = false;
  }

  batDau() {
    if (this.isRunning) return;

    try {
      let mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }

      this.recorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: 600000, // 600 kbps để video nhẹ, nén base64 nhanh
      });

      this.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunksRingBuffer.push(event.data);
          if (this.chunksRingBuffer.length > this.maxChunks) {
            this.chunksRingBuffer.shift(); // Xoá chunk cũ nhất
          }
        }
      };

      this.recorder.start(this.chunkIntervalMs);
      this.isRunning = true;
    } catch (e) {
      console.warn("[BoDemVideoEvidence] Trình duyệt không hỗ trợ MediaRecorder:", e);
    }
  }

  /**
   * Trích xuất đoạn video bằng chứng (pre-roll + hiện tại) dưới dạng Base64
   * @returns {Promise<string|null>} Chuỗi Base64 (không bao gồm tiền tố data:video/webm;base64,)
   */
  async layVideoEvidenceBase64() {
    if (!this.recorder || this.chunksRingBuffer.length === 0) {
      return null;
    }

    try {
      // Ép recorder flush data hiện tại
      if (this.recorder.state === "recording") {
        this.recorder.requestData();
      }
    } catch (e) { /* ignore */ }

    // Gộp tất cả các chunks trong buffer vòng lại thành 1 blob
    const fullBlob = new Blob(this.chunksRingBuffer, { type: "video/webm" });

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === "string") {
          const b64 = result.split(",")[1];
          resolve(b64);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(fullBlob);
    });
  }

  dung() {
    this.isRunning = false;
    try {
      if (this.recorder && this.recorder.state !== "inactive") {
        this.recorder.stop();
      }
    } catch (e) { /* ignore */ }
    this.chunksRingBuffer = [];
  }
}
