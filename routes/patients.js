const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const DiagnosisLog = require('../models/DiagnosisLog');
const { protect, authorize } = require('../middleware/auth');

// @GET /api/patients/me - Get logged-in patient's own record
router.get('/me', protect, async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user.id });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found. Please ask reception to register your profile.' });
    }
    res.json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/patients
router.get('/', protect, async (req, res) => {
  try {
    const { search, page = 1, limit = 10, gender } = req.query;
    const query = {};
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { contact: { $regex: search, $options: 'i' } }
    ];
    if (gender) query.gender = gender;
    const patients = await Patient.find(query)
      .populate('createdBy', 'name role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    const total = await Patient.countDocuments(query);
    res.json({ success: true, patients, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/patients/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('createdBy', 'name');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });
    res.json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/patients/:id/history
router.get('/:id/history', protect, async (req, res) => {
  try {
    const [appointments, prescriptions, diagnosisLogs] = await Promise.all([
      Appointment.find({ patientId: req.params.id })
        .populate('doctorId', 'name specialization')
        .sort({ date: -1 }),
      Prescription.find({ patientId: req.params.id })
        .populate('doctorId', 'name specialization')
        .sort({ createdAt: -1 }),
      DiagnosisLog.find({ patientId: req.params.id })
        .populate('doctorId', 'name')
        .sort({ createdAt: -1 })
    ]);
    res.json({ success: true, appointments, prescriptions, diagnosisLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @POST /api/patients
router.post('/', protect, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
  try {
    const { userEmail, ...patientFields } = req.body;
    const patientData = { ...patientFields, createdBy: req.user.id };

    // Optionally link to an existing user account by email
    if (userEmail) {
      const User = require('../models/User');
      const linkedUser = await User.findOne({ email: userEmail, role: 'patient' });
      if (linkedUser) {
        patientData.userId = linkedUser._id;
      }
    }

    const patient = await Patient.create(patientData);
    res.status(201).json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @PUT /api/patients/:id
router.put('/:id', protect, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });
    res.json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @DELETE /api/patients/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });
    res.json({ success: true, message: 'Patient deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
