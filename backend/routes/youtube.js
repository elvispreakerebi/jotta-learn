const express = require("express");
const axios = require("axios");
const YouTubeVideo = require("../models/YoutubeVideo");
const VideoProcessingJob = require("../models/VideoProcessingJob");
const ensureAuthenticated = require("../middleware/ensureAuthenticated");
const path = require("path");
const fs = require("fs");
const youtubedl = require("youtube-dl-exec");
const ffmpeg = require("fluent-ffmpeg");

const router = express.Router();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const CHUNK_DURATION = 15 * 60; // 15 minutes per chunk

// Helper function to split audio into chunks
const splitAudioIntoChunks = async (audioPath, duration) => {
  const chunks = [];
  const numChunks = Math.ceil(duration / CHUNK_DURATION);

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * CHUNK_DURATION;
    const endTime = Math.min((i + 1) * CHUNK_DURATION, duration);
    const chunkPath = `${audioPath}_chunk_${i}.mp3`;

    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .output(chunkPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    chunks.push({
      path: chunkPath,
      startTime,
      endTime
    });
  }

  return chunks;
};

// Helper function to fetch YouTube video details
const fetchVideoDetails = async (videoId) => {
  const apiUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  console.log(`[FETCH] Fetching video details for video ID: ${videoId}`);
  try {
    const response = await axios.get(apiUrl);
    const { title, thumbnail_url: thumbnail } = response.data;
    console.log(`[FETCH] Fetched details: Title="${title}", Thumbnail="${thumbnail}"`);
    return { title, thumbnail };
  } catch (error) {
    console.error(`[FETCH] Failed to fetch video details: ${error.message}`);
    throw new Error("Failed to fetch video details.");
  }
};

// Helper function to compress audio using ffmpeg
const compressAudio = async (inputPath, outputPath) => {
  console.log("[COMPRESS] Compressing audio...");
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate(64)
      .save(outputPath)
      .on("end", () => {
        console.log(`[COMPRESS] Compression completed: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("[COMPRESS] Compression error:", err.message);
        reject(err);
      });
  });
};

// Helper function to download and compress audio
const downloadAndCompressAudio = async (videoId) => {
  const originalAudioPath = path.resolve(__dirname, `../temp/${videoId}.mp3`);
  const compressedAudioPath = path.resolve(__dirname, `../temp/${videoId}_compressed.mp3`);

  console.log(`[DOWNLOAD] Downloading audio for video ID: ${videoId}`);
  await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
    extractAudio: true,
    audioFormat: "mp3",
    output: originalAudioPath,
    audioQuality: "128K",
  });

  if (!fs.existsSync(originalAudioPath)) {
    console.error(`[DOWNLOAD] Audio file not found: ${originalAudioPath}`);
    throw new Error("Audio file not found.");
  }

  console.log(`[DOWNLOAD] Download completed: ${originalAudioPath}`);

  await compressAudio(originalAudioPath, compressedAudioPath);

  // Clean up the original file
  fs.unlinkSync(originalAudioPath);
  console.log(`[CLEANUP] Original audio file removed: ${originalAudioPath}`);

  return compressedAudioPath;
};

// Helper function to transcribe and summarize audio
const transcribeAndSummarize = async (audioPath) => {
  console.log(`[TRANSCRIBE] Uploading audio for transcription: ${audioPath}`);
  const uploadUrl = "https://api.assemblyai.com/v2/upload";
  const audioStream = fs.createReadStream(audioPath);

  const uploadResponse = await axios.post(uploadUrl, audioStream, {
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
      "content-type": "application/json",
    },
  });

  const { upload_url: audioUrl } = uploadResponse.data;
  console.log(`[TRANSCRIBE] Audio uploaded: ${audioUrl}`);

  console.log("[TRANSCRIBE] Starting transcription...");
  const transcriptResponse = await axios.post(
    "https://api.assemblyai.com/v2/transcript",
    {
      audio_url: audioUrl,
      auto_chapters: true, // Enable auto chapters
    },
    {
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
      },
    }
  );

  const { id: transcriptId } = transcriptResponse.data;

  while (true) {
    const statusResponse = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: { authorization: ASSEMBLYAI_API_KEY },
      }
    );

    if (statusResponse.data.status === "completed") {
      console.log("[TRANSCRIBE] Transcription completed.");

      const { chapters } = statusResponse.data;

      if (!chapters || chapters.length === 0) {
        throw new Error("[TRANSCRIBE] No chapters found in the transcription.");
      }

      console.log(`[TRANSCRIBE] Extracting summaries from ${chapters.length} chapters.`);

      // Map chapters to flashcards structure
      const flashcards = chapters.map((chapter, index) => {
        console.log(`Chapter ${index + 1}:`, chapter); // Log each chapter for debugging

        return {
          content: chapter.summary || "No content available",
          startTime: chapter.start || 0,
          endTime: chapter.end || 0,
        };
      });

      console.log("[TRANSCRIBE] Flashcards:", flashcards);
      return flashcards;
    }

    if (statusResponse.data.status === "failed") {
      throw new Error("[TRANSCRIBE] Transcription failed.");
    }

    console.log("[TRANSCRIBE] In progress...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before polling again
  }
};


// Process video chunks and update job status
const processVideoChunks = async (job, compressedAudioPath) => {
  const { videoId, userId } = job;
  const { title, thumbnail } = await fetchVideoDetails(videoId);

  // Get audio duration
  const duration = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(compressedAudioPath, (err, metadata) => {
      if (err) reject(err);
      resolve(metadata.format.duration);
    });
  });

  // Split audio into chunks
  const chunks = await splitAudioIntoChunks(compressedAudioPath, duration);
  
  // Update job with chunks information
  job.chunks = chunks.map(chunk => ({
    startTime: chunk.startTime,
    endTime: chunk.endTime,
    status: 'pending'
  }));
  job.status = 'processing';
  job.processingStartedAt = new Date();
  await job.save();

  // Process chunks in parallel with rate limiting
  const chunkResults = await Promise.all(
    chunks.map(async (chunk, index) => {
      try {
        const transcription = await transcribeAndSummarize(chunk.path);
        job.chunks[index].status = 'completed';
        job.chunks[index].transcription = transcription.map(t => t.content).join('\n');
        job.progress = ((index + 1) / chunks.length) * 100;
        await job.save();
        return transcription; // Return all flashcards, not just the first one
      } catch (error) {
        job.chunks[index].status = 'failed';
        await job.save();
        throw error;
      } finally {
        // Cleanup chunk file
        if (fs.existsSync(chunk.path)) {
          fs.unlinkSync(chunk.path);
        }
      }
    })
  );

  // Create final video document with all flashcards
  const video = new YouTubeVideo({
    videoId,
    userId,
    title,
    thumbnail,
    flashcards: chunkResults.flat().map(result => ({
      content: result.content,
      startTime: result.startTime,
      endTime: result.endTime
    }))
  });
  await video.save();

  // Delete the job after successful video creation
  await VideoProcessingJob.findByIdAndDelete(job._id);

  return video;
  // Update job status
  job.status = 'completed';
  job.processingCompletedAt = new Date();
  await job.save();

  return video;
};



// Route to generate flashcards
router.post("/generate", ensureAuthenticated, async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    console.log("[REQUEST] Missing video ID in request.");
    return res.status(400).json({ error: "Video ID is required" });
  }

  try {
    console.log(`[REQUEST] Received request to generate flashcards for video ID: ${videoId}`);
    
    // Check for existing video
    const existingVideo = await YouTubeVideo.findOne({
      videoId,
      userId: req.user._id,
    });

    if (existingVideo) {
      console.log("[REQUEST] Flashcards already exist for this video.");
      return res.status(400).json({
        error: "Flashcards for this video already exist for this user.",
      });
    }

    // Check for existing processing job
    const existingJob = await VideoProcessingJob.findOne({
      videoId,
      userId: req.user._id,
      status: { $in: ['queued', 'processing'] }
    });

    if (existingJob) {
      console.log(`[REQUEST] Video ${videoId} is already being processed.`);
      return res.status(409).json({
        error: "This video is already being processed.",
        jobId: existingJob._id
      });
    }

    // Create a new processing job
    const job = new VideoProcessingJob({
      videoId,
      userId: req.user._id,
      status: 'queued'
    });
    await job.save();

    // Start processing in background
    let compressedAudioPath;
    try {
      compressedAudioPath = await downloadAndCompressAudio(videoId);
      await processVideoChunks(job, compressedAudioPath);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      await job.save();
      throw error;
    } finally {
      if (compressedAudioPath && fs.existsSync(compressedAudioPath)) {
        fs.unlinkSync(compressedAudioPath);
      }
    }

    console.log(`[QUEUE] Job created with ID: ${job._id}`);
    res.json({
      message: "Flashcards generation process has started.",
      jobId: job._id,
    });
  } catch (error) {
    console.error(`[REQUEST] Error processing generate request: ${error.message}`);
    res.status(500).json({ error: "Failed to process the video." });
  }
});

// Route to get saved videos
router.get("/saved-videos", ensureAuthenticated, async (req, res) => {
  try {
    const videos = await YouTubeVideo.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch saved videos." });
  }
});

// Route to get video details
router.get("/:videoId", ensureAuthenticated, async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await YouTubeVideo.findOne({ videoId, userId: req.user._id });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch video details." });
  }
});

// Route to delete a video
router.delete("/:videoId", ensureAuthenticated, async (req, res) => {
  const { videoId } = req.params;

  try {
    // Delete the video processing job first
    await VideoProcessingJob.findOneAndDelete({
      videoId,
      userId: req.user._id,
    });

    // Then delete the video
    const video = await YouTubeVideo.findOneAndDelete({
      videoId,
      userId: req.user._id,
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete video." });
  }
});

// Route for full search
router.get("/search", ensureAuthenticated, async (req, res) => {
  const { query } = req.query; // Extract query parameter

  if (!query || query.trim() === "") {
    return res.status(400).json({ error: "Search query cannot be empty." });
  }

  try {
    const videos = await YouTubeVideo.find({
      title: { $regex: query, $options: "i" }, // Case-insensitive regex search
      userId: req.user._id, // Ensure results are specific to the logged-in user
    });

    if (videos.length === 0) {
      return res.status(404).json({ message: "No videos found." });
    }

    res.json(videos);
  } catch (error) {
    console.error("Error searching videos:", error);
    res.status(500).json({ error: "Failed to search for videos." });
  }
});

// Route for auto-suggestions while typing
router.get("/search-suggestions", ensureAuthenticated, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const videos = await YouTubeVideo.find({
      title: { $regex: query, $options: "i" },
      userId: req.user._id,
    }).limit(10); // Limit suggestions to 10 items
    res.json(videos);
  } catch (error) {
    console.error("Error fetching search suggestions:", error);
    res.status(500).json({ error: "Failed to fetch search suggestions." });
  }
});


module.exports = router;