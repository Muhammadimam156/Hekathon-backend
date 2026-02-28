const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const DiagnosisLog = require('../models/DiagnosisLog');
const { protect, authorize } = require('../middleware/auth');

// @GET /api/analytics/admin - Admin dashboard stats
router.get('/admin', protect, authorize('admin'), async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalPatients, totalDoctors, totalReceptionists,
      totalAppointments, monthlyAppointments, lastMonthAppointments,
      totalPrescriptions, pendingAppointments, completedAppointments,
      appointmentsByStatus, appointmentsByMonth, newPatientsThisMonth
    ] = await Promise.all([
      Patient.countDocuments(),
      User.countDocuments({ role: 'doctor', isActive: true }),
      User.countDocuments({ role: 'receptionist', isActive: true }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ date: { $gte: startOfMonth } }),
      Appointment.countDocuments({ date: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      Prescription.countDocuments(),
      Appointment.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ status: 'completed' }),
      Appointment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        {
          $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      Patient.countDocuments({ createdAt: { $gte: startOfMonth } })
    ]);

    const monthlyGrowth = lastMonthAppointments > 0
      ? (((monthlyAppointments - lastMonthAppointments) / lastMonthAppointments) * 100).toFixed(1)
      : 0;

    // Most common diagnoses
    const commonDiagnoses = await Prescription.aggregate([
      { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Doctor performance
    const doctorPerformance = await Appointment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$doctorId', completedAppointments: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctor' } },
      { $unwind: '$doctor' },
      { $project: { name: '$doctor.name', specialization: '$doctor.specialization', completedAppointments: 1 } },
      { $sort: { completedAppointments: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      stats: {
        totalPatients, totalDoctors, totalReceptionists,
        totalAppointments, monthlyAppointments, totalPrescriptions,
        pendingAppointments, completedAppointments,
        newPatientsThisMonth, monthlyGrowth
      },
      charts: {
        appointmentsByStatus,
        appointmentsByMonth: appointmentsByMonth.map(item => ({
          month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          count: item.count
        })),
        commonDiagnoses: commonDiagnoses.map(d => ({ diagnosis: d._id || 'Unknown', count: d.count })),
        doctorPerformance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/analytics/doctor - Doctor personal stats
router.get('/doctor', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctorId = req.user.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalAppointments, monthlyAppointments, todayAppointments,
      completedAppointments, totalPrescriptions, pendingAppointments,
      appointmentsByStatus, appointmentsByMonth
    ] = await Promise.all([
      Appointment.countDocuments({ doctorId }),
      Appointment.countDocuments({ doctorId, date: { $gte: startOfMonth } }),
      Appointment.countDocuments({ doctorId, date: { $gte: today, $lt: tomorrow } }),
      Appointment.countDocuments({ doctorId, status: 'completed' }),
      Prescription.countDocuments({ doctorId }),
      Appointment.countDocuments({ doctorId, status: 'pending' }),
      Appointment.aggregate([
        { $match: { doctorId: require('mongoose').Types.ObjectId.createFromHexString(doctorId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $match: { doctorId: require('mongoose').Types.ObjectId.createFromHexString(doctorId) } },
        {
          $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 6 }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        totalAppointments, monthlyAppointments, todayAppointments,
        completedAppointments, totalPrescriptions, pendingAppointments
      },
      charts: {
        appointmentsByStatus,
        appointmentsByMonth: appointmentsByMonth.map(item => ({
          month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          count: item.count
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
