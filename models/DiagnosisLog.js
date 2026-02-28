const mongoose = require('mongoose');

const diagnosisLogSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symptoms: [String],
  age: Number,
  gender: String,
  history: String,
  aiResponse: {
    possibleConditions: [String],
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    suggestedTests: [String],
    explanation: String,
    urgency: String
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  isRiskFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: String,
  finalDiagnosis: String
}, { timestamps: true });

module.exports = mongoose.model('DiagnosisLog', diagnosisLogSchema);
