const express = require('express');
const router = express.Router();
const { protect, authorize, checkSubscription } = require('../middleware/auth');

let genAI = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'AIzaSyB3dKbPMhjfe2BIgjPSDt_JPNBjx25Yf5E') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
} catch (e) {
  console.log('Gemini AI not configured. AI features will use fallback responses.');
}

const getAIModel = () => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

const AIFallbackResponse = {
  symptomChecker: (symptoms) => ({
    possibleConditions: ['Please consult with a doctor for accurate diagnosis'],
    riskLevel: 'medium',
    suggestedTests: ['Complete Blood Count (CBC)', 'Blood Pressure Check'],
    explanation: `Based on symptoms: ${symptoms.join(', ')}. Please consult a healthcare professional for proper diagnosis.`,
    urgency: 'Schedule an appointment with your doctor.'
  }),
  prescriptionExplanation: (diagnosis, medicines) => ({
    explanation: `Your doctor has diagnosed you with ${diagnosis}. The prescribed medications are designed to treat your condition.`,
    lifestyleAdvice: ['Rest adequately', 'Stay hydrated', 'Follow prescribed medication schedule', 'Maintain a balanced diet'],
    preventiveAdvice: 'Follow your doctor\'s instructions and attend follow-up appointments.',
    urduExplanation: `آپ کے ڈاکٹر نے آپ کو ${diagnosis} تشخیص کیا ہے۔ تجویز کردہ دوائیں آپ کی حالت کے علاج کے لیے ہیں۔`
  })
};

// @POST /api/ai/symptom-checker
router.post('/symptom-checker', protect, authorize('doctor'), async (req, res) => {
  try {
    const { symptoms, age, gender, history, patientId } = req.body;
    if (!symptoms || symptoms.length === 0) {
      return res.status(400).json({ success: false, message: 'Symptoms are required.' });
    }

    const model = getAIModel();
    if (!model) {
      return res.json({ success: true, data: AIFallbackResponse.symptomChecker(symptoms), isFallback: true });
    }

    const prompt = `You are a medical AI assistant helping a doctor. Analyze these symptoms and provide a structured medical analysis.

Patient Details:
- Age: ${age || 'Unknown'}
- Gender: ${gender || 'Unknown'}
- Medical History: ${history || 'No history provided'}
- Current Symptoms: ${symptoms.join(', ')}

Please provide a JSON response with this exact structure:
{
  "possibleConditions": ["condition1", "condition2", "condition3"],
  "riskLevel": "low|medium|high|critical",
  "suggestedTests": ["test1", "test2"],
  "explanation": "Brief medical explanation",
  "urgency": "Urgency message for the doctor",
  "differentialDiagnosis": ["diagnosis1", "diagnosis2"],
  "redFlags": ["flag1", "flag2"]
}

Important: This is for doctor assistance only, not direct patient advice.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsedResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = AIFallbackResponse.symptomChecker(symptoms);
      }
    } catch {
      parsedResponse = AIFallbackResponse.symptomChecker(symptoms);
    }

    res.json({ success: true, data: parsedResponse, isFallback: false });
  } catch (error) {
    console.error('AI Error:', error.message);
    res.json({ success: true, data: AIFallbackResponse.symptomChecker(req.body.symptoms || []), isFallback: true });
  }
});

// @POST /api/ai/prescription-explanation
router.post('/prescription-explanation', protect, async (req, res) => {
  try {
    const { diagnosis, medicines, patientAge, patientGender, urdu } = req.body;

    const model = getAIModel();
    if (!model) {
      return res.json({
        success: true,
        data: AIFallbackResponse.prescriptionExplanation(diagnosis, medicines),
        isFallback: true
      });
    }

    const medicineList = medicines.map(m => `${m.name} (${m.dosage}, ${m.frequency}, ${m.duration})`).join(', ');
    const prompt = `You are a medical AI explaining a prescription to a patient in simple language.

Patient: ${patientAge || 'Unknown'} years old, ${patientGender || 'Unknown'}
Diagnosis: ${diagnosis}
Prescribed Medicines: ${medicineList}

Provide a JSON response with:
{
  "explanation": "Simple explanation of the diagnosis and why these medicines were prescribed (2-3 sentences)",
  "lifestyleAdvice": ["advice1", "advice2", "advice3", "advice4"],
  "preventiveAdvice": "Preventive measures to reduce recurrence",
  "sideEffects": ["common side effect1", "common side effect2"],
  "importantNotes": "Important medication notes",
  ${urdu ? '"urduExplanation": "Same explanation in Urdu language",' : ''}
  "followUpAdvice": "When to seek immediate medical attention"
}

Keep it simple and patient-friendly.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsedResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = AIFallbackResponse.prescriptionExplanation(diagnosis, medicines);
      }
    } catch {
      parsedResponse = AIFallbackResponse.prescriptionExplanation(diagnosis, medicines);
    }

    res.json({ success: true, data: parsedResponse, isFallback: false });
  } catch (error) {
    console.error('AI Error:', error.message);
    res.json({
      success: true,
      data: AIFallbackResponse.prescriptionExplanation(req.body.diagnosis, req.body.medicines || []),
      isFallback: true
    });
  }
});

// @POST /api/ai/risk-flag
router.post('/risk-flag', protect, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const { patientHistory, currentSymptoms, diagnosis } = req.body;
    
    const model = getAIModel();
    if (!model) {
      return res.json({
        success: true,
        data: { isRiskFlagged: false, riskFactors: [], recommendation: 'Manual review recommended.' },
        isFallback: true
      });
    }

    const prompt = `Analyze this patient's medical history for risk patterns.

Current Symptoms: ${currentSymptoms?.join(', ') || 'N/A'}
Current Diagnosis: ${diagnosis || 'N/A'}
Patient History Summary: ${JSON.stringify(patientHistory || {})}

Identify risk patterns and provide JSON:
{
  "isRiskFlagged": true/false,
  "riskLevel": "low|medium|high|critical",
  "riskFactors": ["factor1", "factor2"],
  "patterns": ["pattern1", "pattern2"],
  "recommendation": "Doctor recommendation",
  "urgentAction": "Required action if critical"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsedResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsedResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { isRiskFlagged: false, riskFactors: [], recommendation: 'Manual review recommended.' };
    } catch {
      parsedResponse = { isRiskFlagged: false, riskFactors: [], recommendation: 'Manual review recommended.' };
    }

    res.json({ success: true, data: parsedResponse, isFallback: false });
  } catch (error) {
    console.error('AI Error:', error.message);
    res.json({ success: true, data: { isRiskFlagged: false, riskFactors: [], recommendation: 'Manual review recommended.' }, isFallback: true });
  }
});

// @POST /api/ai/predictive-analytics
router.post('/predictive-analytics', protect, authorize('admin', 'doctor'), async (req, res) => {
  try {
    const { diagnosisData, appointmentData, timeframe } = req.body;

    const model = getAIModel();
    if (!model) {
      return res.json({
        success: true,
        data: {
          mostCommonDiseases: [],
          patientLoadForecast: 'AI not configured',
          trends: [],
          recommendations: 'Enable AI for predictive analytics'
        },
        isFallback: true
      });
    }

    const prompt = `Analyze this clinic data and provide predictive analytics insights.

Diagnosis Frequency Data: ${JSON.stringify(diagnosisData || [])}
Appointment Trends: ${JSON.stringify(appointmentData || [])}
Timeframe: ${timeframe || 'last 30 days'}

Provide JSON analytics:
{
  "mostCommonDiseases": [{"disease": "name", "count": 0, "percentage": "0%"}],
  "patientLoadForecast": "Forecast description",
  "expectedIncrease": "percentage or description",
  "seasonalPatterns": ["pattern1"],
  "recommendations": ["recommendation1", "recommendation2"],
  "performanceTrends": "Overall clinic performance trend"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsedResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsedResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsedResponse = { mostCommonDiseases: [], patientLoadForecast: 'Unable to analyze.', recommendations: [] };
    }

    res.json({ success: true, data: parsedResponse, isFallback: false });
  } catch (error) {
    console.error('AI Error:', error.message);
    res.json({ success: true, data: { mostCommonDiseases: [], recommendations: ['AI temporarily unavailable'] }, isFallback: true });
  }
});

module.exports = router;
