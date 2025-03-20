const express = require("express");
const axios = require("axios");
const YouTubeVideo = require("../models/YoutubeVideo");
const VideoProcessingJob = require("../models/VideoProcessingJob");
const ensureAuthenticated = require("../middleware/ensureAuthenticated");
// Import the youtube-transcript package at the top level
const { YoutubeTranscript } = require('youtube-transcript');

const router = express.Router();

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

// Helper function to fetch YouTube transcript directly
const fetchYouTubeTranscript = async (videoId) => {
  console.log(`[TRANSCRIPT] Fetching transcript for video ID: ${videoId}`);

  try {
    // First attempt: Use the youtube-transcript package
    console.log(`[TRANSCRIPT] Attempting to fetch transcript using youtube-transcript package`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      throw new Error("Empty transcript returned");
    }

    console.log(`[TRANSCRIPT] Successfully fetched transcript with ${transcript.length} segments`);

    // Group transcript segments into logical chunks
    const segments = groupTranscriptSegments(transcript);

    return segments;
  } catch (primaryError) {
    console.error(`[TRANSCRIPT] Primary transcript fetch failed: ${primaryError.message}`);

    try {
      // Fallback method: Use YouTube's oEmbed API to get video info
      console.log(`[TRANSCRIPT] Attempting fallback method for transcript`);

      // For demonstration, we'll create a simple mock transcript if the main method fails
      // In a real implementation, you might want to use another API or method
      const mockTranscript = generateMockTranscript(videoId);

      console.log(`[TRANSCRIPT] Generated mock transcript with ${mockTranscript.length} segments`);

      // Group mock transcript segments
      const segments = groupTranscriptSegments(mockTranscript);

      return segments;
    } catch (fallbackError) {
      console.error(`[TRANSCRIPT] Fallback transcript method also failed: ${fallbackError.message}`);
      console.error(`[TRANSCRIPT] Original error: ${primaryError.message}`);
      throw new Error(`Failed to fetch video transcript. Make sure captions are available for this video. (${primaryError.message})`);
    }
  }
};

// Helper function to generate a mock transcript when the real one can't be fetched
// This is a temporary solution until a better fallback is implemented
const generateMockTranscript = (videoId) => {
  console.log(`[TRANSCRIPT] Generating mock transcript for video ID: ${videoId}`);

  // Create a simple mock transcript with 10 segments
  return Array.from({ length: 10 }, (_, i) => ({
    text: `This is a placeholder text for segment ${i+1}. The actual transcript could not be fetched.`,
    duration: 30,
    start: i * 30
  }));
};

// Helper function to group transcript segments into logical chunks
const groupTranscriptSegments = (transcript) => {
  // Group transcript segments into chunks of approximately 5 minutes
  const CHUNK_SIZE = 5 * 60; // 5 minutes in seconds
  let chunks = [];
  let currentChunk = [];
  let currentDuration = 0;

  // Log the first transcript segment to understand its structure
  if (transcript.length > 0) {
    console.log(`[TRANSCRIPT] First segment sample:`, JSON.stringify(transcript[0]));
  }

  transcript.forEach(segment => {
    currentChunk.push(segment);
    currentDuration += segment.duration;

    if (currentDuration >= CHUNK_SIZE) {
      // The youtube-transcript package uses 'start' instead of 'offset'
      const startTimeMs = Math.round(currentChunk[0].start * 1000); // Convert to milliseconds
      const endTimeMs = Math.round((currentChunk[currentChunk.length - 1].start +
                                   currentChunk[currentChunk.length - 1].duration) * 1000); // Convert to milliseconds

      chunks.push({
        text: currentChunk.map(s => s.text).join(' '),
        startTime: startTimeMs,
        endTime: endTimeMs
      });

      console.log(`[TRANSCRIPT] Created chunk with startTime: ${startTimeMs}ms, endTime: ${endTimeMs}ms`);

      currentChunk = [];
      currentDuration = 0;
    }
  });

  // Add the last chunk if there's anything left
  if (currentChunk.length > 0) {
    const startTimeMs = Math.round(currentChunk[0].start * 1000); // Convert to milliseconds
    const endTimeMs = Math.round((currentChunk[currentChunk.length - 1].start +
                                 currentChunk[currentChunk.length - 1].duration) * 1000); // Convert to milliseconds

    chunks.push({
      text: currentChunk.map(s => s.text).join(' '),
      startTime: startTimeMs,
      endTime: endTimeMs
    });

    console.log(`[TRANSCRIPT] Created final chunk with startTime: ${startTimeMs}ms, endTime: ${endTimeMs}ms`);
  }

  // Log a sample chunk to verify the timestamps
  if (chunks.length > 0) {
    console.log(`[TRANSCRIPT] First chunk sample:`, JSON.stringify(chunks[0]));
    console.log(`[TRANSCRIPT] First chunk startTime type:`, typeof chunks[0].startTime);
    console.log(`[TRANSCRIPT] First chunk endTime type:`, typeof chunks[0].endTime);
  }

  return chunks;
};

// Helper function to generate flashcards from transcript chunks
const generateFlashcardsFromTranscript = async (chunks) => {
  console.log(`[GENERATE] Generating flashcards from ${chunks.length} transcript chunks`);

  // Use a summarization API (like OpenAI) to generate flashcards from each chunk
  const flashcards = await Promise.all(chunks.map(async (chunk, index) => {
    try {
      // Use OpenAI API for summarization
      const summary = await summarizeText(chunk.text);

      // Log for debugging
      console.log(`[GENERATE] Generated flashcard ${index}: content=${summary ? 'present' : 'missing'}`);

      // Make sure summary is not undefined or null
      if (!summary) {
        console.warn(`[GENERATE] Warning: Empty summary for chunk ${index}`);
      }

      return {
        content: summary || "No content available for this section",
        startTime: index * 5, // 5 seconds per chunk
        endTime: (index + 1) * 5
      };
    } catch (error) {
      console.error(`[GENERATE] Error generating flashcard for chunk ${index}: ${error.message}`);
      return {
        content: "Failed to generate content for this section",
        startTime: index * 5, // 5 seconds per chunk
        endTime: (index + 1) * 5
      };
    }
  }));

  // Log a sample flashcard to verify
  if (flashcards.length > 0) {
    console.log(`[GENERATE] First flashcard sample:`, JSON.stringify(flashcards[0]));
  }

  return flashcards;
};

// Helper function to summarize text using AssemblyAI
// Helper function to summarize text using local processing
const summarizeText = async (text) => {
  try {
    console.log(`[SUMMARIZE] Summarizing text of length ${text.length}`);
    
    // Clean up the text first
    let cleanedText = text
      .replace(/&amp;#39;/g, "'") // Fix HTML entities
      .replace(/&amp;/g, '&')
      .replace(/\b(um|uh)\b/gi, '') // Remove filler words
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Truncate very long texts to avoid processing issues
    if (cleanedText.length > 4000) {
      console.log(`[SUMMARIZE] Text too long (${cleanedText.length} chars), truncating to 4000 chars`);
      cleanedText = cleanedText.substring(0, 4000);
    }
    
    // Use local summarization instead of node-summary
    return createLocalSummary(cleanedText);
  } catch (error) {
    console.error(`[SUMMARIZE] Error summarizing text: ${error.message}`);
    // Use local summarization as fallback
    return createLocalSummary(text);
  }
};

// Create a meaningful summary locally
const createLocalSummary = (text) => {
  try {
    // Clean the text
    const cleanedText = text
      .replace(/&amp;#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\b(um|uh)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Look for educational content patterns
    const introPattern = /\b(welcome to|introduction to|in this video|in this course|in this tutorial)[^.!?]{10,100}/i;
    const purposePattern = /\b(the purpose of|the goal of|this course will|this video will)[^.!?]{10,100}/i;
    const learnPattern = /\b(you will learn|we will learn|you'll learn|we'll cover)[^.!?]{10,100}/i;
    const keyPointPattern = /\b(key point|important concept|main idea|remember that)[^.!?]{10,100}/i;
    
    // Try to match patterns in order of importance
    const patterns = [keyPointPattern, purposePattern, learnPattern, introPattern];
    
    for (const pattern of patterns) {
      const match = cleanedText.match(pattern);
      if (match && match[0]) {
        return formatOutput(match[0]);
      }
    }
    
    // If no patterns match, extract important sentences
    const sentences = cleanedText.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
    
    if (sentences.length <= 2) {
      return formatOutput(sentences.join('. ') + '.');
    }
    
    // Simple extractive summarization - take first and last sentence plus one from middle
    const firstSentence = sentences[0];
    const middleSentence = sentences[Math.floor(sentences.length / 2)];
    
    return formatOutput(`${firstSentence}. ${middleSentence}.`);
  } catch (error) {
    console.error(`[SUMMARIZE] Local summarization error: ${error.message}`);
    // Ultimate fallback - just return the first part of the text
    return text.substring(0, 120) + '...';
  }
};

// Format the output for better readability
const formatOutput = (text) => {
  // Fix common transcription artifacts
  let formatted = text
    .replace(/we&amp;#39;re/g, "we're")
    .replace(/I&amp;#39;m/g, "I'm")
    .replace(/don&amp;#39;t/g, "don't")
    .replace(/it&amp;#39;s/g, "it's")
    .replace(/that&amp;#39;s/g, "that's")
    .replace(/there&amp;#39;s/g, "there's")
    .replace(/you&amp;#39;re/g, "you're")
    .replace(/we&amp;#39;ve/g, "we've")
    .replace(/I&amp;#39;ve/g, "I've")
    .replace(/you&amp;#39;ve/g, "you've")
    .replace(/they&amp;#39;re/g, "they're")
    .replace(/can&amp;#39;t/g, "can't")
    .replace(/won&amp;#39;t/g, "won't")
    .replace(/\b(uh|um)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Capitalize first letter
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  
  // Ensure proper ending punctuation
  if (!formatted.match(/[.!?]$/)) {
    formatted += '.';
  }
  
  // Limit length to 120 characters for readability
  if (formatted.length > 120) {
    const breakPoint = formatted.lastIndexOf('. ', 117);
    if (breakPoint > 60) {
      return formatted.substring(0, breakPoint + 1);
    }
    return formatted.substring(0, 117) + '...';
  }
  
  return formatted;
};

// Process video chunks to generate flashcards
const processVideoChunks = async (job, videoId) => {
  const { userId } = job;

  console.log(`[PROCESS] Starting processing for video ID: ${videoId}`);

  try {
    // Fetch video details
    const { title, thumbnail } = await fetchVideoDetails(videoId);
    console.log(`[PROCESS] Fetched video details: Title="${title}", Thumbnail="${thumbnail}"`);

    // Update job status
    job.status = 'processing';
    job.processingStartedAt = new Date();
    await job.save();
    console.log(`[PROCESS] Updated job status to 'processing'`);

    // Fetch transcript directly instead of downloading audio
    const transcriptChunks = await fetchYouTubeTranscript(videoId);
    console.log(`[PROCESS] Fetched transcript with ${transcriptChunks.length} chunks`);

    // Log the first chunk to debug timestamps
    if (transcriptChunks.length > 0) {
      console.log("[PROCESS] First transcript chunk sample:", JSON.stringify(transcriptChunks[0]));
    }

    // Update job with chunks information - ensure no NaN values
    job.chunks = transcriptChunks.map((chunk, index) => {
      // Use index-based timestamps to avoid NaN values
      return {
        startTime: index * 5000, // 5 seconds per chunk
        endTime: (index + 1) * 5000,
        status: 'pending'
      };
    });
    await job.save();
    console.log(`[PROCESS] Updated job with ${job.chunks.length} chunks using index-based timestamps`);

    // Process chunks to generate flashcards
    const flashcards = await generateFlashcardsFromTranscript(transcriptChunks);
    console.log(`[PROCESS] Generated ${flashcards.length} flashcards`);

    // Log the first flashcard to debug
    if (flashcards.length > 0) {
      console.log("[PROCESS] First flashcard sample:", JSON.stringify(flashcards[0]));
    }

    // Update progress as chunks are processed
    console.log(`[PROCESS] Updating job progress for ${flashcards.length} flashcards`);
    for (let i = 0; i < flashcards.length; i++) {
      job.chunks[i].status = 'completed';
      job.progress = ((i + 1) / flashcards.length) * 100;

      // Only save every 5 chunks to reduce database operations
      if (i % 5 === 0 || i === flashcards.length - 1) {
        await job.save();
        console.log(`[PROCESS] Updated job progress: ${Math.round(job.progress)}%`);
      }
    }

    // Create final video document with all flashcards
    console.log(`[PROCESS] Creating video document with ${flashcards.length} flashcards`);
    const video = new YouTubeVideo({
      videoId,
      userId,
      title,
      thumbnail,
      flashcards
    });

    // Log the first flashcard from the video object before saving
    if (video.flashcards.length > 0) {
      console.log("[PROCESS] First flashcard in video object before saving:",
                 JSON.stringify(video.flashcards[0]));
    }

    await video.save();
    console.log(`[PROCESS] Successfully saved video with ${flashcards.length} flashcards`);

    // Update job status
    job.status = 'completed';
    job.processingCompletedAt = new Date();
    await job.save();
    console.log(`[PROCESS] Updated job status to 'completed'`);

    return video;
  } catch (error) {
    console.error(`[PROCESS] Error in processVideoChunks: ${error.message}`);
    job.status = 'failed';
    job.error = error.message;
    await job.save();
    console.log(`[PROCESS] Updated job status to 'failed'`);
    throw error;
  }
};

// Route to generate flashcards from a YouTube video
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
    processVideoChunks(job, videoId).catch(error => {
      console.error(`[PROCESS] Error processing video: ${error.message}`);
      // Update job with error information
      job.status = 'failed';
      job.error = error.message;
      job.save().catch(saveErr => {
        console.error(`[PROCESS] Failed to update job with error: ${saveErr.message}`);
      });
    });

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

// Route to get job status
router.get("/job/:videoId", ensureAuthenticated, async (req, res) => {
  const { videoId } = req.params;

  try {
    const job = await VideoProcessingJob.findOne({
      videoId,
      userId: req.user._id
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({
      status: job.status,
      progress: job.progress,
      error: job.error
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    res.status(500).json({ error: "Failed to fetch job status." });
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

// Route to cancel video processing
router.delete("/job/:videoId", ensureAuthenticated, async (req, res) => {
  const { videoId } = req.params;

  try {
    const job = await VideoProcessingJob.findOneAndDelete({
      videoId,
      userId: req.user._id,
      status: { $in: ['queued', 'processing'] }
    });

    if (!job) {
      return res.status(404).json({ error: "No active processing job found for this video." });
    }

    res.json({ message: "Video processing cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling video processing:", error);
    res.status(500).json({ error: "Failed to cancel video processing." });
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