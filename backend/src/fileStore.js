const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function saveUploadedFile(monthId, bank, file) {
  const ext = path.extname(file.originalname) || '.xlsx';
  const savedName = `month_${monthId}_${bank}${ext}`;
  const savedPath = path.join(UPLOADS_DIR, savedName);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(savedPath, file.buffer);
  return savedName;
}

function deleteUploadedFile(filepath) {
  if (!filepath) return;
  try { fs.unlinkSync(path.join(UPLOADS_DIR, filepath)); } catch (_) {}
}

function getUploadPath(filepath) {
  if (!filepath) return null;
  const full = path.join(UPLOADS_DIR, filepath);
  return fs.existsSync(full) ? full : null;
}

module.exports = { saveUploadedFile, deleteUploadedFile, getUploadPath, UPLOADS_DIR };
