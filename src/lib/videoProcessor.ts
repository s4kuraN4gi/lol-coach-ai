/**
 * Video Processor Utility
 * Client-side extraction of frames from video files for AI analysis.
 */

export type FrameData = {
    timestamp: number;
    dataUrl: string;
    width: number;
    height: number;
};

export class VideoProcessor {
    private video: HTMLVideoElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null;

    constructor() {
        if (typeof window === 'undefined') {
            throw new Error("VideoProcessor can only be used in the browser.");
        }
        this.video = document.createElement("video");
        this.video.crossOrigin = "anonymous";
        this.video.muted = true;
        this.video.playsInline = true;
        
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
    }

    /**
     * Extracts frames from a video file.
     * @param file The video file to process
     * @param intervalSeconds Interval between frames (default: 1.0s)
     * @param maxFrames Maximum number of frames to extract (default: 30)
     * @param maxDimension Downscale video to this max dimension (default: 640px)
     * @param onProgress Callback for progress updates (0-100)
     */
    async extractFrames(
        file: File, 
        intervalSeconds: number = 2.0, // Default to 2s to save tokens
        maxFrames: number = 30,
        maxDimension: number = 640,
        startTime: number = 0, // NEW: Start time offset
        onProgress?: (progress: number) => void
    ): Promise<FrameData[]> {
        return new Promise(async (resolve, reject) => {
            const frames: FrameData[] = [];
            const url = URL.createObjectURL(file);
            
            this.video.src = url;
            this.video.load();

            // Wait for metadata to load (duration, dimensions)
            await new Promise<void>((res) => {
                this.video.onloadedmetadata = () => res();
                this.video.onerror = () => reject(new Error("Failed to load video metadata."));
            });

            const duration = this.video.duration;
            if (isNaN(duration) || duration === 0) {
                URL.revokeObjectURL(url);
                return reject(new Error("Invalid video duration."));
            }

            // Set Canvas Dimensions (Downscaled)
            let width = this.video.videoWidth;
            let height = this.video.videoHeight;
            
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = height * (maxDimension / width);
                    width = maxDimension;
                } else {
                    width = width * (maxDimension / height);
                    height = maxDimension;
                }
            }
            
            this.canvas.width = Math.floor(width);
            this.canvas.height = Math.floor(height);

            let currentTime = startTime; // Start from specified time
            
            // Loop through time
            const processNextFrame = async () => {
                if (currentTime > duration || frames.length >= maxFrames) {
                    URL.revokeObjectURL(url);
                    resolve(frames);
                    return;
                }

                // Seek
                this.video.currentTime = currentTime;

                // Wait for seek
                await new Promise<void>((res) => {
                    this.video.onseeked = () => res();
                });

                // Draw
                if (this.ctx) {
                    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
                    
                    // Compress to High Quality JPEG (0.95) - Better than 0.7, smaller than PNG
                    const dataUrl = this.canvas.toDataURL("image/jpeg", 0.95);
                    
                    frames.push({
                        timestamp: currentTime,
                        dataUrl: dataUrl,
                        width: this.canvas.width,
                        height: this.canvas.height
                    });
                }
                
                // Update Progress
                if (onProgress) {
                    const percent = Math.min(100, Math.round((frames.length / Math.min(maxFrames, duration/intervalSeconds)) * 100));
                    onProgress(percent);
                }

                // Next
                currentTime += intervalSeconds;
                
                // Yield to main thread to prevent UI freeze
                setTimeout(processNextFrame, 10); 
            };

            // Start loop
            processNextFrame().catch(err => {
                URL.revokeObjectURL(url);
                reject(err);
            });
        });
    }
    /**
     * Extracts a few frames specifically for match verification (sanity check).
     * Extracts 5 frames from the first 3 minutes (or full duration if shorter).
     */
    async extractVerificationFrames(
        videoFile: File,
        count: number = 5
    ): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const video = document.createElement("video");
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const frames: string[] = [];
            const url = URL.createObjectURL(videoFile);

            video.crossOrigin = "anonymous";
            video.muted = true;
            video.playsInline = true;

            const cleanup = () => {
                URL.revokeObjectURL(url);
                video.src = "";
                video.load();
            };

            video.onloadedmetadata = async () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Verification check: Focus on first few minutes BUT skip loading screen
                const duration = video.duration;
                
                // Safety: Skip first 60s if video is long (>3m), or 20% if short
                const safeStart = duration > 180 ? 60 : duration * 0.2;
                
                // Check window: Analyze up to 3 mins of content AFTER safeStart
                // (or remaining duration)
                const checkWindow = Math.min(duration - safeStart, 180);
                
                // Extract 5 frames evenly distributed in the safe window
                const timePoints = [
                    safeStart + (checkWindow * 0.05),
                    safeStart + (checkWindow * 0.25),
                    safeStart + (checkWindow * 0.50),
                    safeStart + (checkWindow * 0.75),
                    safeStart + (checkWindow * 0.95),
                ];

                try {
                    for (const time of timePoints) {
                        await new Promise<void>((r) => {
                            video.currentTime = time;
                            video.onseeked = () => r();
                        });
                        if (ctx) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            // Low quality is enough for text/champ recognition
                            frames.push(canvas.toDataURL("image/jpeg", 0.6).split(",")[1]);
                        }
                    }
                    cleanup();
                    resolve(frames);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            video.onerror = () => {
                cleanup();
                reject(new Error("Video load failed"));
            };

            video.src = url;
            video.load(); // Explicit load
        });
    }
}
