const { results } = require('../data/mockData');

const getResults = (req, res) => {
  const { studentId, class: cls, exam } = req.query;
  let filtered = [...results];
  if (studentId) filtered = filtered.filter((r) => r.studentId === studentId);
  if (cls) filtered = filtered.filter((r) => r.class === cls);
  if (exam) filtered = filtered.filter((r) => r.exam.toLowerCase().includes(exam.toLowerCase()));
  res.json({ success: true, data: filtered, total: filtered.length });
};

const getResultById = (req, res) => {
  const result = results.find((r) => r.id === req.params.id);
  if (!result) return res.status(404).json({ success: false, message: 'Result not found' });
  res.json({ success: true, data: result });
};

const createResult = (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const newResult = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
  results.push(newResult);
  res.status(201).json({ success: true, message: 'Result added successfully', data: newResult });
};

module.exports = { getResults, getResultById, createResult };
