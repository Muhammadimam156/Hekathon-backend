const express = require('express');
const router = express.Router();
const DiagnosisLog = require('../models/DiagnosisLog');
const { protect, authorize } = require('../middleware/auth');

// @GET /api/diagnosis
router.get('/', protect, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { patientId, riskLevel, page = 1, limit = 10 } = req.query;
    const query = {};
    if (req.user.role === 'doctor') query.doctorId = req.user.id;
    if (patientId) query.patientId = patientId;
    if (riskLevel) query.riskLevel = riskLevel;

    const logs = await DiagnosisLog.find(query)
      .populate('patientId', 'name age gender')
      .populate('doctorId', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    const total = await DiagnosisLog.countDocuments(query);
    res.json({ success: true, logs, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @POST /api/diagnosis
router.post('/', protect, authorize('doctor'), async (req, res) => {
  try {
    const logData = { ...req.body, doctorId: req.user.id };
    if (logData.aiResponse) {
      logData.riskLevel = logData.aiResponse.riskLevel || 'low';
      logData.isRiskFlagged = ['high', 'critical'].includes(logData.riskLevel);
    }
    const log = await DiagnosisLog.create(logData);
    await log.populate([
      { path: 'patientId', select: 'name age gender' },
      { path: 'doctorId', select: 'name' }
    ]);
    res.status(201).json({ success: true, log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @PUT /api/diagnosis/:id
router.put('/:id', protect, authorize('doctor'), async (req, res) => {
  try {
    const log = await DiagnosisLog.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.user.id },
      req.body,
      { new: true }
    );
    if (!log) return res.status(404).json({ success: false, message: 'Diagnosis log not found.' });
    res.json({ success: true, log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/diagnosis/flagged
router.get('/flagged', protect, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const query = { isRiskFlagged: true };
    if (req.user.role === 'doctor') query.doctorId = req.user.id;
    const logs = await DiagnosisLog.find(query)
      .populate('patientId', 'name age gender contact')
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
