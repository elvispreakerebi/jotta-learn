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
  // Added fields for better tracking and management
  priority: { type: Number, default: 1 },
  videoMetadata: {
    duration: Number,
    resolution: String,
    fileSize: Number,
    format: String
  },
  processingConfig: {
    chunkDuration: { type: Number, default: 30 }, // in seconds
    transcriptionModel: { type: String, default: "standard" },
    language: { type: String, default: "en" }
  },
  estimatedCompletionTime: Date,
  lastHeartbeat: Date,
  workerNodeId: String,
  chunks: [{
    startTime: Number,
    endTime: Number,
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending"
    },
    transcription: String,
    // Enhanced chunk data
    confidence: Number,
    speakers: [{
      id: String,
      name: String,
      timespans: [{ start: Number, end: Number }]
    }],
    keywords: [{ word: String, occurrences: Number }],
    processingAttempts: { type: Number, default: 0 }
  }]
}, { timestamps: true });

// Index for efficient querying of jobs by status and creation date
VideoProcessingJobSchema.index({ status: 1, createdAt: 1 });

// Index for finding jobs by videoId and userId
VideoProcessingJobSchema.index({ videoId: 1, userId: 1 }, { unique: true });

// Additional indexes for new query patterns
VideoProcessingJobSchema.index({ status: 1, priority: -1, createdAt: 1 });
VideoProcessingJobSchema.index({ workerNodeId: 1, lastHeartbeat: 1 });

// Virtual for job duration
VideoProcessingJobSchema.virtual('processingDuration').get(function() {
  if (this.processingStartedAt && this.processingCompletedAt) {
    return (this.processingCompletedAt - this.processingStartedAt) / 1000; // duration in seconds
  }
  return null;
});

// Instance methods
VideoProcessingJobSchema.methods.markAsProcessing = function() {
  this.status = "processing";
  this.processingStartedAt = new Date();
  this.lastHeartbeat = new Date();
  return this.save();
};

VideoProcessingJobSchema.methods.updateProgress = function(progressPercentage) {
  this.progress = progressPercentage;
  this.lastHeartbeat = new Date();
  return this.save();
};

VideoProcessingJobSchema.methods.markAsCompleted = function() {
  this.status = "completed";
  this.progress = 100;
  this.processingCompletedAt = new Date();
  return this.save();
};

VideoProcessingJobSchema.methods.markAsFailed = function(errorMessage) {
  this.status = "failed";
  this.error = errorMessage;
  return this.save();
};

// Static methods
VideoProcessingJobSchema.statics.findStalled = function(timeThresholdMinutes = 10) {
  const thresholdDate = new Date(Date.now() - timeThresholdMinutes * 60 * 1000);
  return this.find({
    status: "processing",
    lastHeartbeat: { $lt: thresholdDate }
  });
};

VideoProcessingJobSchema.statics.findNextBatch = function(batchSize = 10) {
  return this.find({ status: "queued" })
    .sort({ priority: -1, createdAt: 1 })
    .limit(batchSize);
};

module.exports = mongoose.model("VideoProcessingJob", VideoProcessingJobSchema);