const mongoose = require("mongoose");

const VideoProcessingJobSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["queued", "processing", "completed", "failed"],
    default: "queued"
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  error: { type: String, default: null },
  attempts: { type: Number, default: 0 },
  processingStartedAt: Date,
  processingCompletedAt: Date,
  chunks: [{
    startTime: Number,
    endTime: Number,
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending"
    },
    transcription: String
  }]
}, { timestamps: true });

// Index for efficient querying of jobs by status and creation date
VideoProcessingJobSchema.index({ status: 1, createdAt: 1 });

// Index for finding jobs by videoId and userId
VideoProcessingJobSchema.index({ videoId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("VideoProcessingJob", VideoProcessingJobSchema);