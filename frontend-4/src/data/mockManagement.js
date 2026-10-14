export const mockMedicinesData = [
  { id: 'med-cetirizine', name: 'Cetirizine', strength: '10 mg', frequency: 'Once daily', timing: 'After dinner', startDate: '2026-10-01', endDate: '', status: 'current', notes: 'Demo entry — confirm every medicine with a healthcare professional.' },
  { id: 'med-vitamin-d3', name: 'Vitamin D3', strength: '60,000 IU', frequency: 'Once weekly', timing: 'Sunday morning', startDate: '2026-09-20', endDate: '', status: 'current', notes: 'Sample schedule only; not a prescription.' },
  { id: 'med-paracetamol', name: 'Paracetamol', strength: '500 mg', frequency: 'As needed', timing: 'As directed by clinician', startDate: '2026-08-10', endDate: '', status: 'past', notes: 'Archived demo medicine.' },
]

export const mockAppointmentsData = [
  { id: 'appt-mehta', doctorName: 'Dr. Ananya Mehta', specialty: 'General Physician', date: '2026-10-20', time: '10:30', location: 'Apollo Hospital, Guntur', visitType: 'In person', status: 'scheduled', notes: 'Discuss recent blood test report.' },
  { id: 'appt-rajesh', doctorName: 'Dr. Rajesh Kumar', specialty: 'Dermatologist', date: '2026-11-05', time: '11:00', location: 'Care Hospitals', visitType: 'In person', status: 'scheduled', notes: '' },
  { id: 'appt-iyer', doctorName: 'Dr. Karthik Iyer', specialty: 'Neurologist', date: '2026-09-28', time: '09:30', location: 'City Specialty Clinic', visitType: 'In person', status: 'completed', notes: '' },
]

export const mockRemindersData = [
  { id: 'rem-medicine', title: 'Review medicine schedule', category: 'medicine', date: '2026-10-13', time: '09:00', repeat: 'Daily', enabled: true, completed: false, notes: 'Demo reminder only; no system notification is sent.' },
  { id: 'rem-followup', title: 'Prepare questions for doctor', category: 'appointment', date: '2026-10-19', time: '18:00', repeat: 'Does not repeat', enabled: true, completed: false, notes: 'Bring relevant reports to the appointment.' },
  { id: 'rem-lab', title: 'Review latest lab report', category: 'report', date: '2026-10-08', time: '10:00', repeat: 'Does not repeat', enabled: false, completed: true, notes: '' },
]
