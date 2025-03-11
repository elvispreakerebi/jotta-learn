const express = require("express");
const { Queue, Worker, QueueEvents } = require("bullmq");
const axios = require("axios");
const YouTubeVideo = require("../models/YoutubeVideo");
const ensureAuthenticated = require("../middleware/ensureAuthenticated");
const path = require("path");
const fs = require("fs");
const youtubedl = require("youtube-dl-exec");
const ffmpeg = require("fluent-ffmpeg");

const router = express.Router();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

//Redis connection options
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL);
const connection = { redis };

// Create the queue and events tracker
const flashcardsQueue = new Queue("flashcardsQueue", { connection });
const queueEvents = new QueueEvents("flashcardsQueue", { connection });

// Listen for job completion and failure
queueEvents.on("completed", (jobId, result) => {
  console.log(`[QUEUE] Job ${jobId} completed with result: ${result}`);
});
queueEvents.on("failed", (jobId, failedReason) => {
  console.error(`[QUEUE] Job ${jobId} failed with reason: ${failedReason}`);
});

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


// Updated to include start and end times in flashcards
new Worker(
  "flashcardsQueue",
  async (job) => {
    const { videoId, userId } = job.data;

    let compressedAudioPath; // Declare here for cleanup in finally block
    try {
      console.log(`[WORKER] Processing job for video ID: ${videoId}, User ID: ${userId}`);
      const { title, thumbnail } = await fetchVideoDetails(videoId);
      compressedAudioPath = await downloadAndCompressAudio(videoId);

      // Fetch and log chapters
      const chapters = await transcribeAndSummarize(compressedAudioPath);
      console.log("[WORKER] Chapters received:", chapters);

      // Directly use the returned chapters as flashcards
      const flashcards = chapters.map((chapter) => ({
        content: chapter.content,
        startTime: chapter.startTime,
        endTime: chapter.endTime,
      }));

      console.log("[WORKER] Final Flashcards:", flashcards);

      const video = new YouTubeVideo({ videoId, userId, title, thumbnail, flashcards });
      await video.save();

      console.log(`[WORKER] Job completed successfully for video ID: ${videoId}`);
    } catch (error) {
      console.error(`[WORKER] Job failed: ${error.message}`);
      throw error;
    } finally {
      // Cleanup the compressed audio file
      if (compressedAudioPath && fs.existsSync(compressedAudioPath)) {
        fs.unlinkSync(compressedAudioPath);
        console.log(`[CLEANUP] Compressed audio file removed: ${compressedAudioPath}`);
      }
    }
  },
  { connection }
);



// Route to generate flashcards
router.post("/generate", ensureAuthenticated, async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    console.log("[REQUEST] Missing video ID in request.");
    return res.status(400).json({ error: "Video ID is required" });
  }

  try {
    console.log(`[REQUEST] Received request to generate flashcards for video ID: ${videoId}`);
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

    const job = await flashcardsQueue.add("generateFlashcards", {
      videoId,
      userId: req.user._id,
    });

    console.log(`[QUEUE] Job added to queue with ID: ${job.id}`);
    res.json({
      message: "Flashcards generation process has started.",
      jobId: job.id,
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