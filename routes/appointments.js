const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { protect, authorize } = require('../middleware/auth');

// @GET /api/appointments
router.get('/', protect, async (req, res) => {
  try {
    const { doctorId, patientId, status, date, page = 1, limit = 20 } = req.query;
    const query = {};
    if (req.user.role === 'doctor') query.doctorId = req.user.id;
    else if (doctorId) query.doctorId = doctorId;
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      query.date = { $gte: start, $lt: end };
    }
    const appointments = await Appointment.find(query)
      .populate('patientId', 'name age gender contact')
      .populate('doctorId', 'name specialization')
      .populate('bookedBy', 'name role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: 1 });
    const total = await Appointment.countDocuments(query);
    res.json({ success: true, appointments, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/appointments/today
router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const query = { date: { $gte: today, $lt: tomorrow } };
    if (req.user.role === 'doctor') query.doctorId = req.user.id;
    const appointments = await Appointment.find(query)
      .populate('patientId', 'name age gender contact')
      .populate('doctorId', 'name specialization')
      .sort({ timeSlot: 1 });
    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/appointments/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name age gender contact allergies chronicConditions')
      .populate('doctorId', 'name specialization')
      .populate('bookedBy', 'name role');
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @POST /api/appointments
router.post('/', protect, authorize('admin', 'receptionist', 'doctor', 'patient'), async (req, res) => {
  try {
    const appointmentData = { ...req.body, bookedBy: req.user.id };
    // Check for conflicts
    const conflict = await Appointment.findOne({
      doctorId: req.body.doctorId,
      date: new Date(req.body.date),
      timeSlot: req.body.timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (conflict) {
      return res.status(400).json({ success: false, message: 'This time slot is already booked for the doctor.' });
    }
    const appointment = await Appointment.create(appointmentData);
    await appointment.populate([
      { path: 'patientId', select: 'name age gender' },
      { path: 'doctorId', select: 'name specialization' }
    ]);
    res.status(201).json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @PUT /api/appointments/:id/status
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('patientId', 'name').populate('doctorId', 'name');
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @PUT /api/appointments/:id
router.put('/:id', protect, authorize('admin', 'receptionist', 'doctor'), async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @DELETE /api/appointments/:id
router.delete('/:id', protect, authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, message: 'Appointment cancelled.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
