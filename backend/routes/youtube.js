// Remove Redis and BullMQ related imports
const express = require("express");
const axios = require("axios");
const YouTubeVideo = require("../models/YoutubeVideo");
const ensureAuthenticated = require("../middleware/ensureAuthenticated");
const path = require("path");
const fs = require("fs");
const youtubedl = require("youtube-dl-exec");
const ffmpeg = require("fluent-ffmpeg");

// Add new JobQueue model
const mongoose = require('mongoose');

// Define the JobQueue Schema
const jobQueueSchema = new mongoose.Schema({
  videoId: String,
  userId: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  result: mongoose.Schema.Types.Mixed,
  error: String,
  createdAt: { type: Date, default: Date.now }
});

const JobQueue = mongoose.model('JobQueue', jobQueueSchema);

// Remove Redis connection setup and queue creation
const router = express.Router();
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Create a function to process jobs
async function processJob(job) {
  try {
    const { videoId, userId } = job;
    let compressedAudioPath;

    console.log(`[WORKER] Processing job for video ID: ${videoId}, User ID: ${userId}`);
    const { title, thumbnail } = await fetchVideoDetails(videoId);
    compressedAudioPath = await downloadAndCompressAudio(videoId);

    const chapters = await transcribeAndSummarize(compressedAudioPath);
    console.log("[WORKER] Chapters received:", chapters);

    const flashcards = chapters.map((chapter) => ({
      content: chapter.content,
      startTime: chapter.startTime,
      endTime: chapter.endTime,
    }));

    const video = new YouTubeVideo({ videoId, userId, title, thumbnail, flashcards });
    await video.save();

    // Update job status
    await JobQueue.findByIdAndUpdate(job._id, {
      status: 'completed',
      result: { videoId, flashcards }
    });

    // Cleanup
    if (compressedAudioPath && fs.existsSync(compressedAudioPath)) {
      fs.unlinkSync(compressedAudioPath);
    }
  } catch (error) {
    console.error(`[WORKER] Job failed: ${error.message}`);
    await JobQueue.findByIdAndUpdate(job._id, {
      status: 'failed',
      error: error.message
    });
  }
}

// Update the generate route
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

    // Create a new job in MongoDB
    const job = await JobQueue.create({
      videoId,
      userId: req.user._id,
      status: 'pending'
    });

    // Process the job asynchronously
    processJob(job).catch(console.error);

    console.log(`[QUEUE] Job created with ID: ${job._id}`);
    res.json({
      message: "Flashcards generation process has started.",
      jobId: job._id
    });
  } catch (error) {
    console.error(`[REQUEST] Error processing generate request: ${error.message}`);
    res.status(500).json({ error: "Failed to process the video." });
  }
});

// Add a new route to check job status
router.get("/job-status/:jobId", ensureAuthenticated, async (req, res) => {
  try {
    const job = await JobQueue.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({
      status: job.status,
      result: job.result,
      error: job.error
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job status" });
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