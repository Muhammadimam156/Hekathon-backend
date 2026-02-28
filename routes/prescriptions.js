const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const { protect, authorize } = require('../middleware/auth');

// @GET /api/prescriptions
router.get('/', protect, async (req, res) => {
  try {
    const { patientId, doctorId, page = 1, limit = 10 } = req.query;
    const query = {};
    if (req.user.role === 'doctor') query.doctorId = req.user.id;
    else if (doctorId) query.doctorId = doctorId;
    if (patientId) query.patientId = patientId;
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user.id });
      if (patient) query.patientId = patient._id;
    }
    const prescriptions = await Prescription.find(query)
      .populate('patientId', 'name age gender contact')
      .populate('doctorId', 'name specialization')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    const total = await Prescription.countDocuments(query);
    res.json({ success: true, prescriptions, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/prescriptions/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patientId', 'name age gender contact address bloodGroup allergies')
      .populate('doctorId', 'name specialization phone');
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found.' });
    res.json({ success: true, prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @POST /api/prescriptions
router.post('/', protect, authorize('doctor'), async (req, res) => {
  try {
    const prescriptionData = { ...req.body, doctorId: req.user.id };
    const prescription = await Prescription.create(prescriptionData);
    await prescription.populate([
      { path: 'patientId', select: 'name age gender' },
      { path: 'doctorId', select: 'name specialization' }
    ]);
    res.status(201).json({ success: true, prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @PUT /api/prescriptions/:id
router.put('/:id', protect, authorize('doctor'), async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.user.id },
      req.body,
      { new: true }
    ).populate('patientId', 'name age').populate('doctorId', 'name specialization');
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found.' });
    res.json({ success: true, prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @GET /api/prescriptions/:id/pdf
router.get('/:id/pdf', protect, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patientId', 'name age gender contact address bloodGroup allergies')
      .populate('doctorId', 'name specialization phone email');
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found.' });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=prescription_${prescription._id}.pdf`);
    doc.pipe(res);

    // Header
    doc.fillColor('#1a73e8').fontSize(24).font('Helvetica-Bold').text('MediCare Clinic', { align: 'center' });
    doc.fillColor('#666').fontSize(12).font('Helvetica').text('AI-Powered Clinic Management System', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#1a73e8').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Doctor Info
    doc.fillColor('#333').fontSize(14).font('Helvetica-Bold').text('Doctor Information');
    doc.font('Helvetica').fontSize(11).fillColor('#555');
    doc.text(`Name: Dr. ${prescription.doctorId.name}`);
    doc.text(`Specialization: ${prescription.doctorId.specialization || 'General Physician'}`);
    doc.text(`Contact: ${prescription.doctorId.phone || 'N/A'}`);
    doc.moveDown(0.5);

    // Patient Info
    doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(14).font('Helvetica-Bold').text('Patient Information');
    doc.font('Helvetica').fontSize(11).fillColor('#555');
    doc.text(`Name: ${prescription.patientId.name}`);
    doc.text(`Age: ${prescription.patientId.age} years | Gender: ${prescription.patientId.gender}`);
    doc.text(`Contact: ${prescription.patientId.contact}`);
    if (prescription.patientId.bloodGroup) doc.text(`Blood Group: ${prescription.patientId.bloodGroup}`);
    doc.moveDown(0.5);

    // Date
    doc.text(`Date: ${new Date(prescription.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' });
    doc.moveDown(0.5);

    // Diagnosis
    doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(14).font('Helvetica-Bold').text('Diagnosis');
    doc.font('Helvetica').fontSize(11).fillColor('#555').text(prescription.diagnosis);
    doc.moveDown(0.5);

    // Medicines
    doc.fillColor('#333').fontSize(14).font('Helvetica-Bold').text('Prescribed Medicines');
    doc.moveDown(0.3);
    prescription.medicines.forEach((med, i) => {
      doc.fillColor('#1a73e8').fontSize(12).font('Helvetica-Bold').text(`${i + 1}. ${med.name}`);
      doc.font('Helvetica').fontSize(10).fillColor('#555');
      doc.text(`   Dosage: ${med.dosage}  |  Frequency: ${med.frequency}  |  Duration: ${med.duration}`);
      if (med.instructions) doc.text(`   Instructions: ${med.instructions}`);
      doc.moveDown(0.3);
    });

    // Instructions
    if (prescription.instructions) {
      doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fillColor('#333').fontSize(14).font('Helvetica-Bold').text('General Instructions');
      doc.font('Helvetica').fontSize(11).fillColor('#555').text(prescription.instructions);
    }

    // AI Explanation
    if (prescription.aiExplanation) {
      doc.moveDown(0.5);
      doc.strokeColor('#eee').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fillColor('#1a73e8').fontSize(14).font('Helvetica-Bold').text('AI Health Explanation');
      doc.font('Helvetica').fontSize(10).fillColor('#555').text(prescription.aiExplanation);
    }

    // Follow-up
    if (prescription.followUpDate) {
      doc.moveDown(0.5);
      doc.fillColor('#e53935').fontSize(12).font('Helvetica-Bold')
        .text(`Follow-up Date: ${new Date(prescription.followUpDate).toLocaleDateString()}`);
    }

    // Footer
    doc.moveDown(2);
    doc.strokeColor('#1a73e8').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#999').fontSize(9).font('Helvetica')
      .text('This prescription is computer-generated by MediCare AI Clinic Management System.', { align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
